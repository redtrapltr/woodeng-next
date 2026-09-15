// Living NFT helpers — SWL444NFTMinter has no ERC721Enumerable extension, so
// a holder's currently-owned NFTs for one meme token are reconstructed from
// NFTMinted logs (indexed by memeToken + minter) the same way robinhoodStats
// reconstructs holder balances from Transfer logs.
import type { Address } from "viem";
import { robinhoodPublicClient, RH_CONFIG, NFT_MINTER_ABI } from "./robinhoodChain";

export const NFT_MINTED_EVENT = {
  type: "event", name: "NFTMinted",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "memeToken", type: "address", indexed: true },
    { name: "minter", type: "address", indexed: true },
    { name: "metadataUri", type: "string", indexed: false },
    { name: "timestamp", type: "uint256", indexed: false },
  ],
} as const;

export type LivingNft = {
  tokenId: bigint;
  metadataUri: string;
  mintTimestamp: number;
};

/** Currently-held Living NFTs the given owner has minted for one meme token.
 * A minted id that was later burned (or transferred away) drops out via the
 * ownerOf check — NFTMinted logs alone only prove it was minted, not that
 * it's still held. */
export async function getUserLivingNfts(memeToken: Address, owner: Address): Promise<LivingNft[]> {
  const logs = await robinhoodPublicClient.getLogs({
    address: RH_CONFIG.nftMinter,
    event: NFT_MINTED_EVENT,
    args: { memeToken, minter: owner },
    fromBlock: 0n,
    toBlock: "latest",
  });

  const candidates = (logs as any[]).map((l) => ({
    tokenId: l.args.tokenId as bigint,
    metadataUri: l.args.metadataUri as string,
    mintTimestamp: Number(l.args.timestamp as bigint),
  }));

  const owned = await Promise.all(
    candidates.map(async (c) => {
      try {
        const currentOwner = await robinhoodPublicClient.readContract({
          address: RH_CONFIG.nftMinter, abi: NFT_MINTER_ABI, functionName: "ownerOf", args: [c.tokenId],
        });
        return (currentOwner as string).toLowerCase() === owner.toLowerCase() ? c : null;
      } catch {
        return null; // burned — ownerOf reverts (ERC721NonexistentToken)
      }
    })
  );

  return owned.filter((c): c is LivingNft => c !== null);
}
