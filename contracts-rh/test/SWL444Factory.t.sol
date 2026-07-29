// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SWL444Token.sol";
import "../src/SWL444Factory.sol";
import "../src/DiamondHandGate.sol";
import "./mocks/MockUniswapV2.sol";

contract SWL444FactoryTest is Test {
    SWL444Factory factory;
    DiamondHandGate gate;
    MockUniswapV2Factory uniFactory;
    MockUniswapV2Router uniRouter;

    address weth = makeAddr("weth");
    address feeCollector = makeAddr("feeCollector");
    address authority = address(this);
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");
    address whale = makeAddr("whale");
    address stranger = makeAddr("stranger");

    uint256 constant TOTAL_SUPPLY = 444_000_000 * 1e18;
    uint256 constant BONDING_SUPPLY = 44_000_000 * 1e18;

    // The bonding curve starts with a tiny virtual ETH reserve (0.001 ether)
    // against the full 444M token supply, so even fractions of an ether move
    // the price a huge amount. Keep "ordinary" test buys small so they don't
    // blow through BONDING_SUPPLY in a single trade.
    uint256 constant SMALL_BUY = 1e12; // 0.000001 ether

    function setUp() public {
        gate = new DiamondHandGate();
        uniFactory = new MockUniswapV2Factory();
        uniRouter = new MockUniswapV2Router(address(uniFactory), weth);

        factory = new SWL444Factory(
            feeCollector,
            address(uniRouter),
            address(uniFactory),
            address(gate)
        );
        gate.setFactory(address(factory));

        vm.deal(creator, 1000 ether);
        vm.deal(buyer, 1000 ether);
        vm.deal(whale, 1000 ether);
        vm.deal(stranger, 1000 ether);
    }

    // ─── Helpers ───────────────────────────────────────────────

    function _createToken(
        address by,
        string memory name,
        string memory symbol,
        uint256 minAvgHoldDays
    ) internal returns (address) {
        vm.prank(by);
        return factory.createToken(name, symbol, "ipfs://meta", minAvgHoldDays, 0);
    }

    /// @dev Buys past the remaining bonding supply in a single trade. The
    /// factory clamps any buy that would overshoot BONDING_SUPPLY down to
    /// exactly the remaining amount and refunds the unused ETH, so one
    /// oversized buy is always enough to land exactly on BONDING_SUPPLY and
    /// trigger the AMM flip — regardless of how much bonding was already
    /// sold beforehand.
    function _fillBondingSupply(address token, address by) internal {
        SWL444Factory.Pool memory p = factory.getPool(token);
        if (p.bondingSold >= BONDING_SUPPLY) return;

        vm.deal(by, 100 ether);
        vm.prank(by);
        factory.buy{value: 100 ether}(token);
    }

    // ─── Token Creation ────────────────────────────────────────

    function test_createToken_deploysPoolInBondingPhase() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(pool.token, token);
        assertEq(pool.creator, creator);
        assertEq(uint8(pool.phase), uint8(SWL444Factory.PoolPhase.Bonding));
        assertEq(pool.virtualTokens, TOTAL_SUPPLY);
        assertEq(pool.virtualEth, 0.001 ether);
        assertEq(pool.bondingSold, 0);
        assertEq(pool.metadataUri, "ipfs://meta");
        assertEq(factory.getPoolCount(), 1);

        SWL444Token tok = SWL444Token(token);
        assertEq(tok.name(), "Meme");
        assertEq(tok.symbol(), "MEME");
        assertEq(tok.creator(), creator);
        assertEq(tok.factory(), address(factory));
        assertEq(tok.decimals(), 18);
    }

    function test_createToken_emitsTokenCreated() public {
        vm.expectEmit(false, true, false, true);
        emit SWL444Factory.TokenCreated(address(0), creator, "Meme", "MEME");
        _createToken(creator, "Meme", "MEME", 0);
    }

    function test_createToken_revertsOnEmptyName() public {
        vm.prank(creator);
        vm.expectRevert("Name 1-32 chars");
        factory.createToken("", "MEME", "ipfs://meta", 0, 0);
    }

    function test_createToken_revertsOnLongName() public {
        vm.prank(creator);
        vm.expectRevert("Name 1-32 chars");
        factory.createToken(
            "this name is definitely way too long for the limit",
            "MEME",
            "ipfs://meta",
            0,
            0
        );
    }

    function test_createToken_revertsOnLongSymbol() public {
        vm.prank(creator);
        vm.expectRevert("Symbol 1-10 chars");
        factory.createToken("Meme", "WAYTOOLONGX", "ipfs://meta", 0, 0);
    }

    function test_createToken_withInitialBuy_respectsFirstBuyCap() public {
        vm.prank(creator);
        // Small enough to stay under the 1% first-buy cap for the creator.
        factory.createToken{value: 0.00001 ether}("Meme", "MEME", "ipfs://meta", 0, 0.00001 ether);
    }

    function test_createToken_creatorFirstBuyRevertsAboveCap() public {
        vm.prank(creator);
        vm.expectRevert("First buy max 1%");
        factory.createToken{value: 0.0001 ether}("Meme", "MEME", "ipfs://meta", 0, 0.0001 ether);
    }

    function test_createToken_refundsExcessOnInitialBuy() public {
        uint256 before = creator.balance;
        vm.prank(creator);
        factory.createToken{value: 1 ether}("Meme", "MEME", "ipfs://meta", 0, 0.00001 ether);
        // Only 0.00001 ether should have been spent, rest refunded.
        assertEq(creator.balance, before - 0.00001 ether);
    }

    // ─── Buy (Bonding) ─────────────────────────────────────────

    function test_buy_bonding_mintsTokensAndAccruesFees() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        SWL444Token tok = SWL444Token(token);
        assertGt(tok.balanceOf(buyer), 0);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(pool.creatorFeesAccrued, (SMALL_BUY * 50) / 10000);
        assertEq(pool.stakerFeesAccrued, (SMALL_BUY * 100) / 10000);
        assertEq(pool.bondingSold, tok.balanceOf(buyer));
    }

    function test_buy_bonding_nonCreatorFirstBuyNotCapped() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        // A buy from a non-creator on the very first purchase is not subject
        // to the 1% cap (only the creator's first buy is capped). Pick an
        // amount that clears the 1% cap but stays under the bonding supply.
        vm.prank(whale);
        factory.buy{value: 0.00002 ether}(token);

        assertGt(SWL444Token(token).balanceOf(whale), (TOTAL_SUPPLY * 100) / 10000);
    }

    function test_buy_revertsOnZeroEth() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        vm.expectRevert("Send ETH");
        factory.buy{value: 0}(token);
    }

    function test_buy_revertsOnUnknownPool() public {
        vm.prank(buyer);
        vm.expectRevert("Pool not found");
        factory.buy{value: 1 ether}(makeAddr("notAPool"));
    }

    // ─── Sell (Bonding) ────────────────────────────────────────

    function test_sell_bonding_burnsTokensAndPaysEth() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        uint256 tokenBal = SWL444Token(token).balanceOf(buyer);
        uint256 ethBefore = buyer.balance;

        vm.prank(buyer);
        factory.sell(token, tokenBal);

        assertEq(SWL444Token(token).balanceOf(buyer), 0);
        assertGt(buyer.balance, ethBefore);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(pool.bondingSold, 0);
    }

    function test_sell_revertsOnZeroAmount() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        vm.expectRevert("Zero amount");
        factory.sell(token, 0);
    }

    function test_sell_bonding_revertsOnInsufficientBalance() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        vm.expectRevert();
        factory.sell(token, 1000 * 1e18);
    }

    // ─── Diamond Hand Gate ─────────────────────────────────────

    function test_diamondGate_blocksFreshWalletFromGatedPool() public {
        address gated = _createToken(creator, "Gated", "GATE", 7);

        vm.prank(stranger);
        vm.expectRevert("Diamond hand gate: hold longer");
        factory.buy{value: 1 ether}(gated);
    }

    function test_diamondGate_allowsHolderWithSufficientHoldTime() public {
        // Build hold history on an ungated token.
        address ungated = _createToken(creator, "Open", "OPEN", 0);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(ungated);

        // Let the position age.
        vm.warp(block.timestamp + 30 days);

        uint256 avgDays = gate.getAvgHoldDays(buyer);
        assertGe(avgDays, 7);

        address gated = _createToken(creator, "Gated", "GATE", 7);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(gated);

        assertGt(SWL444Token(gated).balanceOf(buyer), 0);
    }

    function test_diamondGate_openPoolIgnoresHoldRequirement() public {
        address ungated = _createToken(creator, "Open", "OPEN", 0);
        vm.prank(stranger);
        factory.buy{value: SMALL_BUY}(ungated);
        assertGt(SWL444Token(ungated).balanceOf(stranger), 0);
    }

    // ─── AMM Flip + Trading ────────────────────────────────────

    function test_flipToAmm_onBondingSupplyExhausted() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(uint8(pool.phase), uint8(SWL444Factory.PoolPhase.AMM));
        assertEq(pool.bondingSold, BONDING_SUPPLY);
        assertEq(pool.ammTokenReserve, TOTAL_SUPPLY - BONDING_SUPPLY);
        // ammEthReserve excludes the phantom initial virtual-ETH seed —
        // it only reflects real ETH actually raised during bonding.
        assertEq(pool.ammEthReserve, pool.virtualEth - factory.INIT_VIRTUAL_ETH());
        assertEq(SWL444Token(token).balanceOf(address(factory)), TOTAL_SUPPLY - BONDING_SUPPLY);
    }

    function test_buy_amm_afterFlip() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        uint256 before = SWL444Token(token).balanceOf(buyer);
        vm.prank(buyer);
        factory.buy{value: 1 ether}(token);

        assertGt(SWL444Token(token).balanceOf(buyer), before);
    }

    function test_sell_amm_afterFlip() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        vm.prank(buyer);
        factory.buy{value: 1 ether}(token);
        uint256 tokenBal = SWL444Token(token).balanceOf(buyer);

        vm.prank(buyer);
        SWL444Token(token).approve(address(factory), tokenBal);

        uint256 ethBefore = buyer.balance;
        vm.prank(buyer);
        factory.sell(token, tokenBal);

        assertEq(SWL444Token(token).balanceOf(buyer), 0);
        assertGt(buyer.balance, ethBefore);
    }

    function test_buyAndSell_revertAfterGraduation() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        vm.prank(creator);
        factory.graduate(token);

        vm.prank(buyer);
        vm.expectRevert("Pool graduated - trade on Uniswap");
        factory.buy{value: 1 ether}(token);

        vm.prank(buyer);
        vm.expectRevert("Pool graduated - trade on Uniswap");
        factory.sell(token, 1);
    }

    // ─── Graduation ────────────────────────────────────────────

    function test_graduate_revertsIfNotInAmmPhase() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(creator);
        vm.expectRevert("Not in AMM phase");
        factory.graduate(token);
    }

    function test_graduate_revertsIfUnauthorized() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        vm.prank(stranger);
        vm.expectRevert("Not authorized");
        factory.graduate(token);
    }

    function test_graduate_addsLiquidityAndLocksIt() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        SWL444Factory.Pool memory beforePool = factory.getPool(token);
        uint256 ammTokens = beforePool.ammTokenReserve;
        uint256 ammEth = beforePool.ammEthReserve;

        vm.prank(creator);
        factory.graduate(token);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(uint8(pool.phase), uint8(SWL444Factory.PoolPhase.Graduated));
        assertTrue(pool.liquidityLocked);
        assertTrue(pool.uniswapPair != address(0));

        // Router pulled the full AMM reserves.
        assertEq(SWL444Token(token).balanceOf(address(uniRouter)), ammTokens);
        assertEq(address(uniRouter).balance, ammEth);
    }

    // ─── Fee Claiming ──────────────────────────────────────────

    function test_claimCreatorFees() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        uint256 accrued = pool.creatorFeesAccrued;
        assertGt(accrued, 0);

        uint256 before = creator.balance;
        vm.prank(creator);
        factory.claimCreatorFees(token);

        assertEq(creator.balance, before + accrued);
        pool = factory.getPool(token);
        assertEq(pool.creatorFeesAccrued, 0);
    }

    function test_claimCreatorFees_revertsForNonCreator() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        vm.prank(stranger);
        vm.expectRevert("Not creator");
        factory.claimCreatorFees(token);
    }

    function test_claimCreatorFees_revertsWhenNoFees() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(creator);
        vm.expectRevert("No fees");
        factory.claimCreatorFees(token);
    }

    function test_flushStakerFees() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        uint256 accrued = pool.stakerFeesAccrued;
        assertGt(accrued, 0);

        uint256 before = feeCollector.balance;
        factory.flushStakerFees(token);

        assertEq(feeCollector.balance, before + accrued);
    }

    function test_flushStakerFees_revertsWhenNoFees() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.expectRevert("No fees");
        factory.flushStakerFees(token);
    }

    // ─── Views ─────────────────────────────────────────────────

    function test_getCurrentPrice_bonding() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        uint256 expectedPrice = (pool.virtualEth * 1e18) / pool.virtualTokens;
        assertEq(factory.getCurrentPrice(token), expectedPrice);
    }

    function test_getCurrentPrice_amm() public {
        // Uses a fresh token filled straight from bondingSold == 0 — see
        // _fillBondingSupply's docs on why this can't be composed with a
        // preceding partial buy.
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        uint256 expectedPrice = (pool.ammEthReserve * 1e18) / pool.ammTokenReserve;
        assertEq(factory.getCurrentPrice(token), expectedPrice);
    }

    function test_getAllPools_and_getPoolCount() public {
        address t1 = _createToken(creator, "One", "ONE", 0);
        address t2 = _createToken(creator, "Two", "TWO", 0);

        assertEq(factory.getPoolCount(), 2);
        address[] memory all = factory.getAllPools();
        assertEq(all.length, 2);
        assertEq(all[0], t1);
        assertEq(all[1], t2);
    }

    // ─── Admin ─────────────────────────────────────────────────

    function test_setAuthority_onlyAuthority() public {
        vm.prank(stranger);
        vm.expectRevert("Not authority");
        factory.setAuthority(stranger);

        factory.setAuthority(stranger);
        assertEq(factory.authority(), stranger);
    }

    function test_setFeeCollector_onlyAuthority() public {
        vm.prank(stranger);
        vm.expectRevert("Not authority");
        factory.setFeeCollector(stranger);

        factory.setFeeCollector(stranger);
        assertEq(factory.feeCollector(), stranger);
    }

    // ─── SWL444Token access control ────────────────────────────

    function test_token_mintAndBurn_onlyFactory() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        vm.expectRevert("Only factory");
        SWL444Token(token).mint(stranger, 1);

        vm.expectRevert("Only factory");
        SWL444Token(token).burn(creator, 1);
    }

    function test_token_updateMetadataUri_onlyCreator() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        vm.prank(stranger);
        vm.expectRevert("Only creator");
        SWL444Token(token).updateMetadataUri("ipfs://new");

        vm.prank(creator);
        SWL444Token(token).updateMetadataUri("ipfs://new");
        assertEq(SWL444Token(token).metadataUri(), "ipfs://new");
    }
}
