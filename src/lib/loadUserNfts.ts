/* ------------------------------------------------------------------ *
 *  src/lib/loadUserNfts.ts                                           *
 *  Thin data-adapter used ONLY by the profile page                   *
 * ------------------------------------------------------------------ */
'use client';

import {
  Connection,
  PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';

import {
  AnchorProvider,
  Program,
  Idl,
  BorshCoder,
  BorshAccountsCoder,
  utils as anchorUtils,
} from '@project-serum/anchor';

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { Metaplex } from '@metaplex-foundation/js';

import { PROGRAM_ID } from '@/lib/constants';     // ← same as marketplace
import ammIdl from '@/idl/idl.json';              // marketplace AMM idl

import { listProtocolMusicMints } from '@/lib/protocolLists';
import {
  fetchSoundMemePoolsWithMetadata,
  getUserProtocolNfts,
} from '@/lib/sound-memes';
import { stillOwnsNft } from '@/lib/sound-meme-helpers';

import type { NFT } from '@/types/nft';
import type { PoolType } from '@/lib/sound-meme-types';
/* ---- Sound-Meme program (same as /sound-memes page) -------------- */
import poolIdlJson from '@/idl/my_sound_meme_pool.json';
const poolIdl: Idl         = poolIdlJson as Idl;
const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');


/* ------------------------------------------------------------------ */
/*  Connection & common helpers                                       */
/* ------------------------------------------------------------------ */
const conn = new Connection(
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC as string,
  'confirmed',
);
const mx = Metaplex.make(conn);

const TOKEN_MD_PID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

const metadataPda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_MD_PID.toBuffer(), mint.toBuffer()],
    TOKEN_MD_PID,
  )[0];

/* ipfs/arweave → https URL (same rules as Marketplace loader) */
const gateways = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://nftstorage.link/ipfs/${cid}`,
];
const looksLikeCid = (x?: string) => !!x && /^[a-z0-9]{46,59}$/i.test(x);
function toHttp(raw?: string, g = 0): string {
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return gateways[g](raw.slice(7));
  if (raw.startsWith('ar://'))   return `https://arweave.net/${raw.slice(5)}`;
  if (looksLikeCid(raw))         return gateways[g](raw);
  return raw;
}

/* ------------------------------------------------------------------ */
/*  1.  MUSIC NFTs  (wallet ▸ AMM pool ▸ fixed-price order)            */
/* ------------------------------------------------------------------ */
export async function loadUserMusicNfts(owner: PublicKey) {
  const out: NFT[] = [];
  const ownerKey   = owner.toBase58();

  /* ---------- a) list of mints actually held in wallet ------------- */
  const tokenAccs = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const walletMints = new Set<string>();
  tokenAccs.value.forEach(({ account }) => {
    const info: any = account.data.parsed.info;
    if (info.tokenAmount.amount === '1' && info.tokenAmount.decimals === 0) {
      walletMints.add(info.mint as string);              // NFT mint
    }
  });

  /* nothing ⇒ quick return */
  if (walletMints.size === 0) return { created: [], collected: [] };

  /* ---------- b) prepare Anchor coder for the AMM program ---------- */
  const coder = new BorshCoder(ammIdl as Idl);

  /* discriminator bytes */
  const poolDisc  = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('Pool'),
  );
  const orderDisc = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('Order'),
  );

  /* ---------- c) scan all pools (single-mint only) ----------------- */
  const rawPools = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: poolDisc } }],
  });

  /* quick inline price helper (same math as marketplace) */
  const poolBuyPrice = (p: any): number => {
    const n = Number(p.nftReserves?.[0] ?? 0);
    const x0 = n + Number(p.vx ?? 0);
    if (x0 <= 1) return Infinity;
    const y0 = Number(p.tokenReserve ?? 0) + Number(p.vy ?? 0);
    const k  = BigInt(x0) * BigInt(y0);
    const y1 = Number(k / BigInt(x0 - 1));
    return (y1 - y0) / 1e9;                              // lamports → WOODENG
  };

  for (const { pubkey, account } of rawPools) {
    let pool: any;
    try { pool = coder.accounts.decode('Pool', account.data); }
    catch { continue; }

    if (pool.kind.single === undefined) continue;        // skip bundle pools

    const mint = new PublicKey(pool.nftMints[0]);
    if (!walletMints.has(mint.toBase58())) continue;     // user doesn’t own

    const priceWdg = poolBuyPrice(pool);
    if (!Number.isFinite(priceWdg)) continue;

    /* pull & robust-fetch metadata (same 3-gateway strategy) */
    const nftModel = await mx.nfts().findByMint({ mintAddress: mint });
    let meta: any = nftModel.json ?? null;
    if (!meta) {
      const uri = nftModel.uri;
      const cid = uri.startsWith('ipfs://') ? uri.slice(7) : '';
      for (let i = 0; i < 3 && !meta; i++) {
        try {
          meta = await fetch(cid ? gateways[i](cid) : uri).then((r) => r.json());
        } catch {/* try next gateway */}
      }
    }
    meta ||= {};

    out.push({
      id:        mint.toBase58(),
      mint:      mint.toBase58(),
      poolPda:   pubkey.toBase58(),
      title:     nftModel.name,
      imageUrl:  toHttp(meta.image) || '/blank.png',
      audioUrl:  toHttp(meta.properties?.audio) || toHttp(meta.animation_url),
      price:     { sol: 0, woodeng: priceWdg, usd: 0 },
      status:    'available',
      type:      'single',
      tokenType: 'woodeng',
      nftType:   'music',
      hasPool:   true,
      popularity: 0,
      createdAt : new Date().toISOString(),
      collection: {
        name:       meta.collection?.name ?? 'Unknown',
        verified:   !!meta.collection,
        floorPrice: 0,
        volume24h:  0,
      },
      metadata: {
        artist:     meta.properties?.artist ?? 'Unknown',
        genre:      meta.properties?.genre  ?? 'N/A',
        duration:   Number(meta.properties?.duration ?? 0),
        style:      meta.properties?.style,
        collection: meta.collection?.name,
        royalties:  nftModel.sellerFeeBasisPoints / 100,
      },
    } as NFT);
  }

  /* ---------- d) scan direct listings created by the user ---------- */
  const rawOrders = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: orderDisc } }],
  });

  for (const { account } of rawOrders) {
    let order: any;
    try { order = coder.accounts.decode('Order', account.data); }
    catch { continue; }

    /* only the user’s own listings (they’re the seller) */
    if (order.seller.toBase58() !== ownerKey) continue;

    /* if escrow already closed, skip */
    if (!(await conn.getAccountInfo(order.escrow))) continue;

    const mint = new PublicKey(order.nftMint);

    /* avoid duplicates – if same NFT already had a pool entry prefer that */
    if (out.some((n) => n.id === mint.toBase58() && n.hasPool)) continue;

    const nftModel = await mx.nfts().findByMint({ mintAddress: mint });
    let meta: any = nftModel.json ?? null;
    if (!meta) {
      const uri = nftModel.uri;
      const cid = uri.startsWith('ipfs://') ? uri.slice(7) : '';
      for (let i = 0; i < 3 && !meta; i++) {
        try {
          meta = await fetch(cid ? gateways[i](cid) : uri).then((r) => r.json());
        } catch {/* try next */}
      }
    }
    meta ||= {};

    out.push({
      id:        mint.toBase58(),
      mint:      mint.toBase58(),
      title:     nftModel.name,
      imageUrl:  toHttp(meta.image) || '/blank.png',
      audioUrl:  toHttp(meta.properties?.audio) || toHttp(meta.animation_url),
      price:     { sol: 0, woodeng: order.price / 1e9, usd: 0 },
      status:    'listed',
      type:      'single',
      tokenType: 'woodeng',
      nftType:   'music',
      hasPool:   false,
      listing:   order,                     // <— used by profile page
      popularity: 0,
      createdAt : new Date().toISOString(),
      collection: {
        name:       meta.collection?.name ?? 'Unknown',
        verified:   !!meta.collection,
        floorPrice: 0,
        volume24h:  0,
      },
      metadata: {
        artist:     meta.properties?.artist ?? 'Unknown',
        genre:      meta.properties?.genre  ?? 'N/A',
        duration:   Number(meta.properties?.duration ?? 0),
        style:      meta.properties?.style,
        collection: meta.collection?.name,
        royalties:  nftModel.sellerFeeBasisPoints / 100,
      },
    } as NFT);
  }

  /* ---------- e) split created / collected (same rules) ------------ */
  return splitByCreator(out, owner);
}

