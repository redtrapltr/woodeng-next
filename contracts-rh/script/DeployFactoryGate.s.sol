// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SWL444Factory.sol";
import "../src/DiamondHandGate.sol";

/// @notice Redeploys just Gate + Factory (e.g. after a Factory-only bytecode
/// change) without touching SWL444NFTMinter, which is independent of the
/// factory/gate pair and doesn't need to move. Kept as a separate script from
/// Deploy.s.sol rather than adding a flag to it, since a from-scratch deploy
/// and a Factory-only redeploy are different enough operations to want
/// distinct, unambiguous entry points.
contract DeployFactoryGateScript is Script {
    address constant UNISWAP_V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    address constant UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    // See Deploy.s.sol's STAKER_FEE_WALLET comment.
    address constant STAKER_FEE_WALLET = 0xC9606B03123E2b4BF5F799a3A89105B792C1D0df;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        DiamondHandGate gate = new DiamondHandGate();

        SWL444Factory factory = new SWL444Factory(
            STAKER_FEE_WALLET,
            UNISWAP_V2_ROUTER,
            UNISWAP_V2_FACTORY,
            address(gate)
        );

        gate.setFactory(address(factory));

        vm.stopBroadcast();

        console.log("DiamondHandGate:", address(gate));
        console.log("SWL444Factory:", address(factory));
        console.log("Uniswap V2 Router:", UNISWAP_V2_ROUTER);
        console.log("Uniswap V2 Factory:", UNISWAP_V2_FACTORY);
        console.log("WETH:", WETH);
    }
}
