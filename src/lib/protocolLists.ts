/* ------------------------------------------------------------------ *
 *  protocolLists.ts – gather every mint our contracts ever touched
 * ------------------------------------------------------------------ */
import {
  Connection,
  PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  BorshAccountsCoder,
  Idl,
  utils as anchorUtils,
} from '@project-serum/anchor';

import ammIdl  from '@/idl/idl.json';                  // woodeng_amm
import poolIdl from '@/idl/my_sound_meme_pool.json';   // sound-meme pools

/* PIDs */
import { PROGRAM_ID as AMM_PROGRAM_ID } from '@/lib/constants';
const POOL_PROGRAM_ID = new PublicKey(
  '8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV',
);

const conn = new Connection(
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC as string,
  'confirmed',
);

/* ───────────────────────── MUSIC ───────────────────────── */
export async function listProtocolMusicMints(): Promise<PublicKey[]> {
  const coder = new BorshAccountsCoder(ammIdl as Idl);

  const poolDisc   = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('Pool'),
  );
  const orderDisc  = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('Order'),
  );
  const bundleDisc = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('BundleConfig'),
  );

  /* (1) single-mint pools – first NFT mint */
  const pools = await conn.getProgramAccounts(AMM_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: poolDisc } }],
    dataSlice: { offset: 12, length: 32 },
  });

  /* (2) limit orders – nftMint field */
  const orders = await conn.getProgramAccounts(AMM_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: orderDisc } }],
    dataSlice: { offset: 1 + 8 + 32, length: 32 },
  });

  /* (3) bundle configs – full deserialize for all whitelisted mints */
  const bundleAccs = await conn.getProgramAccounts(AMM_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bundleDisc } }],
  });

  const bundleMints: PublicKey[] = [];
  for (const { account } of bundleAccs) {
    const cfg = coder.decode('BundleConfig', account.data) as any;
    (cfg.mints as PublicKey[]).forEach((m) => {
      if (!m.equals(PublicKey.default)) bundleMints.push(m);
    });
  }

  /* de-dupe & return */
  return [
    ...new Map(
      [...pools, ...orders].map((a) => {
        const mint = new PublicKey(a.account.data as Buffer);
        return [mint.toBase58(), mint];
      }),
    ).values(),
    ...bundleMints,
  ];
}

/* ─────────────────────── SOUND MEMES ───────────────────── */
export async function listSoundMemeMints(): Promise<PublicKey[]> {
  const coder   = new BorshAccountsCoder(poolIdl as Idl);
  const cfgDisc = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('SoundMemeConfig'),
  );

  const cfgAccs = await conn.getProgramAccounts(POOL_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: cfgDisc } }],
    dataSlice: { offset: 8 + 32, length: 32 }, // skip authority
  });

  return cfgAccs.map((a) => new PublicKey(a.account.data as Buffer));
}
