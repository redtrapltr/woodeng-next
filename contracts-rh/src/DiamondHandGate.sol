// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DiamondHandGate {

    struct TokenProfile {
        uint256 cumulativeTokenSeconds;  // token-seconds accumulated for this token
        uint256 currentBalance;          // current balance of this token
        uint256 lastSyncTimestamp;       // last time we synced the accumulator
        uint256 firstBuyTimestamp;       // when they first bought this token
        uint256 totalSold;               // permanent record of tokens ever sold —
                                          // stays in the averaging denominator even
                                          // after the position is exited, so a
                                          // flip (buy big, sell down to a dust
                                          // balance) can't dilute the denominator
                                          // away and let the score re-climb fast
                                          // on the leftover dust.
    }

    // holder => token => per-token hold profile
    mapping(address => mapping(address => TokenProfile)) public tokenProfiles;

    // holder => every token they've ever bought, so getAvgHoldDays can
    // aggregate across positions without the caller needing to know the list.
    mapping(address => address[]) public holderTokenList;
    mapping(address => mapping(address => bool)) private _seenToken;

    address public factory;  // only factory can record buys/sells

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    function setFactory(address _factory) external {
        require(msg.sender == factory, "Not factory");
        factory = _factory;
    }

    function _sync(TokenProfile storage p) private {
        if (p.lastSyncTimestamp > 0 && p.currentBalance > 0) {
            uint256 elapsed = block.timestamp - p.lastSyncTimestamp;
            p.cumulativeTokenSeconds += p.currentBalance * elapsed;
        }
    }

    function recordBuy(address holder, address token, uint256 amount) external onlyFactory {
        TokenProfile storage p = tokenProfiles[holder][token];
        _sync(p);

        if (p.firstBuyTimestamp == 0) {
            p.firstBuyTimestamp = block.timestamp;
        }
        if (!_seenToken[holder][token]) {
            _seenToken[holder][token] = true;
            holderTokenList[holder].push(token);
        }

        p.currentBalance += amount;
        p.lastSyncTimestamp = block.timestamp;
    }

    function recordSell(address holder, address token, uint256 amount) external onlyFactory {
        TokenProfile storage p = tokenProfiles[holder][token];
        _sync(p);

        if (amount > p.currentBalance) amount = p.currentBalance;

        // Penalty: selling burns accumulated token-seconds proportionally to
        // the fraction of the position sold, so flipping (buy, sell, repeat)
        // can't preserve an average-hold-days score built up while holding.
        // Selling 100% of a position wipes that token's score to zero;
        // selling 50% halves it. Scoped per-token — selling out of one
        // position doesn't touch the hold history of any other token.
        if (p.currentBalance > 0) {
            uint256 proportionBps = (amount * 10000) / p.currentBalance;
            uint256 secondsToRemove = (p.cumulativeTokenSeconds * proportionBps) / 10000;
            if (secondsToRemove > p.cumulativeTokenSeconds) {
                p.cumulativeTokenSeconds = 0;
            } else {
                p.cumulativeTokenSeconds -= secondsToRemove;
            }
        }

        p.currentBalance -= amount;
        p.totalSold += amount;
        p.lastSyncTimestamp = block.timestamp;
    }

    /// @notice Average hold time in days for one specific token. Weighted by
    /// (currentBalance + totalSold), not just currentBalance — a fully or
    /// mostly sold-out position keeps its sold tokens in the denominator
    /// permanently, so exiting down to a dust balance doesn't let the score
    /// climb back to a "diamond hand" reading in minutes on that dust.
    function getTokenAvgHoldDays(address holder, address token) public view returns (uint256) {
        TokenProfile storage p = tokenProfiles[holder][token];
        uint256 totalTokens = p.currentBalance + p.totalSold;
        if (p.firstBuyTimestamp == 0 || totalTokens == 0) return 0;

        uint256 totalTokenSeconds = p.cumulativeTokenSeconds;
        if (p.currentBalance > 0 && p.lastSyncTimestamp > 0) {
            totalTokenSeconds += p.currentBalance * (block.timestamp - p.lastSyncTimestamp);
        }
        return totalTokenSeconds / totalTokens / 86400;
    }

    /// @notice Global average hold time in days: every token position this
    /// holder has ever bought, weighted by (currentBalance + totalSold) per
    /// token into a single score. This is what pool.minAvgHoldDays gates
    /// against, so a holder can qualify for a gated pool using hold history
    /// built up on any other token — but sold-off tokens permanently weigh
    /// the average down instead of dropping out of it.
    function getAvgHoldDays(address holder) external view returns (uint256) {
        (uint256 totalSeconds, uint256 totalTokens) = _aggregate(holder);
        if (totalTokens == 0) return 0;
        return totalSeconds / totalTokens / 86400;
    }

    /// @notice Global average hold time in SECONDS, same aggregation as
    /// getAvgHoldDays but without the /86400 truncation — the days version
    /// floors to 0 for anyone who bought less than a day ago, which is
    /// useless for a frontend display that wants to show minutes/hours.
    /// Use this for display; getAvgHoldDays stays the gate check.
    function getAvgHoldSeconds(address holder) external view returns (uint256) {
        (uint256 totalSeconds, uint256 totalTokens) = _aggregate(holder);
        if (totalTokens == 0) return 0;
        return totalSeconds / totalTokens;
    }

    /// @dev Shared aggregation for getAvgHoldDays/getAvgHoldSeconds: sums
    /// live token-seconds and (currentBalance + totalSold) across every
    /// token the holder has ever bought.
    function _aggregate(address holder) private view returns (uint256 totalSeconds, uint256 totalTokens) {
        address[] storage tokens = holderTokenList[holder];

        for (uint256 i = 0; i < tokens.length; i++) {
            TokenProfile storage p = tokenProfiles[holder][tokens[i]];
            uint256 posTokens = p.currentBalance + p.totalSold;
            if (posTokens == 0) continue;

            uint256 tokenSeconds = p.cumulativeTokenSeconds;
            if (p.currentBalance > 0 && p.lastSyncTimestamp > 0) {
                tokenSeconds += p.currentBalance * (block.timestamp - p.lastSyncTimestamp);
            }
            totalSeconds += tokenSeconds;
            totalTokens += posTokens;
        }
    }

    function getProfile(address holder, address token) external view returns (TokenProfile memory) {
        return tokenProfiles[holder][token];
    }

    function getHolderTokens(address holder) external view returns (address[] memory) {
        return holderTokenList[holder];
    }
}
