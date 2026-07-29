// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SWL444Token is ERC20 {
    string public metadataUri;
    address public creator;
    address public factory;
    uint8 private _decimals;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory uri_,
        address creator_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        metadataUri = uri_;
        creator = creator_;
        factory = msg.sender;
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyFactory {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyFactory {
        _burn(from, amount);
    }

    /// @notice Creator can update metadata URI (Living Meme feature)
    function updateMetadataUri(string memory newUri) external {
        require(msg.sender == creator, "Only creator");
        metadataUri = newUri;
    }
}
