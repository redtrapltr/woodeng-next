// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DiamondHandGate {

    struct HolderProfile {
        uint256 cumulativeTokenSeconds;  // total token-seconds accumulated
        uint256 currentBalance;          // current total token balance across all pools
        uint256 totalSold;               // total tokens ever sold
        uint256 lastSyncTimestamp;       // last time we synced the accumulator
        uint256 firstBuyTimestamp;       // when they first bought
    }

    mapping(address => HolderProfile) public profiles;

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

    function recordBuy(address holder, address /*token*/, uint256 amount) external onlyFactory {
        HolderProfile storage p = profiles[holder];

        // Sync accumulated token-seconds before changing balance
        if (p.lastSyncTimestamp > 0 && p.currentBalance > 0) {
            uint256 elapsed = block.timestamp - p.lastSyncTimestamp;
            p.cumulativeTokenSeconds += p.currentBalance * elapsed;
        }

        if (p.firstBuyTimestamp == 0) {
            p.firstBuyTimestamp = block.timestamp;
        }

        p.currentBalance += amount;
        p.lastSyncTimestamp = block.timestamp;
    }

    function recordSell(address holder, address /*token*/, uint256 amount) external onlyFactory {
        HolderProfile storage p = profiles[holder];

        // Sync accumulated token-seconds before changing balance
        if (p.lastSyncTimestamp > 0 && p.currentBalance > 0) {
            uint256 elapsed = block.timestamp - p.lastSyncTimestamp;
            p.cumulativeTokenSeconds += p.currentBalance * elapsed;
        }

        // Update balance and sold totals
        if (amount > p.currentBalance) amount = p.currentBalance;
        p.currentBalance -= amount;
        p.totalSold += amount;
        p.lastSyncTimestamp = block.timestamp;
    }

    /// @notice Get average hold time in days
    /// Formula: cumulativeTokenSeconds / (currentBalance + totalSold) / 86400
    function getAvgHoldDays(address holder) external view returns (uint256) {
        HolderProfile storage p = profiles[holder];
        if (p.firstBuyTimestamp == 0) return 0;

        // Calculate current accumulated seconds (including time since last sync)
        uint256 totalTokenSeconds = p.cumulativeTokenSeconds;
        if (p.currentBalance > 0 && p.lastSyncTimestamp > 0) {
            totalTokenSeconds += p.currentBalance * (block.timestamp - p.lastSyncTimestamp);
        }

        uint256 totalTokens = p.currentBalance + p.totalSold;
        if (totalTokens == 0) return 0;

        return totalTokenSeconds / totalTokens / 86400;
    }

    function getProfile(address holder) external view returns (HolderProfile memory) {
        return profiles[holder];
    }
}
