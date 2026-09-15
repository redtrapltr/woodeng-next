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
    uint256 constant BONDING_SUPPLY = 400_000_000 * 1e18;

    // The bonding curve starts with a small virtual ETH reserve (0.23958
    // ether) against the full 444M token supply, so even fractions of an
    // ether move the price a large amount. Keep "ordinary" test buys small
    // so they don't blow through BONDING_SUPPLY in a single trade.
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
        address token = factory.createToken(name, symbol, "ipfs://meta", minAvgHoldDays, 0, address(0));
        // Foundry doesn't auto-advance block.number between statements, so
        // every buy in a test would otherwise land in the creation block and
        // eat the block-0 snipe tax. Tests that specifically exercise the
        // snipe tax roll blocks themselves instead of using this helper.
        vm.roll(block.number + 3);
        return token;
    }

    /// @dev Buys past the remaining bonding supply in a single trade. The
    /// factory clamps any buy that would overshoot BONDING_SUPPLY down to
    /// exactly the remaining amount and refunds the unused ETH, so one
    /// oversized buy is always enough to land exactly on BONDING_SUPPLY and
    /// trigger auto-graduation to Uniswap — regardless of how much bonding
    /// was already sold beforehand.
    function _fillBondingSupply(address token, address by) internal {
        SWL444Factory.Pool memory p = factory.getPool(token);
        if (p.bondingSold >= BONDING_SUPPLY) return;

        vm.deal(by, 100 ether);
        vm.prank(by);
        factory.buy{value: 100 ether}(token);
    }

    // ─── Token Creation ────────────────────────────────────────

    function test_createToken_deploysPoolInBondingPhase() public {
        // Not the _createToken helper here — it rolls 3 blocks forward as a
        // side effect (see its comment), which would make a "before" block
        // number captured beforehand ambiguous to compare against.
        address token = _createTokenNoRoll(creator);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(pool.token, token);
        assertEq(pool.creator, creator);
        assertEq(uint8(pool.phase), uint8(SWL444Factory.PoolPhase.Bonding));
        assertEq(pool.virtualTokens, TOTAL_SUPPLY);
        assertEq(pool.virtualEth, factory.INIT_VIRTUAL_ETH());
        assertEq(pool.bondingSold, 0);
        assertEq(pool.metadataUri, "ipfs://meta");
        assertEq(pool.creationBlock, block.number);
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
        factory.createToken("", "MEME", "ipfs://meta", 0, 0, address(0));
    }

    function test_createToken_revertsOnLongName() public {
        vm.prank(creator);
        vm.expectRevert("Name 1-32 chars");
        factory.createToken(
            "this name is definitely way too long for the limit",
            "MEME",
            "ipfs://meta",
            0,
            0,
            address(0)
        );
    }

    function test_createToken_revertsOnLongSymbol() public {
        vm.prank(creator);
        vm.expectRevert("Symbol 1-10 chars");
        factory.createToken("Meme", "WAYTOOLONGX", "ipfs://meta", 0, 0, address(0));
    }

    function test_createToken_withInitialBuy_respectsFirstBuyCap() public {
        vm.prank(creator);
        // Buying the 1% cap (4.44M tokens) is hit at ethIn ~= 0.00244 ETH
        // gross given INIT_VIRTUAL_ETH=0.23958 ether (see the cap-revert test
        // below for the derivation) — 0.0007 ether stays comfortably under.
        factory.createToken{value: 0.0007 ether}("Meme", "MEME", "ipfs://meta", 0, 0.0007 ether, address(0));
    }

    function test_createToken_creatorFirstBuyRevertsAboveCap() public {
        vm.prank(creator);
        vm.expectRevert("First buy max 1%");
        // With INIT_VIRTUAL_ETH = 0.23958 ether (mainnet), solving
        // tokensOut = maxFirst (4.44M) for netEth via the constant-product
        // formula gives netEth = maxFirst*V/(T-maxFirst) ~= 0.00242 ETH, so
        // ethIn gross ~= 0.00244 ETH — 0.25 ether clears it with huge margin.
        factory.createToken{value: 0.25 ether}("Meme", "MEME", "ipfs://meta", 0, 0.25 ether, address(0));
    }

    function test_createToken_refundsExcessOnInitialBuy() public {
        uint256 before = creator.balance;
        vm.prank(creator);
        factory.createToken{value: 1 ether}("Meme", "MEME", "ipfs://meta", 0, 0.00001 ether, address(0));
        // Only 0.00001 ether should have been spent net of refund — but with
        // feeRecipient defaulting to the creator, the creator-side cut of the
        // buy fee is sent straight back to them in the same transaction, so
        // their net spend is less than the raw initialBuyEth amount.
        uint256 creatorFee = (0.00001 ether * 70) / 10000;
        assertEq(creator.balance, before - 0.00001 ether + creatorFee);
    }

    // ─── Buy (Bonding) ─────────────────────────────────────────

    function test_buy_bonding_mintsTokens() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        SWL444Token tok = SWL444Token(token);
        assertGt(tok.balanceOf(buyer), 0);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(pool.bondingSold, tok.balanceOf(buyer));
    }

    function test_buy_bonding_nonCreatorFirstBuyNotCapped() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        // A buy from a non-creator on the very first purchase is not subject
        // to the first-buy cap (only the creator's first buy is capped). Pick
        // an amount that clears the cap (~1.515 ETH) but stays under the
        // bonding supply.
        vm.prank(whale);
        factory.buy{value: 2 ether}(token);

        assertGt(SWL444Token(token).balanceOf(whale), (TOTAL_SUPPLY * factory.MAX_FIRST_BUY_BPS()) / 10000);
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

    // ─── Snipe Tax ─────────────────────────────────────────────
    // Decaying tax on non-creator buys in the first 3 blocks after creation
    // (50% / 25% / 10% / none from block 3 onward) — discourages bots
    // front-running the launch block. The creator's own qualifying first buy
    // (bondingSold still 0) is exempt regardless of block.

    function _createTokenNoRoll(address by) internal returns (address) {
        vm.prank(by);
        return factory.createToken("Meme", "MEME", "ipfs://meta", 0, 0, address(0));
    }

    function test_snipeTax_block0_taxes50Percent() public {
        address token = _createTokenNoRoll(creator);

        uint256 collectorBefore = feeCollector.balance;
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        uint256 expectedSnipeTax = (SMALL_BUY * 5000) / 10000;
        uint256 expectedStakerFee = ((SMALL_BUY - expectedSnipeTax) * 30) / 10000;
        assertEq(feeCollector.balance, collectorBefore + expectedSnipeTax + expectedStakerFee);
    }

    function test_snipeTax_block1_taxes25Percent() public {
        address token = _createTokenNoRoll(creator);
        vm.roll(block.number + 1);

        uint256 collectorBefore = feeCollector.balance;
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        uint256 expectedSnipeTax = (SMALL_BUY * 2500) / 10000;
        uint256 expectedStakerFee = ((SMALL_BUY - expectedSnipeTax) * 30) / 10000;
        assertEq(feeCollector.balance, collectorBefore + expectedSnipeTax + expectedStakerFee);
    }

    function test_snipeTax_block2_taxes10Percent() public {
        address token = _createTokenNoRoll(creator);
        vm.roll(block.number + 2);

        uint256 collectorBefore = feeCollector.balance;
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        uint256 expectedSnipeTax = (SMALL_BUY * 1000) / 10000;
        uint256 expectedStakerFee = ((SMALL_BUY - expectedSnipeTax) * 30) / 10000;
        assertEq(feeCollector.balance, collectorBefore + expectedSnipeTax + expectedStakerFee);
    }

    function test_snipeTax_block3Plus_noTax() public {
        address token = _createTokenNoRoll(creator);
        vm.roll(block.number + 3);

        uint256 collectorBefore = feeCollector.balance;
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        // No snipe tax past block 2 — only the normal 0.3% staker fee.
        uint256 expectedStakerFee = (SMALL_BUY * 30) / 10000;
        assertEq(feeCollector.balance, collectorBefore + expectedStakerFee);
    }

    function test_snipeTax_exemptForCreatorFirstBuy() public {
        // Creator's own first buy, same block as creation — must NOT be
        // taxed, even though block 0 would otherwise carry the 50% tax.
        uint256 creatorBefore = creator.balance;
        vm.prank(creator);
        factory.createToken{value: 0.0007 ether}("Meme", "MEME", "ipfs://meta", 0, 0.0007 ether, address(0));

        uint256 creatorFee = (0.0007 ether * 70) / 10000;
        assertEq(creator.balance, creatorBefore - 0.0007 ether + creatorFee);
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

    // ─── Auto-Graduation ────────────────────────────────────────
    // Graduation is automatic: filling the bonding curve migrates liquidity
    // straight to Uniswap in the same transaction, with no intermediate
    // internal-AMM phase and no separate graduate() call.

    function test_graduatesAutomatically_onBondingSupplyExhausted() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        uint256 expectedLiquidityTokens = TOTAL_SUPPLY - BONDING_SUPPLY;
        // Mainnet value: bonding graduates after ~2.2 ETH raised gross
        // (~2.178 ETH net of the 1% buy fee) — see INIT_VIRTUAL_ETH comment
        // in SWL444Factory.sol for the derivation.
        uint256 expectedRealEth = 2.178 ether;

        _fillBondingSupply(token, whale);

        SWL444Factory.Pool memory pool = factory.getPool(token);
        assertEq(uint8(pool.phase), uint8(SWL444Factory.PoolPhase.Graduated));
        assertEq(pool.bondingSold, BONDING_SUPPLY);
        assertTrue(pool.liquidityLocked);
        assertTrue(pool.uniswapPair != address(0));

        // The full remaining supply was minted and handed straight to the
        // Uniswap router as liquidity — the factory itself holds none of it.
        assertEq(SWL444Token(token).balanceOf(address(uniRouter)), expectedLiquidityTokens);
        assertEq(SWL444Token(token).balanceOf(address(factory)), 0);
        assertApproxEqAbs(address(uniRouter).balance, expectedRealEth, 0.0001 ether);
    }

    function test_buyAndSell_revertAfterGraduation() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        vm.prank(buyer);
        vm.expectRevert("Graduated - trade on Uniswap");
        factory.buy{value: 1 ether}(token);

        vm.prank(buyer);
        vm.expectRevert("Graduated - trade on Uniswap");
        factory.sell(token, 1);
    }

    // ─── Auto-Sent Fees ────────────────────────────────────────
    // Fees are sent instantly on every trade — no accrue-then-claim step, so
    // these assert balance deltas directly rather than a Pool.xxxAccrued field.

    function test_buy_bonding_sendsFeesInstantly() public {
        address token = _createToken(creator, "Meme", "MEME", 0);

        uint256 creatorBefore = creator.balance;
        uint256 collectorBefore = feeCollector.balance;

        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        uint256 expectedCreatorFee = (SMALL_BUY * 70) / 10000;
        uint256 expectedStakerFee = (SMALL_BUY * 30) / 10000;

        assertEq(creator.balance, creatorBefore + expectedCreatorFee);
        assertEq(feeCollector.balance, collectorBefore + expectedStakerFee);
    }

    function test_buy_bonding_sendsFeesToCustomFeeRecipient() public {
        address customWallet = makeAddr("customFeeWallet");
        vm.prank(creator);
        address token = factory.createToken("Meme", "MEME", "ipfs://meta", 0, 0, customWallet);
        vm.roll(block.number + 3); // past the snipe-tax window — not what this test covers

        uint256 customBefore = customWallet.balance;
        uint256 creatorBefore = creator.balance;

        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);

        uint256 expectedCreatorFee = (SMALL_BUY * 70) / 10000;
        assertEq(customWallet.balance, customBefore + expectedCreatorFee);
        // Creator's own wallet is untouched when a distinct feeRecipient is set.
        assertEq(creator.balance, creatorBefore);
    }

    function test_sell_bonding_sendsFeesInstantly() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        vm.prank(buyer);
        factory.buy{value: SMALL_BUY}(token);
        uint256 tokenBal = SWL444Token(token).balanceOf(buyer);

        uint256 creatorBefore = creator.balance;
        uint256 collectorBefore = feeCollector.balance;

        vm.prank(buyer);
        factory.sell(token, tokenBal);

        assertGt(creator.balance, creatorBefore);
        assertGt(feeCollector.balance, collectorBefore);
    }

    function test_RevertWhen_FeeRecipientRejectsEth() public {
        // A contract with no receive/fallback can't accept the .call{value:}
        // fee send — the buy must revert instead of silently losing the fee.
        RejectsEth rejecter = new RejectsEth();
        vm.prank(creator);
        address token = factory.createToken("Meme", "MEME", "ipfs://meta", 0, 0, address(rejecter));

        vm.prank(buyer);
        vm.expectRevert("Creator fee transfer failed");
        factory.buy{value: SMALL_BUY}(token);
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

    function test_getCurrentPrice_returnsZeroAfterGraduation() public {
        address token = _createToken(creator, "Meme", "MEME", 0);
        _fillBondingSupply(token, whale);

        assertEq(uint8(factory.getPool(token).phase), uint8(SWL444Factory.PoolPhase.Graduated));
        assertEq(factory.getCurrentPrice(token), 0);
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

/// @dev No receive/fallback — any plain ETH send to this contract reverts.
/// Used to prove a fee send failure aborts the whole trade instead of
/// silently dropping the fee.
contract RejectsEth {}
