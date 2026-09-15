// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SWL444NFTMinter is ERC721 {

    uint256 public constant LOCK_AMOUNT = 444_000 * 1e18; // 444K tokens to mint

    uint256 private _nextTokenId;
    address public factory;

    struct LockedNFT {
        address memeToken;        // which SWL-444 token was locked
        uint256 lockedAmount;     // always 444K
        uint256 mintTimestamp;
        string metadataUri;       // snapshot of metadata at time of mint
        address owner;
    }

    mapping(uint256 => LockedNFT) public lockedNfts;

    // Track how many NFTs each user has minted per token
    mapping(address => mapping(address => uint256)) public userNftCount;

    event NFTMinted(
        uint256 indexed tokenId,
        address indexed memeToken,
        address indexed minter,
        string metadataUri,
        uint256 timestamp
    );

    event NFTBurned(
        uint256 indexed tokenId,
        address indexed memeToken,
        address indexed burner,
        uint256 tokensReturned
    );

    constructor() ERC721("SWL-444 Living NFT", "SWL-NFT") {
        factory = msg.sender;
    }

    /// @notice Lock 444K tokens and mint an NFT pointing at caller-supplied
    /// metadata. The caller (frontend) builds ERC721-shaped NFT metadata
    /// (name/description/attributes) from the meme token's current state and
    /// pins it separately — the contract just stores whatever URI it's given,
    /// so it never points back at the token's own (mutable) metadataUri and
    /// can't drift if the creator updates the token later.
    function mintNFT(address memeToken, string calldata nftMetadataUri) external returns (uint256) {
        require(bytes(nftMetadataUri).length > 0, "Empty metadata URI");

        // Transfer 444K tokens from user to this contract (locked)
        require(
            IERC20(memeToken).transferFrom(msg.sender, address(this), LOCK_AMOUNT),
            "Transfer failed - approve 444K tokens first"
        );

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);

        lockedNfts[tokenId] = LockedNFT({
            memeToken: memeToken,
            lockedAmount: LOCK_AMOUNT,
            mintTimestamp: block.timestamp,
            metadataUri: nftMetadataUri,
            owner: msg.sender
        });

        userNftCount[msg.sender][memeToken]++;

        emit NFTMinted(tokenId, memeToken, msg.sender, nftMetadataUri, block.timestamp);

        return tokenId;
    }

    /// @notice Burn NFT and unlock the 444K tokens back to the owner
    function burnNFT(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not NFT owner");

        LockedNFT storage nft = lockedNfts[tokenId];
        address memeToken = nft.memeToken;
        uint256 amount = nft.lockedAmount;

        // Burn the NFT
        _burn(tokenId);

        // Return locked tokens
        require(
            IERC20(memeToken).transfer(msg.sender, amount),
            "Token return failed"
        );

        userNftCount[msg.sender][memeToken]--;

        emit NFTBurned(tokenId, memeToken, msg.sender, amount);

        delete lockedNfts[tokenId];
    }

    /// @notice NFT metadata points to the snapshot URI from mint time.
    /// _requireOwned reverts ERC721NonexistentToken for a burned/never-minted
    /// id, so there's no need for a separate existence check here.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return lockedNfts[tokenId].metadataUri;
    }

    /// @notice How many NFTs an address currently holds for a specific meme token
    function getNFTsForToken(address owner, address memeToken) external view returns (uint256) {
        return userNftCount[owner][memeToken];
    }
}