/* ------------------------------------------------------------------ */
/*  2.  SOUND-MEME NFTs  (unchanged)                                   */
/* ------------------------------------------------------------------ */
export async function loadUserSoundMemes(owner: PublicKey) {
  /* …  (exact same code you already had – untouched) …               */
  // ———👇 KEEP YOUR EXISTING IMPLEMENTATION ———
  const dummyWallet = { publicKey: owner } as any;
  const provider    = new AnchorProvider(conn, dummyWallet, {});
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  const pools    : PoolType[] = await fetchSoundMemePoolsWithMetadata();
  const lockers  = await getUserProtocolNfts(
    owner,
    pools.map((p) => p.memeMint),
  );
  const collected: NFT[] = [];

  for (const pool of pools) {
    const key         = pool.memeMint.toBase58();
    const poolLockers = lockers[key];

    if (poolLockers && Object.keys(poolLockers).length > 0) {
      const userLockers = await Promise.all(
        Object.entries(poolLockers).map(async ([lockId, { mint }]) => ({
          lockId : Number(lockId),
          mint   : mint.toBase58(),
          balance: (await stillOwnsNft(mint, owner)) ? 1 : 0 as 0 | 1,
        })),
      );

      collected.push({
        id: key,
        mint: key,
        title: pool.name || pool.symbol || key.slice(0, 4) + '…',
        imageUrl: toHttp(pool.imageUrl) || '/blank.png',
        audioUrl: toHttp(pool.audioUrl) || '',
        price: { sol: 0, woodeng: pool.price ?? 0, usd: 0 },
        status: 'available',
        type: 'single',
        tokenType: 'woodeng',
        nftType: 'soundmeme',
        hasPool: true,
        popularity: 0,
        createdAt: new Date().toISOString(),
        collection: {
          name: 'Sound Meme',
          verified: true,
          floorPrice: 0,
          volume24h: 0,
        },
        metadata: {
          artist: pool.attributes?.find((a) => a.trait_type === 'Artist')?.value ?? 'Unknown',
          genre:  pool.attributes?.find((a) => a.trait_type === 'Genre') ?.value ?? 'N/A',
          duration: 0,
        },
        userLockers,
        pool,
      });
    }
  }

  return { created: [], collected };
}

/* ------------------------------------------------------------------ */
/*  Helper: split list into “created” & “collected”                    */
/* ------------------------------------------------------------------ */
function splitByCreator(list: NFT[], owner: PublicKey) {
  const key = owner.toBase58();
  return {
    created: list.filter(
      (n) => n.creators?.[0] === key || n.updateAuthority === key,
    ),
    collected: list.filter(
      (n) => n.creators?.[0] !== key && n.updateAuthority !== key,
    ),
  };
}
