// app/api/memes/home-panels/route.ts

import { NextResponse } from "next/server";
import type { Idl } from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import poolIdlJson from "@/idl/my_sound_meme_pool.json";
import { pool as pg } from "@/lib/pg";
import * as Hidden from "@/lib/hidden"
import bs58 from "bs58";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---------- IPFS helper (KEEP THIS ONE) ---------- */
const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/$/, "") || "https://ipfs.io";

const toHttp = (url?: string, absolute = false) => {
  if (!url) return undefined;
  if (url.startsWith("ipfs://")) {
    const rest = url.slice(7).replace(/^ipfs\//, "");
    return absolute ? `${IPFS_GATEWAY}/ipfs/${rest}` : `/ipfs/${rest}`;
  }
  return url;
};



/* ---------- env / cluster ---------- */
const RPC_URL =
  process.env.RPC_URL ||
  process.env.SOLANA_RPC ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  "";

if (!RPC_URL) {
  throw new Error(
    "Missing RPC_URL / SOLANA_RPC / NEXT_PUBLIC_SOLANA_RPC / NEXT_PUBLIC_HELIUS_RPC_URL"
  );
}

const SOLANA_CLUSTER =
  process.env.SOLANA_CLUSTER ||
  (RPC_URL.toLowerCase().includes("devnet") ? "devnet" :
   RPC_URL.toLowerCase().includes("testnet") ? "testnet" : "mainnet-beta");



/* ---------- chain constants ---------- */
const POOL_PROGRAM_ID = new PublicKey("8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV");
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const QUOTE_DECIMALS = 9; // WOODENG / SOL
const CONFIG_VERSION = 17;

/* ---------- helpers ---------- */
const clean = (s?: string) =>
  (s ?? "").replace(/\0/g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();



function readU64LE(buf: Buffer, off: number) {
  return Number(buf.readBigUInt64LE(off));
}

async function getMultiple(conn: Connection, keys: PublicKey[], chunk = 100) {
  const out: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    const infos = await conn.getMultipleAccountsInfo(part, "confirmed");
    out.push(...infos);
  }
  return out;
}

/** Bonding-curve spot price (matches client math) */
function bondingSpotPrice(cfg: { vtokens: number; vwoodeng: number; bondingSold: number }) {
  const { vtokens, vwoodeng, bondingSold } = cfg;
  if (!vtokens || !vwoodeng) return NaN;
  const thresholdRaw = 44_000_000; // raw tokens to migration on curve
  const goalLamports = 35 * 10 ** QUOTE_DECIMALS; // migration threshold in lamports
  const p0 = vwoodeng / vtokens;
  const k = Math.log(goalLamports / p0) / thresholdRaw;
  return (p0 * Math.exp(k * bondingSold)) / 10 ** QUOTE_DECIMALS;
}

type PoolLite = {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  price_chain: number; // WOODENG (from chain)
  mcap_chain: number;  // WOODENG (price_chain * supply)
  supply_ui: number;
};

/** Pull all pools: config + token vaults + token metadata json */
async function fetchPools(): Promise<PoolLite[]> {
  const connection = new Connection(RPC_URL, "confirmed");
  const dummy = { publicKey: new PublicKey("11111111111111111111111111111111") } as any;
  const provider = new AnchorProvider(connection, dummy, { commitment: "confirmed" });
  const program = new Program(poolIdlJson as Idl, POOL_PROGRAM_ID, provider);

// 1) configs — try Anchor accessor, fall back to raw scan+decode using discriminator
let cfgAll: Array<{ publicKey: PublicKey; account: any }>;
try {
  cfgAll = await (program.account as any).soundMemeConfig.all();
} catch (_) {
  // robust fallback: filter by Anchor discriminator for "SoundMemeConfig"
  const disc = await (program.coder.accounts as any).accountDiscriminator?.("SoundMemeConfig");
  if (!disc) throw new Error("Could not compute account discriminator for SoundMemeConfig");

  const raw = await connection.getProgramAccounts(POOL_PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(Buffer.from(disc)),
        },
      },
    ],
  });

  const decoded: Array<{ publicKey: PublicKey; account: any }> = [];
  for (const { pubkey, account } of raw) {
    try {
      const acc = program.coder.accounts.decode("SoundMemeConfig", account.data) as any;
      decoded.push({ publicKey: pubkey, account: acc });
    } catch {
      // skip quietly
    }
  }
  cfgAll = decoded;
}

