/* src/lib/loadMarketNfts.ts -------------------------------------------------- */
'use client';

import {
  Connection, PublicKey, clusterApiUrl, AccountInfo,
} from '@solana/web3.js';
import {
  AnchorProvider, Program, Idl,
  BorshCoder, BorshAccountsCoder,
  utils as anchorUtils,
} from '@project-serum/anchor';
import { Metaplex } from '@metaplex-foundation/js';

import idl            from '@/idl/idl.json';
import { PROGRAM_ID }  from '@/lib/constants';
import { NFT }         from '@/types/nft';



// Identify the quote token from a mint
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
// set your real WOODENG mint here (or via env)
const WOODENG = new PublicKey(process.env.NEXT_PUBLIC_WOODENG_MINT || PublicKey.default.toBase58());

const normTokenFromMint = (mint: PublicKey): 'sol' | 'woodeng' =>
  mint.equals(WSOL) ? 'sol' : mint.equals(WOODENG) ? 'woodeng' : 'woodeng';

// generic XYK buy price (quote has 9 decimals)
function xykBuyPrice(x: number, y: number): number {
  // buy 1: (sum_x -> sum_x - 1), cost = new_y - y
  if (x <= 1) return Infinity;
  const k  = BigInt(x) * BigInt(y);
  const y1 = Number(k / BigInt(x - 1));
  return (y1 - y) / 1e9;
}

/* ------------------------------------------------------------------ */
/* URL helpers – identical rules as the detail page / Web3Media.jsx   */
/* ------------------------------------------------------------------ */
const gateways = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://nftstorage.link/ipfs/${cid}`,
];

const looksLikeCid = (x?: string) => !!x && /^[a-z0-9]{46,59}$/i.test(x);

const toHttp = (raw?: string, g = 0): string => {
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return gateways[g](raw.slice(7));
  if (raw.startsWith('ar://'))   return `https://arweave.net/${raw.slice(5)}`;
  if (looksLikeCid(raw))         return gateways[g](raw);
  return raw;                                 // already https:// …
};

/* ------------------------------------------------------------------ */
/* Misc helpers                                                       */
/* ------------------------------------------------------------------ */

/** Anchor coder (decode account data) */
const coder = new BorshCoder(idl as Idl);

/** xy-k price for single-mint pools (WOODENG, 1 e-9) */
function poolBuyPrice(pool: any): number {
  const nftCnt = Number(pool.nftReserves?.[0] ?? 0);
  const x0     = nftCnt + Number(pool.vx ?? 0);
  if (x0 <= 1) return Infinity;                             // empty vault

  const y0 = Number(pool.tokenReserve ?? 0) + Number(pool.vy ?? 0);
  const k  = BigInt(x0) * BigInt(y0);
  const y1 = Number(k / BigInt(x0 - 1));
  return (y1 - y0) / 1e9;                                   // lamports → WOODENG
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '');

