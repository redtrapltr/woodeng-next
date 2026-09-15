// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SWL444Token.sol";
import "../src/SWL444Factory.sol";
import "../src/DiamondHandGate.sol";
import "../src/SWL444NFTMinter.sol";

// *** MAINNET deploy script — Robinhood Chain, chain ID 4663. ***
// SWL444Factory.INIT_VIRTUAL_ETH must be 0.23958 ether (2.2 ETH graduation
// raise, 400M/444M BONDING_SUPPLY split, ~102x price multiplier) when this
// runs — see the guard comment on that constant in src/SWL444Factory.sol. Do
// not point this script at chain 46630 (testnet).
contract DeployMainnetScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        DiamondHandGate gate = new DiamondHandGate();

        address uniRouter = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
        address uniFactory = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;
        address feeCollector = 0xC9606B03123E2b4BF5F799a3A89105B792C1D0df;

        SWL444Factory factory = new SWL444Factory(
            feeCollector,
            uniRouter,
            uniFactory,
            address(gate)
        );

        gate.setFactory(address(factory));

        SWL444NFTMinter nftMinter = new SWL444NFTMinter();

        vm.stopBroadcast();

        console.log("=== MAINNET DEPLOYMENT ===");
        console.log("DiamondHandGate:", address(gate));
        console.log("SWL444Factory:", address(factory));
        console.log("SWL444NFTMinter:", address(nftMinter));
        console.log("FeeCollector:", feeCollector);
    }
}
