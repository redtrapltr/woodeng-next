// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SWL444Token.sol";
import "./DiamondHandGate.sol";

contract SWL444Factory is ReentrancyGuard {

    // ─── Constants ─────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY = 444_000_000 * 1e18;  // 444M tokens
    uint256 public constant BONDING_SUPPLY = 400_000_000 * 1e18;  // 400M sold through bonding (90%)
    uint256 public constant MAX_FIRST_BUY_BPS = 100;  // 1% max first purchase

    // Decaying snipe tax — discourages bots front-running the launch block.
    // Applies to non-creator buys only (see the exemption in _buyBonding);
    // block 3+ (blocksSinceCreation >= 3) pays no snipe tax, normal fees only.
    uint256 public constant SNIPE_TAX_BLOCK_0_BPS = 5000;  // 50% tax on creation block
    uint256 public constant SNIPE_TAX_BLOCK_1_BPS = 2500;  // 25% tax on next block
    uint256 public constant SNIPE_TAX_BLOCK_2_BPS = 1000;  // 10% tax on block after

    // Seed virtual ETH reserve for the bonding curve's starting price. This
    // amount is never actually deposited by anyone — it only exists to bootstrap
    // the constant-product price curve — so it must never be treated as real
    // ETH the contract holds (see realEth in _graduateToUniswap).
    //
    // *** MAINNET VALUE — DO NOT REDEPLOY TESTNET FROM THIS SOURCE STATE ***
    // Sized so the curve raises ~2.2 ETH before BONDING_SUPPLY sells out and
    // the pool graduates straight to Uniswap, with BONDING_SUPPLY now 400M
    // (90% of supply) instead of the old 44M (10%) — selling far more of the
    // supply through the curve for the same graduation raise makes the price
    // multiplier from first buy to graduation ~102x instead of ~1.2x (see
    // the multiplier derivation below), matching pump.fun/Pons-style bonding
    // curves instead of the nearly-flat original one.
    //
    // Since the curve is a constant-product invariant (k = TOTAL_SUPPLY *
    // INIT_VIRTUAL_ETH stays fixed regardless of trade sizes/order), the
    // total net ETH raised by the time bondingSold == BONDING_SUPPLY is
    // exactly:
    //   netEthTotal = INIT_VIRTUAL_ETH * (TOTAL_SUPPLY / (TOTAL_SUPPLY - BONDING_SUPPLY) - 1)
    //               = INIT_VIRTUAL_ETH * (444M/44M - 1) = INIT_VIRTUAL_ETH * (100/11)
    // Grossing up for BUY_FEE_BPS (1%): grossEthTotal = netEthTotal / 0.99.
    // Solving grossEthTotal = 2.2 ether gives INIT_VIRTUAL_ETH = 0.23958 ether.
    //
    // The start->graduation price multiplier depends ONLY on the
    // TOTAL_SUPPLY/BONDING_SUPPLY ratio, not on INIT_VIRTUAL_ETH — plugging
    // netEthTotal above into price = virtualEth/virtualTokens and simplifying
    // shows multiplier = (TOTAL_SUPPLY / (TOTAL_SUPPLY - BONDING_SUPPLY))^2
    // = (444M/44M)^2 ≈ 101.8x. INIT_VIRTUAL_ETH only scales the absolute
    // price/raise, never the multiplier — don't try to tune it independently
    // of BONDING_SUPPLY to hit a different multiplier target.
    //
    // TESTNET value is 0.001089 ether (same ~0.01 ETH raise as before, scaled
    // for the new 400M BONDING_SUPPLY) — see git history / the deployed
    // testnet contract at the address in .env.local for that config.
    // script/Deploy.s.sol (testnet) and script/DeployMainnet.s.sol (mainnet,
    // chain 4663) both compile against this SAME constant because it's a
    // Solidity `constant`, not a constructor argument — if this file is ever
    // recompiled and rebroadcast for testnet, revert this line back to the
    // testnet value FIRST, or testnet will silently get mainnet's 2.2 ETH
    // curve instead of its usual ~0.01 ETH one.
    uint256 public constant INIT_VIRTUAL_ETH = 0.23958 ether;

    // Fee basis points
    uint256 public constant BUY_FEE_BPS = 100;         // 1% total on buys
    uint256 public constant CREATOR_BUY_FEE_BPS = 70;  // 0.7% to creator (70%)
    uint256 public constant STAKER_BUY_FEE_BPS = 30;   // 0.3% to stakers (30%)

    uint256 public constant SELL_PENALTY_BPS = 1000;    // 10% early sell
    uint256 public constant CREATOR_SELL_FEE_BPS = 700; // 7% to creator (70%)
    uint256 public constant STAKER_SELL_FEE_BPS = 300;  // 3% to stakers (30%)

    // ─── Structs ───────────────────────────────────────────────
    // Graduation is automatic and immediate: once bonding sells out,
    // liquidity migrates straight to Uniswap in the same transaction (no
    // intermediate internal-AMM phase, unlike the old flip-then-graduate flow).
    enum PoolPhase { Bonding, Graduated }

    struct Pool {
        address token;             // SWL444Token address
        address creator;           // creator wallet
        address feeRecipient;      // receives creator fees — defaults to creator
        PoolPhase phase;

        // Bonding curve state
        uint256 virtualTokens;     // virtual token reserve
        uint256 virtualEth;        // virtual ETH reserve
        uint256 bondingSold;       // tokens sold through bonding
        uint256 targetPrice;       // graduation target price

        // Diamond Hand Gate
        uint256 minAvgHoldDays;    // 0 = open to all

        // Graduation
        address uniswapPair;       // set after graduation
        bool liquidityLocked;      // permanently locked LP

        // Metadata
        string metadataUri;
        uint256 createdAt;
        uint256 creationBlock;     // block.number at creation — snipe-tax window
    }

    // ─── State ─────────────────────────────────────────────────
    mapping(address => Pool) public pools;           // token address => Pool
    address[] public allPools;

    address public feeCollector;                      // receives staker fees
    address public authority;                          // admin
    DiamondHandGate public diamondGate;

    address public uniswapRouter;                     // Uniswap V2 router on RH chain
    address public uniswapFactory;                    // Uniswap V2 factory on RH chain

    // ─── Events ────────────────────────────────────────────────
    event TokenCreated(address indexed token, address indexed creator, string name, string symbol);
    event Buy(address indexed token, address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 newPrice);
    event Sell(address indexed token, address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 newPrice);
    event PhaseChanged(address indexed token, PoolPhase newPhase);
    event Graduated(address indexed token, address uniswapPair);
    event PriceUpdate(address indexed token, uint256 price, uint256 timestamp);

    constructor(
        address _feeCollector,
        address _uniswapRouter,
        address _uniswapFactory,
        address _diamondGate
    ) {
        authority = msg.sender;
        feeCollector = _feeCollector;
        uniswapRouter = _uniswapRouter;
        uniswapFactory = _uniswapFactory;
        diamondGate = DiamondHandGate(_diamondGate);
    }

    // ─── Create Token ──────────────────────────────────────────
    function createToken(
        string memory name,
        string memory symbol,
        string memory metadataUri,
        uint256 minAvgHoldDays,
        uint256 initialBuyEth,      // ETH to spend on first buy (0 = none)
        address feeRecipient        // where creator fees are paid — address(0) defaults to msg.sender
    ) external payable nonReentrant returns (address) {
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Name 1-32 chars");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Symbol 1-10 chars");

        // Deploy token
        SWL444Token token = new SWL444Token(name, symbol, metadataUri, msg.sender, 18);
        address tokenAddr = address(token);
        address actualFeeRecipient = feeRecipient == address(0) ? msg.sender : feeRecipient;

        // Initialize bonding curve
        // Constant-product curve: price = virtualEth / virtualTokens
        // Starting price ~8.1e-8 ETH per token; see INIT_VIRTUAL_ETH for the
        // ~4 ETH graduation-target derivation.
        uint256 initVirtualTokens = TOTAL_SUPPLY;  // full supply as virtual
        uint256 initVirtualEth = INIT_VIRTUAL_ETH; // phantom, not real ETH

        pools[tokenAddr] = Pool({
            token: tokenAddr,
            creator: msg.sender,
            feeRecipient: actualFeeRecipient,
            phase: PoolPhase.Bonding,
            virtualTokens: initVirtualTokens,
            virtualEth: initVirtualEth,
            bondingSold: 0,
            targetPrice: 0.0000001 ether,  // graduation target price (~1e-7 ETH/token)
            minAvgHoldDays: minAvgHoldDays,
            uniswapPair: address(0),
            liquidityLocked: false,
            metadataUri: metadataUri,
            createdAt: block.timestamp,
            creationBlock: block.number
        });

        allPools.push(tokenAddr);
        emit TokenCreated(tokenAddr, msg.sender, name, symbol);

        // Optional: creator first buy
        if (initialBuyEth > 0 && msg.value >= initialBuyEth) {
            _buyBonding(tokenAddr, msg.sender, initialBuyEth);
            // Refund excess
            if (msg.value > initialBuyEth) {
                payable(msg.sender).transfer(msg.value - initialBuyEth);
            }
        }

        return tokenAddr;
    }

    // ─── Buy ───────────────────────────────────────────────────
    function buy(address token) external payable nonReentrant {
        Pool storage pool = pools[token];
        require(pool.token != address(0), "Pool not found");
        require(msg.value > 0, "Send ETH");
        require(pool.phase == PoolPhase.Bonding, "Graduated - trade on Uniswap");

        // Diamond Hand Gate check
        if (pool.minAvgHoldDays > 0) {
            uint256 holderAvgDays = diamondGate.getAvgHoldDays(msg.sender);
            require(holderAvgDays >= pool.minAvgHoldDays, "Diamond hand gate: hold longer");
        }
        _buyBonding(token, msg.sender, msg.value);
    }

    function _buyBonding(address token, address buyer, uint256 ethIn) internal {
        Pool storage pool = pools[token];

        // Decaying snipe tax — taken off the top before normal fees, so a
        // sniper in blocks 0-2 pays this on top of (not instead of) the
        // usual creator/staker cut. Exempt for the creator's own first buy
        // (bondingSold still 0) — that's a legitimate part of launching, not
        // a snipe, and is already separately capped by MAX_FIRST_BUY_BPS.
        // Sent alongside the other fee transfers further down rather than
        // here, so every external value transfer in this function happens in
        // one place after all state is finalized.
        uint256 snipeTax = 0;
        bool isCreatorFirstBuy = buyer == pool.creator && pool.bondingSold == 0;
        if (!isCreatorFirstBuy) {
            uint256 blocksSinceCreation = block.number - pool.creationBlock;
            uint256 snipeTaxBps = 0;
            if (blocksSinceCreation == 0) snipeTaxBps = SNIPE_TAX_BLOCK_0_BPS;
            else if (blocksSinceCreation == 1) snipeTaxBps = SNIPE_TAX_BLOCK_1_BPS;
            else if (blocksSinceCreation == 2) snipeTaxBps = SNIPE_TAX_BLOCK_2_BPS;

            if (snipeTaxBps > 0) {
                snipeTax = (ethIn * snipeTaxBps) / 10000;
                ethIn -= snipeTax;
            }
        }

        // Calculate fees (on ethIn net of any snipe tax above)
        uint256 creatorFee = (ethIn * CREATOR_BUY_FEE_BPS) / 10000;
        uint256 stakerFee = (ethIn * STAKER_BUY_FEE_BPS) / 10000;
        uint256 netEth = ethIn - creatorFee - stakerFee;

        // Constant product: tokensOut = virtualTokens - (virtualTokens * virtualEth) / (virtualEth + netEth)
        uint256 tokensOut = (pool.virtualTokens * netEth) / (pool.virtualEth + netEth);

        // First buy cap: 1% of total supply
        if (pool.bondingSold == 0 && buyer == pool.creator) {
            uint256 maxFirst = (TOTAL_SUPPLY * MAX_FIRST_BUY_BPS) / 10000;
            require(tokensOut <= maxFirst, "First buy max 1%");
        }

        require(tokensOut > 0, "Zero output");

        uint256 refund = 0;
        if (pool.bondingSold + tokensOut > BONDING_SUPPLY) {
            // A buy that would overshoot the bonding cap is clamped to
            // exactly the remaining supply (instead of reverting) so the
            // pool always reaches BONDING_SUPPLY exactly and reliably flips
            // to AMM — an exact wei-for-wei hit is not something a market
            // buyer can be expected to land on, and requiring one would let
            // the pool stall forever just under the cap.
            uint256 remaining = BONDING_SUPPLY - pool.bondingSold;

            uint256 netEthExact = (remaining * pool.virtualEth) / (pool.virtualTokens - remaining);
            if (netEthExact == 0) netEthExact = 1;
            uint256 ethInExact = (netEthExact * 10000) / (10000 - BUY_FEE_BPS);
            if (ethInExact == 0) ethInExact = 1;
            if (ethInExact > ethIn) ethInExact = ethIn;

            refund = ethIn - ethInExact;
            ethIn = ethInExact;
            creatorFee = (ethIn * CREATOR_BUY_FEE_BPS) / 10000;
            stakerFee = (ethIn * STAKER_BUY_FEE_BPS) / 10000;
            netEth = ethIn - creatorFee - stakerFee;
            tokensOut = remaining;
        }

        // Update reserves
        pool.virtualEth += netEth;
        pool.virtualTokens -= tokensOut;
        pool.bondingSold += tokensOut;

        // Mint tokens to buyer
        SWL444Token(token).mint(buyer, tokensOut);

        // Update Diamond Hand Gate
        diamondGate.recordBuy(buyer, token, tokensOut);

        if (refund > 0) {
            payable(buyer).transfer(refund);
        }

        // Fees are sent instantly rather than accrued for a later manual
        // claim — .call instead of .transfer so a smart-contract fee wallet
        // (multisig, etc.) isn't broken by the 2300-gas stipend. Safe against
        // reentrancy here despite the external call preceding the reads
        // below: buy()/sell()/createToken() (the only callers of
        // _buyBonding/_sellBonding) are all nonReentrant.
        if (creatorFee > 0) {
            address recipient = pool.feeRecipient != address(0) ? pool.feeRecipient : pool.creator;
            (bool sentCreator, ) = payable(recipient).call{value: creatorFee}("");
            require(sentCreator, "Creator fee transfer failed");
        }
        if (stakerFee > 0) {
            (bool sentStaker, ) = payable(feeCollector).call{value: stakerFee}("");
            require(sentStaker, "Staker fee transfer failed");
        }
        if (snipeTax > 0) {
            (bool sentSnipe, ) = payable(feeCollector).call{value: snipeTax}("");
            require(sentSnipe, "Snipe tax transfer failed");
        }

        // Calculate current price
        uint256 currentPrice = (pool.virtualEth * 1e18) / pool.virtualTokens;
        emit Buy(token, buyer, ethIn, tokensOut, currentPrice);
        emit PriceUpdate(token, currentPrice, block.timestamp);

        // Bonding curve sold out — graduate straight to Uniswap in this same
        // transaction (no intermediate internal-AMM phase).
        if (pool.bondingSold >= BONDING_SUPPLY) {
            _graduateToUniswap(token);
        }
    }

    function _graduateToUniswap(address token) internal {
        Pool storage pool = pools[token];
        pool.phase = PoolPhase.Graduated;

        // Exclude the phantom seed — only real ETH raised during bonding was
        // ever actually held by the contract.
        uint256 realEth = pool.virtualEth - INIT_VIRTUAL_ETH;

        // Mint the remaining supply for Uniswap liquidity
        uint256 liquidityTokens = TOTAL_SUPPLY - pool.bondingSold;
        SWL444Token(token).mint(address(this), liquidityTokens);

        // Approve Uniswap router
        IERC20(token).approve(uniswapRouter, liquidityTokens);

        // Add liquidity — LP tokens sent to dead address (permanently locked)
        IUniswapV2Router(uniswapRouter).addLiquidityETH{value: realEth}(
            token,
            liquidityTokens,
            0,  // slippage tolerance
            0,
            address(0xdead),  // LP tokens burned = liquidity permanently locked
            block.timestamp + 300
        );

        pool.liquidityLocked = true;
        pool.uniswapPair = IUniswapV2Factory(uniswapFactory).getPair(
            token,
            IUniswapV2Router(uniswapRouter).WETH()
        );

        emit Graduated(token, pool.uniswapPair);
        emit PhaseChanged(token, PoolPhase.Graduated);
    }

    // ─── Sell ──────────────────────────────────────────────────
    function sell(address token, uint256 tokenAmount) external nonReentrant {
        Pool storage pool = pools[token];
        require(pool.token != address(0), "Pool not found");
        require(tokenAmount > 0, "Zero amount");
        require(pool.phase == PoolPhase.Bonding, "Graduated - trade on Uniswap");

        _sellBonding(token, msg.sender, tokenAmount);
    }

    function _sellBonding(address token, address seller, uint256 tokenAmount) internal {
        Pool storage pool = pools[token];

        // Calculate ETH out from bonding curve
        uint256 ethOut = (pool.virtualEth * tokenAmount) / (pool.virtualTokens + tokenAmount);

        // Early sell penalty: 10%
        uint256 creatorPenalty = (ethOut * CREATOR_SELL_FEE_BPS) / 10000;
        uint256 stakerPenalty = (ethOut * STAKER_SELL_FEE_BPS) / 10000;
        uint256 netEth = ethOut - creatorPenalty - stakerPenalty;

        pool.virtualEth -= ethOut;
        pool.virtualTokens += tokenAmount;
        pool.bondingSold -= tokenAmount;

        // Burn tokens
        SWL444Token(token).burn(seller, tokenAmount);

        // Update Diamond Hand Gate
        diamondGate.recordSell(seller, token, tokenAmount);

        // Send ETH
        payable(seller).transfer(netEth);

        // Fees sent instantly — see _buyBonding for the .call rationale.
        if (creatorPenalty > 0) {
            address recipient = pool.feeRecipient != address(0) ? pool.feeRecipient : pool.creator;
            (bool sentCreator, ) = payable(recipient).call{value: creatorPenalty}("");
            require(sentCreator, "Creator fee transfer failed");
        }
        if (stakerPenalty > 0) {
            (bool sentStaker, ) = payable(feeCollector).call{value: stakerPenalty}("");
            require(sentStaker, "Staker fee transfer failed");
        }

        uint256 currentPrice = (pool.virtualEth * 1e18) / pool.virtualTokens;
        emit Sell(token, seller, tokenAmount, netEth, currentPrice);
        emit PriceUpdate(token, currentPrice, block.timestamp);
    }

    // ─── View Functions ────────────────────────────────────────
    function getPool(address token) external view returns (Pool memory) {
        return pools[token];
    }

    function getPoolCount() external view returns (uint256) {
        return allPools.length;
    }

    function getCurrentPrice(address token) external view returns (uint256) {
        Pool storage pool = pools[token];
        if (pool.phase == PoolPhase.Bonding) {
            return (pool.virtualEth * 1e18) / pool.virtualTokens;
        }
        return 0; // graduated - check Uniswap
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

    // ─── Admin ─────────────────────────────────────────────────
    function setFeeCollector(address _new) external {
        require(msg.sender == authority, "Not authority");
        feeCollector = _new;
    }

    function setAuthority(address _new) external {
        require(msg.sender == authority, "Not authority");
        authority = _new;
    }

    receive() external payable {}
}

// ─── Interfaces ────────────────────────────────────────────────
interface IUniswapV2Router {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function WETH() external pure returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}
