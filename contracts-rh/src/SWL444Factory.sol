// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SWL444Token.sol";
import "./DiamondHandGate.sol";

contract SWL444Factory is ReentrancyGuard {

    // ─── Constants ─────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY = 444_000_000 * 1e18;  // 444M tokens
    uint256 public constant BONDING_SUPPLY = 44_000_000 * 1e18;  // 44M sold through bonding
    uint256 public constant MAX_FIRST_BUY_BPS = 100;  // 1% max first purchase

    // Seed virtual ETH reserve for the bonding curve's starting price. This
    // amount is never actually deposited by anyone — it only exists to bootstrap
    // the constant-product price curve — so it must never be treated as real
    // ETH the contract holds (see ammEthReserve in _flipToAmm).
    uint256 public constant INIT_VIRTUAL_ETH = 0.001 ether;

    // Fee basis points
    uint256 public constant BUY_FEE_BPS = 150;        // 1.5% on buys
    uint256 public constant CREATOR_BUY_FEE_BPS = 50;  // 0.5% to creator
    uint256 public constant STAKER_BUY_FEE_BPS = 100;  // 1% to fee pool

    uint256 public constant SELL_PENALTY_BPS = 1000;   // 10% early sell
    uint256 public constant CREATOR_SELL_FEE_BPS = 600; // 6% to creator
    uint256 public constant STAKER_SELL_FEE_BPS = 400;  // 4% to fee pool

    uint256 public constant AMM_FEE_BPS = 30;          // 0.3% AMM swap fee
    uint256 public constant CREATOR_AMM_FEE_BPS = 20;   // 0.2% to creator
    uint256 public constant STAKER_AMM_FEE_BPS = 10;    // 0.1% to fee pool

    // ─── Structs ───────────────────────────────────────────────
    enum PoolPhase { Bonding, AMM, Graduated }

    struct Pool {
        address token;             // SWL444Token address
        address creator;           // creator wallet
        PoolPhase phase;

        // Bonding curve state
        uint256 virtualTokens;     // virtual token reserve
        uint256 virtualEth;        // virtual ETH reserve
        uint256 bondingSold;       // tokens sold through bonding
        uint256 targetPrice;       // graduation target price

        // AMM state (after flip)
        uint256 ammTokenReserve;
        uint256 ammEthReserve;

        // Diamond Hand Gate
        uint256 minAvgHoldDays;    // 0 = open to all

        // Graduation
        address uniswapPair;       // set after graduation
        bool liquidityLocked;      // permanently locked LP

        // Metadata
        string metadataUri;
        uint256 createdAt;

        // Fees collected
        uint256 creatorFeesAccrued;
        uint256 stakerFeesAccrued;
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
        uint256 initialBuyEth       // ETH to spend on first buy (0 = none)
    ) external payable nonReentrant returns (address) {
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Name 1-32 chars");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Symbol 1-10 chars");

        // Deploy token
        SWL444Token token = new SWL444Token(name, symbol, metadataUri, msg.sender, 18);
        address tokenAddr = address(token);

        // Initialize bonding curve
        // Exponential curve: price = virtualEth / virtualTokens
        // Starting price ~0.000000003 ETH per token (adjust as needed)
        uint256 initVirtualTokens = TOTAL_SUPPLY;  // full supply as virtual
        uint256 initVirtualEth = INIT_VIRTUAL_ETH; // small initial virtual ETH (phantom, not real)

        pools[tokenAddr] = Pool({
            token: tokenAddr,
            creator: msg.sender,
            phase: PoolPhase.Bonding,
            virtualTokens: initVirtualTokens,
            virtualEth: initVirtualEth,
            bondingSold: 0,
            targetPrice: 0.000003 ether,  // graduation target
            ammTokenReserve: 0,
            ammEthReserve: 0,
            minAvgHoldDays: minAvgHoldDays,
            uniswapPair: address(0),
            liquidityLocked: false,
            metadataUri: metadataUri,
            createdAt: block.timestamp,
            creatorFeesAccrued: 0,
            stakerFeesAccrued: 0
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

        if (pool.phase == PoolPhase.Bonding) {
            // Diamond Hand Gate check
            if (pool.minAvgHoldDays > 0) {
                uint256 holderAvgDays = diamondGate.getAvgHoldDays(msg.sender);
                require(holderAvgDays >= pool.minAvgHoldDays, "Diamond hand gate: hold longer");
            }
            _buyBonding(token, msg.sender, msg.value);
        } else if (pool.phase == PoolPhase.AMM) {
            _buyAmm(token, msg.sender, msg.value);
        } else {
            revert("Pool graduated - trade on Uniswap");
        }
    }

    function _buyBonding(address token, address buyer, uint256 ethIn) internal {
        Pool storage pool = pools[token];

        // Calculate fees
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

        pool.creatorFeesAccrued += creatorFee;
        pool.stakerFeesAccrued += stakerFee;

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

        // Calculate current price
        uint256 currentPrice = (pool.virtualEth * 1e18) / pool.virtualTokens;
        emit Buy(token, buyer, ethIn, tokensOut, currentPrice);
        emit PriceUpdate(token, currentPrice, block.timestamp);

        // Check if bonding threshold reached -> flip to AMM
        if (pool.bondingSold >= BONDING_SUPPLY) {
            _flipToAmm(token);
        }
    }

    function _flipToAmm(address token) internal {
        Pool storage pool = pools[token];
        pool.phase = PoolPhase.AMM;

        // Mint remaining supply for AMM liquidity
        uint256 ammTokens = TOTAL_SUPPLY - pool.bondingSold;
        SWL444Token(token).mint(address(this), ammTokens);

        pool.ammTokenReserve = ammTokens;
        // Exclude the phantom seed — only real ETH raised during bonding backs
        // the AMM reserve, since that's all the contract actually holds.
        pool.ammEthReserve = pool.virtualEth - INIT_VIRTUAL_ETH;

        emit PhaseChanged(token, PoolPhase.AMM);
    }

    function _buyAmm(address token, address buyer, uint256 ethIn) internal {
        Pool storage pool = pools[token];

        uint256 creatorFee = (ethIn * CREATOR_AMM_FEE_BPS) / 10000;
        uint256 stakerFee = (ethIn * STAKER_AMM_FEE_BPS) / 10000;
        uint256 netEth = ethIn - creatorFee - stakerFee;

        pool.creatorFeesAccrued += creatorFee;
        pool.stakerFeesAccrued += stakerFee;

        // XYK: tokensOut = reserve * netEth / (reserveEth + netEth)
        uint256 tokensOut = (pool.ammTokenReserve * netEth) / (pool.ammEthReserve + netEth);
        require(tokensOut > 0, "Zero output");

        pool.ammEthReserve += netEth;
        pool.ammTokenReserve -= tokensOut;

        IERC20(token).transfer(buyer, tokensOut);
        diamondGate.recordBuy(buyer, token, tokensOut);

        uint256 currentPrice = (pool.ammEthReserve * 1e18) / pool.ammTokenReserve;
        emit Buy(token, buyer, ethIn, tokensOut, currentPrice);
        emit PriceUpdate(token, currentPrice, block.timestamp);
    }

    // ─── Sell ──────────────────────────────────────────────────
    function sell(address token, uint256 tokenAmount) external nonReentrant {
        Pool storage pool = pools[token];
        require(pool.token != address(0), "Pool not found");
        require(tokenAmount > 0, "Zero amount");

        if (pool.phase == PoolPhase.Bonding) {
            _sellBonding(token, msg.sender, tokenAmount);
        } else if (pool.phase == PoolPhase.AMM) {
            _sellAmm(token, msg.sender, tokenAmount);
        } else {
            revert("Pool graduated - trade on Uniswap");
        }
    }

    function _sellBonding(address token, address seller, uint256 tokenAmount) internal {
        Pool storage pool = pools[token];

        // Calculate ETH out from bonding curve
        uint256 ethOut = (pool.virtualEth * tokenAmount) / (pool.virtualTokens + tokenAmount);

        // Early sell penalty: 10%
        uint256 creatorPenalty = (ethOut * CREATOR_SELL_FEE_BPS) / 10000;
        uint256 stakerPenalty = (ethOut * STAKER_SELL_FEE_BPS) / 10000;
        uint256 netEth = ethOut - creatorPenalty - stakerPenalty;

        pool.creatorFeesAccrued += creatorPenalty;
        pool.stakerFeesAccrued += stakerPenalty;

        pool.virtualEth -= ethOut;
        pool.virtualTokens += tokenAmount;
        pool.bondingSold -= tokenAmount;

        // Burn tokens
        SWL444Token(token).burn(seller, tokenAmount);

        // Update Diamond Hand Gate
        diamondGate.recordSell(seller, token, tokenAmount);

        // Send ETH
        payable(seller).transfer(netEth);

        uint256 currentPrice = (pool.virtualEth * 1e18) / pool.virtualTokens;
        emit Sell(token, seller, tokenAmount, netEth, currentPrice);
        emit PriceUpdate(token, currentPrice, block.timestamp);
    }

    function _sellAmm(address token, address seller, uint256 tokenAmount) internal {
        Pool storage pool = pools[token];

        uint256 ethOut = (pool.ammEthReserve * tokenAmount) / (pool.ammTokenReserve + tokenAmount);

        uint256 creatorFee = (ethOut * CREATOR_AMM_FEE_BPS) / 10000;
        uint256 stakerFee = (ethOut * STAKER_AMM_FEE_BPS) / 10000;
        uint256 netEth = ethOut - creatorFee - stakerFee;

        pool.creatorFeesAccrued += creatorFee;
        pool.stakerFeesAccrued += stakerFee;

        pool.ammEthReserve -= ethOut;
        pool.ammTokenReserve += tokenAmount;

        // Transfer tokens from seller to pool
        IERC20(token).transferFrom(seller, address(this), tokenAmount);

        diamondGate.recordSell(seller, token, tokenAmount);

        payable(seller).transfer(netEth);

        uint256 currentPrice = (pool.ammEthReserve * 1e18) / pool.ammTokenReserve;
        emit Sell(token, seller, tokenAmount, netEth, currentPrice);
        emit PriceUpdate(token, currentPrice, block.timestamp);
    }

    // ─── Graduation to Uniswap ────────────────────────────────
    function graduate(address token) external nonReentrant {
        Pool storage pool = pools[token];
        require(pool.phase == PoolPhase.AMM, "Not in AMM phase");
        require(msg.sender == authority || msg.sender == pool.creator, "Not authorized");

        pool.phase = PoolPhase.Graduated;

        // Approve Uniswap router
        IERC20(token).approve(uniswapRouter, pool.ammTokenReserve);

        // Add liquidity to Uniswap
        // The LP tokens go to address(0xdead) = permanently locked
        IUniswapV2Router(uniswapRouter).addLiquidityETH{value: pool.ammEthReserve}(
            token,
            pool.ammTokenReserve,
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

    // ─── Fee Claiming ──────────────────────────────────────────
    function claimCreatorFees(address token) external {
        Pool storage pool = pools[token];
        require(msg.sender == pool.creator, "Not creator");
        uint256 amount = pool.creatorFeesAccrued;
        require(amount > 0, "No fees");
        pool.creatorFeesAccrued = 0;
        payable(msg.sender).transfer(amount);
    }

    function flushStakerFees(address token) external {
        Pool storage pool = pools[token];
        uint256 amount = pool.stakerFeesAccrued;
        require(amount > 0, "No fees");
        pool.stakerFeesAccrued = 0;
        payable(feeCollector).transfer(amount);
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
        } else if (pool.phase == PoolPhase.AMM) {
            return (pool.ammEthReserve * 1e18) / pool.ammTokenReserve;
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