/* ------------------------------------------------------------------ */
/* Loader                                                             */
/* ------------------------------------------------------------------ */
export async function loadMarketNfts(): Promise<NFT[]> {
  const conn      = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const provider  = new AnchorProvider(conn, {} as any, {});
  const mx        = Metaplex.make(conn);

  const out: NFT[] = [];

  /* ---------- 1) AMM pools (single-mint) ------------------------- */
  const poolDisc = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('Pool'),
  );

  const rawPools = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: poolDisc } }],
  });

  for (const { pubkey, account } of rawPools) {
    let pool: any;
    try { pool = coder.accounts.decode('Pool', account.data); }
    catch { continue; }

    if (pool.kind.single === undefined) continue;            // skip bundles

    const x0 = Number(pool.nftReserves?.[0] ?? 0) + Number(pool.vx ?? 0);
const y0 = Number(pool.tokenReserve ?? 0)     + Number(pool.vy ?? 0);
const buy = xykBuyPrice(x0, y0);
if (!Number.isFinite(buy)) continue;

const tokenType = normTokenFromMint(new PublicKey(pool.tokenMint));


    const mint      = new PublicKey(pool.nftMints[0]);
    const nftModel  = await mx.nfts().findByMint({ mintAddress: mint });

    // resilient JSON fetch (same strategy as detail page)
    let meta: any = nftModel.json ?? null;
    if (!meta) {
      const uri = nftModel.uri;
      const cid = uri.startsWith('ipfs://') ? uri.slice(7) : '';
      for (let i = 0; i < 3 && !meta; i++) {
        try {
          const url = cid ? gateways[i](cid) : uri;
          meta = await fetch(url).then(r => r.json());
        } catch {/* try next */}
      }
    }
    meta ||= {};

    const rawImg   = s(meta.image);
    const rawAudio = s(meta.properties?.audio) || s(meta.animation_url);

    out.push({
      id:         mint.toBase58(),
      mint:       mint.toBase58(),
      poolPda:    pubkey.toBase58(),
      title:      nftModel.name,
      imageUrl:   toHttp(rawImg) || '/blank.png',
      audioUrl:   toHttp(rawAudio),
      price: {
  sol:     tokenType === 'sol'     ? buy : 0,
  woodeng: tokenType === 'woodeng' ? buy : 0,
  usd: 0,
},
status:     'available',
type:       'single',
tokenType,

      nftType:    'music',
      hasPool:    true,
      popularity: 0,
      createdAt:  new Date().toISOString(),
      collection: {
        name:       s(meta.collection?.name) || 'Unknown',
        verified:   !!meta.collection,
        floorPrice: 0,
        volume24h:  0,
      },
      metadata: {
        artist:     s(meta.properties?.artist) || 'Unknown',
        genre:      s(meta.properties?.genre)  || 'N/A',
        duration:   Number(meta.properties?.duration ?? 0),
        style:      s(meta.properties?.style),
        collection: s(meta.collection?.name),
        royalties:  nftModel.sellerFeeBasisPoints / 100,
      },
    });
  }


  /* ---------- 2) AMM bundles (BundleConfig) ----------------------- */
const bundleDisc = anchorUtils.bytes.bs58.encode(
  BorshAccountsCoder.accountDiscriminator('BundleConfig'),
);

const rawBundles = await conn.getProgramAccounts(PROGRAM_ID, {
  filters: [{ memcmp: { offset: 0, bytes: bundleDisc } }],
});

