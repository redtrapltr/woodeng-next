// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal Uniswap V2 pair stand-in — just needs a distinct address.
contract MockUniswapV2Pair {
    address public token0;
    address public token1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }
}

/// @notice Minimal Uniswap V2 factory stand-in for testing graduation.
contract MockUniswapV2Factory {
    mapping(bytes32 => address) public pairs;

    function _key(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        bytes32 key = _key(tokenA, tokenB);
        pair = pairs[key];
        if (pair == address(0)) {
            pair = address(new MockUniswapV2Pair(tokenA, tokenB));
            pairs[key] = pair;
        }
    }

    function getPair(address tokenA, address tokenB) external view returns (address) {
        return pairs[_key(tokenA, tokenB)];
    }
}

/// @notice Minimal Uniswap V2 router stand-in for testing graduation.
/// Pulls the token liquidity via transferFrom (factory approves it beforehand),
/// accepts the ETH, and lazily creates the pair on the mock factory.
contract MockUniswapV2Router {
    address public immutable factoryAddr;
    address public immutable wethAddr;

    constructor(address _factory, address _weth) {
        factoryAddr = _factory;
        wethAddr = _weth;
    }

    function WETH() external view returns (address) {
        return wethAddr;
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint /*amountTokenMin*/,
        uint /*amountETHMin*/,
        address /*to*/,
        uint /*deadline*/
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        MockUniswapV2Factory(factoryAddr).createPair(token, wethAddr);
        return (amountTokenDesired, msg.value, amountTokenDesired);
    }
}
