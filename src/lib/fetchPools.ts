import { Program, AnchorProvider, Idl } from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import poolIdl from "../../idl/my_sound_meme_pool.json";
import { Metaplex } from "@metaplex-foundation/js";
const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');

export async function fetchSoundMemePoolsSortedByLiquidity() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const dummyWallet = { publicKey: PublicKey.default } as any;
  const provider = new AnchorProvider(connection, dummyWallet, {});
  const program = new Program(poolIdl as Idl, POOL_PROGRAM_ID, provider);
  const metaplex = Metaplex.make(connection);

  const configs = await program.account.soundMemeConfig.all();
  const pools = await Promise.all(configs.map(async (c: any) => {
    // ...full fetch logic here as in your SoundMemes page
    let meta = {};
    let reserves = { meme: 0, woodeng: 0 };
    let price = 0;
    try {
      const mintPubkey = new PublicKey(c.account.memeMint);
      const nft = await metaplex.nfts().findByMint({ mintAddress: mintPubkey });
      if (!nft.json?.image) console.warn("Missing image for", mintPubkey.toBase58());
      meta = {
        imageUrl: nft.json?.image || "",
        audioUrl: nft.json?.animation_url || "",
        name: nft.name || "",
        description: nft.json?.description || "",
        symbol: nft.symbol || "",
        attributes: nft.json?.attributes || [],
        category: nft.json?.attributes?.find((a: any) => a.trait_type === "Category")?.value || "",
      };
      // Vaults
      const [poolMemeVault] = await PublicKey.findProgramAddress(
        [Buffer.from('pool_meme_vault'), mintPubkey.toBuffer()],
        POOL_PROGRAM_ID
      );
      const [poolWoodengVault] = await PublicKey.findProgramAddress(
        [Buffer.from('pool_woodeng_vault'), mintPubkey.toBuffer()],
        POOL_PROGRAM_ID
      );
      const memeAcct = await connection.getTokenAccountBalance(poolMemeVault);
      const woodengAcct = await connection.getTokenAccountBalance(poolWoodengVault);
      reserves = {
        meme: Number(memeAcct.value.amount),
        woodeng: Number(woodengAcct.value.amount)
      };
      // Price calc (XYK)
      price = (reserves.meme > 0 && reserves.woodeng > 0)
        ? (reserves.woodeng / 10 ** 9) / (reserves.meme / 1)
        : 1;
    } catch (e) {}
    return {
      pubkey: c.publicKey,
      ...c.account,
      ...meta,
      ammReserves: reserves,
      price: price,
    };
  }));

  // Sort descending by woodeng liquidity
  pools.sort((a, b) => (b.ammReserves?.woodeng || 0) - (a.ammReserves?.woodeng || 0));
  return pools;
}