// keep only the right version & not blacklisted
const cfgs = (cfgAll || [])
  .filter((x) => {
    const isRightVersion = Number(x.account?.version) === CONFIG_VERSION;
    // x.account.memeMint may already be a PublicKey; the constructor accepts both
 const mintB58 = new PublicKey(x.account?.memeMint).toBase58();
 const HIDDEN: Set<string> =
   (Hidden as any)?.HIDDEN_SOUND_MEMES instanceof Set
     ? (Hidden as any).HIDDEN_SOUND_MEMES
     : new Set<string>();
 return isRightVersion && !HIDDEN.has(mintB58);
  })
  .map((x) => ({
    pubkey: x.publicKey,
    data: x.account,
  }));

if (!cfgs.length) return [];





  const memeMints = cfgs.map((c) => new PublicKey(c.data.memeMint));

  const memeVaults = await Promise.all(
    memeMints.map(
      async (m) =>
        (
          await PublicKey.findProgramAddress(
            [Buffer.from("pool_meme_vault"), m.toBuffer()],
            POOL_PROGRAM_ID
          )
        )[0]
    )
  );
  const woodVaults = await Promise.all(
    memeMints.map(
      async (m) =>
        (
          await PublicKey.findProgramAddress(
            [Buffer.from("pool_woodeng_vault"), m.toBuffer()],
            POOL_PROGRAM_ID
          )
        )[0]
    )
  );
  const mdPDAs = await Promise.all(
    memeMints.map(
      async (m) =>
        (
          await PublicKey.findProgramAddress(
            [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), m.toBuffer()],
            METADATA_PROGRAM_ID
          )
        )[0]
    )
  );

  const [mintInfos, memeVaultInfos, woodVaultInfos, metaInfos] = await Promise.all([
    getMultiple(connection, memeMints),
    getMultiple(connection, memeVaults),
    getMultiple(connection, woodVaults),
    getMultiple(connection, mdPDAs),
  ]);

  const chain = memeMints.map((_, i) => {
    // Mint
    const mi = mintInfos[i]?.data;
    let decimals = 0;
    let supplyUi = 0;
    if (mi && mi.length >= 82) {
      decimals = mi[44];
      const supplyRaw = readU64LE(mi, 36);
      supplyUi = supplyRaw / 10 ** decimals;
    }

    // Vaults
    const memeAcc = memeVaultInfos[i]?.data;
    const woodAcc = woodVaultInfos[i]?.data;
    const memeReserveRaw = memeAcc ? readU64LE(memeAcc, 64) : 0;
    const woodReserveLamports = woodAcc ? readU64LE(woodAcc, 64) : 0;

    // Metadata PDA
    let metaName = "",
      metaSymbol = "",
      metaUri: string | undefined = undefined;
    const mdi = metaInfos[i]?.data;
    if (mdi) {
      try {
        const [md] = Metadata.deserialize(mdi);
        metaName = clean((md as any).data.name);
        metaSymbol = clean((md as any).data.symbol);
        metaUri = clean((md as any).data.uri);
      } catch {}
    }

    return {
      decimals,
      supplyUi,
      memeReserveRaw,
      woodReserveLamports,
      metaName,
      metaSymbol,
      metaUri,
    };
  });

  // Metadata JSONs (ipfs/http)
