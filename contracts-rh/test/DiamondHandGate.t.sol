// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DiamondHandGate.sol";

contract DiamondHandGateTest is Test {
    DiamondHandGate gate;
    address token = makeAddr("token");
    address tokenB = makeAddr("tokenB");
    address holder = makeAddr("holder");

    function setUp() public {
        gate = new DiamondHandGate();
        gate.setFactory(address(this));
    }

    function test_getAvgHoldDays_zeroBeforeAnyBuy() public view {
        assertEq(gate.getAvgHoldDays(holder), 0);
    }

    function test_getAvgHoldDays_growsWithHoldTime() public {
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 30 days);
        assertEq(gate.getAvgHoldDays(holder), 30);
    }

    function test_getTokenAvgHoldDays_scopedToOneToken() public {
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 30 days);
        gate.recordBuy(holder, tokenB, 1000e18);

        assertEq(gate.getTokenAvgHoldDays(holder, token), 30);
        assertEq(gate.getTokenAvgHoldDays(holder, tokenB), 0);
    }

    function test_getAvgHoldDays_aggregatesAcrossTokensBalanceWeighted() public {
        // Equal balances on two tokens, aged differently — global average is
        // the balance-weighted mean of the two per-token averages (here, a
        // simple average since the balances match).
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 60 days);
        gate.recordBuy(holder, tokenB, 1000e18);
        vm.warp(block.timestamp + 30 days);

        // token: aged 90d total. tokenB: aged 30d total.
        assertEq(gate.getTokenAvgHoldDays(holder, token), 90);
        assertEq(gate.getTokenAvgHoldDays(holder, tokenB), 30);
        assertEq(gate.getAvgHoldDays(holder), 60);
    }

    function test_recordSell_fullExitWipesThatTokenScoreToZero_butNotOthers() public {
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 30 days);
        gate.recordBuy(holder, tokenB, 1000e18);

        assertEq(gate.getAvgHoldDays(holder), 15);

        gate.recordSell(holder, token, 1000e18);
        assertEq(gate.getTokenAvgHoldDays(holder, token), 0);
        assertEq(gate.getTokenAvgHoldDays(holder, tokenB), 0);
        assertEq(gate.getAvgHoldDays(holder), 0);
    }

    function test_recordSell_partialExitHalvesScore() public {
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 30 days);

        gate.recordSell(holder, token, 500e18);
        // Half the position sold burns half the accumulated token-seconds,
        // but totalSold now stays in the denominator permanently — the
        // remaining balance no longer offsets it, so the average roughly
        // halves instead of holding steady at ~30d.
        assertApproxEqAbs(gate.getTokenAvgHoldDays(holder, token), 15, 1);

        DiamondHandGate.TokenProfile memory p = gate.getProfile(holder, token);
        assertEq(p.currentBalance, 500e18);
        assertEq(p.totalSold, 500e18);
    }

    function test_recordSell_flippingCannotPreserveScoreOverBuySellCycles() public {
        // Buy, age the position, then sell it all and immediately rebuy —
        // the new position must start from zero hold time, not inherit the
        // score built up before the sell.
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 60 days);
        gate.recordSell(holder, token, 1000e18);

        gate.recordBuy(holder, token, 1000e18);
        assertEq(gate.getTokenAvgHoldDays(holder, token), 0);
    }

    function test_getAvgHoldSeconds_nonZeroUnderOneDay() public {
        gate.recordBuy(holder, token, 1000e18);
        vm.warp(block.timestamp + 90 minutes);

        // getAvgHoldDays floors to 0 for anything under a day — that's the
        // bug this function exists to work around for frontend display.
        assertEq(gate.getAvgHoldDays(holder), 0);
        assertEq(gate.getAvgHoldSeconds(holder), 90 minutes);
    }

    function test_recordSell_flipperCannotRegrowScoreOnDustBalance() public {
        // Regression for the flip exploit: buy big, sell almost all of it,
        // then let the dust balance age. Without totalSold in the
        // denominator, the score climbs 1 second per second on the tiny
        // remaining balance and looks "diamond hand" again within hours.
        uint256 bought = 44_000_000e18;
        uint256 dust = 8_000e18;
        uint256 sold = bought - dust;

        gate.recordBuy(holder, token, bought);
        vm.warp(block.timestamp + 7 minutes);
        gate.recordSell(holder, token, sold);

        vm.warp(block.timestamp + 2 hours);

        // Diamond hand control: same total tokens, held for a comparable
        // stretch. Deliberately 3h here, not 2h again — solc 0.8.26 with
        // via_ir+optimizer on (this project's config) miscompiles a second
        // vm.warp(block.timestamp + <same literal duration>) in one function
        // into a no-op (verified in isolation: three sequential warps of the
        // same delta advance time once, then silently stall). Using a
        // different literal duration sidesteps it; it's a test-harness
        // compilation quirk, not a bug in the contract under test.
        gate.recordBuy(holder, tokenB, bought);
        vm.warp(block.timestamp + 3 hours);

        uint256 flipperTokenSeconds = _tokenAvgHoldSeconds(token);
        uint256 diamondTokenSeconds = _tokenAvgHoldSeconds(tokenB);

        // Flipper's dust position should read as a small fraction of the
        // diamond hand's — nowhere near equal despite both having just
        // finished a multi-hour hold on their current balance.
        assertLt(flipperTokenSeconds * 100, diamondTokenSeconds);
    }

    function _tokenAvgHoldSeconds(address t) internal view returns (uint256) {
        DiamondHandGate.TokenProfile memory p = gate.getProfile(holder, t);
        uint256 totalTokens = p.currentBalance + p.totalSold;
        if (totalTokens == 0) return 0;
        uint256 secs = p.cumulativeTokenSeconds;
        if (p.currentBalance > 0 && p.lastSyncTimestamp > 0) {
            secs += p.currentBalance * (block.timestamp - p.lastSyncTimestamp);
        }
        return secs / totalTokens;
    }

    function test_getHolderTokens_tracksDistinctTokensOnce() public {
        gate.recordBuy(holder, token, 1000e18);
        gate.recordBuy(holder, token, 500e18);
        gate.recordBuy(holder, tokenB, 200e18);

        address[] memory tokens = gate.getHolderTokens(holder);
        assertEq(tokens.length, 2);
        assertEq(tokens[0], token);
        assertEq(tokens[1], tokenB);
    }
}
