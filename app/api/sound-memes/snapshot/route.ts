import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BorshAccountsCoder } from "@project-serum/anchor";
import type { Idl } from "@project-serum/anchor";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metadata, PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import poolIdlJson from "../../../../idl/my_sound_meme_pool.json";

import bs58 from "bs58";

// --- copy a few tiny helpers from your client file (or import from /lib)
const QUOTE_DECIMALS = 9;
const CONFIG_VERSION = 17;
const clean = (s?: string) => (s ?? "").replace(/\0/g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();
const readU64LESafe = (buf: Buffer | undefined | null, offset: number) => {
  if (!buf || buf.length < offset + 8) return 0;
  try { return Number(buf.readBigUInt64LE(offset)); } catch { return 0; }
};
async function getMultiple(conn: Connection, keys: PublicKey[], chunk = 100) {
  const out: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    const infos = await conn.getMultipleAccountsInfo(part, "processed");
    out.push(...infos);
  }
  return out;
}
const asNumber = (x: any) => Number(x?.toString?.() ?? x ?? 0);
function bondingSpotPrice(cfg: { vtokens: number; vwoodeng: number; bondingSold: number }) {
  const { vtokens, vwoodeng, bondingSold } = cfg;
  if (!vtokens || !vwoodeng) return NaN;
  const p0 = vwoodeng / vtokens;
  const p1 = 35 * 10 ** QUOTE_DECIMALS;             // same as your threshold
  const THRESHOLD_RAW = 44_000_000;                  // your bonding curve raw cap
  const k  = Math.log(p1 / p0) / THRESHOLD_RAW;
  return (p0 * Math.exp(k * bondingSold)) / 10 ** QUOTE_DECIMALS;
}

export const revalidate = 10; // ISR

export async function GET() {
  const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "process.env.NEXT_PUBLIC_SOLANA_RPC as string";

  const connection = new Connection(RPC_URL, { commitment: "processed" });

  const POOL_PROGRAM_ID = new PublicKey("8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV");
  const poolIdl = poolIdlJson as Idl;

  // minimal Anchor provider (no wallet)
  const provider = new AnchorProvider(connection, { publicKey: new PublicKey("11111111111111111111111111111111") } as any, {});
  const program  = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  // ---- same as headers-only fetch
  const disc = BorshAccountsCoder.accountDiscriminator("SoundMemeConfig");
  const rawConfigs = await connection.getProgramAccounts(POOL_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(disc) } },
      { memcmp: { offset: 8, bytes: bs58.encode(Buffer.from([CONFIG_VERSION])) } },
    ],
  });

  const configs: Array<{ publicKey: PublicKey; account: any }> = [];
  for (const { pubkey, account } of rawConfigs) {
    const data = account.data;
    if (!data || data.length < 9 || data[8] !== CONFIG_VERSION) continue;
    try {
      const acc = program.coder.accounts.decode("SoundMemeConfig", data);
      if ((acc as any).version === CONFIG_VERSION) configs.push({ publicKey: pubkey, account: acc });
    } catch {}
  }
  if (!configs.length) return NextResponse.json([]);

  const memeMints  = configs.map((c) => new PublicKey((c.account as any).memeMint));
  const quoteMints = configs.map((c) => new PublicKey((c.account as any).woodengMint));

  const memeVaults = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("pool_meme_vault"), m.toBuffer()], POOL_PROGRAM_ID
    ))[0])
  );
  const woodVaults = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("pool_woodeng_vault"), m.toBuffer()], POOL_PROGRAM_ID
    ))[0])
  );
  const metadataPDAs = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), m.toBuffer()],
      METADATA_PROGRAM_ID
    ))[0])
  );

  const mintInfos      = await getMultiple(connection, memeMints);
  const memeVaultInfos = await getMultiple(connection, memeVaults);
  const woodVaultInfos = await getMultiple(connection, woodVaults);
  const metadataInfos  = await getMultiple(connection, metadataPDAs);

  const out = configs.map((c, i) => {
    const cfg = c.account as any;
    const raw = cfg.poolType as number | { bonding?: {}; amm?: {} };
    const poolType = (typeof raw === "number" ? raw : ("amm" in raw ? 1 : 0)) as 0 | 1;

    const mi = mintInfos[i]?.data;
    let decimals = 0, supplyUi = 0;
    if (mi && mi.length >= 82) {
      decimals = mi[44];
      const supplyRaw = readU64LESafe(mi, 36);
      supplyUi = supplyRaw / 10 ** decimals;
    }

    const memeAccInfo = memeVaultInfos[i];
    const woodAccInfo = woodVaultInfos[i];
    const memeReserveRaw =
      memeAccInfo && memeAccInfo.owner.equals(TOKEN_PROGRAM_ID) && memeAccInfo.data.length >= 72
        ? readU64LESafe(memeAccInfo.data, 64) : 0;
    const woodReserveLamports =
      woodAccInfo && woodAccInfo.owner.equals(TOKEN_PROGRAM_ID) && woodAccInfo.data.length >= 72
        ? readU64LESafe(woodAccInfo.data, 64) : 0;

    let metaName = "", metaSymbol = "", metaUri: string | undefined = undefined;
    const mdi = metadataInfos[i]?.data;
    if (mdi) {
      try {
        const [md] = Metadata.deserialize(mdi);
        metaName   = clean((md as any).data.name);
        metaSymbol = clean((md as any).data.symbol);
        metaUri    = clean((md as any).data.uri);
      } catch {}
    }

    let price = 1;
    if (poolType === 0) {
      price = bondingSpotPrice({
        vtokens: asNumber(cfg.vtokens),
        vwoodeng: asNumber(cfg.vwoodeng),
        bondingSold: asNumber(cfg.bondingSold),
      });
    } else if (memeReserveRaw > 0 && woodReserveLamports > 0) {
      price = (woodReserveLamports / 10 ** QUOTE_DECIMALS) / (memeReserveRaw / 10 ** decimals);
    }
    const marketCap = price * (supplyUi ?? 0);

    return {
      pubkey: c.publicKey.toBase58(),
      poolType,
      lastMemePrice: asNumber(cfg.lastMemePrice),
      vtokens: asNumber(cfg.vtokens),
      vwoodeng: asNumber(cfg.vwoodeng),
      bondingSold: asNumber(cfg.bondingSold),
      memeMint: memeMints[i].toBase58(),
      quoteMint: quoteMints[i].toBase58(),
      ammReserves: { meme: memeReserveRaw, woodeng: woodReserveLamports },
      price,
      decimals,
      totalSupply: supplyUi,
      marketCap,
      name: metaName || "",
      symbol: metaSymbol || "",
      metaUri,
      hydrated: false,
    };
  });

  return NextResponse.json(out, {
    headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=60" },
  });
}
