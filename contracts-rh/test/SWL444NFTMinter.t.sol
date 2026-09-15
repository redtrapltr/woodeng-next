// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SWL444Token.sol";
import "../src/SWL444NFTMinter.sol";

contract SWL444NFTMinterTest is Test {
    SWL444NFTMinter minter;
    SWL444Token token;

    address creator = makeAddr("creator");
    address user = makeAddr("user");
    address stranger = makeAddr("stranger");

    uint256 constant LOCK_AMOUNT = 444_000 * 1e18;

    function setUp() public {
        minter = new SWL444NFTMinter();
        // This test contract is msg.sender for the token constructor, which
        // makes it the token's "factory" — lets us mint balances directly
        // without standing up the full SWL444Factory bonding curve.
        token = new SWL444Token("Test Meme", "TEST", "ipfs://original", creator, 18);
        token.mint(user, LOCK_AMOUNT * 2);
    }

    function test_MintLocksTokensAndIssuesNFT() public {
        vm.startPrank(user);
        token.approve(address(minter), LOCK_AMOUNT);
        uint256 tokenId = minter.mintNFT(address(token), "ipfs://nft-metadata-1");
        vm.stopPrank();

        assertEq(minter.ownerOf(tokenId), user);
        assertEq(token.balanceOf(user), LOCK_AMOUNT);
        assertEq(token.balanceOf(address(minter)), LOCK_AMOUNT);
        assertEq(minter.tokenURI(tokenId), "ipfs://nft-metadata-1");
        assertEq(minter.userNftCount(user, address(token)), 1);
    }

    /// The NFT stores whatever URI the caller passes at mint time — it never
    /// reads the meme token's own metadataUri, so it can't drift even after
    /// the creator updates the token's metadata post-mint.
    function test_MintedUriIsIndependentOfTokenMetadataUri() public {
        vm.startPrank(user);
        token.approve(address(minter), LOCK_AMOUNT);
        uint256 tokenId = minter.mintNFT(address(token), "ipfs://nft-snapshot-at-mint");
        vm.stopPrank();

        assertEq(minter.tokenURI(tokenId), "ipfs://nft-snapshot-at-mint");

        // Creator updates the token's own metadata after minting — the NFT's
        // stored URI must not follow it.
        vm.prank(creator);
        token.updateMetadataUri("ipfs://token-updated-later");
        assertEq(minter.tokenURI(tokenId), "ipfs://nft-snapshot-at-mint");
    }

    function test_RevertWhen_MintWithEmptyMetadataUri() public {
        vm.startPrank(user);
        token.approve(address(minter), LOCK_AMOUNT);
        vm.expectRevert("Empty metadata URI");
        minter.mintNFT(address(token), "");
        vm.stopPrank();
    }

    function test_RevertWhen_MintWithoutApproval() public {
        vm.prank(user);
        vm.expectRevert();
        minter.mintNFT(address(token), "ipfs://nft-metadata");
    }

    function test_BurnReturnsLockedTokens() public {
        vm.startPrank(user);
        token.approve(address(minter), LOCK_AMOUNT);
        uint256 tokenId = minter.mintNFT(address(token), "ipfs://nft-metadata");

        minter.burnNFT(tokenId);
        vm.stopPrank();

        assertEq(token.balanceOf(user), LOCK_AMOUNT * 2);
        assertEq(token.balanceOf(address(minter)), 0);
        assertEq(minter.userNftCount(user, address(token)), 0);

        vm.expectRevert();
        minter.ownerOf(tokenId);
    }

    function test_RevertWhen_BurnByNonOwner() public {
        vm.startPrank(user);
        token.approve(address(minter), LOCK_AMOUNT);
        uint256 tokenId = minter.mintNFT(address(token), "ipfs://nft-metadata");
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert("Not NFT owner");
        minter.burnNFT(tokenId);
    }

    function test_RevertWhen_TokenURIForNonexistentToken() public {
        vm.expectRevert();
        minter.tokenURI(999);
    }
}