const jsons = await Promise.all(
  chain.map(async (c) => {
    const url = toHttp(c.metaUri, /*absolute*/ true); // <-- CHANGED
    if (!url) return null;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  })
);


  const out: PoolLite[] = cfgs.map((cfg, i) => {
    const raw = cfg.data.poolType as number | { bonding?: {}; amm?: {} };
    const poolType: 0 | 1 = (typeof raw === "number" ? raw : ("amm" in raw ? 1 : 0)) as 0 | 1;
    const m = chain[i];
    const j = jsons[i] || {};

    // Price from chain
    let price = Number.NaN;
    if (poolType === 0) {
      price = bondingSpotPrice({
        vtokens: Number(cfg.data.vtokens ?? 0),
        vwoodeng: Number(cfg.data.vwoodeng ?? 0),
        bondingSold: Number(cfg.data.bondingSold ?? 0),
      });
    } else if (m.memeReserveRaw > 0 && m.woodReserveLamports > 0) {
      price =
        (m.woodReserveLamports / 10 ** QUOTE_DECIMALS) /
        (m.memeReserveRaw / 10 ** m.decimals);
    }

    const priceChain = Number.isFinite(price) ? price : 0;
    const mcap = priceChain * (m.supplyUi ?? 0);

    return {
      mint: new PublicKey(cfg.data.memeMint).toBase58(),
      name: m.metaName || j.name || "",
      symbol: m.metaSymbol || j.symbol || "",
      image: toHttp(j.image || "", /*absolute*/ true), // <-- CHANGED
      price_chain: priceChain,
      mcap_chain: Number.isFinite(mcap) ? mcap : 0,
      supply_ui: m.supplyUi ?? 0,
    };
  });

  return out;
}

/* ---------- DB signals (latest, 24h base, first seen) ---------- */
async function getDbSignals(
  mints: string[]
): Promise<{
  latestUi: Record<string, number>;
  baseUi: Record<string, number>;
  firstMs: Record<string, number>;
}> {
    // Early exit: avoid SQL when there are no mints
  if (!mints || mints.length === 0) {
    return { latestUi: {}, baseUi: {}, firstMs: {} };
  }
  const latestUi: Record<string, number> = {};
  const baseUi: Record<string, number> = {};
  const firstMs: Record<string, number> = {};

  // latest per mint
  const { rows: rLatest } = await pg.query<{
    meme_mint: string;
    price_lamports: string;
    woodeng_decimals: number;
  }>(
    `
    SELECT DISTINCT ON (meme_mint)
      meme_mint, price_lamports::numeric AS price_lamports, woodeng_decimals
    FROM price_ticks
    WHERE meme_mint = ANY($1)
    ORDER BY meme_mint, ts DESC
    `,
    [mints]
  );

  for (const r of rLatest) {
    const dec = Number(r.woodeng_decimals ?? 9);
    latestUi[r.meme_mint] = Number(r.price_lamports) / 10 ** dec;
  }

  // base value = last tick at/before (now - 24h)
  const { rows: rBaseOld } = await pg.query<{
    meme_mint: string;
    price_lamports: string;
    woodeng_decimals: number;
  }>(
    `
    SELECT DISTINCT ON (meme_mint)
      meme_mint, price_lamports::numeric AS price_lamports, woodeng_decimals
    FROM price_ticks
    WHERE meme_mint = ANY($1) AND ts <= now() - interval '24 hours'
    ORDER BY meme_mint, ts DESC
    `,
    [mints]
  );

  for (const r of rBaseOld) {
    const dec = Number(r.woodeng_decimals ?? 9);
    baseUi[r.meme_mint] = Number(r.price_lamports) / 10 ** dec;
  }

  // fallback base for *brand new* tokens: first ever tick
  const { rows: rFirstTick } = await pg.query<{
    meme_mint: string;
    price_lamports: string;
    woodeng_decimals: number;
  }>(
    `
    SELECT DISTINCT ON (meme_mint)
      meme_mint, price_lamports::numeric AS price_lamports, woodeng_decimals
    FROM price_ticks
    WHERE meme_mint = ANY($1)
    ORDER BY meme_mint, ts ASC
    `,
    [mints]
  );

  for (const r of rFirstTick) {
    if (baseUi[r.meme_mint] == null) {
      const dec = Number(r.woodeng_decimals ?? 9);
      baseUi[r.meme_mint] = Number(r.price_lamports) / 10 ** dec;
    }
  }

  // first seen timestamp (ms)
  const { rows: rFirst } = await pg.query<{ meme_mint: string; ms: number }>(
    `
    SELECT DISTINCT ON (meme_mint)
      meme_mint, EXTRACT(EPOCH FROM ts)*1000 AS ms
    FROM price_ticks
    WHERE meme_mint = ANY($1)
    ORDER BY meme_mint, ts ASC
    `,
    [mints]
  );

  for (const r of rFirst) {
    firstMs[r.meme_mint] = Number(r.ms);
  }

  return { latestUi, baseUi, firstMs };
}