for (const { pubkey, account } of rawBundles) {
  let cfg: any;
  try { cfg = coder.accounts.decode('BundleConfig', account.data); }
  catch { continue; }

  // Σx across all bundle mints (include vx)
  const sumX = Number(cfg.vx ?? 0) + (cfg.nftReserves || []).reduce((a: number, b: any) => a + Number(b || 0), 0);
  const sumY = Number(cfg.tokenReserve ?? 0) + Number(cfg.vy ?? 0);
  const buy  = xykBuyPrice(sumX, sumY);
  if (!Number.isFinite(buy)) continue;

  const tokenType = normTokenFromMint(new PublicKey(cfg.tokenMint));

  // choose a representative mint (prefer one with reserve > 0)
  const mintStrs: string[] = (cfg.mints || []).map((m: any) => new PublicKey(m).toBase58());
  const reserves: number[] = (cfg.nftReserves || []).map((n: any) => Number(n || 0));
  const liveIdx = reserves.findIndex((r) => r > 0);
  const repMint = liveIdx >= 0 && mintStrs[liveIdx] ? new PublicKey(mintStrs[liveIdx]) :
                  mintStrs[0] ? new PublicKey(mintStrs[0]) : null;

  // derive a title/cover/audio from a representative mint (best effort)
  let title = `Bundle ${pubkey.toBase58().slice(0, 6)}…`;
  let imageUrl = '/blank.png';
  let audioUrl = '';

  if (repMint) {
    try {
      const rep = await mx.nfts().findByMint({ mintAddress: repMint });
      title = rep.name || title;

      let meta: any = rep.json ?? null;
      if (!meta) {
        const uri = rep.uri;
        const cid = uri.startsWith('ipfs://') ? uri.slice(7) : '';
        for (let i = 0; i < 3 && !meta; i++) {
          try {
            const url = cid ? gateways[i](cid) : uri;
            meta = await fetch(url).then(r => r.json());
          } catch {/* try next */}
        }
      }
      meta ||= {};
      imageUrl = toHttp(String(meta.image) || '') || imageUrl;
      audioUrl = toHttp(String(meta.properties?.audio) || String(meta.animation_url) || '');
    } catch {/* ignore */}
  }

  out.push({
    id:        pubkey.toBase58(),      // unique id for bundle
    title,
    imageUrl,
    audioUrl,
    price: {
      sol:     tokenType === 'sol'     ? buy : 0,
      woodeng: tokenType === 'woodeng' ? buy : 0,
      usd: 0,
    },
    status:     'available',
    type:       'bundle',
    tokenType,
    nftType:    'soundmeme',           // adjust to your taxonomy if needed
    hasPool:    true,
    pool:       pubkey.toBase58(),     // <- lets UI detect a “pool”
    popularity: 0,
    createdAt:  new Date().toISOString(),
    collection: { name: 'Bundle', verified: false, floorPrice: 0, volume24h: 0 },
    metadata:   { artist: 'Various', genre: 'N/A', duration: 0 },
  } as NFT);
}


  /* ---------- 2) fixed-price orders ------------------------------ */
  const orderDisc = anchorUtils.bytes.bs58.encode(
    BorshAccountsCoder.accountDiscriminator('Order'),
  );

  const rawOrders = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: orderDisc } }],
  });

  for (const { account } of rawOrders) {
    let order: any;
    try { order = coder.accounts.decode('Order', account.data); }
    catch { continue; }

    /* skip orders whose escrow already closed */
    if (!(await conn.getAccountInfo(order.escrow))) continue;

    const mint      = new PublicKey(order.nftMint);
    const nftModel  = await mx.nfts().findByMint({ mintAddress: mint });

    let meta: any = nftModel.json ?? null;
    if (!meta) {
      const uri = nftModel.uri;
      const cid = uri.startsWith('ipfs://') ? uri.slice(7) : '';
      for (let i = 0; i < 3 && !meta; i++) {
        try {
          const url = cid ? gateways[i](cid) : uri;
          meta = await fetch(url).then(r => r.json());
        } catch {/* try next */}
      }
    }
    meta ||= {};

    const rawImg   = s(meta.image);
    const rawAudio = s(meta.properties?.audio) || s(meta.animation_url);

    out.push({
      id:         mint.toBase58(),
      mint:       mint.toBase58(),
      title:      nftModel.name,
      imageUrl:   toHttp(rawImg) || '/blank.png',
      audioUrl:   toHttp(rawAudio),
      price:      { sol: 0, woodeng: order.price / 1e9, usd: 0 },
      status:     'listed',
      seller : order.seller.toBase58(), 
      type:       'single',
      tokenType:  'woodeng',
      nftType:    'music',
      hasPool:    false,
      popularity: 0,
      createdAt:  new Date().toISOString(),
      collection: {
        name:       s(meta.collection?.name) || 'Unknown',
        verified:   !!meta.collection,
        floorPrice: 0,
        volume24h:  0,
      },
      metadata: {
        artist:     s(meta.properties?.artist) || 'Unknown',
        genre:      s(meta.properties?.genre)  || 'N/A',
        duration:   Number(meta.properties?.duration ?? 0),
        style:      s(meta.properties?.style),
        collection: s(meta.collection?.name),
        royalties:  nftModel.sellerFeeBasisPoints / 100,
      },
    });
  }

  /* any extra sources could be merged here */

  return out;
}
