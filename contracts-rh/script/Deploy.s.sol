// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SWL444Token.sol";
import "../src/SWL444Factory.sol";
import "../src/DiamondHandGate.sol";

contract DeployScript is Script {
    // Confirmed Robinhood Chain (chain ID 4663) addresses
    address constant UNISWAP_V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    address constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Diamond Hand Gate first
        DiamondHandGate gate = new DiamondHandGate();

        // Deploy Factory
        address feeCollector = msg.sender; // change to your fee wallet
        SWL444Factory factory = new SWL444Factory(
            feeCollector,
            UNISWAP_V2_ROUTER,
            UNISWAP_V2_FACTORY,
            address(gate)
        );

        // Set factory as authorized caller on DiamondHandGate
        gate.setFactory(address(factory));

        vm.stopBroadcast();

        console.log("DiamondHandGate:", address(gate));
        console.log("SWL444Factory:", address(factory));
        console.log("Uniswap V2 Router:", UNISWAP_V2_ROUTER);
        console.log("Uniswap V2 Factory:", UNISWAP_V2_FACTORY);
        console.log("WETH:", WETH);
    }
}