export async function GET() {
  try {
    // 1) chain snapshot (supply, fallback price, metadata)
    const pools = await fetchPools();

// apply blacklist again just in case (safe even if already filtered)
 const HIDDEN2: Set<string> =
   (Hidden as any)?.HIDDEN_SOUND_MEMES instanceof Set
     ? (Hidden as any).HIDDEN_SOUND_MEMES
     : new Set<string>();
 const poolsVisible = pools.filter((p) => !HIDDEN2.has(p.mint));

// if nothing left, return empty panels (avoid DB queries with empty ANY($1))
if (!poolsVisible.length) {
  const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
  return NextResponse.json(
    {
      trending: [],
      recentlyAdded: [],
      topMarketCap: [],
      cluster: SOLANA_CLUSTER,
    },
    { headers }
  );
}

const mints = poolsVisible.map((p) => p.mint);


    // 2) DB overlays (latest price, base-24h or first-ever, first seen)
    const { latestUi, baseUi, firstMs } = await getDbSignals(mints);

    // 3) merge & compute
    const merged = poolsVisible.map((p) => {

      const price = Number.isFinite(latestUi[p.mint]) ? latestUi[p.mint] : p.price_chain;
      const market_cap = price * p.supply_ui;

      const base = baseUi[p.mint];
      const change_24h =
        Number.isFinite(base) && base > 0 ? ((price - base) / base) * 100 : undefined;

      return {
        mint: p.mint,
        name: p.name,
        symbol: p.symbol,
        image: p.image,
        price,
        market_cap,
        change_24h,
        created_at: firstMs[p.mint],
      };
    });

    // 4) slices (top-3 each)
    const trending = (() => {
      // strict by 24h %, then tie-break by market cap
      const withChg = merged.filter((x) => Number.isFinite(x.change_24h as number));
      const strictTop = withChg
        .sort((a, b) => {
          const d = (b.change_24h as number) - (a.change_24h as number);
          return d !== 0 ? d : (b.market_cap ?? 0) - (a.market_cap ?? 0);
        })
        .slice(0, 3);
      if (strictTop.length === 3) return strictTop;

      // fill remaining with highest market cap
      const fillers = merged
        .filter((x) => !strictTop.find((y) => y.mint === x.mint))
        .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
        .slice(0, 3 - strictTop.length);
      return [...strictTop, ...fillers];
    })();

    const recentlyAdded = [...merged]
      .filter((x) => Number.isFinite(x.created_at))
      .sort((a, b) => (b.created_at as number) - (a.created_at as number))
      .slice(0, 3);

    const topMarketCap = [...merged]
      .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
      .slice(0, 3);

    const pick = (arr: typeof merged) =>
      arr.map((p) => ({
        mint: p.mint,
        name: p.name,
        symbol: p.symbol,
        image: p.image,
        price: p.price,
        market_cap: p.market_cap,
        change_24h: p.change_24h,
      }));

    const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
    return NextResponse.json(
      {
        trending: pick(trending),
        recentlyAdded: pick(recentlyAdded),
        topMarketCap: pick(topMarketCap),
        cluster: SOLANA_CLUSTER,
      },
      { headers }
    );
  } catch (e: any) {
    console.error("[home-panels] error:", e);
    const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
    return NextResponse.json(
  { error: e?.message || String(e), stack: e?.stack },
  { status: 500, headers }
);

  }
}
