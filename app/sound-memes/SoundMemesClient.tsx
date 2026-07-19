//C:\Users\burgu\woodeng-next\app\sound-memes\SOUNDMEMESClient.tsx

'use client';


export const dynamic = 'force-dynamic'; 
import poolIdlJson from '../../idl/my_sound_meme_pool.json';
import poolIdlV2Json from '../../idl/my_sound_meme_pool_v2.json';
import lockerIdlJson from '../../idl/hybrid_meme_coin_nft_locker.json';
import stakingIdlJson from '../../idl/woodeng_staking.json';

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair,
  ComputeBudgetProgram, TransactionInstruction, SendTransactionError
} from "@solana/web3.js";

import { useWallet } from "@solana/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { getCachedBalance } from "@/lib/balanceCache";
import type { Idl } from "@project-serum/anchor";
import { Program, AnchorProvider, BN } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction
} from "@solana/spl-token";

import {
  Play, Pause, Loader2, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertCircle, Info, X, Pickaxe, Copy
} from "lucide-react";





import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Metaplex } from "@metaplex-foundation/js";
// getLockerPda removed (SWL-444): wrong seed order; inline PDA derivation used instead


import { getMint, NATIVE_MINT, createSyncNativeInstruction, createCloseAccountInstruction } from "@solana/spl-token";

import { Rocket } from "lucide-react";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import { CpAmm } from '@meteora-ag/cp-amm-sdk';

import NextDynamic from 'next/dynamic';


import { Globe, Send, Twitter } from 'lucide-react';
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";


import bs58 from "bs58";
import { BorshAccountsCoder } from "@project-serum/anchor";

// at the top with other next/navigation imports
import { useSearchParams, usePathname, useRouter } from "next/navigation";




// ── Test tokens to hide everywhere (listings, reputation, cards) ────────────
const HIDDEN_MINTS = new Set([
  '35kXDQ7LdSBNdNo9iVfXi3ZRE4Mh4pyJt3t3G5rCDwoo',
  'Dn5xinGN5HWTCZr1sUVcExx4xcU9q4YpghreSprkVwoo',
  '9P1S4JQEsVWoW1Yu2Ucp4pLLvj67Z3kaN47k1kj6zwoo',
]);

// ───── Candles helpers (timeframe-driven) ─────
type Timeframe = '15m' | '30m' | '1h' | '4h' | '24h';

const TF_MS: Record<Timeframe, number> = {
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h':   60 * 60_000,
  '4h':  4 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};



const DAY_MS = 24 * 60 * 60 * 1000;

// ── keep TF_MS and DAY_MS as you have ──
function bucketStart(t: number, tf: Timeframe): number {
  // Always align to UTC, including the daily frame
  if (tf === '24h') {
    // UTC midnight
    return Math.floor(t / DAY_MS) * DAY_MS;
  }
  // 15m / 30m / 1h / 4h align to absolute UTC epoch grid
  const ms = TF_MS[tf];
  return Math.floor(t / ms) * ms;
}

// ⬇️ add this near other top-level constants
const HIDDEN_POOLS = new Set<string>([
  'FWpLqRiWk8egYjPfscnmpGxPKMqZcxHhASHrfMLDawoo',
  'J7gVKZQFiFGt5XBkWgZ6anHex978Chemp551yVvuMwoo',
  '8GhRMWqLVo1LtDRmFrgnjviZqDoPG74KiusHL4VTPwoo', // bad/legacy pool
  'G7rFNzj8jdVbq3NamfiHtj9xZk2yJGsYpmVXKQJX6woo'
]);





export function SocialLinksBar({
  socials,
  className = ""
}: {
  socials?: { x?: string; telegram?: string; website?: string };
  className?: string;
}) {
  if (!socials) return null;
  const links = [
    { href: socials.x,        Icon: Twitter, label: 'X' },
    { href: socials.telegram, Icon: Send,    label: 'Telegram' },
    { href: socials.website,  Icon: Globe,   label: 'Website' },
  ].filter(x => !!x.href);

  if (!links.length) return null;

  return (
    <div className={`flex items-center gap-3 mt-3 ${className}`}>
      {links.map(({ href, Icon, label }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1f2128] hover:bg-[#262a33] border border-[#2b2d35]"
          title={label}
        >
          <Icon className="w-4 h-4 text-[#c9cbd6]" />
        </a>
      ))}
    </div>
  );
}

const CandleChart = NextDynamic(
  () => import('../../src/contexts/components/CandleChart'),
  { ssr: false }
);







const clean = (s?: string) =>
  (s ?? "").replace(/\0/g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();


const isAmm = (p: { poolType: 0 | 1 | 2 | 3 }) => p.poolType === 1;
const isGraduated = (p: { poolType: 0 | 1 | 2 | 3 }) => p.poolType === 2 || p.poolType === 3;


const format6 = (v: number) =>
  Number.isFinite(v) ? v.toFixed(6).replace(/\.?0+$/, "") : "0";

// short "4…4" formatter for addresses
const shortAddr = (s: string, chars = 4) => (s ? `${s.slice(0, chars)}…${s.slice(-chars)}` : "");

function TinyPrice({
  value,
  maxNormalDp = 6,          // show up to 6 dp for normal values
  tinyThreshold = 1e-6,     // only compress really tiny numbers
  sigDigits = 6,            // show up to 6 significant digits after the zeros
  className = "",
}: {
  value: number;
  maxNormalDp?: number;
  tinyThreshold?: number;
  sigDigits?: number;
  className?: string;
}) {
  if (!Number.isFinite(value) || value <= 0) return <span className={className}>0</span>;

  // Normal formatting (up to 6 decimals, strip trailing zeros)
  if (value >= tinyThreshold) {
    const s = value.toFixed(maxNormalDp).replace(/\.?0+$/, "");
    return <span className={`tabular-nums ${className}`}>{s}</span>;
  }

  // Compress zeros for ultra-small numbers: 0.0<sup>k</sup> + first significant digits
  const exp = Number(value).toExponential();               // e.g. "7.6e-11"
  const m = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(exp);         // 1st digit, rest, exponent
  if (!m) {
    const s = value.toFixed(maxNormalDp).replace(/\.?0+$/, "");
    return <span className={`tabular-nums ${className}`}>{s}</span>;
  }

  const first = m[1];
  const rest  = m[2] || "";
  const e     = Number(m[3]);                              // decimals shift
  const zeroCount = Math.max(0, e - 1);                    // zeros after "0."
  const digits = (first + rest).slice(0, sigDigits);       // show up to 6 sig digits

  return (
    <span className={`tabular-nums ${className}`}>
      0.0<sup className="align-super text-[10px] opacity-75">{zeroCount}</sup>{digits}
    </span>
  );
}





/* ───────── MOBILE: vertical climb sections ───────── */


function BondingProgressBar({ pool }: { pool: PoolType }) {
  if (pool.poolType !== 0) return null; // bonding only

  const woodLamports = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const thrLamports = Number(targetsFor(pool).migrateLowerLamports);
const pct = Math.min(1, woodLamports / Math.max(1, thrLamports));

  const pctInt       = Math.round(pct * 100);

  const woodUi = woodLamports / 10 ** WOODENG_DECIMALS;
  const thrUi  = thrLamports  / 10 ** WOODENG_DECIMALS;
  const leftUi = Math.max(0, thrUi - woodUi);

  return (
    <div className="w-full flex flex-col items-center mb-2">
      {/* header row with subtle tooltip */}
      <div className="w-11/12 mb-1 flex items-center justify-between text-[11px] text-[#d6d8ff]">
        <div className="flex items-center gap-1 relative group">
          <span className="font-semibold">Bonding progress</span>
          <Info className="w-3.5 h-3.5 opacity-70" />
          <div
            className="
              absolute left-0 top-full mt-1 hidden group-hover:block
              bg-black/85 text-white rounded-md px-2 py-1 text-[11px]
              ring-1 ring-white/10 shadow-lg whitespace-nowrap z-10
            "
          >
            
Pool starts on a bonding curve. When it reaches {thrUi.toFixed(2)} {quoteLabelOf(pool)}
liquidity, it migrates to the AMM.

          </div>
        </div>
        <span className="font-semibold tabular-nums">{pctInt}%</span>
      </div>

      {/* bar — same proportions as your Mint NFT bar */}
      <div className="relative w-11/12 h-4 bg-[#2b2b37] rounded overflow-hidden">
        <div
          className={`
            h-full bg-gradient-to-r from-[#b484ff] to-[#6c47e2]
            ${pctInt === 100 ? 'animate-pulse' : ''}
          `}
          style={{ width: `${pct * 100}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[#f0eaff]">
          {pctInt}%
        </span>
      </div>

      {/* micro copy */}
      <div className="w-11/12 flex justify-between text-[11px] leading-none text-[#d6d8ff] mt-1">
        <span>{woodUi.toFixed(2)} / {thrUi.toFixed(2)} {quoteLabelOf(pool)}</span>
        <span>{leftUi.toFixed(2)} {quoteLabelOf(pool)} left</span>
      </div>
    </div>
  );
}


// ── Per-pool performance badge type ──
type PoolPerfBadge = {
  launchPrice: number;
  currentPrice: number;
  currentMultiplier: number;
  athMultiplier: number;
  bondingStatus: 'bonding' | 'bonded' | 'amm-launch';
};

// ── Creator-level reputation badge type ──
type CreatorRepBadge = {
  score: number;
  launches: number;
  graduated: number;
  avgMultiplier: number;
  bestMultiplier: number;
};

// ADD props for buy/sell to MiniVerticalCard
function MiniVerticalCard({
  pool,
  rank,
  onOpen,
  change24h,
  onBuy,
  onQuickBuy,
  onSell,
  onMint,
  onBurn,
  onPlay,
  isPlaying,
  tokensUiOwned,
  mintThreshold,
  nftCount,
  active = false,
  walletConnected,
  creatorRep,
  poolPerf,
}: {
  pool: PoolType;
  rank: number;
  onOpen: (p: PoolType) => void;
  change24h: number;
  onBuy: (p: PoolType) => void;
  onQuickBuy: (p: PoolType, quoteRawIn: number) => void;
  onSell: (p: PoolType) => void;
  onMint: (p: PoolType) => void;                  // NEW
  onBurn: (p: PoolType) => void;                  // NEW
  onPlay: (id: string, url?: string) => void;     // NEW (plays audio)
  isPlaying: boolean;                             // NEW
  tokensUiOwned: number;                          // NEW
  mintThreshold: number;                          // NEW
  nftCount: number;                               // NEW
  active?: boolean;
  walletConnected: boolean;
  creatorRep?: CreatorRepBadge;
  poolPerf?: PoolPerfBadge;
}) {
  const up = change24h >= 0;
  const [copiedAddr, setCopiedAddr] = React.useState<string | null>(null);
  const [copiedLocal, setCopiedLocal] = React.useState(false);
  const [showMobileQB, setShowMobileQB] = React.useState(false);

  

  // Allow sells on both bonding + AMM. We'll warn on bonding.
const canSell = true;
const bondingSellTaxBps = pool.poolType === 0 ? 1000 : 0; // 10% during bonding



  const canMint = Number.isFinite(tokensUiOwned) && tokensUiOwned >= mintThreshold;
  const quote = quoteLabelOf(pool);
  const decs = pool.decimals ?? MEME_DECIMALS;

  const ownedLabel = Number.isFinite(tokensUiOwned)
    ? tokensUiOwned.toLocaleString(undefined, { maximumFractionDigits: decs })
    : '—';

  const pct = Math.max(0, Math.min(100, (Math.max(0, tokensUiOwned || 0) / Math.max(1, mintThreshold)) * 100));

  return (
    <div
  role="button"
  tabIndex={0}
  onClick={() => onOpen(pool)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(pool); } }}
  

  className="snap-center w-full h-full min-h-0 text-left
          bg-[#22232a] border border-[#33334a] rounded-2xl shadow-xl
          overflow-hidden flex flex-col
          active:scale-[0.995]
          relative isolate" 

>
  {/* header ABOVE the image */}
  <div className="p-5 pb-3">
    <div className="flex items-center gap-1.5">
      <span className="font-semibold truncate">{pool.name || 'Untitled Meme'}</span>
      {pool.programVersion === 'v1' && (
        <span className="shrink-0 text-[9px] font-bold bg-[#2b323c] text-[#8a8fa3] px-1.5 py-0.5 rounded-full">V1</span>
      )}
      {pool.programVersion === 'v2' && (
        <span className="shrink-0 text-[9px] font-bold bg-[#1a2e1a] text-[#4ade80] px-1.5 py-0.5 rounded-full">V2</span>
      )}
    </div>

    <div className="mt-1 flex items-center gap-2">
      <TinyPrice value={Number(pool.price ?? 0)} className="text-[#ffc371] font-bold" />
      <span className="text-xs text-[#ffc371]/90">{quoteLabelOf(pool)}</span>
      {/* show % only if bonding progress ≥ 10% (or AMM) else show NEW */}
{showPerfBadge(pool) ? (
  <span className={`ml-auto text-xs px-2 py-0.5 rounded ${change24h >= 0 ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}>
    {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
  </span>
) : (
  <span className="ml-auto text-[11px] px-2 py-0.5 rounded bg-[#2b323c] text-[#d6d8ff]">
    NEW
  </span>
)}

    </div>

    {/* Bonding status + creator avg multiplier */}
    {(() => {
      const perf = poolPerf;
      const fmtMult = (m: number) => m >= 1000 ? `${(m/1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1);
      return (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {/* Bonding status pill */}
          {perf && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              perf.bondingStatus === 'bonding' ? 'bg-blue-500/20 text-blue-300' :
              perf.bondingStatus === 'bonded' ? 'bg-emerald-500/20 text-emerald-300' :
              'bg-purple-500/20 text-purple-300'
            }`}>
              {perf.bondingStatus === 'bonding' ? '⏳ Bonding' :
               perf.bondingStatus === 'bonded' ? '✓ Bonded' : '🚀 AMM'}
            </span>
          )}
          {/* Creator avg multiplier — the key dopamine metric */}
          {creatorRep && creatorRep.avgMultiplier > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
              creatorRep.avgMultiplier >= 10 ? 'bg-emerald-500/20 text-emerald-300' :
              creatorRep.avgMultiplier >= 2 ? 'bg-yellow-500/20 text-yellow-300' :
              creatorRep.avgMultiplier >= 1 ? 'bg-[#2b323c] text-[#8a8fa3]' : 'bg-red-500/20 text-red-300'
            }`}>
              🔥 Avg {fmtMult(creatorRep.avgMultiplier)}x
            </span>
          )}
        </div>
      );
    })()}
  </div>

  {/* image BELOW the header, with a tighter max height */}
  <div className="relative w-full aspect-[4/3] md:aspect-square bg-[#1f2130]
                  max-h-[22svh] md:max-h-none">
    <img
      src={pool.imageUrl || 'https://placehold.co/600x600?text=No+Image'}
      alt={pool.name ?? 'Sound Meme'}
      className="w-full h-full object-contain object-center bg-[#1f2130]"
      loading="lazy"
      decoding="async"
      sizes="(min-width:768px) 50vw, 100vw"
    />

    {/* rank + ticker chips */}
    <div
  className="absolute top-2 right-2 max-w-[48%] bg-black/60 px-2 py-0.5 rounded
             text-[10px] sm:text-[11px] leading-tight whitespace-nowrap overflow-hidden truncate
             uppercase z-20 pointer-events-none"
  title={pool.symbol ?? 'MEME'}
>
  {pool.symbol ?? 'MEME'}
</div>



    {/* play/pause center button */}
    {pool.audioUrl && (
      <button
        type="button"
        title={isPlaying ? 'Pause' : 'Play'}
        onClick={(e) => { e.stopPropagation(); onPlay(pool.pubkey.toBase58(), pool.audioUrl); }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="bg-black/65 hover:bg-black/75 rounded-full p-3">
          {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
        </span>
      </button>
    )}
    {/* contract chip + copy (bottom-left) */}
<div
  className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5
             bg-black/55 backdrop-blur
             px-1 py-[2px] md:px-2 md:py-1
             rounded-[6px] ring-1 ring-white/10
             text-[9px] md:text-[11px] leading-none select-text"
  onClick={(e) => e.stopPropagation()}
>
  <span className="font-mono">
    {/* tighter short address on mobile (3…3), normal on md+ (4…4) */}
    <span className="md:hidden">{shortAddr(pool.memeMint.toBase58(), 3)}</span>
    <span className="hidden md:inline">{shortAddr(pool.memeMint.toBase58(), 4)}</span>
  </span>

  <button
    type="button"
    className="p-0.5 md:p-1 rounded hover:bg-white/10"
    title="Copy contract address"
    onClick={(e) => {
      e.stopPropagation();
      try { navigator.clipboard.writeText(pool.memeMint.toBase58()); } catch {}
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 1200);
    }}
  >
    {copiedLocal
      ? <CheckCircle2 className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
      : <Copy         className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />}
  </button>
</div>



  </div>



        {/* info + actions + progress */}
  <div className="p-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
    {/* bonding progress (bonding only) */}
    {pool.poolType === 0 && (
      <div className="mb-2">
        <BondingProgressBar pool={pool} />
      </div>
    )}

    {/* owned + NFT count */}
    <div className="mb-2 text-[11px] text-[#c2c2c9] flex items-center justify-between">
      <span>Your tokens: <span className="text-white/90 font-semibold">
        {Number.isFinite(tokensUiOwned)
          ? tokensUiOwned.toLocaleString(undefined, { maximumFractionDigits: pool.decimals ?? 0 })
          : '—'}
      </span></span>
      <span>NFTs: <span className="text-white/90 font-semibold">{nftCount}</span></span>
    </div>


    {/* mint progress toward threshold (kept compact) */}
<div className="w-full mb-2">
  <div className="relative w-full h-4 bg-[#2b2b37] rounded overflow-hidden">
    <div
      className={`h-full bg-gradient-to-r from-[#b484ff] to-[#6c47e2] ${
        Math.min(100, (Math.max(0, tokensUiOwned || 0) / Math.max(1, mintThreshold)) * 100) >= 100 ? 'animate-pulse' : ''
      }`}
      style={{
        width: `${Math.min(100, (Math.max(0, tokensUiOwned || 0) / Math.max(1, mintThreshold)) * 100)}%`
      }}
    />
    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[#f0eaff]">
      {Math.min(100, (Math.max(0, tokensUiOwned || 0) / Math.max(1, mintThreshold)) * 100).toFixed(2)}%
    </span>
  </div>
  <div className="flex justify-between text-[11px] text-[#d6d8ff] mt-1.5">
    <span>
      {Number.isFinite(tokensUiOwned)
        ? tokensUiOwned.toLocaleString(undefined, { maximumFractionDigits: pool.decimals ?? 0 })
        : '—'}
    </span>
    <span>{mintThreshold.toLocaleString()} required</span>
  </div>
</div>


{/* spacer so content can scroll behind sticky footer comfortably */}
<div className="h-2" />

{/* ── GRADUATED: Meteora trade links (mobile) ──────────────── */}
{isGraduated(pool) && (
<div
  className="sticky bottom-0 left-0 right-0 z-20 -mx-5 px-5
    pt-2 pb-[max(env(safe-area-inset-bottom),12px)]
    bg-gradient-to-t from-[#22232a] to-[#22232a]/0"
  onClick={(e) => e.stopPropagation()}
>
  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 mb-2">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">🎓</span>
      <span className="text-sm font-bold text-purple-300">
        {pool.poolType === 3 ? 'Trading on Meteora' : 'Graduated — Creating Meteora Pool…'}
      </span>
    </div>
    {pool.poolType === 3 ? (
      <a
        href={`/sound-memes/${pool.memeMint.toBase58()}`}
        className="h-10 w-full inline-flex items-center justify-center gap-2 rounded font-semibold text-sm bg-purple-600/80 text-white hover:bg-purple-500 transition"
        onClick={e => e.stopPropagation()}
      >
        <Rocket className="w-4 h-4" /> Trade ${pool.symbol || 'Token'}
      </a>
    ) : pool.poolType === 2 ? (
      <a
        href={`/sound-memes/${pool.memeMint.toBase58()}`}
        className="h-10 w-full inline-flex items-center justify-center gap-2 rounded font-semibold text-sm bg-[#ffc371]/40 text-black/60 hover:bg-[#ffc371]/60 transition"
        onClick={e => e.stopPropagation()}
      >
        <Rocket className="w-4 h-4" /> Open to Create Pool
      </a>
    ) : null}
  </div>
</div>
)}

{/* Sticky actions footer (hidden for graduated) */}
{!isGraduated(pool) && (
<div
  className="
    sticky bottom-0 left-0 right-0 z-20 -mx-5 px-5
    pt-2 pb-[max(env(safe-area-inset-bottom),12px)]
    bg-gradient-to-t from-[#22232a] to-[#22232a]/0
    backdrop-blur-[2px]
  "
  onClick={(e) => e.stopPropagation()}
>
  {/* Quick-buy preset panel */}
  <div
    className="overflow-hidden transition-all duration-300"
    style={{ maxHeight: showMobileQB ? '120px' : '0px', opacity: showMobileQB ? 1 : 0 }}
  >
    <div className="mb-2 rounded-xl bg-[#1a1b23] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#ffc371]">Quick Buy</span>
        <button onClick={() => setShowMobileQB(false)} className="text-xs text-[#6b7084] hover:text-white transition">✕ Cancel</button>
      </div>
      <div className="flex gap-2">
        {quoteIsSol(pool) ? (
          <>
            <button onClick={() => { setShowMobileQB(false); onQuickBuy(pool, 0.1e9); }} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">0.1 SOL</button>
            <button onClick={() => { setShowMobileQB(false); onQuickBuy(pool, 0.5e9); }} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">0.5 SOL</button>
            <button onClick={() => { setShowMobileQB(false); onQuickBuy(pool, 1e9); }} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">1 SOL</button>
          </>
        ) : (
          <>
            <button onClick={() => { setShowMobileQB(false); onQuickBuy(pool, 100_000 * 1e9); }} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">100K $WOODENG</button>
            <button onClick={() => { setShowMobileQB(false); onQuickBuy(pool, 444_000 * 1e9); }} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">444K $WOODENG</button>
            <button onClick={() => { setShowMobileQB(false); onQuickBuy(pool, 1_000_000 * 1e9); }} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">1M $WOODENG</button>
          </>
        )}
      </div>
    </div>
  </div>
  <div className="grid grid-cols-2 gap-2">
    {/* Buy */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setShowMobileQB(v => !v); }}
      className="h-10 w-full inline-flex items-center justify-center rounded px-3 text-[13px] font-semibold bg-[#ffc371] text-black"
    >
      {showMobileQB ? '✕ Cancel' : 'Buy'}
    </button>

    {/* Sell */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSell(pool); }}
      className="h-10 w-full inline-flex items-center justify-center rounded px-3 text-[13px] font-semibold bg-[#ff5656] text-white"
      title={pool.poolType === 0 ? 'Bonding sell: 10% tax' : ''}
    >
      {pool.poolType === 0 ? 'Sell (10% tax)' : 'Sell'}
    </button>

    {/* Mint */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onMint(pool); }}
      disabled={!Number.isFinite(tokensUiOwned) || tokensUiOwned < mintThreshold}
      className="h-10 w-full inline-flex items-center justify-center rounded px-3 text-[13px] font-semibold bg-[#907aff] text-white disabled:opacity-40"
      title={Number.isFinite(tokensUiOwned) && tokensUiOwned < mintThreshold ? 'Need more tokens to mint' : ''}
    >
      Mint NFT
    </button>

    {/* Burn */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onBurn(pool); }}
      disabled={nftCount === 0}
      className="h-10 w-full inline-flex items-center justify-center rounded px-3 text-[13px] font-semibold bg-[#ff5656] text-white disabled:opacity-40"
      title={nftCount > 0 ? '' : 'No NFTs to burn'}
    >
      Burn NFT
    </button>
  </div>
</div>
)}

    

    {/* socials */}
    <SocialLinksBar socials={pool.socials} className="mt-2" />
  </div>
</div>

  );
}

// ── Pump.fun-style compact mobile card ────────────────────────────────────────
function PumpStyleCard({
  pool, change24h, onOpen, onBuy, onQuickBuy, poolPerf, creatorRep, createdAt,
}: {
  pool: PoolType; change24h: number;
  onOpen: (p: PoolType) => void; onBuy: (p: PoolType) => void;
  onQuickBuy: (p: PoolType, quoteRawIn: number) => void;
  poolPerf?: PoolPerfBadge; creatorRep?: CreatorRepBadge;
  createdAt?: number;
}) {
  const up = change24h >= 0;
  const [showBuyOptions, setShowBuyOptions] = React.useState(false);
  const isNew = typeof createdAt === 'number' && createdAt > 0 && (Date.now() / 1000) - createdAt < 300;

  // Deterministic sparkline seeded by mint address + trend direction
  const svgPoints = React.useMemo(() => {
    let s = pool.memeMint.toBase58().split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 1);
    const r = () => { s = (s * 1664525 + 1013904223) | 0; return Math.abs(s) / 2147483647; };
    let cur = 18 + r() * 8;
    const pts: string[] = [];
    for (let i = 0; i < 7; i++) {
      cur = Math.max(3, Math.min(36, cur + (up ? 1.5 : -1.5) + (r() - 0.5) * 9));
      pts.push(`${(i / 6) * 56 + 2},${40 - cur}`);
    }
    return pts.join(' ');
  }, [pool.memeMint.toBase58(), up]);

  const isLive = poolPerf?.bondingStatus === 'bonding';
  const mcap = pool.marketCap ?? 0;
  const fmtMcap = mcap >= 1e6 ? `${(mcap / 1e6).toFixed(1)}M` : mcap >= 1000 ? `${(mcap / 1000).toFixed(1)}K` : mcap > 0 ? mcap.toFixed(0) : '?';
  const quote = quoteLabelOf(pool);

  const isSOLPair = quoteIsSol(pool);

  return (
    <div
      className={`relative flex flex-col border-b border-[#1a1b25] transition-colors active:bg-white/[0.04] ${isNew ? 'animate-rocket-entrance' : ''}`}
      style={{ background: 'transparent' }}
    >
      {isNew && (
        <div className="absolute -top-2 -right-2 z-10 animate-bounce pointer-events-none">
          <span className="text-base">🚀</span>
        </div>
      )}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={() => onOpen(pool)}
      >
        {/* Left: image with live dot */}
        <div className="relative w-[68px] h-[68px] rounded-xl overflow-hidden bg-[#1a1b25] shrink-0">
          {pool.imageUrl
            ? <img src={pool.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <div className="w-full h-full flex items-center justify-center text-2xl">🔊</div>
          }
          {isLive && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
            />
          )}
        </div>

        {/* Center: name, price, change, mcap */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-sm truncate text-white leading-tight">{pool.name || 'Untitled'}</span>
            {pool.symbol && <span className="shrink-0 text-[10px] font-mono text-[#6b7084]">{pool.symbol}</span>}
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-black text-[#ffc371] tabular-nums leading-none">
              <TinyPrice value={pool.price ?? 0} />
            </span>
            <span className="text-[9px] text-[#6b7084] shrink-0">{quote}</span>
            {showPerfBadge(pool) ? (
              <span className={`text-[10px] font-bold px-1 py-px rounded shrink-0 ${up ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                {up ? '▲' : '▼'}{Math.abs(change24h).toFixed(1)}%
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1 py-px rounded bg-[#2b323c] text-[#d6d8ff] shrink-0">NEW</span>
            )}
          </div>
          <div className="text-[10px] text-[#4a4f63]">MCap {fmtMcap} {quote}</div>
        </div>

        {/* Right: sparkline + BUY / quick-buy toggle */}
        <div className="shrink-0 flex flex-col items-end gap-2 ml-1">
          <svg width="60" height="32" viewBox="0 0 60 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <polyline
              points={svgPoints}
              fill="none"
              stroke={up ? '#34d399' : '#f87171'}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          </svg>
          {!isGraduated(pool) && (
            <button
              type="button"
              className="px-3.5 py-1 rounded-full text-xs font-bold text-white transition-transform active:scale-90"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 2px 8px rgba(34,197,94,0.35)' }}
              onClick={(e) => { e.stopPropagation(); setShowBuyOptions(v => !v); }}
            >
              {showBuyOptions ? '✕' : 'BUY'}
            </button>
          )}
          {isGraduated(pool) && (
            <a
              href={`/sound-memes/${pool.memeMint.toBase58()}`}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold text-purple-300 bg-purple-500/20 transition active:scale-90"
              onClick={e => e.stopPropagation()}
            >
              TRADE
            </a>
          )}
        </div>
      </div>

      {/* Inline quick-buy panel */}
      {!isGraduated(pool) && (
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: showBuyOptions ? '120px' : '0px', opacity: showBuyOptions ? 1 : 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#ffc371]">Quick Buy</span>
              <button onClick={() => setShowBuyOptions(false)} className="text-[11px] text-[#6b7084] hover:text-white transition">✕ Cancel</button>
            </div>
            <div className="flex gap-2">
              {isSOLPair ? (
                <>
                  <button onClick={() => { setShowBuyOptions(false); onQuickBuy(pool, 0.1e9); }} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">0.1 SOL</button>
                  <button onClick={() => { setShowBuyOptions(false); onQuickBuy(pool, 0.5e9); }} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">0.5 SOL</button>
                  <button onClick={() => { setShowBuyOptions(false); onQuickBuy(pool, 1e9); }} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">1 SOL</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowBuyOptions(false); onQuickBuy(pool, 100_000 * 1e9); }} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">100K $WOODENG</button>
                  <button onClick={() => { setShowBuyOptions(false); onQuickBuy(pool, 444_000 * 1e9); }} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">444K $WOODENG</button>
                  <button onClick={() => { setShowBuyOptions(false); onQuickBuy(pool, 1_000_000 * 1e9); }} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#ffc371] text-black active:scale-95 transition">1M $WOODENG</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileVerticalSection({
  title,
  itemsBestFirst,
  onOpen,
  onBuy,
  onQuickBuy,
  onSell,
  onMint,
  onBurn,
  onPlay,
  isPlayingFor,
  tokensUiFor,
  mintThresholdFor,
  nftCountFor,
  change24hFor,
  createdAtFor,
  walletConnected,
  creatorRepFor,
  poolPerfLookup,
}: {
  title: string;
  itemsBestFirst: PoolType[];
  onOpen: (p: PoolType) => void;
  onBuy: (p: PoolType) => void;
  onQuickBuy: (p: PoolType, quoteRawIn: number) => void;
  onSell: (p: PoolType) => void;
  onMint: (p: PoolType) => void;
  onBurn: (p: PoolType) => void;
  onPlay: (id: string, url?: string) => void;
  isPlayingFor: (p: PoolType) => boolean;
  tokensUiFor: (p: PoolType) => number;
  mintThresholdFor: (p: PoolType) => number;
  nftCountFor: (p: PoolType) => number;
  change24hFor: (mint: string) => number;
  createdAtFor: (mint: string) => number;
  walletConnected: boolean;
  creatorRepFor?: (mint: string) => CreatorRepBadge | undefined;
  poolPerfLookup?: Record<string, PoolPerfBadge>;
}) {


  const railH = 'calc(100svh - var(--app-header-h,72px) - max(16px, env(safe-area-inset-bottom)))';

  return (
    <section className="md:hidden">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div
        className="no-scrollbar overflow-y-auto rounded-2xl bg-[#0c0d12] border border-[#1e1f2e]"
        style={{ height: railH, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {itemsBestFirst.map((p) => (
          <PumpStyleCard
            key={p.pubkey.toBase58()}
            pool={p}
            change24h={change24hFor(p.memeMint.toBase58())}
            onOpen={onOpen}
            onBuy={onBuy}
            onQuickBuy={onQuickBuy}
            poolPerf={poolPerfLookup?.[p.memeMint.toBase58()]}
            creatorRep={creatorRepFor?.(p.memeMint.toBase58())}
            createdAt={createdAtFor(p.memeMint.toBase58())}
          />
        ))}
      </div>
    </section>
  );
}


function MobileVerticalStacks({
  pools,
  onOpen,
  onBuy,
  onQuickBuy,
  onSell,
  onMint,
  onBurn,
  onPlay,
  isPlayingFor,
  tokensUiFor,
  mintThresholdFor,
  nftCountFor,
  change24hFor,
  createdAtFor,
  walletConnected,
  creatorRepFor,
  poolPerfLookup,
}: {
  pools: PoolType[];
  onOpen: (p: PoolType) => void;
  onBuy: (p: PoolType) => void;
  onQuickBuy: (p: PoolType, quoteRawIn: number) => void;
  onSell: (p: PoolType) => void;
  onMint: (p: PoolType) => void;   // NEW
  onBurn: (p: PoolType) => void;   // NEW
  onPlay: (id: string, url?: string) => void; // NEW
  isPlayingFor: (p: PoolType) => boolean;     // NEW
  tokensUiFor: (p: PoolType) => number;       // NEW
  mintThresholdFor: (p: PoolType) => number;  // NEW
  nftCountFor: (p: PoolType) => number;       // NEW
  change24hFor: (mint: string) => number;
  createdAtFor: (mint: string) => number;
  walletConnected: boolean;
  creatorRepFor?: (mint: string) => CreatorRepBadge | undefined;
  poolPerfLookup?: Record<string, PoolPerfBadge>;
})
{

  type Mode = 'gainers' | 'marketcap' | 'newest' | 'bonding';
  const [mode, setMode] = React.useState<Mode>('newest');





  useEffect(() => {
  const applyHash = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#','');
    if (h === 'top-gainers') setMode('gainers');
    if (h === 'top-marketcap') setMode('marketcap');
    if (h === 'newest') setMode('newest');
    if (h === 'to-market') setMode('bonding');
  };
  applyHash();
  window.addEventListener('hashchange', applyHash);
  return () => window.removeEventListener('hashchange', applyHash);
}, []);


  const mobileVisiblePools = React.useMemo(
    () => pools.filter(p => !HIDDEN_MINTS.has(p.memeMint.toBase58())),
    [pools]
  );

  const topMcap = React.useMemo(
    () => [...mobileVisiblePools].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
    [mobileVisiblePools]
  );
  const topGainers = React.useMemo(
    () => [...mobileVisiblePools].sort(
      (a, b) => change24hFor(b.memeMint.toBase58()) - change24hFor(a.memeMint.toBase58())
    ),
    [mobileVisiblePools, change24hFor]
  );




  





  const newest = React.useMemo(() => {
  return [...mobileVisiblePools].sort((a, b) => {
    const ta = createdAtFor(a.memeMint.toBase58()) || Infinity;
    const tb = createdAtFor(b.memeMint.toBase58()) || Infinity;
    if (tb !== ta) return tb - ta;
    const ma = a.marketCap ?? 0, mb = b.marketCap ?? 0;
    if (mb !== ma) return mb - ma;
    return a.memeMint.toBase58().localeCompare(b.memeMint.toBase58());
  });
}, [mobileVisiblePools, createdAtFor]);

  const toMarket = React.useMemo(() => {
    return [...mobileVisiblePools].sort((a, b) => {
      const aB = a.poolType === 0 ? 1 : 0;
      const bB = b.poolType === 0 ? 1 : 0;
      if (aB !== bB) return bB - aB;
      if (aB && bB) return (b.bondingSold ?? 0) - (a.bondingSold ?? 0);
      return (b.marketCap ?? 0) - (a.marketCap ?? 0);
    });
  }, [mobileVisiblePools]);

  const current = mode === 'gainers' ? topGainers : mode === 'bonding' ? toMarket : mode === 'newest' ? newest : topMcap;
  const title   = mode === 'gainers' ? '📈 24h Gainers' : mode === 'bonding' ? '🚀 To Market' : mode === 'newest' ? '✨ Newest' : '💰 Top MCap';

  return (
    <div className="md:hidden">
  <div className="mt-3 mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {([
          { key: 'newest', label: '✨ New' },
          { key: 'bonding', label: '🚀 To Market' },
          { key: 'gainers', label: '📈 Gainers' },
          { key: 'marketcap', label: '💰 MCap' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              mode === tab.key
                ? 'bg-[#ffc371] text-black shadow-md shadow-[#ffc371]/20'
                : 'bg-[#1a1b25] text-[#8a8fa3] border border-[#2a2b3a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <MobileVerticalSection
  key={mode}
  title={title}
  itemsBestFirst={current}
  onOpen={onOpen}
  onBuy={onBuy}
  onQuickBuy={onQuickBuy}
  onSell={onSell}
  onMint={onMint}                   // NEW
  onBurn={onBurn}                   // NEW
  onPlay={onPlay}                   // NEW
  isPlayingFor={isPlayingFor}       // NEW
  tokensUiFor={tokensUiFor}         // NEW
  mintThresholdFor={mintThresholdFor} // NEW
  nftCountFor={nftCountFor}         // NEW
  change24hFor={change24hFor}
  createdAtFor={createdAtFor}
  walletConnected={walletConnected}
  creatorRepFor={creatorRepFor}
  poolPerfLookup={poolPerfLookup}
/>


    </div>
  );
}




type PoolType = {


  // creator routing (new)
  creator?: PublicKey;
  creatorFeeBps?: number;  // e.g. 100 = 1%


    metaUri?: string;         // on-chain metadata URI (for later hydration)
  hydrated?: boolean;       // whether off-chain JSON was merged

  /* on-chain config ------------------------------------ */
  poolType: 0 | 1 | 2 | 3;      // 0 = bonding, 1 = AMM, 2 = graduated, 3 = migrated DAMM v2

  /* graduation info (only when poolType === 2) --------- */
  graduationTimestamp?: number;
  meteoraPool?: string;          // DAMM v2 pool address
  meteoraPositionNft?: string;   // position NFT mint
  graduationConfirmed?: boolean; // true when poolType === 3
  lastMemePrice?: number;    // starting price for bonding curve

  /* reserves & mints ----------------------------------- */
  ammReserves: { meme: number; woodeng: number };
  memeMint: PublicKey;

  /* ➕ added fields you use elsewhere ------------------- */
  pubkey: PublicKey;         // set in fetchSoundMemePoolsWithMetadata
  price?: number;
  decimals?: number;
  totalSupply?: number;      // computed in fetcher
  marketCap?: number;        // computed in fetcher
  volume24h?: number;        // (optional) display only, ok if undefined
  category?: string;         // derived from metadata trait
  quoteMint: PublicKey;   // WOODENG mint or wSOL (NATIVE_MINT)

  socials?: { x?: string; telegram?: string; website?: string };



  /* metadata / UI -------------------------------------- */
  symbol?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  audioUrl?: string;
  attributes?: any[];

  /* bonding-curve params --------------------------------*/
  nftThreshold?: number;
  vtokens?: number;
  vwoodeng?: number;
  bondingSold?: number;

  /* user state ----------------------------------------- */
  userMemeBalance?: number;

  /* local upload scratch ------------------------------- */
  imageFile?: File;
  audioFile?: File;

  /* creation timestamp --------------------------------- */
  createdAt?: number;

  /* program version ----------------------------------- */
  programVersion?: 'v1' | 'v2';  // which pool program this came from

  /* v2 gate ------------------------------------------- */
  minAvgHoldDays?: number;        // holder requirement (v2 only)
};




// Filled trade toast payloads (used by buy/sell "filled" modals)
type FilledTrade = {
  open: boolean;
  symbol: string;
  amountMeme: number;   // UI units
  priceWoodeng: number; // UI units
  quoteLabel?: string;  // SOL or WOODENG
};


const QUOTE_DECIMALS = 9;              // WOODENG and wSOL both have 9
const WOODENG_DECIMALS = QUOTE_DECIMALS;
const WSOL_MINT = NATIVE_MINT;         // So111111... (wrapped SOL)

const quoteIsSol = (p: PoolType) => p.quoteMint?.equals(WSOL_MINT);
const quoteLabelOf = (p: PoolType) => (quoteIsSol(p) ? "SOL" : "WOODENG");

const MEME_DECIMALS = 0;
const PROTOCOL_FEE_BPS = 100; // 1 %

const calcAvgDays = (hp: any): number => {
  try {
    const totalSold = BigInt(hp.totalSold?.toString() ?? '0')
    const firstBuyTs = BigInt(hp.firstBuyTs?.toString() ?? '0')
    const nowSecs = BigInt(Math.floor(Date.now() / 1000))

    if (totalSold === 0n) {
      // Never sold → time since first buy until NOW (simulated)
      if (firstBuyTs === 0n) return 0
      return Number(nowSecs - firstBuyTs) / 86400
    }
    // Has sold → classic weighted average + elapsed since last trade
    const cumul = BigInt(hp.cumulativeTokenSecs?.toString() ?? '0')
    const balance = BigInt(hp.currentBalance?.toString() ?? '0')
    const total = balance + totalSold
    if (total === 0n) return 0
    const lastTs = BigInt(hp.lastUpdateTs?.toString() ?? '0')
    const elapsed = lastTs > 0n && balance > 0n ? (nowSecs - lastTs) * balance : 0n
    return Number((cumul + elapsed) / total) / 86400
  } catch { return 0 }
}

const fmtHoldTime = (days: number): string => {
  if (days <= 0) return '0h'
  const totalMinutes = Math.floor(days * 24 * 60)
  const d = Math.floor(totalMinutes / 1440)
  const h = Math.floor((totalMinutes % 1440) / 60)
  const m = totalMinutes % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}


// --- Chain-aligned targets & thresholds (LAMPORTS = 1e9) ---
const CURVE_THRESHOLD_RAW_COMMON = 44_000_000n; // 44,000,000 raw MEME (same for both pairs & versions)

// ── V2 constants (new pools) ──────────────────────────────────────────────
const V2_PRICE_TARGET_WOODENG_LAMPORTS = 100_000_000n; // 0.1 WOODENG/MEME
const V2_MIGRATE_LOWER_WOODENG = 1_400_000n * 10n ** 9n;
const V2_MIGRATE_UPPER_WOODENG = 3_000_000n * 10n ** 9n;

// ── V1 constants (existing mainnet pools) ─────────────────────────────────
const V1_PRICE_TARGET_WOODENG_LAMPORTS = 4_444_444n * 10n ** 9n; // 4,444,444 WOODENG/MEME
const V1_MIGRATE_LOWER_WOODENG = 4_317_460n * 10n ** 9n;
const V1_MIGRATE_UPPER_WOODENG = 9_284_888n * 10n ** 9n;

// ── SOL constants (same in both versions) ─────────────────────────────────
const PRICE_TARGET_SOL_LAMPORTS     = 44n       * 10n ** 9n;
const MIGRATE_LOWER_SOL     = 40n       * 10n ** 9n;
const MIGRATE_UPPER_SOL     = 100n       * 10n ** 9n;

// Helper: pick the right set for the pool's quote mint AND program version
function targetsFor(pool: PoolType) {
  const isSol = quoteIsSol(pool);
  const isV1 = pool.programVersion === 'v1';
  return {
    // p1 for the exponential curve
    priceTargetLamports: isSol
      ? PRICE_TARGET_SOL_LAMPORTS
      : (isV1 ? V1_PRICE_TARGET_WOODENG_LAMPORTS : V2_PRICE_TARGET_WOODENG_LAMPORTS),

    // migration window [lower, upper)
    migrateLowerLamports: isSol ? MIGRATE_LOWER_SOL : (isV1 ? V1_MIGRATE_LOWER_WOODENG : V2_MIGRATE_LOWER_WOODENG),
    migrateUpperLamports: isSol ? MIGRATE_UPPER_SOL : (isV1 ? V1_MIGRATE_UPPER_WOODENG : V2_MIGRATE_UPPER_WOODENG),

    // x-threshold (raw MEME sold) to reach p1
    curveThresholdRaw: CURVE_THRESHOLD_RAW_COMMON,
  };
}









// % toward AMM migration based on WOODENG liquidity in the pool vault
function ammMigrationPct(pool: PoolType): number {
  if (pool.poolType === 1 || pool.poolType === 2 || pool.poolType === 3) return 1;
  const wood = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const lower = Number(targetsFor(pool).migrateLowerLamports);
  return Math.min(1, wood / Math.max(1, lower));
}


// Show performance metrics?
function showPerfBadge(pool: PoolType): boolean {
  // AMM and graduated always show perf; bonding only after 10% of the lower migration target
  return isAmm(pool) || isGraduated(pool) || ammMigrationPct(pool) >= 0.10;
}


// Show the Buy button?
function canShowBuy(pool: PoolType): boolean {
  // Graduated pools: trade on Meteora, not here
  if (isGraduated(pool)) return false;

  // AMM pools: always show Buy
  if (isAmm(pool)) return true;

  // Bonding pools: allow buys until the **upper** migration bound is reached
  const woodLamports = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const upper        = Number(targetsFor(pool).migrateUpperLamports);

  // show Buy while we're still below the upper threshold
  return woodLamports < upper;
}



// wallet-like type for one-shot sender
type SignerWallet = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
};

async function sendIxsOnce(
  connection: Connection,
  wallet: SignerWallet,
  ixs: TransactionInstruction[],
  signers: Keypair[] = [],
  { skipPreflight = false } = {}
) {
  const { blockhash, lastValidBlockHeight } =
  await connection.getLatestBlockhash("confirmed");


  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  // ✅ Phantom signs FIRST
  const signed = await wallet.signTransaction(tx);

  // ✅ Additional signers sign AFTER
  if (signers.length) signed.partialSign(...signers);

  // expected signature even if sendRawTransaction throws
  const expectedSig = bs58.encode(signed.signatures[0].signature as Buffer);

  try {
    const sig = await connection.sendRawTransaction(signed.serialize(), {
  skipPreflight,
  preflightCommitment: "confirmed",
});

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed'
    );
    return sig;
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).toLowerCase();

    if (expectedSig && /already been processed|duplicate signature/.test(msg)) {
      const start = Date.now();
      while (Date.now() - start < 20_000) {
        const st = await connection.getSignatureStatuses([expectedSig]);
        const s = st.value[0];
        if (s && !s.err) return expectedSig;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (e instanceof SendTransactionError) {
      const logs = await e.getLogs(connection).catch(() => null);
      throw new Error(logs && logs.length ? `${e.message}\n${logs.join('\n')}` : e.message);
    }
    throw e;
  }
}










async function buildWrapSolIxs(payer: PublicKey, amountLamports: number) {
  const ata = await getAssociatedTokenAddress(WSOL_MINT, payer);
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer, ata, payer, WSOL_MINT
  );
  const fundIx = SystemProgram.transfer({ fromPubkey: payer, toPubkey: ata, lamports: amountLamports });
  const syncIx = createSyncNativeInstruction(ata);
  return { ata, ixs: [createAtaIx, fundIx, syncIx] };
}




// idempotent ATA builder (returns address + instruction, no send)
async function ensureAtaIx(
  owner: PublicKey,
  mint: PublicKey,
  payer: PublicKey,
  isPdaOwner = false
): Promise<{ ata: PublicKey; ix: TransactionInstruction }> {
  const ata = await getAssociatedTokenAddress(mint, owner, isPdaOwner, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { ata, ix };
}

async function buildCreateMintIx(
  connection: Connection,           // ← added
  payer: PublicKey,
  decimals: number,
  mintAuthority: PublicKey
): Promise<{ mint: PublicKey; ixs: TransactionInstruction[]; signers: Keypair[] }> {
  const kp = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(82);
  const createIx = SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: kp.publicKey,
    lamports,
    space: 82,
    programId: TOKEN_PROGRAM_ID,
  });
  const initIx = createInitializeMintInstruction(kp.publicKey, decimals, mintAuthority, mintAuthority, TOKEN_PROGRAM_ID);
  return { mint: kp.publicKey, ixs: [createIx, initIx], signers: [kp] };
}




export default function SoundMemesClient() {

 // 1) FIRST
  const wallet = useWallet();
  const { authenticated } = usePrivy();
  const { publicKey: unifiedPublicKey, connected: unifiedConnected, sendTransaction: unifiedSendTransaction, signTransaction: unifiedSignTransaction } = useUnifiedWallet();
  const effectivePublicKey = (wallet.connected && wallet.publicKey) ? wallet.publicKey : unifiedPublicKey;
  const effectiveConnected = wallet.connected || unifiedConnected;
  const router = useRouter();
    // simple flag we can re-use in UI
  const walletMissing = !effectivePublicKey && !authenticated;

  // a tiny record we use to sort/paginate cheaply
type LitePoolKey = {
  pubkey: string;        // pool config PDA (string)
  memeMint: string;      // mint (string)
  symbol?: string;
  name?: string;
  marketCap: number;
  createdAt?: number;    // firstSeenAtByMint or 0
  poolType: 0 | 1 | 2 | 3;
  metaUri?: string;
  quoteMint: string;
};

const [allPoolKeys, setAllPoolKeys] = useState<LitePoolKey[]>([]);                 // whole catalog (light)
const [headersByKey, setHeadersByKey] = useState<Record<string, PoolType>>({});    // header objects by pubkey
const [poolsByKey,   setPoolsByKey]   = useState<Record<string, PoolType>>({});    // hydrated full objects (only window)


// a concrete list the UI and helpers can use
const [pools, setPools] = useState<PoolType[]>([]);


  const [balancesByMint, setBalancesByMint] = useState<Record<string, number>>({});

  // ── Top Diamond Hands ──────────────────────────────────────────────
  type DiamondEntry = { pda: string; avgDays: number; currentBalance: any; isMe: boolean }
  const [topHolders, setTopHolders] = useState<DiamondEntry[]>([])
  const [topHoldersLoading, setTopHoldersLoading] = useState(false)

  // ── paint + load gates ─────────────────────────────────────────────
const [afterPaint, setAfterPaint] = React.useState(false);
const [poolsLoaded, setPoolsLoaded] = React.useState(false);

// fire after first paint (avoids blocking initial render)
React.useEffect(() => {
  const id = requestAnimationFrame(() => setAfterPaint(true));
  return () => cancelAnimationFrame(id);
}, []);


// put this right after the closing brace of hydratePoolsDetails(...)
async function fetchSoundMemePoolsWithMetadata(poolProgram: Program): Promise<PoolType[]> {
  const headers = await fetchPoolHeadersOnly(poolProgram);
  if (!headers.length) return [];
  return await hydratePoolsDetails(headers);
}

async function fetchJupiterPrice(memeMintStr: string): Promise<number> {
  try {
    const WOODENG_MINT_STR = "83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5";
    const [memeRes, woodRes] = await Promise.all([
      fetch(`https://api.jup.ag/price/v2?ids=${memeMintStr}`).then(r => r.json()),
      fetch(`https://api.jup.ag/price/v2?ids=${WOODENG_MINT_STR}`).then(r => r.json()),
    ]);
    const memeUsd = Number(memeRes?.data?.[memeMintStr]?.price ?? 0);
    const woodUsd = Number(woodRes?.data?.[WOODENG_MINT_STR]?.price ?? 0);
    if (memeUsd > 0 && woodUsd > 0) return memeUsd / woodUsd;
    return 0;
  } catch { return 0; }
}

async function fetchDexScreenerPrice(memeMintStr: string): Promise<number> {
  try {
    const WOODENG_MINT_STR = "83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5";
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${memeMintStr}`);
    const json = await res.json();
    const pairs = json?.pairs;
    if (!pairs || pairs.length === 0) return 0;
    const woodPair = pairs.find((p: any) =>
      p.quoteToken?.address === WOODENG_MINT_STR ||
      p.baseToken?.address === WOODENG_MINT_STR
    );
    const pair = woodPair || pairs[0];
    if (!pair) return 0;
    const priceUsd = Number(pair.priceUsd ?? 0);
    const woodRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${WOODENG_MINT_STR}`);
    const woodJson = await woodRes.json();
    const woodPriceUsd = Number(woodJson?.pairs?.[0]?.priceUsd ?? 0);
    if (priceUsd > 0 && woodPriceUsd > 0) return priceUsd / woodPriceUsd;
    return 0;
  } catch { return 0; }
}

async function fetchBirdeyePrice(memeMintStr: string): Promise<number> {
  try {
    const WOODENG_MINT = "83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5";
    const res = await fetch(
      `https://public-api.birdeye.so/defi/multi_price?list_address=${memeMintStr},${WOODENG_MINT}`,
      { headers: { "X-API-KEY": "" } }
    );
    const json = await res.json();
    const memeUsd = json?.data?.[memeMintStr]?.value ?? 0;
    const woodUsd = json?.data?.[WOODENG_MINT]?.value ?? 0;
    if (memeUsd > 0 && woodUsd > 0) return memeUsd / woodUsd;
    return 0;
  } catch { return 0; }
}



// fetch Top Diamond Hands from devnet HolderProfile accounts
useEffect(() => {
  if (!afterPaint) return;
  setTopHoldersLoading(true);
  (async () => {
    try {
      const dummyProvider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
      const v2Program = new Program(poolV2Idl, V2_POOL_PROGRAM_ID, dummyProvider);
      const allProfiles = await (v2Program.account as any).holderProfile.all() as Array<{ publicKey: PublicKey; account: any }>;
      const HOLDER_SEED = Buffer.from("holder");
      const myPda = effectivePublicKey
        ? PublicKey.findProgramAddressSync([HOLDER_SEED, effectivePublicKey.toBuffer()], V2_POOL_PROGRAM_ID)[0].toBase58()
        : null;
      const sorted: DiamondEntry[] = allProfiles
        .map(({ publicKey, account }) => {
          return { pda: publicKey.toBase58(), avgDays: calcAvgDays(account), currentBalance: account.currentBalance, isMe: publicKey.toBase58() === myPda };
        })
        .sort((a, b) => b.avgDays - a.avgDays)
        .slice(0, 10);
      setTopHolders(sorted);
    } catch (e) {
      console.error("[TopHolders] fetch error", e);
    } finally {
      setTopHoldersLoading(false);
    }
  })();
}, [afterPaint, effectivePublicKey?.toBase58()]);

// load pools once we’ve painted (unblocks the rest of the pipeline)
useEffect(() => {
  if (!afterPaint) return;
  let cancelled = false;

  (async () => {
    try {
      const provider = new AnchorProvider(
        connection,
        effectivePublicKey
          ? {
              publicKey: effectivePublicKey,
              signTransaction: ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction) as any,
              signAllTransactions: ((wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx))))) as any,
            }
          : ({ publicKey: new PublicKey('11111111111111111111111111111111') } as any),
        { preflightCommitment: 'processed' }
      );
      const poolProgram = new Program(poolIdl, V2_POOL_PROGRAM_ID, provider);
const rawHeaderPools = await fetchPoolHeadersOnly(poolProgram);

// hide any blacklisted pool by either config PDA *or* meme mint
const headerPools = rawHeaderPools.filter(p => {
  const cfg = p.pubkey.toBase58();
  const mint = p.memeMint.toBase58();
  return !HIDDEN_POOLS.has(cfg) && !HIDDEN_POOLS.has(mint);
});
if (cancelled) return;


// 2) cache raw headers by pubkey (for later hydration)
const hdrMap: Record<string, PoolType> = {};
for (const p of headerPools) hdrMap[p.pubkey.toBase58()] = p;
if (!cancelled) setHeadersByKey(hdrMap);

// 3) build lightweight keys we can sort/paginate cheaply
const keys: LitePoolKey[] = headerPools.map(p => ({
  pubkey:   p.pubkey.toBase58(),
  memeMint: p.memeMint.toBase58(),
  name:     p.name ?? "",
  symbol:   p.symbol ?? "",
  marketCap: Number(p.marketCap ?? 0),
  createdAt: 0,  // we’ll patch from firstSeenAt later
  poolType: p.poolType,
  metaUri:  p.metaUri,
  quoteMint: p.quoteMint.toBase58(),
}));

// 4) default sort: market cap
keys.sort((a,b) => b.marketCap - a.marketCap);
if (!cancelled) setAllPoolKeys(keys);

// 5) do not set full pools here; hydration is done for the window below


// 6) seed the visible list with header-only pools (no HTTP yet)
setPools(headerPools);


    } catch (e) {
      console.warn('Failed to load pools', e);
    } finally {
      if (!cancelled) setPoolsLoaded(true);
    }
  })();

  return () => { cancelled = true; };
}, [afterPaint, effectivePublicKey?.toBase58()]);

// Fetch live prices for graduated (poolType 2 or 3) pools once headers are loaded.
// Mirrors the detail page: fetch GraduationInfo PDA individually if meteoraPool missing,
// then Meteora vault first, Jupiter/DexScreener as fallbacks.
useEffect(() => {
  if (!poolsLoaded) return;
  const graduated = pools.filter(p => p.poolType === 2 || p.poolType === 3);
  if (!graduated.length) return;
  let cancelled = false;
  (async () => {
    const updates: Record<string, number> = {};
    await Promise.all(graduated.map(async p => {
      const mint = p.memeMint.toBase58();
      let lp = 0;

      // If meteoraPool not already populated, fetch GraduationInfo PDA directly
      let meteoraPoolAddr = p.meteoraPool;
      if (!meteoraPoolAddr) {
        try {
          const programId = p.programVersion === 'v1' ? V1_POOL_PROGRAM_ID : V2_POOL_PROGRAM_ID;
          const [gradPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('graduation'), p.pubkey.toBuffer()],
            programId
          );
          const gradInfo = await connection.getAccountInfo(gradPda, 'confirmed');
          if (gradInfo?.data && gradInfo.data.length >= 8 + 106) {
            const raw = new PublicKey(gradInfo.data.subarray(8 + 40, 8 + 72)).toBase58();
            if (raw !== '11111111111111111111111111111111') {
              meteoraPoolAddr = raw;
              p.meteoraPool = raw;
            }
          }
        } catch (e) {
          console.warn('[GRAD PDA]', mint, e);
        }
      }

      // Try Meteora vault price
      if (meteoraPoolAddr) {
        try {
          lp = await fetchMeteoraPoolPrice(connection, meteoraPoolAddr, mint, p.decimals ?? 0, 9);
          if (lp > 0) console.log('[METEORA PRICE]', mint, '→', lp);
        } catch (e) {
          console.warn('[METEORA ERROR]', mint, e);
        }
      }

      // Birdeye fallback (most reliable for listed tokens)
      if (lp <= 0) {
        lp = await fetchBirdeyePrice(mint);
        if (lp > 0) console.log('[BIRDEYE FALLBACK]', mint, '→', lp);
      }

      // Jupiter fallback
      if (lp <= 0) {
        lp = await fetchJupiterPrice(mint);
        if (lp > 0) console.log('[JUPITER FALLBACK]', mint, '→', lp);
      }

      // DexScreener fallback
      if (lp <= 0) {
        lp = await fetchDexScreenerPrice(mint);
        if (lp > 0) console.log('[DEXSCREENER FALLBACK]', mint, '→', lp);
      }

      if (lp > 0) updates[mint] = lp;
    }));
    if (cancelled || !Object.keys(updates).length) return;
    setPools(prev => prev.map(p => {
      const lp = updates[p.memeMint.toBase58()];
      return lp ? { ...p, price: lp } : p;
    }));
  })();
  return () => { cancelled = true; };
}, [poolsLoaded]);

// run work when the browser is idle (fallback to setTimeout)
const runIdle = (fn: () => void) => {
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void) => number)
    | undefined;
  if (ric) ric(() => fn());
  else setTimeout(fn, 0);
};



// Reusable: open Burn modal for a pool (used by desktop + mobile)
const handleOpenBurn = async (pool: PoolType) => {
  const canBurn = nftsLoaded && (ownedCounts[pool.memeMint.toBase58()] ?? 0) > 0;
  if (!canBurn) {
    setStatus("No NFTs to burn for this pool.");
    return;
  }

  const lockDict = userPoolNfts[pool.memeMint.toBase58()] ?? {};
  const maybeNfts = Object.entries(lockDict).map(([lockId, data]) => ({
    lockId: Number(lockId),
    mint: new PublicKey(data.mint),
  }));

  const ownedNfts = (
    await Promise.all(
      maybeNfts.map(async (n) =>
        (await stillOwnsNft(n.mint, effectivePublicKey!)) ? n : null
      )
    )
  ).filter(Boolean) as { lockId: number; mint: PublicKey }[];

  if (!ownedNfts.length) {
    setStatus("Looks like you’ve already burned every NFT for this meme.");
    return;
  }

  setBurnModal({ pool, nfts: ownedNfts, open: true });
};

  
const BULK_FLUSH_MS = 120_000;
type PricePoint = { mint: string; priceLamports: number; at: number };

const bulkRef = React.useRef<Map<string, PricePoint>>(new Map());
const flushTimerRef = React.useRef<number | null>(null);


const lastQueuedRef = React.useRef<Record<string, { at:number; lamports:number }>>({});

function shouldRecord(mint: string, priceLamports: number, at: number) {
  const last = lastQueuedRef.current[mint];
  if (!last) return true;
  const dt = at - last.at;
  if (dt < 5_000) return false; // don't spam within 5s
  const rel = Math.abs(priceLamports - last.lamports) / Math.max(1, last.lamports);
  return rel >= 0.001; // 0.1% min change
}


function queuePrice(mint: string, priceLamports: number, at = Date.now()) {
  if (!Number.isFinite(priceLamports) || priceLamports <= 0) return;
  if (!shouldRecord(mint, priceLamports, at)) return;

  lastQueuedRef.current[mint] = { at, lamports: priceLamports };
  const prev = bulkRef.current.get(mint);
  if (!prev || at > prev.at) bulkRef.current.set(mint, { mint, priceLamports, at });
  scheduleFlush();
}


function scheduleFlush() {
  if (flushTimerRef.current != null) return;
  flushTimerRef.current = window.setTimeout(() => flushNow(false), BULK_FLUSH_MS);
}
async function flushNow(useBeacon: boolean) {
  const items = Array.from(bulkRef.current.values());
  bulkRef.current.clear();
  if (!items.length) {
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    return;
  }
  const payload = JSON.stringify({ points: items });
  try {
    if (useBeacon && 'sendBeacon' in navigator) {
      const ok = navigator.sendBeacon('/api/pricepoints/bulk', new Blob([payload], { type: 'application/json' }));
      if (ok) return;
    }
    await fetch('/api/pricepoints/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: useBeacon,
    });
  } finally {
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
  }
}

React.useEffect(() => {
  const id = window.setInterval(() => flushNow(false), BULK_FLUSH_MS);
  const onHide = () => flushNow(true);
  window.addEventListener('visibilitychange', onHide);
  window.addEventListener('beforeunload', onHide);
  return () => {
    clearInterval(id);
    window.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('beforeunload', onHide);
    flushNow(true);
  };
}, []);











 


  const [copied, setCopied] = useState<string | null>(null);


  // Auto-migration controls
const AUTO_MIGRATE_AFTER_BUY = false;           // used by the post-buy path
const ATTEMPT_SINGLE_TX_AUTOMIGRATE = false;   // keep false unless you know the math
const autoMigratingRef = React.useRef<Set<string>>(new Set()); // prevent double-fires



  const searchParams   = useSearchParams();
  const deepLinkedMint = searchParams.get("mint");
  const queryRaw = (searchParams.get("q") || "").trim();
  const query    = queryRaw.toLowerCase();


  const seededOnceRef = useRef<Set<string>>(new Set())

  
const [firstSeenAtByMint, setFirstSeenAtByMint] = useState<Record<string, number>>({});

const [showDetail, setShowDetail] = useState(false);
const [detailPool, setDetailPool] = useState<PoolType | null>(null);
const [selectedTimeRange, setSelectedTimeRange] = useState<Timeframe>('24h');

  







type ServerCandle = { t:number; o:number; h:number; l:number; c:number; v:number };
const [serverCandles, setServerCandles] = useState<
  Record<string, Record<Timeframe, ServerCandle[]>>
>({});



useEffect(() => {
  if (!showDetail || !detailPool) return;
  const mintKey = detailPool.memeMint.toBase58();

  let stop = false;
  (async () => {
    try {
      const r = await fetch(`/api/ohlc/${mintKey}?tf=${selectedTimeRange}&limit=1000`, { cache: 'no-store' });
      const raw: ServerCandle[] = r.ok ? await r.json() : [];
      const bars: ServerCandle[] = raw.map(b => ({
        t: Number(b.t), o: Number(b.o) / 1e9, h: Number(b.h) / 1e9,
        l: Number(b.l) / 1e9, c: Number(b.c) / 1e9, v: Number(b.v) | 0
      }));
      if (!stop && Array.isArray(bars) && bars.length > 0) {   // ✅ only set when non-empty
        setServerCandles(prev => ({
          ...prev,
          [mintKey]: { ...(prev[mintKey] ?? {}), [selectedTimeRange]: bars }
        }));
      }
    } catch {/* ignore transient */}
  })();

  return () => { stop = true; };
}, [showDetail, detailPool, selectedTimeRange]);





type UserPoolNfts = Record<
  string,              // memeMint (base-58 string)
  Record<number, any>  // lockId   -> NFT object
>;

function assertWallet(wallet: WalletContextState): asserts wallet is WalletContextState & { publicKey: PublicKey } {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
}







function StepModal({ step, total, message }:{
  step:number; total:number; message:string;
}) {
  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
      <div className="w-[min(88vw,340px)] rounded-2xl bg-[#1e1f28] border border-[#33334a]
                      shadow-2xl p-6 text-white">
        {/* step dots */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-3 mb-5">
            {Array.from({ length: total }, (_, i) => {
              const idx = i + 1;
              const done = idx < step;
              const active = idx === step;
              return (
                <React.Fragment key={idx}>
                  {i > 0 && (
                    <div className={`h-[2px] w-8 rounded-full transition-colors duration-300 ${
                      done ? 'bg-[#ffc371]' : 'bg-[#33334a]'
                    }`} />
                  )}
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    transition-all duration-300 shrink-0
                    ${done ? 'bg-[#ffc371] text-black' : ''}
                    ${active ? 'bg-[#ffc371]/20 text-[#ffc371] ring-2 ring-[#ffc371]' : ''}
                    ${!done && !active ? 'bg-[#2b2b37] text-[#666]' : ''}
                  `}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : idx}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* spinner */}
        <div className="flex justify-center mb-4">
          <Loader2 className="w-8 h-8 text-[#ffc371] animate-spin" />
        </div>

        {/* title */}
        <h2 className="text-center text-base font-bold mb-1">
          {total > 1 ? `Step ${step} of ${total}` : 'Processing'}
        </h2>

        {/* message */}
        <p className="text-center text-sm text-[#a0a0b0]">{message}</p>

        {/* hint */}
        <p className="text-center text-[11px] text-[#666] mt-3">
          Please confirm in your wallet
        </p>
      </div>
    </div>
  );
}



// Anchor expects a Wallet object, not WalletContextState, so we create an adapter
function getAnchorWallet(wallet: WalletContextState): {
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>
} | null {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    return null;
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions
  };
}

const poolIdl = poolIdlJson as Idl;
const poolV2Idl = poolIdlV2Json as Idl;
const lockerIdl = lockerIdlJson as Idl;




// -- Pinata Upload Helper --
// Accepts Blob *or* File
async function pinFile(data: Blob | File, filename?: string) {
  const r = await fetch('/api/pinata-token');
  if (!r.ok) throw new Error(`Pinata token failed: ${r.status} ${r.statusText}`);
  const { jwt } = await r.json();

  const form = new FormData();
  form.append('file', data, (data as any)?.name ?? filename ?? 'upload.bin');

  const res  = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const text = await res.text();
  let body: any; try { body = JSON.parse(text); } catch {}

  if (!res.ok || !body?.IpfsHash) {
    const msg = body?.error?.message || body?.error || body?.message || `${res.status} ${res.statusText}`;
    throw new Error(`Pinata upload failed: ${msg}`);
  }
  return body.IpfsHash;
}




// Returns threshold for minting NFT (prefer metadata → attributes → fallback)
function getMintThreshold(pool: PoolType): number {
  // 1) prefer the parsed numeric field we attach in the fetcher
  const fromPool = Number((pool as any).nftThreshold);
  if (Number.isFinite(fromPool) && fromPool > 0) return Math.floor(fromPool);

  // 2) fallback: read an attribute named "Threshold"
  const rawAttr = (pool.attributes ?? [])
    .find?.((a: any) => String(a?.trait_type ?? '').toLowerCase() === 'threshold')
    ?.value;
  const parsedAttr = Number(String(rawAttr).replace(/[,_\s]/g, ''));
  if (Number.isFinite(parsedAttr) && parsedAttr > 0) return Math.floor(parsedAttr);

  // 3) last resort default
  return 10_000;
}


// ===== NEW HELPERS (add below getMintThreshold) ===========================

// decimals for meme mint (fallback 0)
const memeDecimalsOf = (pool: PoolType) =>
  Number.isFinite(pool.decimals) ? (pool.decimals as number) : MEME_DECIMALS;

// UI threshold you already compute
function getMintThresholdUi(pool: PoolType): number {
  return getMintThreshold(pool);
}

// RAW threshold (what the on-chain program expects)
function getMintThresholdRaw(pool: PoolType): number {
  const ui  = getMintThresholdUi(pool);
  const dec = memeDecimalsOf(pool);
  return Math.floor(ui * 10 ** dec);
}

// keep metadata ASCII, enforce Token Metadata size limits
function asciiClean(s?: string) {
  return (s ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}
function sanitizeNameSymbolUri(
  nameRaw: string | undefined,
  symbolRaw: string | undefined,
  uriRaw: string | undefined
) {
  const name   = asciiClean(nameRaw).slice(0, 32);
  const symbol = asciiClean(symbolRaw).slice(0, 10);
  const uri    = String(uriRaw ?? "").slice(0, 200);
  return { name, symbol, uri };
}

// Optional: decode Anchor custom errors to human messages
function decodeAnchorCustomError(code: number, idl?: Idl) {
  try {
    const errs = (idl as any)?.errors as Array<{ code: number; name: string; msg?: string }>;
    const hit = errs?.find(e => e.code === code);
    if (hit) return `${hit.name}${hit.msg ? `: ${hit.msg}` : ""}`;
  } catch {}
  return null;
}


// ── DEVNET TESTING ──────────────────────────────────────────────────────────
// Flip this to false when you go back to mainnet
const USE_DEVNET = false;

// ── V1 mainnet pool program (existing pools, bonding + AMM only) ──
const V1_POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');
const V1_CONFIG_VERSION = 17;
const V1_ACCOUNT_SIZE = 330; // 8 discriminator + 322 SoundMemeConfig::LEN

// ── V2 mainnet pool program ──
const V2_POOL_PROGRAM_ID = new PublicKey(
  'C1pGixxtxw1z8x7eGcG2kzs4ZWBkXKVLwPJsDjxWTsin'
);
const V2_CONFIG_VERSION = 22;
const V2_ACCOUNT_SIZE = 332; // 8 discriminator + 324 SoundMemeConfig::LEN
const V2_DEPLOYED_ON_MAINNET = true;

// ── Devnet connection for V2 testing ──
const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const devnetConnection = new Connection(DEVNET_RPC_URL, { commitment: "processed" });

// For new pool creation (once v2 is on mainnet)
const POOL_PROGRAM_ID = V2_POOL_PROGRAM_ID;

const LOCKER_PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');


const STAKING_PROGRAM_ID = new PublicKey(
  'BFJU3f7PXgzcrYPD2MkQsjRko9wDTpEbyJTtLUzSyhFG'   // mainnet staking (same code as devnet)
);

const WOODENG_MINT = new PublicKey(
  '83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5'   // mainnet WOODENG
);

// Admin wallet allowed to run the initializer
const ADMIN_INIT_PUBKEY = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');

// Cast the staking IDL
const stakingIdl = stakingIdlJson as Idl;



const PROJECT_WALLET = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');


// MAINNET RPC — override any .env devnet setting
const RPC_URL = (
  process.env.NEXT_PUBLIC_SOLANA_RPC &&
  process.env.NEXT_PUBLIC_SOLANA_RPC.startsWith('http') &&
  !process.env.NEXT_PUBLIC_SOLANA_RPC.includes('devnet')  // reject devnet URLs
)
    ? process.env.NEXT_PUBLIC_SOLANA_RPC
    : 'https://mainnet.helius-rpc.com/?api-key=6b56ae36-a263-4599-a807-43a5289701dc';

const connection = new Connection(RPC_URL, { commitment: "processed" });
if (typeof window !== 'undefined') console.log('[SoundMemes] RPC:', RPC_URL.replace(/api-key=.*/, 'api-key=***'));



function feeRecipientFor(pool: PoolType): PublicKey {
  // If the pool config exposes a creator address, use it; else fallback.
  return pool.creator ?? PROJECT_WALLET;
}

// Get the correct pool program ID for a given pool (v1 vs v2)
function poolProgramIdFor(pool: PoolType): PublicKey {
  return pool.programVersion === 'v1' ? V1_POOL_PROGRAM_ID : V2_POOL_PROGRAM_ID;
}


const poolMcap = (p: PoolType) => p.ammReserves?.woodeng ?? 0;

// CONFIG_VERSION is used for new pool creation (always v2)
const CONFIG_VERSION = V2_CONFIG_VERSION;


type SortMode = 'marketcap' | 'gainers' | 'newest' | 'bonding';
const PER_PAGE = 12;

const [sortMode, setSortMode] = useState<SortMode>('newest');
const [page, setPage] = useState(1);






// one per mint, persisted history only (from the DB API)
const [persistedSeriesByMint, setPersistedSeriesByMint] = useState<
  Record<string, { time: number; price: number }[]>
>({});



// one in-memory timeseries per meme mint (for charts)
const [priceSeriesByMint, setPriceSeriesByMint] = useState<
  Record<string, { time: number; price: number }[]>
>({});



// Bumps whenever any mint gets a new last point — forces memo recomputes.
const seriesTick = React.useMemo(() => {
  let acc = 0;
  for (const arr of Object.values(priceSeriesByMint)) {
    const t = arr.length ? arr[arr.length - 1].time : 0;
    acc = (acc * 9973 + t) | 0;
  }
  for (const arr of Object.values(persistedSeriesByMint)) {
    const t = arr.length ? arr[arr.length - 1].time : 0;
    acc = (acc * 9973 + t) | 0;
  }
  return acc;
}, [priceSeriesByMint, persistedSeriesByMint]);



function getStakingPdas(quoteMint: PublicKey) {
  // CONFIG is keyed by the WOODENG ecosystem mint (not the quote)
  const [stakingConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), WOODENG_MINT.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // WOODENG rewards vault (mint = WOODENG)
  const [rewardsVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault'), WOODENG_MINT.toBuffer()],
    STAKING_PROGRAM_ID
  );

// WSOL rewards vault is an ATA owned by the staking config PDA
  const rewardsVaultWsol = getAssociatedTokenAddressSync(NATIVE_MINT, stakingConfig, true);

  // keep return shape the same so call sites don't change
  return { stakingConfig, rewardsVault, rewardsVaultWsol };
}




// REPLACE your initStakingForWSOL(...) with this
async function ensureWsolRewardsVault(setStatus: (m: string) => void, walletCtx: WalletContextState) {
  try {
    if (!walletCtx.publicKey || !walletCtx.signTransaction || !walletCtx.signAllTransactions) {
      throw new Error("Connect the admin wallet first.");
    }
    if (!walletCtx.publicKey.equals(ADMIN_INIT_PUBKEY)) {
      throw new Error("Only the admin wallet can run this initializer.");
    }

    const provider = new AnchorProvider(connection, getAnchorWallet(walletCtx)!, {
      preflightCommitment: "confirmed",
    });
    const stakingProgram = new Program(stakingIdl, STAKING_PROGRAM_ID, provider);

    // PDAs (WSOL/NATIVE)
    const { stakingConfig, rewardsVaultWsol } = getStakingPdas(NATIVE_MINT);




    // If config exists AND already points to the same WSOL vault, we're done.
    try {
      const cfg = await (stakingProgram.account as any).config.fetch(stakingConfig);
      const current: PublicKey = (cfg as any).rewardsVaultWsol;

      if (current.equals(rewardsVaultWsol)) {
        setStatus("WSOL rewards vault already set ✅");
        return;
      }
    } catch {
      // config exists if WOODENG pairs already stake; if fetch fails, we'll still try the idempotent method below
    }

    setStatus("Ensuring WSOL rewards vault…");

    // Your staking program should expose an idempotent admin method for WSOL.
    // If your IDL names differ, adjust the method name & accounts labels here.
    const ix = await (stakingProgram.methods as any)
      .initWsolVaultIfNeeded()
      .accounts({
        config: stakingConfig,
        authority: walletCtx.publicKey!,
        wsolMint: NATIVE_MINT,
        rewardsVaultWsol,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    await sendIxsOnce(connection, getAnchorWallet(walletCtx)!, [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ix,
    ]);

    // ─── verify config + vault ─────────────────────────────────────────
try {
  // 1) config exists and points to the derived rewardsVaultWsol
  const cfg = await (stakingProgram.account as any).config.fetch(stakingConfig);
  const current: PublicKey = (cfg as any).rewardsVaultWsol;

  if (!current.equals(rewardsVaultWsol)) {
    throw new Error(
      `Config.rewardsVaultWsol != derived PDA
       config:  ${current.toBase58()}
       derived: ${rewardsVaultWsol.toBase58()}`
    );
  }

  // 2) the vault account exists and is a WSOL token account
  const vAcc = await connection.getAccountInfo(rewardsVaultWsol, 'confirmed');
  if (!vAcc) throw new Error('WSOL vault token account was not created');

  // quick SPL Token account decode (mint at offset 0x00, owner at 0x20, amount at 0x40)
  const mintPk  = new PublicKey(vAcc.data.subarray(0, 32));
  const ownerPk = new PublicKey(vAcc.data.subarray(32, 64));
  if (!mintPk.equals(NATIVE_MINT)) {
    throw new Error(`WSOL vault mint mismatch: ${mintPk.toBase58()}`);
  }

  // (optional) if your program uses a vault authority PDA, assert it here:
  // const [vaultAuth] = PublicKey.findProgramAddressSync(
  //   [Buffer.from('vault-authority'), stakingConfig.toBuffer()],
  //   STAKING_PROGRAM_ID
  // );
  // if (!ownerPk.equals(vaultAuth)) {
  //   throw new Error(`Vault owner mismatch: ${ownerPk.toBase58()} != ${vaultAuth.toBase58()}`);
  // }

  setStatus("WSOL rewards vault ready ✅");
} catch (verr: any) {
  setStatus(`Init succeeded but verification failed: ${verr?.message || verr}`);
}


    setStatus("WSOL rewards vault ready ✅");
  } catch (e: any) {
    setStatus(`Init failed: ${e?.message || String(e)}`);
  }
}






// Merge server history + live points, optionally clipped to a time window.
function mergedSeries(mintStr: string, windowMs?: number) {
  const now = Date.now();
  const live = (priceSeriesByMint[mintStr] ?? []).map(p => ({
    time: Number(p.time),
    price: Number(p.price),
  }));
  const persisted = (persistedSeriesByMint[mintStr] ?? []).map(p => ({
    time: Number(p.time),
    price: Number(p.price),
  }));

  const all = [...persisted, ...live]
  .filter(p => Number.isFinite(p.time) && Number.isFinite(p.price) && p.price > 0)
  .filter(p => (windowMs ? p.time >= now - windowMs : true))
  .sort((a, b) => a.time - b.time);


  // keep the most recent point inside each second bucket
const buckets = new Map<number, { time: number; price: number }>();
for (const pt of all) {
  const key = Math.floor(pt.time / 1000);
  const cur = buckets.get(key);
  if (!cur || pt.time >= cur.time) buckets.set(key, pt);
}
return Array.from(buckets.values()).sort((a, b) => a.time - b.time);

}



const latestPriceOf = (mint: string) => {
  const s = mergedSeries(mint);
  return s.length ? s[s.length - 1].price : 0;
};


const pushPricePoint = useCallback((mintStr: string, priceLamports: number) => {
  if (!Number.isFinite(priceLamports) || priceLamports <= 0) return;

  const priceUi = priceLamports / 10 ** WOODENG_DECIMALS;
  const time = Date.now();

  setPriceSeriesByMint(prev => {
    const arr = [...(prev[mintStr] ?? []), { time, price: priceUi }];
    return { ...prev, [mintStr]: arr.slice(-500) };
  });

  try {
    localStorage.setItem(`lastPrice:${mintStr}`, JSON.stringify({ time, priceLamports }));
  } catch {}

  queuePrice(mintStr, priceLamports, time);
}, []);










async function fetchAsBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed ${r.status} ${r.statusText}`);
  return await r.blob();
}

async function ensureIpfsUri(src?: string, filenameHint?: string) {
  if (!src) return '';
  if (src.startsWith('ipfs://')) return src;
  // If it’s your local /ipfs/... proxy or a public gateway, re-pin it to your Pinata
  const blob = await fetchAsBlob(src);
  const cid  = await pinFile(blob, filenameHint || 'media.bin');
  return `ipfs://${cid}`;
}


// Fetch live price from a Meteora DAMM v2 pool by reading vault balances
async function fetchMeteoraPoolPrice(
  conn: Connection,
  meteoraPoolAddress: string,
  memeMintStr: string,
  memeDecimals = 6,
  quoteDecimals = 9,
): Promise<number> {
  try {
    console.log('[fetchMeteoraPoolPrice] Fetching pool:', meteoraPoolAddress);
    const cpAmm = new CpAmm(conn);
    const poolState = await cpAmm.fetchPoolState(new PublicKey(meteoraPoolAddress));
    console.log('[fetchMeteoraPoolPrice] Pool state OK, vaults:', poolState.tokenAVault.toBase58(), poolState.tokenBVault.toBase58());
    const [vaultA, vaultB] = await Promise.all([
      conn.getTokenAccountBalance(poolState.tokenAVault),
      conn.getTokenAccountBalance(poolState.tokenBVault),
    ]);
    const amountA = Number(vaultA.value.amount);
    const amountB = Number(vaultB.value.amount);
    if (amountA <= 0 || amountB <= 0) return 0;
    if (poolState.tokenAMint.toBase58() === memeMintStr) {
      return (amountB / 10 ** quoteDecimals) / (amountA / 10 ** memeDecimals);
    } else {
      return (amountA / 10 ** quoteDecimals) / (amountB / 10 ** memeDecimals);
    }
  } catch (e) {
    console.error('[fetchMeteoraPoolPrice] FAILED:', meteoraPoolAddress, e);
    return 0;
  }
}

// put this near the other top-level utils

function memeOutForWoodengIn(pool: PoolType, budgetRaw: number): number {
  // invert getQuoteForMemeBuy with a small exponential search + binary search
  const DEC = pool.decimals ?? MEME_DECIMALS;
  if (!Number.isFinite(budgetRaw) || budgetRaw <= 0) return 0;

  const spend = (amtUi: number) => getQuoteForMemeBuy(pool, amtUi) || Number.POSITIVE_INFINITY;

  // start with a small guess and grow until we exceed budget
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32 && spend(hi) < budgetRaw; i++) hi *= 2;

  // binary-search to target spend
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const need = spend(mid);
    if (need > budgetRaw) hi = mid; else lo = mid;
  }

  // floor to mint decimals
  const factor = 10 ** DEC;
  return Math.floor(lo * factor) / factor;
}

/** Converts a BN (or plain number) to a JS number, defaulting to 0 */
const asNumber = (x?: BN | number) =>
  Number(
    // BN has .toString(); plain numbers don’t – they stringify fine
    (x ?? 0 as any).toString?.() ?? x ?? 0
  );





function rangeMs(range: string) {
  switch (range) {
    case '1m':  return 60_000;
    case '5m':  return 5 * 60_000;
    case '30m': return 30 * 60_000;
    case '1H':  return 60 * 60_000;
    case '24H': return 24 * 60 * 60_000;
    case '7D':  return 7  * 24 * 60 * 60_000;
    case '30D': return 30 * 24 * 60 * 60_000;
    case '1Y':  return 365* 24 * 60 * 60_000;
    case 'ALL': return Infinity;
    default:    return 24 * 60 * 60_000;
  }
}


const toPubkey = (x: any) => (x instanceof PublicKey ? x : new PublicKey(String(x)));



/** Build OHLC candles from ALL ticks using the given timeframe.
 *  GAP-FILLING: emits a candle for every bucket, even if no trades happened.
 *  Caps to the last 1000 bars for sanity.
 */
function buildCandles(mintStr: string, tf: Timeframe) {
  const bucketMs = TF_MS[tf];

  const pts = mergedSeries(mintStr)
    .sort((a, b) => a.time - b.time);

  if (!pts.length) return [];

  const firstBucket = bucketStart(pts[0].time, tf);
  const lastBucket  = bucketStart(pts[pts.length - 1].time, tf);

  const out: { t:number; o:number; h:number; l:number; c:number }[] = [];
  let i = 0;
  let lastClose = pts[0].price;

  for (let t = firstBucket; t <= lastBucket; t += bucketMs) {
    // Flat gap candle by default; override if trades exist in this bucket.
    let o = lastClose, h = lastClose, l = lastClose, c = lastClose;
    let saw = false;

    while (i < pts.length && bucketStart(pts[i].time, tf) === t) {
      const p = pts[i].price;
      if (!saw) {
        // OPEN = first trade inside the bucket
        o = p; h = p; l = p; c = p;
        saw = true;
      } else {
        if (p > h) h = p;
        if (p < l) l = p;
        c = p;
      }
      lastClose = c;
      i++;
    }

    out.push({ t, o, h, l, c });
  }

  const MAX = 1000;
  return out.length > MAX ? out.slice(out.length - MAX) : out;
}







const change24hFor = React.useCallback((mintStr: string): number => {
  // Anything below this is treated as "zero" for baseline purposes.
  const EPS = 1e-9;

  // Latest price (UI units), already merged (persisted + live)
  const latest = latestPriceOf(mintStr);
  if (!Number.isFinite(latest) || latest <= EPS) return 0;

  // Try to build a robust baseline from server-provided daily bars first.
  const bars = serverCandles[mintStr]?.['24h'] as
    | { t: number; o: number; h: number; l: number; c: number }[]
    | undefined;

  const robustFromBars = (): number | null => {
    if (!bars || bars.length === 0) return null;

    // Preferred: previous bar close; fallback: first bar open
    let baseline =
      bars.length >= 2 ? Number(bars[bars.length - 2].c) : Number(bars[0].o);

    // If baseline is zero-ish, walk backwards through closes then opens to find first > EPS
    if (!Number.isFinite(baseline) || baseline <= EPS) {
      for (let i = bars.length - 1; i >= 0; i--) {
        const c = Number(bars[i].c);
        if (Number.isFinite(c) && c > EPS) { baseline = c; break; }
      }
    }
    if (!Number.isFinite(baseline) || baseline <= EPS) {
      for (let i = bars.length - 1; i >= 0; i--) {
        const o = Number(bars[i].o);
        if (Number.isFinite(o) && o > EPS) { baseline = o; break; }
      }
    }

    return Number.isFinite(baseline) && baseline > EPS ? baseline : null;
  };

  const baselineFromBars = robustFromBars();
  if (baselineFromBars != null) {
    return ((latest - baselineFromBars) / baselineFromBars) * 100;
  }

  // Fallback: derive from our merged series around (now - 24h)
  const all = mergedSeries(mintStr);
  if (all.length < 2) return 0;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  // Binary search for the last point <= cutoff
  let lo = 0, hi = all.length - 1, baseIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid].time <= cutoff) { baseIdx = mid; lo = mid + 1; }
    else hi = mid - 1;
  }

  // Start with the point at/just before cutoff, else earliest
  let baseline = (baseIdx >= 0 ? all[baseIdx].price : all[0].price);

  // If that baseline is ~0, walk backward then forward to find a non-zero
  if (!Number.isFinite(baseline) || baseline <= EPS) {
    for (let i = baseIdx; i >= 0; i--) {
      const p = Number(all[i].price);
      if (Number.isFinite(p) && p > EPS) { baseline = p; break; }
    }
  }
  if (!Number.isFinite(baseline) || baseline <= EPS) {
    for (let i = Math.max(0, baseIdx); i < all.length; i++) {
      const p = Number(all[i].price);
      if (Number.isFinite(p) && p > EPS) { baseline = p; break; }
    }
  }

  if (!Number.isFinite(baseline) || baseline <= EPS) return 0;

  return ((latest - baseline) / baseline) * 100;
}, [serverCandles, persistedSeriesByMint, priceSeriesByMint]);








// "Newest" ≈ first time 
const createdAtFor = useCallback((mintStr: string): number => {
  return (
    firstSeenAtByMint[mintStr] ??
    persistedSeriesByMint[mintStr]?.[0]?.time ??
    priceSeriesByMint[mintStr]?.[0]?.time ??
    0
  );
}, [firstSeenAtByMint, persistedSeriesByMint, priceSeriesByMint]);




// helper once
const isPubkey = (s: string) => { try { new PublicKey(s); return true; } catch { return false; } };

// score how well a pool matches the query
const scorePool = (p: PoolType): number => {
  if (!query) return 0;

  // 1) address direct hit
  if (isPubkey(queryRaw) && p.memeMint.toBase58() === queryRaw) return 1000;

  const name   = (p.name || "").toLowerCase();
  const symbol = (p.symbol || "").toLowerCase();

  let s = 0;
  if (symbol) {
    if (symbol === query)              s += 800;
    else if (symbol.startsWith(query)) s += 600;
    else if (symbol.includes(query))   s += 400;
  }
  if (name === query)            s += 300;
  else if (name.includes(query)) s += 200;

  return s;
};

// ── Living Meme: locker URI overrides state (populated by effect below) ───
const [lockerMetaOverrides, setLockerMetaOverrides] = useState<
  Record<string, { imageUrl: string; audioUrl: string; description?: string; metaUri: string }>
>({});

// 1) reduce the set by query (if any)
const filteredPoolsRaw = React.useMemo(() => {
  const visible = pools.filter(p => !HIDDEN_MINTS.has(p.memeMint.toBase58()));
  if (!query) return visible;

  if (isPubkey(queryRaw)) {
    return visible.filter(p => p.memeMint.toBase58() === queryRaw);
  }
  return visible.filter(p => scorePool(p) > 0);
}, [pools, query, queryRaw, seriesTick]);

// 1b) Apply locker metadata overrides (Living Meme feature)
const filteredPools = React.useMemo(() => {
  if (!Object.keys(lockerMetaOverrides).length) return filteredPoolsRaw;
  return filteredPoolsRaw.map(p => {
    const ov = lockerMetaOverrides[p.memeMint.toBase58()];
    return ov ? { ...p, imageUrl: ov.imageUrl, audioUrl: ov.audioUrl, metaUri: ov.metaUri } : p;
  });
}, [filteredPoolsRaw, lockerMetaOverrides]);

// 2) sorting on the filtered set
const sortedPools = React.useMemo(() => {
  const rows = filteredPools.map(p => ({
    p,
    score:   scorePool(p),
    mcap:    p.marketCap ?? 0,
    chg:     change24hFor(p.memeMint.toBase58()),
    created: createdAtFor(p.memeMint.toBase58()),
  }));

  rows.sort((a, b) => {
    if (query && a.score !== b.score) return b.score - a.score;
    if (sortMode === 'gainers' && a.chg !== b.chg) return b.chg - a.chg;
    if (sortMode === 'newest') {
      const ta = a.created || Infinity, tb = b.created || Infinity;
      if (tb !== ta) return tb - ta;
    }
    if (sortMode === 'bonding') {
      // Show bonding pools first (poolType 0), sorted by bonding progress desc
      const aIsBonding = a.p.poolType === 0 ? 1 : 0;
      const bIsBonding = b.p.poolType === 0 ? 1 : 0;
      if (aIsBonding !== bIsBonding) return bIsBonding - aIsBonding;
      if (aIsBonding && bIsBonding) {
        const aProg = (a.p.bondingSold ?? 0);
        const bProg = (b.p.bondingSold ?? 0);
        return bProg - aProg; // most progress first
      }
    }
    // default: marketcap
    if (a.mcap !== b.mcap) return b.mcap - a.mcap;

    // stable deterministic fallback
    return a.p.memeMint.toBase58().localeCompare(b.p.memeMint.toBase58());
  });

  return rows.map(r => r.p);
}, [filteredPools, sortMode, query, change24hFor, createdAtFor]);

// 3) pagination + a SMALL prefetch window
const totalPages  = Math.min(10, Math.max(1, Math.ceil(sortedPools.length / PER_PAGE)));
const pageClamped = Math.min(page, totalPages);
const start       = (pageClamped - 1) * PER_PAGE;

// what the UI actually renders
const visiblePools = sortedPools.slice(start, start + PER_PAGE);

// NEW: a "window" you can use for background work (hydrate/prefetch, polling, etc.)
const windowPools  = sortedPools.slice(start, start + PER_PAGE * 2);


// keys for the currently-relevant window (used by hydration effect)
const windowKeys = React.useMemo<LitePoolKey[]>(() => {
  // keep the current sort order, but convert to LitePoolKey
  const lookup: Record<string, LitePoolKey> = {};
  for (const k of allPoolKeys) lookup[k.pubkey] = k;

  const orderedKeys = sortedPools
    .map(p => lookup[p.pubkey.toBase58()])
    .filter((k): k is LitePoolKey => !!k);

  const startIdx = (pageClamped - 1) * PER_PAGE;
  return orderedKeys.slice(startIdx, startIdx + PER_PAGE * 2);
}, [sortedPools, allPoolKeys, pageClamped]);






// ── SWL-444: Creator reputation computed from loaded pools ─────────────
// Groups all pools by creator, computes a lightweight reputation score,
// and maps it per memeMint so each card can display it.

// Per-pool perf data (keyed by mint)
const poolPerfByMint = React.useMemo<Record<string, PoolPerfBadge>>(() => {
  const result: Record<string, PoolPerfBadge> = {};

  for (const p of pools) {
    if (HIDDEN_MINTS.has(p.memeMint.toBase58())) continue;
    // For graduated pools whose vaults are empty, use lastMemePrice as currentPrice
    let currentPrice = p.price ?? 0;
    if ((p.poolType === 2 || p.poolType === 3) && currentPrice <= 0) {
      const lmp = (p.lastMemePrice ?? 0);
      if (lmp > 0) currentPrice = lmp / 1e9;
    }
    if (currentPrice <= 0) continue;

    // Bonding status detection
    let bondingStatus: PoolPerfBadge['bondingStatus'] = 'amm-launch';
    if (p.poolType === 0) {
      bondingStatus = 'bonding';
    } else if ((p.bondingSold ?? 0) > 0) {
      bondingStatus = 'bonded';
    }

    // Base price: flat reference for multiplier calculation.
    // V2 graduated pools: lastMemePrice/1e9 (starts at 1x at graduation).
    // SOL pools: 44 SOL target. WOODENG bonding: 0.1 WOODENG.
    let basePrice: number;
    if ((p.poolType === 2 || p.poolType === 3) && !quoteIsSol(p)) {
      const gradPrice = (p.lastMemePrice ?? 0) / 1e9;
      basePrice = gradPrice > 0 ? gradPrice : 0.1;
    } else {
      basePrice = quoteIsSol(p) ? Number(PRICE_TARGET_SOL_LAMPORTS) / 1e9 : 0.1;
    }

    const currentMultiplier = currentPrice / basePrice;

    // ATH approximation from lastMemePrice
    const lastPrice = (p.lastMemePrice ?? 0) / 1e9;
    const bestKnown = Math.max(currentPrice, lastPrice);
    const athMultiplier = bestKnown / basePrice;

    result[p.memeMint.toBase58()] = {
      launchPrice: basePrice,
      currentPrice,
      currentMultiplier,
      athMultiplier,
      bondingStatus,
    };
  }
  return result;
}, [pools]);

// Creator-level stats (aggregate across all their pools)
const creatorRepByMint = React.useMemo<Record<string, CreatorRepBadge>>(() => {
  const byCreator: Record<string, PoolType[]> = {};
  for (const p of pools) {
    if (HIDDEN_MINTS.has(p.memeMint.toBase58())) continue;
    const c = p.creator?.toBase58();
    if (!c) continue;
    if (!byCreator[c]) byCreator[c] = [];
    byCreator[c].push(p);
  }

  const result: Record<string, CreatorRepBadge> = {};

  for (const [, creatorPools] of Object.entries(byCreator)) {
    const launches = creatorPools.length;
    // Graduated = finished bonding. v1: poolType>=1 with bondingSold>0. v2: poolType>=2.
    const graduated = creatorPools.filter(p =>
      p.poolType >= 2 || (p.poolType >= 1 && (p.bondingSold ?? 0) > 0)
    ).length;

    // Collect multipliers from per-pool perf
    let totalMult = 0;
    let bestMult = 0;
    let countWithPerf = 0;
    for (const p of creatorPools) {
      const perf = poolPerfByMint[p.memeMint.toBase58()];
      if (!perf) continue;
      totalMult += perf.currentMultiplier;
      bestMult = Math.max(bestMult, perf.currentMultiplier);
      countWithPerf++;
    }
    const avgMultiplier = countWithPerf > 0 ? totalMult / countWithPerf : 0;

    // Score not displayed directly — we show avgMultiplier instead
    // But keep score for internal ranking/sorting
    const launchScore = Math.min(30, launches * 10);
    const perfScore = avgMultiplier > 1 ? Math.min(40, Math.log10(avgMultiplier) * 20) : 0;
    const gradScore = Math.min(30, graduated * 15);
    const score = Math.min(100, Math.round(launchScore + perfScore + gradScore));

    const badge: CreatorRepBadge = { score, launches, graduated, avgMultiplier, bestMultiplier: bestMult };
    for (const p of creatorPools) {
      result[p.memeMint.toBase58()] = badge;
    }
  }
  return result;
}, [pools, poolPerfByMint]);

// ── Top 3 creators by avg multiplier (for leaderboard) ──
const topCreators = React.useMemo(() => {
  const seen = new Map<string, { addr: string; avgMult: number; launches: number; bestPool?: PoolType }>();
  for (const p of pools) {
    const addr = p.creator?.toBase58();
    if (!addr) continue;
    const rep = creatorRepByMint[p.memeMint.toBase58()];
    if (!rep || seen.has(addr)) continue;
    // find this creator's best performing pool
    const creatorPools = pools.filter(pp => pp.creator?.toBase58() === addr);
    let bestPool: PoolType | undefined;
    let bestMult = 0;
    for (const cp of creatorPools) {
      const perf = poolPerfByMint[cp.memeMint.toBase58()];
      if (perf && perf.currentMultiplier > bestMult) {
        bestMult = perf.currentMultiplier;
        bestPool = cp;
      }
    }
    seen.set(addr, { addr, avgMult: rep.avgMultiplier, launches: rep.launches, bestPool });
  }
  return [...seen.values()].sort((a, b) => b.avgMult - a.avgMult).slice(0, 3);
}, [pools, creatorRepByMint, poolPerfByMint]);

// ── Hot pools: bonding pools with most progress + top 24h gainers ──
const hotPools = React.useMemo(() => {
  const withScore = pools
    .filter(p => (p.price ?? 0) > 0)
    .map(p => {
      const mint = p.memeMint.toBase58();
      const chg = change24hFor(mint);
      const perf = poolPerfByMint[mint];
      const bondingProg = p.poolType === 0 && p.vtokens ? (p.bondingSold ?? 0) / Number(CURVE_THRESHOLD_RAW_COMMON) : 0;
      // Hot score: bonding progress (60% weight when bonding) + 24h change
      const score = (p.poolType === 0 ? bondingProg * 60 : 0) + Math.max(0, chg) + (perf?.currentMultiplier ?? 0) * 2;
      return { pool: p, score, chg, bondingProg };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return withScore;
}, [pools, change24hFor, poolPerfByMint]);



useEffect(() => {
  if (!afterPaint || !poolsLoaded || !visiblePools.length) return;
  let stop = false;

  const mints = visiblePools.map(p => p.memeMint.toBase58());
  const mintsNeeding = mints.filter(m => !(serverCandles[m]?.['24h']?.length));

  if (!mintsNeeding.length) return;

  const fetchBatch24h = async () => {
    try {
      const qs = new URLSearchParams({ tf: '24h', limit: '200', mints: mintsNeeding.join(',') });
      const r = await fetch(`/api/ohlc/batch?${qs}`, { cache: 'force-cache' });
      if (!r.ok || stop) return;
      const byMint: Record<string, any[]> = await r.json();
      if (stop) return;

      setServerCandles(prev => {
        const next = { ...prev };
        for (const [mint, bars] of Object.entries(byMint)) {
          const cooked = (bars || []).map(b => ({
            t: Number(b.t), o: Number(b.o) / 1e9, h: Number(b.h) / 1e9,
            l: Number(b.l) / 1e9, c: Number(b.c) / 1e9, v: Number(b.v) | 0
          })).filter(b => Number.isFinite(b.t));
          (next[mint] ||= {} as any)['24h'] = cooked;
        }
        return next;
      });
    } catch {}
  };

  fetchBatch24h();
  // re-check less often (every 5 min) instead of 60s
  const id = setInterval(fetchBatch24h, 300_000);
  return () => { stop = true; clearInterval(id); };
}, [afterPaint, poolsLoaded, visiblePools.map(p => p.memeMint.toBase58()).join(','), serverCandles]);

// Poll live prices for graduated pools every 30s (mirrors detail page logic)
useEffect(() => {
  const graduatedPools = pools.filter(p => p.poolType === 2 || p.poolType === 3);
  if (!graduatedPools.length) return;

  const fetchLivePrices = async () => {
    const updates: Record<string, number> = {};
    for (const p of graduatedPools) {
      try {
        const memeMint = p.memeMint instanceof PublicKey ? p.memeMint.toBase58() : String(p.memeMint);
        let livePrice = 0;
        if (p.meteoraPool) {
          livePrice = await fetchMeteoraPoolPrice(connection, p.meteoraPool, memeMint, p.decimals ?? 0, 9);
        }
        if (livePrice <= 0) livePrice = await fetchBirdeyePrice(memeMint);
        if (livePrice <= 0) livePrice = await fetchJupiterPrice(memeMint);
        if (livePrice <= 0) livePrice = await fetchDexScreenerPrice(memeMint);
        if (livePrice > 0) updates[memeMint] = livePrice;
      } catch {}
    }
    if (!Object.keys(updates).length) return;
    // Immutable update: create new pool objects so React detects the change
    setPools(prev => prev.map(p => {
      const mint = p.memeMint instanceof PublicKey ? p.memeMint.toBase58() : String(p.memeMint);
      const lp = updates[mint];
      return lp ? { ...p, price: lp, marketCap: lp * (p.totalSupply ?? 0) } : p;
    }));
  };

  fetchLivePrices();
  const id = setInterval(fetchLivePrices, 30_000);
  return () => clearInterval(id);
}, [pools.length]);







useEffect(() => {
  if (!poolsLoaded || !windowKeys.length) return;

  const missing: PoolType[] = [];
  for (const k of windowKeys) {
    const full = poolsByKey[k.pubkey];
    if (!full) {
      const header = headersByKey[k.pubkey];
      if (header?.metaUri) missing.push(header);
    }
  }
  if (!missing.length) return;

  (async () => {
    const filled = await hydratePoolsDetails(missing);
    setPoolsByKey(prev => {
      const next = { ...prev };
      for (const p of filled) next[p.pubkey.toBase58()] = p;
      return next;
    });


    // also merge the hydrated objects into the concrete list
setPools(prev => {
  if (!prev?.length) return prev;
  const map = new Map(prev.map(p => [p.pubkey.toBase58(), p]));
  for (const p of filled) {
    const existing = map.get(p.pubkey.toBase58());
    // For graduated pools, preserve the live Meteora/Jupiter price if already fetched
    if (existing && (existing.poolType === 2 || existing.poolType === 3) && existing.price && existing.price > 0) {
      map.set(p.pubkey.toBase58(), { ...p, price: existing.price, marketCap: existing.price * (p.totalSupply ?? existing.totalSupply ?? 0) });
    } else {
      map.set(p.pubkey.toBase58(), p);
    }
  }
  return Array.from(map.values());
});

  })();
}, [poolsLoaded, windowKeys.map(k=>k.pubkey).join(','), headersByKey]);


// ── Living Meme: locker URI overrides effect ─────────────────────────────

useEffect(() => {
  if (!poolsLoaded || !pools.length) return;
  let cancelled = false;

  (async () => {
    try {
      const disc = BorshAccountsCoder.accountDiscriminator('LockerState');
      const allLockers = await connection.getProgramAccounts(LOCKER_PROGRAM_ID, {
        filters: [{ memcmp: { offset: 0, bytes: bs58.encode(disc) } }],
      });
      if (cancelled || !allLockers.length) return;

      const dummyProvider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
      const coder = new Program(lockerIdl, LOCKER_PROGRAM_ID, dummyProvider).coder.accounts;

      // SWL-444: Build memeMint → list of lockers, then pick creator-owned highest lockId
      const lockersByMint: Record<string, { uri: string; owner: string; lockId: number }[]> = {};
      for (const { account } of allLockers) {
        try {
          const s = coder.decode('LockerState', account.data) as any;
          const mint = new PublicKey(s.memeMint).toBase58();
          const uri = String(s.memeUri ?? '').replace(/\0/g, '').trim();
          const owner = new PublicKey(s.lockerOwner).toBase58();
          const lockId = Number(s.lockId ?? 0);
          if (uri) {
            if (!lockersByMint[mint]) lockersByMint[mint] = [];
            lockersByMint[mint].push({ uri, owner, lockId });
          }
        } catch {}
      }

      // Find pools where the best locker URI differs from current metaUri
      const toFetch: { mintStr: string; lockerUri: string }[] = [];
      for (const p of pools) {
        const mintStr = p.memeMint.toBase58();
        const candidates = lockersByMint[mintStr];
        if (!candidates?.length) continue;

        const creatorStr = p.creator?.toBase58();
        const creatorLockers = creatorStr
          ? candidates.filter(c => c.owner === creatorStr)
          : [];
        const pool_ = creatorLockers.length ? creatorLockers : candidates;
        const best = pool_.reduce((a, b) => (b.lockId > a.lockId ? b : a));

        if (best.uri && best.uri !== p.metaUri) {
          toFetch.push({ mintStr, lockerUri: best.uri });
        }
      }
      if (cancelled || !toFetch.length) return;

      // Fetch updated metadata JSONs
      const results = await Promise.all(
        toFetch.map(async ({ lockerUri }) => {
          try {
            const url = toHttp(lockerUri);
            if (!url) return null;
            const r = await fetch(url, { cache: 'no-store' });
            return r.ok ? await r.json() : null;
          } catch { return null; }
        })
      );
      if (cancelled) return;

      const overrides: typeof lockerMetaOverrides = {};
      for (let i = 0; i < toFetch.length; i++) {
        const j = results[i];
        if (!j) continue;
        overrides[toFetch[i].mintStr] = {
          imageUrl: toHttp(j.image || '') || '',
          audioUrl: toHttp(j.animation_url || '') || '',
          description: j.description || '',
          metaUri: toFetch[i].lockerUri,
        };
      }

      if (Object.keys(overrides).length && !cancelled) {
        console.log('[Living Meme] Override ready for', Object.keys(overrides).length, 'pool(s)');
        setLockerMetaOverrides(overrides);
      }
    } catch (e) {
      console.debug('[Living Meme] locker override fetch failed:', e);
    }
  })();

  return () => { cancelled = true; };
}, [poolsLoaded, pools.length]);



// reset to page 1 when sort, pools or query change
useEffect(() => { setPage(1); }, [sortMode, pools.length, query]);



async function migratePool(pool: PoolType) {
  if (!effectivePublicKey) throw new Error('Connect wallet first!');
  const anchorWalletEff = { publicKey: effectivePublicKey!, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };
  const provider = new AnchorProvider(connection, anchorWalletEff as any, { preflightCommitment: 'confirmed' });
  const prog     = new Program(poolIdl, poolProgramIdFor(pool), provider);
  const [cfgPda] = await getConfigPda(pool.memeMint, poolProgramIdFor(pool));
  const [memeVault]   = await PublicKey.findProgramAddress(
    [Buffer.from('pool_meme_vault'),   pool.memeMint.toBuffer()], poolProgramIdFor(pool));
  const [woodengVault]= await PublicKey.findProgramAddress(
    [Buffer.from('pool_woodeng_vault'),pool.memeMint.toBuffer()], poolProgramIdFor(pool));

  const sig = await prog.methods.migrateToAmm().accounts({
    config: cfgPda,
    poolMemeVault:   memeVault,
    poolWoodengVault: woodengVault,
    memeMint: pool.memeMint,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();

  // 🔗 bridge one price point immediately
  try {
    const fresh   = await prog.account.soundMemeConfig.fetch(cfgPda);
    const lamports = Number((fresh as any).lastMemePrice ?? 0);
    const mintStr  = pool.memeMint.toBase58();
    const bridge   = lamports > 0 ? lamports : Math.round(Number(pool.price ?? 0) * 1e9);
    if (bridge > 0) {
      pushPricePoint(mintStr, bridge);
      flushNow(false); // persist right away so reloads keep it
    }
  } catch {}

  await refreshBalances();
  await refreshUserNfts();
  const upd = await fetchSoundMemePoolsWithMetadata(prog);
  setPools(upd);
  setStatus(`Migrated! Tx ${sig.slice(0,8)}…`);
}


async function graduatePool(pool: PoolType) {
  if (!effectivePublicKey) throw new Error('Connect wallet first!');
  const anchorWalletEff2 = { publicKey: effectivePublicKey!, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };
  const provider = new AnchorProvider(connection, anchorWalletEff2 as any, { preflightCommitment: 'confirmed' });
  const prog     = new Program(poolIdl, poolProgramIdFor(pool), provider);
  const [cfgPda] = await getConfigPda(pool.memeMint, poolProgramIdFor(pool));

  const [memeVault]    = await PublicKey.findProgramAddress(
    [Buffer.from('pool_meme_vault'),    pool.memeMint.toBuffer()], poolProgramIdFor(pool));
  const [woodengVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], poolProgramIdFor(pool));

  const [graduationInfo] = await PublicKey.findProgramAddress(
    [Buffer.from('graduation'), cfgPda.toBuffer()], poolProgramIdFor(pool));

  setTxStep({ step: 1, total: 1, message: 'Graduating to Meteora…' });

  const sig = await prog.methods.graduateToMeteora().accounts({
    config:           cfgPda,
    payer:            effectivePublicKey!,
    poolMemeVault:    memeVault,
    poolWoodengVault: woodengVault,
    graduationInfo,
    systemProgram:    SystemProgram.programId,
  }).rpc();

  setTxStep(null);

  // Bridge price point
  try {
    const mintStr = pool.memeMint.toBase58();
    const bridge = Number(pool.lastMemePrice ?? 0) > 0
      ? Number(pool.lastMemePrice)
      : Math.round(Number(pool.price ?? 0) * 1e9);
    if (bridge > 0) { pushPricePoint(mintStr, bridge); flushNow(false); }
  } catch {}

  await refreshBalances();
  await refreshUserNfts();
  const upd = await fetchSoundMemePoolsWithMetadata(prog);
  setPools(upd);
  setStatus(`Graduated! Now create the Meteora pool. Tx ${sig.slice(0, 8)}…`);
}








// ------------------------------------------------------------------
//  spot price for a bonding (virtual-reserve) pool
// ------------------------------------------------------------------
function bondingSpotPriceForPool(pool: PoolType, bondingSoldRaw?: number) {
  const vtokens   = pool.vtokens  ?? 0;
  const vwoodeng  = pool.vwoodeng ?? 0;
  const sold      = bondingSoldRaw ?? (pool.bondingSold ?? 0);
  if (!vtokens || !vwoodeng) return NaN;

  const { priceTargetLamports: targetLamports, curveThresholdRaw } = targetsFor(pool);

  const p0LamportsPerToken = vwoodeng / vtokens; // lamports/MEME_raw at x=0

  const p1 = Number(targetLamports);        // lamports at threshold
  const thr = Number(curveThresholdRaw);    // MEME_raw at threshold
  const k  = Math.log(p1 / p0LamportsPerToken) / thr;

  // Return UI price (quote units, not lamports)
  const priceLamports = p0LamportsPerToken * Math.exp(k * sold);
  return priceLamports / 1e9;
}




// ---- optimistic spot price after a trade (AMM or Bonding) ----
function nextPriceLamportsAfterTrade(pool: PoolType, deltaMemeRaw: number, deltaWoodLamports: number) {
  // positive deltaMemeRaw means pool X increases (sell), negative means it decreases (buy)
  if (pool.poolType === 1) {
    const dec = pool.decimals ?? MEME_DECIMALS;
    const x = Math.max(1, (pool.ammReserves?.meme ?? 0) + deltaMemeRaw);
    const y = Math.max(1, (pool.ammReserves?.woodeng ?? 0) + deltaWoodLamports);
    const priceUi = (y / 1e9) / (x / 10**dec);
    return Math.max(1, Math.floor(priceUi * 1e9));
  } else {
    const soldNext  = (pool.bondingSold ?? 0) + (-deltaMemeRaw);
const priceUi   = bondingSpotPriceForPool(pool, soldNext);
return Math.max(1, Math.floor(priceUi * 1e9));

  }
}




// ---------------------------------------------------------------------------
//  NEW — query lockers instead of crawling every NFT in the wallet
// ---------------------------------------------------------------------------
async function getUserProtocolNfts(
  owner: PublicKey,
  memeMints: PublicKey[]
): Promise<UserPoolNfts> {
  const byPool: UserPoolNfts = {};

    // ---- tiny read-only Anchor client --------------------------
  const dummyWallet  = { publicKey: owner } as any;
  const provider     = new AnchorProvider(connection, dummyWallet, {});
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  // 1. iterate only over the mints we were given
  for (const memeMint of memeMints) {
    const [counterPda] = await PublicKey.findProgramAddress(
      [Buffer.from("counter"), memeMint.toBuffer(), owner.toBuffer()],
      LOCKER_PROGRAM_ID
    );

        let counter: any;
    try { counter = await lockerProgram.account.lockCounter.fetch(counterPda); }
    catch { continue; }                     // no counter ⇒ user never minted here
    if (!counter || typeof counter.count === "undefined") continue;

        // 2. loop 0 … count-1 and fetch each locker directly
    for (let i = 0; i < Number(counter.count); i++) {
      // Inline PDA derivation — must match Rust seeds:
      // seeds = [b"locker", meme_mint.key(), user.key(), &lock_id.to_le_bytes()]
      const lockIdLE = new Uint8Array(8);
      new DataView(lockIdLE.buffer).setBigUint64(0, BigInt(i), true);
      const [lockerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('locker'), memeMint.toBuffer(), owner.toBuffer(), Buffer.from(lockIdLE)],
        LOCKER_PROGRAM_ID
      );
      try {
        const l = await lockerProgram.account.lockerState.fetch(lockerPda);
        (byPool[memeMint.toBase58()] ??= {})[Number(i)] = { mint: l.nftMint };
      } catch { /* locker i was never created – skip */ }
    }
  }
  return byPool;
}




async function getAta(owner: PublicKey, mint: PublicKey, isPdaOwner = false) {
  return getAssociatedTokenAddress(
    mint,
    owner,
    isPdaOwner,                  // ← pass this through!
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

async function getConfigPda(memeMint: PublicKey, programId: PublicKey = POOL_PROGRAM_ID) {
  return await PublicKey.findProgramAddress([Buffer.from('config'), memeMint.toBuffer()], programId);
}


// ─────────────────────────────────────────────────────────────────────────────
//  Did I already burn this NFT?  (returns true if the user still has ≥1 token)
// ─────────────────────────────────────────────────────────────────────────────
async function stillOwnsNft(
  mint: PublicKey,
  owner: PublicKey
): Promise<boolean> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (!info) return false;                  // ATA never existed
  const bal = await connection.getTokenAccountBalance(ata);
  return !!bal.value.uiAmount && bal.value.uiAmount > 0;
}


// ----- NFT LOCK/MINT LOGIC, FULLY FIXED -----
// ── Error helpers (drop-in) ────────────────────────────────────────────────
function safeStringify(obj: any) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      obj,
      (k, v) => {
        if (v instanceof PublicKey) return v.toBase58?.() ?? String(v);
        if (typeof v?.toString === 'function' && v?.constructor?.name === 'BN') {
          try { return v.toString(); } catch {}
        }
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      },
      2
    );
  } catch {
    try { return JSON.stringify(String(obj)); } catch { return String(obj); }
  }
}

async function renderError(e: any, connection: Connection) {
  try {
    // Web3 send error with logs
    if (e instanceof SendTransactionError) {
      const logs = await e.getLogs(connection).catch(() => null);
      const body = e.message || 'SendTransactionError';
      return logs && logs.length ? `${body}\n${logs.join('\n')}` : body;
    }


 



    // Common shapes
    if (typeof e === 'string') return e;
    if (e instanceof Error)     return e.message || e.toString();
    if (e?.error?.errorMessage) return String(e.error.errorMessage);
    if (e?.error?.message)      return String(e.error.message);
    if (e?.message)             return String(e.message);
    if (e?.reason)              return String(e.reason);
    if (e?.status && e?.statusText) return `HTTP ${e.status} ${e.statusText}`;

    // Anchor/IDL builder often throws plain objects; include keys + json
    const keys = e && typeof e === 'object' ? Object.keys(e) : [];
    if (keys.length) return `${Object.prototype.toString.call(e)} ${safeStringify(e)}`;


  // If it's an InstructionError with a Custom code, decode via IDL
  if (e?.InstructionError && Array.isArray(e.InstructionError)) {
    const custom = e.InstructionError[1]?.Custom;
    if (typeof custom === "number") {
      const human =
        decodeAnchorCustomError(custom, lockerIdl) ||
        decodeAnchorCustomError(custom, poolIdl);
      if (human) return `Program error ${custom} — ${human}`;
      return `Program error ${custom}`;
    }
  }



    // Last resort
    return String(e);
  } catch {
    return String(e);
  }
}


function isUserRejectError(e: any): boolean {
  const code = e?.code ?? e?.error?.code;
  if (code === 4001 || code === 'USER_REJECTED') return true; // common Phantom/Wallet Std

  const name = (e?.name ?? '').toLowerCase();
  if (name.includes('walletsigntransactionerror') || name.includes('walletsendtransactionerror')) return true;

  const msg = String(
    e?.message ?? e?.error?.message ?? e?.toString?.() ?? ''
  ).toLowerCase();

  return /user.*reject|rejected the request|transaction (canceled|cancelled|declined|denied)/i.test(msg);
}



async function ensureLockerInitialized(
  pool: PoolType & { nftMint: PublicKey },
  walletCtx: WalletContextState
) {
  const memeMint    = pool.memeMint;
  const nftMint     = pool.nftMint;
  const thresholdRaw = getMintThresholdRaw(pool);   // ✅ RAW units

  const meme_name   = pool.name   ?? "Meme";
  const meme_symbol = pool.symbol ?? "MEME";
  const meme_uri    = pool.metaUri ?? "";


  assertWallet(walletCtx);

  const provider      = new AnchorProvider(connection, getAnchorWallet(walletCtx)!, { preflightCommitment: "confirmed" });
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  // 1) Counter PDA
  const [counterPda] = await PublicKey.findProgramAddress(
    [Buffer.from("counter"), memeMint.toBuffer(), walletCtx.publicKey!.toBuffer()],
    LOCKER_PROGRAM_ID
  );

  // 2) Initialize counter if missing
  const counterInfo = await connection.getAccountInfo(counterPda);
  if (!counterInfo) {
    await lockerProgram.methods.initializeCounter().accounts({
      user: walletCtx.publicKey!,
      counter: counterPda,
      memeMint,
      systemProgram: SystemProgram.programId,
    }).rpc();
  }

  // 3) Locker PDA using current counter value
  const counter = await lockerProgram.account.lockCounter.fetch(counterPda);
  const lockId  = Number(counter.count);
  const lockIdLE2 = new Uint8Array(8);
  new DataView(lockIdLE2.buffer).setBigUint64(0, BigInt(lockId), true);
  const [lockerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('locker'), memeMint.toBuffer(), walletCtx.publicKey!.toBuffer(), Buffer.from(lockIdLE2)],
    LOCKER_PROGRAM_ID
  );

  // 4) If locker already exists, done
  try {
    await lockerProgram.account.lockerState.fetch(lockerPda);
    return;
  } catch {}

  // 5) Ensure locker’s meme ATA exists (owned by the PDA) — send once
  const { ata: lockerMemeAccount, ix: lockerMemeAtaIx } =
    await ensureAtaIx(lockerPda, memeMint, walletCtx.publicKey!, true);
  await sendIxsOnce(connection, getAnchorWallet(walletCtx)!, [lockerMemeAtaIx]);

  // 6) Initialize the locker
  await lockerProgram.methods.initializeLocker(
  new BN(thresholdRaw),
  meme_name,
  meme_symbol,
  meme_uri,
).accounts({
  user: walletCtx.publicKey!,
  counter: counterPda,
  locker: lockerPda,
  memeMint,
  nftMint,
  lockerMemeAccount,
  systemProgram: SystemProgram.programId,
  tokenProgram: TOKEN_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  rent: SYSVAR_RENT_PUBKEY,
}).rpc();


}



// add a tiny helper type
type MintedInfo = {
  mint: PublicKey;          // the new NFT mint
  memeMint: string;         // pool.memeMint.toBase58()
  lockId: number | bigint;
};

// ----- MINT LOGIC (USE THIS FOR NFT MINTING, CALL IN YOUR HANDLER) -----
// ──────────────────────────────────────────────────────────────────
//  REPLACE your current lockTokens(...) with the block below
// ──────────────────────────────────────────────────────────────────
async function lockTokens(
  pool: PoolType,
  setStatus: (msg: string) => void,
  walletCtx: WalletContextState,
  refresh: () => Promise<void>,
  onMintSuccess?: (info: { mint: PublicKey; memeMint: string; lockId: number | bigint }) => void
) {
  // nice progress UI
  const setStep = (s: number, t: number, msg: string) =>
    setTxStep({ step: s, total: t, message: msg });

  try {
    if (!walletCtx.publicKey || !walletCtx.signTransaction || !walletCtx.signAllTransactions) {
      throw new Error("Connect wallet first");
    }
    const wallet = getAnchorWallet(walletCtx)!;
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
    const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

    const memeMint = pool.memeMint;
    const threshold = getMintThreshold(pool);
    const thresholdRaw = getMintThresholdRaw(pool);

    const nameRaw   = pool.name   ?? "Meme";
const symbolRaw = pool.symbol ?? "MEME";


   // -------- 0) off-chain uploads (no wallet popups) ----------
setStep(1, 3, "Uploading NFT metadata to IPFS…");

const canUseFile = typeof File !== 'undefined';
const imgIpfs = canUseFile && pool.imageFile instanceof File
  ? `ipfs://${await pinFile(pool.imageFile)}`
  : await ensureIpfsUri(pool.imageUrl, 'image');

const audIpfs = canUseFile && pool.audioFile instanceof File
  ? `ipfs://${await pinFile(pool.audioFile)}`
  : await ensureIpfsUri(pool.audioUrl, 'audio');

const meta = {
  name: nameRaw, symbol: symbolRaw, description: pool.description ?? "",

  image: imgIpfs || "",
  animation_url: audIpfs || "",
  attributes: [
    ...(pool.attributes || []),
    { trait_type: "MemeMint", value: memeMint.toBase58() },
  ],
  properties: {
    files: [
      imgIpfs ? { uri: imgIpfs, type: "image/png" } : undefined,
      audIpfs ? { uri: audIpfs, type: "audio/mpeg" } : undefined,
    ].filter(Boolean)
  }
};

const metaBlob = new Blob([JSON.stringify(meta)], { type: "application/json" });
const cid = await pinFile(metaBlob, "metadata.json");
const metaUri = `ipfs://${cid}`;

const { name: nameSan, symbol: symbolSan, uri: metaUriSan } =
  sanitizeNameSymbolUri(nameRaw, symbolRaw, metaUri);


    // -------- 1) pre-derive things we need ----------------------
    setStep(2, 3, "Preparing accounts…");
    const [counterPda] = await PublicKey.findProgramAddress(
      [Buffer.from("counter"), memeMint.toBuffer(), wallet.publicKey.toBuffer()],
      LOCKER_PROGRAM_ID
    );

    // fetch current counter (if exists) to derive lockId now
    let lockId = 0;
    const counterInfo = await connection.getAccountInfo(counterPda);
    if (counterInfo) {
      const c = await lockerProgram.account.lockCounter.fetch(counterPda);
      lockId = Number(c.count);
    } else {
      lockId = 0; // first time
    }

    // Inline PDA derivation — must match Rust seeds:
    // seeds = [b"locker", meme_mint.key(), user.key(), &counter.count.to_le_bytes()]
    const lockIdLEInit = new Uint8Array(8);
    new DataView(lockIdLEInit.buffer).setBigUint64(0, BigInt(lockId), true);
    let [lockerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('locker'), memeMint.toBuffer(), wallet.publicKey.toBuffer(), Buffer.from(lockIdLEInit)],
      LOCKER_PROGRAM_ID
    );

    // NFT mint: authority = locker PDA
    const mintBuild = await buildCreateMintIx(connection, wallet.publicKey, 0, lockerPda);
    const nftMint   = mintBuild.mint;

    // ATAs (idempotent, so safe in one tx)
    const { ata: userMemeAta, ix: userMemeAtaIx } =
      await ensureAtaIx(wallet.publicKey, memeMint, wallet.publicKey, false);
    const { ata: userNftAta, ix: userNftAtaIx } =
      await ensureAtaIx(wallet.publicKey, nftMint,  wallet.publicKey, false);
    

      const { ata: lockerMemeAccount, ix: lockerMemeAtaIx } =
  await ensureAtaIx(lockerPda, memeMint, wallet.publicKey, true);

    // which on-chain setup do we actually need?
    const needInitCounter = !counterInfo;
    let needInitLocker = false;
    try { await lockerProgram.account.lockerState.fetch(lockerPda); }
    catch { needInitLocker = true; }

    // instructions – ALL in one blob
    const ixs: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
      ...mintBuild.ixs,
      userMemeAtaIx,
      userNftAtaIx,
      
    ];

    if (needInitCounter) {
      ixs.push(
        await lockerProgram.methods.initializeCounter()
          .accounts({
            user: wallet.publicKey, counter: counterPda, memeMint,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      );
    }

    if (needInitLocker) {
  ixs.push(
    await lockerProgram.methods.initializeLocker(
      new BN(thresholdRaw),        // ✅ RAW threshold sent to the program
      nameSan,                     // ✅ sanitized
      symbolSan,
      metaUriSan
    )
    .accounts({
      user: wallet.publicKey,
      counter: counterPda,
      locker: lockerPda,
      memeMint,
      nftMint,                  // just-created mint
      lockerMemeAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()
  );
}





    // -------- 2) send TX A1 / A2 / A3 (state/mint/ATAs/init) --------------
    // IMPORTANT: initializeCounter and initializeLocker MUST be in separate
    // transactions. Anchor reads counter.count from the on-chain account to
    // verify the locker PDA seeds — if both are in the same tx the counter
    // account doesn't exist yet when initializeLocker executes, causing a
    // ConstraintSeeds error.
    setStep(3, 4, "Initializing locker…");

    // TX A1: create mint + ATAs (needs mintBuild.signers for the new mint keypair)
    const ixsA1: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
      ...mintBuild.ixs,
      userMemeAtaIx,
      userNftAtaIx,
      lockerMemeAtaIx,
    ];
    await sendIxsOnce(connection, wallet, ixsA1, mintBuild.signers);

    // TX A2: initialize counter (only if it didn't exist yet)
    if (needInitCounter) {
      const ixsA2: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
        await lockerProgram.methods.initializeCounter()
          .accounts({
            user: wallet.publicKey,
            counter: counterPda,
            memeMint,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ];
      await sendIxsOnce(connection, wallet, ixsA2, []);
    }

    // TX A3: initialize locker — counter is now confirmed on-chain so Anchor
    // can read counter.count to verify the locker PDA seeds correctly.
    if (needInitLocker) {
      // Re-fetch counter to get the definitive lockId after A2 has landed
      const freshCounter = await lockerProgram.account.lockCounter.fetch(counterPda);
      const freshLockId  = Number(freshCounter.count);

      // Inline PDA derivation — must match Rust seeds exactly:
      // seeds = [b"locker", meme_mint.key(), user.key(), &counter.count.to_le_bytes()]
      const lockIdLE = new Uint8Array(8);
      new DataView(lockIdLE.buffer).setBigUint64(0, BigInt(freshLockId), true);
      const [freshLockerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('locker'), memeMint.toBuffer(), wallet.publicKey.toBuffer(), Buffer.from(lockIdLE)],
        LOCKER_PROGRAM_ID
      );

      console.log('[lockTokens] TX A3 debug:');
      console.log('  memeMint:', memeMint.toBase58());
      console.log('  user:', wallet.publicKey.toBase58());
      console.log('  freshLockId:', freshLockId);
      console.log('  lockIdLE:', Array.from(lockIdLE).map(b => b.toString(16).padStart(2,'0')).join(' '));
      console.log('  freshLockerPda:', freshLockerPda.toBase58());
      console.log('  nftMint:', nftMint.toBase58());
      console.log('  LOCKER_PROGRAM_ID:', LOCKER_PROGRAM_ID.toBase58());

      // Re-check in case locker was already created by a concurrent call
      let alreadyExists = false;
      try { await lockerProgram.account.lockerState.fetch(freshLockerPda); alreadyExists = true; }
      catch { /* doesn't exist yet — proceed */ }

      if (!alreadyExists) {
        const ixsA3: TransactionInstruction[] = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
          await lockerProgram.methods.initializeLocker(
            new BN(thresholdRaw),
            nameSan,
            symbolSan,
            metaUriSan
          )
          .accounts({
            user: wallet.publicKey,
            counter: counterPda,
            locker: freshLockerPda,
            memeMint,
            nftMint,
            lockerMemeAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
        ];
        await sendIxsOnce(connection, wallet, ixsA3, []);

        // Update lockerPda for TX B (lockTokensAndMintNft) below
        lockerPda = freshLockerPda;
      }
    }

// -------- 3) send TX B (lock + mint + metadata + edition) --------------
setStep(4, 4, "Locking tokens & minting your NFT…");

const [metadataPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
  METADATA_PROGRAM_ID
);
const [editionPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer(), Buffer.from("edition")],
  METADATA_PROGRAM_ID
);


const ixsB: TransactionInstruction[] = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
  await lockerProgram.methods
    .lockTokensAndMintNft(nameSan, symbolSan, metaUriSan)
    .accounts({
      user: wallet.publicKey,
      userMemeAccount:   userMemeAta,
      locker:            lockerPda,
      lockerMemeAccount,
      nftMint,
      userNftAccount:    userNftAta,
      metadata:          metadataPda,
      edition:           editionPda,
      tokenMetadataProgram: METADATA_PROGRAM_ID,
      tokenProgram:      TOKEN_PROGRAM_ID,
      systemProgram:     SystemProgram.programId,
      rent:              SYSVAR_RENT_PUBKEY,
    })
    .instruction(),
];

let sig: string;
try {
  sig = await sendIxsOnce(connection, wallet, ixsB, []); // TX B
} catch (e: any) {
  setTxStep(null);
  const msg = await renderError(e, connection);
  console.error('Mint failed (post-send):', e);
  setStatus(`NFT mint failed: ${msg}`);
  throw e;
}

// we minted — close the stepper and notify
setTxStep(null);
onMintSuccess?.({ mint: nftMint, memeMint: memeMint.toBase58(), lockId });

// refresh UI (non-fatal if it fails)
try {
  await refresh();
  await refreshBalances();
  setStatus(`Minted! Tx ${sig.slice(0, 8)}…`);
} catch (e) {
  console.warn("Mint succeeded but UI refresh failed:", e);
  setStatus("Minted! UI may take a moment to update.");
}



} catch (err: any) {
  setTxStep(null);
  const msg = await renderError(err, connection);
  console.error('Mint failed (pre-send):', err);
  setStatus(`NFT mint failed (pre-send): ${msg}`);
}



}



























/**
 * How many WOODENG lamports are needed to buy `memeUiOut` MEME?
 * – Works for both bonding-curve (poolType 0) and AMM (poolType 1) pools.
 * – Automatically respects the mint’s decimals that you cached in `pool.decimals`.
 *
 * @param pool       the pool object (must include `.decimals` and reserves)
 * @param memeUiOut  desired MEME amount **in UI units** (e.g. 90.5)
 * @returns          lamports of WOODENG that must be paid
 */
function getQuoteForMemeBuy(pool: PoolType, memeUiOut: number): number {
  const MIN_LAMPORTS = 1;
  const DEC = pool.decimals ?? 0;

  // desired MEME out, in RAW units
  const memeRawOut = Math.floor(memeUiOut * 10 ** DEC);

  // ── Bonding-curve (poolType 0) ───────────────────────────────
  if (pool.poolType === 0) {
    const BONDING_FEE_BPS = 150;

    const vtokens  = pool.vtokens ?? 0;
const vwoodeng = pool.vwoodeng ?? 0;
const sold     = pool.bondingSold ?? 0;
if (!vtokens || !vwoodeng || memeRawOut <= 0) return NaN;

const { priceTargetLamports, curveThresholdRaw } = targetsFor(pool);

const p0  = vwoodeng / vtokens;                 // lamports per MEME_raw at x=0
const thr = Number(curveThresholdRaw);
const p1  = Number(priceTargetLamports);;
const k   = Math.log(p1 / p0) / thr;


    if (!vtokens || !vwoodeng || memeRawOut <= 0) return NaN;

    

    // ∫_{sold}^{sold + memeRawOut} p0 e^{k t} dt
    const base = (p0 / k) * (Math.exp(k * (sold + memeRawOut)) - Math.exp(k * sold));
    const fee  = base * (BONDING_FEE_BPS / 10_000);
    const lamports = Math.ceil(base + fee);

    return Math.max(MIN_LAMPORTS, lamports);
  }

  // ── AMM (XYK) ────────────────────────────────────────────────
  const x = Number(pool.ammReserves.meme);     // MEME reserve (raw)
  const y = Number(pool.ammReserves.woodeng);  // WOODENG reserve (lamports)
  if (memeRawOut <= 0 || memeRawOut >= x) return NaN;

  // Δy = ceil( y * Δx / (x − Δx) )
  let woodengIn = Math.ceil((y * memeRawOut) / (x - memeRawOut));
  // add 0.3% fee (exact-in)
  woodengIn = Math.ceil(woodengIn / (1 - 0.003));

  return Math.max(MIN_LAMPORTS, woodengIn);
}


// How many tokens still need to be SOLD until the curve migrates?
function tokensUntilAmm(pool: PoolType): number {
  if (pool.poolType === 1 || pool.bondingSold === undefined) return NaN;
  const dec = pool.decimals ?? MEME_DECIMALS;
  const thr = Number(targetsFor(pool).curveThresholdRaw);
  return (thr - (pool.bondingSold ?? 0)) / 10 ** dec;
}





function getQuoteForMemeSell(pool: PoolType, memeRawIn: number): number {
  if (memeRawIn <= 0) return NaN;

  // ── Bonding curve (poolType 0): refund integral with a 10% tax ──────────
  if (pool.poolType === 0) {
    const vtokens  = pool.vtokens ?? 0;
    const vwoodeng = pool.vwoodeng ?? 0;
    const sold     = pool.bondingSold ?? 0;
    if (!vtokens || !vwoodeng) return NaN;

    const { priceTargetLamports, curveThresholdRaw } = targetsFor(pool);
const p0 = vwoodeng / vtokens;
const thr = Number(curveThresholdRaw);
const p1  = Number(priceTargetLamports);
const k   = Math.log(p1 / p0) / thr;


    // You are SELLING Δx back to the curve:
    // baseOut = ∫_{sold - Δx}^{sold} p0 e^{k t} dt
    const soldNext = Math.max(0, sold - memeRawIn); // clamp (never go below 0)
    const baseOut  = (p0 / k) * (Math.exp(k * sold) - Math.exp(k * soldNext));

    // 10% bonding sell tax
    const TAX_BPS = 1000; // 10%
    const dyNet   = Math.floor(baseOut * (1 - TAX_BPS / 10_000));

    // Never negative
    return Math.max(0, dyNet);
  }

  // ── AMM (XYK) ───────────────────────────────────────────────────────────
  const x = Number(pool.ammReserves.meme);
  const y = Number(pool.ammReserves.woodeng);

  // Gross out without fees:
  const dyGross = Math.floor((y * memeRawIn) / (x + memeRawIn));
  // Program charges 0.3% on OUTPUT on AMM:
  const dyNet = Math.floor(dyGross * (1 - 0.003));
  return Math.max(0, dyNet);
}



function userMemeTokens(pool: PoolType): number {
  // balance still loading? – return NaN so we can render a placeholder
  const raw = balancesByMint[pool.memeMint.toBase58()];
  if (raw === undefined) return NaN;

  const d = pool.decimals ?? MEME_DECIMALS;   // decimals are fetched with the pool
  return raw / 10 ** d;
}



function PoolTypeBadge({ poolType }: { poolType: 0 | 1 | 2 | 3 }) {
  const cfg =
    poolType === 0
      ? { text: "Bonding", bg: "bg-orange-600/80" }
      : poolType === 3
        ? { text: "🎓 On Meteora", bg: "bg-purple-600/80" }
        : poolType === 2
          ? { text: "🎓 Graduating…", bg: "bg-yellow-600/80" }
          : { text: "AMM", bg: "bg-green-600/80" };

  return (
    <span
      className={`
        ${cfg.bg}
        shrink-0 whitespace-nowrap
        text-[11px] px-2 py-0.5 rounded-full font-semibold text-white
      `}
    >
      {cfg.text}
    </span>
  );
}



function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;


  return (
    <div className="w-full flex flex-col items-center space-y-1">
      {/* bar wrapper */}
      <div className="relative w-11/12 h-4 bg-[#2b2b37] rounded overflow-hidden">
        {/* fill */}
        <div
          className={`
            h-full bg-gradient-to-r from-[#b484ff] to-[#6c47e2]
            ${pct === 100 ? 'animate-pulse' : ''}
          `}
          style={{ width: `${pct}%` }}
        />
        {/* percentage label */}
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[#f0eaff]">
          {pct.toFixed(2)}%
        </span>
      </div>

      {/* numbers */}
      <div className="w-11/12 flex justify-between text-[11px] leading-none text-[#d6d8ff]">
        <span>{current.toLocaleString()}</span>
        <span>{total.toLocaleString()} required</span>
      </div>
    </div>
  );
}





async function fetchUserMemeBalance(wallet: WalletContextState, memeMint: PublicKey): Promise<number> {
  if (!wallet?.publicKey) return 0;
  try {
    if (!wallet.publicKey) throw new Error("Connect your wallet first");
const ata = await getAssociatedTokenAddress(memeMint, wallet.publicKey!);
    const bal = await connection.getTokenAccountBalance(ata);
    return Number(bal.value.amount);
  } catch (e) {
    return 0; // No ATA, zero balance
  }
}



// ---- helpers used by the batched fetch --------------------------------
function readU64LESafe(buf: Buffer | undefined | null, offset: number): number {
  if (!buf || buf.length < offset + 8) return 0;
  try { return Number(buf.readBigUInt64LE(offset)); } catch { return 0; }
}



function toHttp(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.startsWith('ipfs://')) {
    const rest = url.slice(7).replace(/^ipfs\//, '');
    return `/ipfs/${rest}`;
  }
  // handle bare /ipfs/ paths
  if (url.startsWith('/ipfs/')) return url;
  return url;
}


async function getMultiple(
  keys: PublicKey[],
  chunk = 100,
  conn: Connection = connection
): Promise<(import("@solana/web3.js").AccountInfo<Buffer> | null)[]> {
  const out: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    const infos = await conn.getMultipleAccountsInfo(part, "confirmed");
    out.push(...infos);
  }
  return out;
}
async function mapLimit<T, R>(
  arr: T[],
  limit: number,
  fn: (x: T, i: number) => Promise<R>
): Promise<R[]> {
  const ret: R[] = new Array(arr.length);
  let i = 0;
  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (i < arr.length) {
      const idx = i++;
      ret[idx] = await fn(arr[idx], idx);
    }
  });
  await Promise.all(workers);
  return ret;
}

// ------ BATCHED & SCALABLE FETCH ---------------------------------------

// Helper: fetch pools from a single program ID + config version, tag with programVersion
async function fetchPoolsFromProgram(
  programId: PublicKey,
  configVersion: number,
  poolProgram: Program,
  programVersion: 'v1' | 'v2',
  dataSize: number,
  conn: Connection = connection, // default to mainnet
): Promise<PoolType[]> {
  const disc = BorshAccountsCoder.accountDiscriminator("SoundMemeConfig");

  const tag = `[${programVersion.toUpperCase()} fetch]`;
  console.log(tag, 'programId:', programId.toString(), 'dataSize:', dataSize, 'configVersion:', configVersion);

  const rawConfigs = await conn.getProgramAccounts(programId, {
    filters: [
      { dataSize },
      { memcmp: { offset: 0, bytes: bs58.encode(disc) } },
    ],
  });

  console.log(tag, 'raw accounts from getProgramAccounts:', rawConfigs.length);
  console.log(tag, 'first account data length:', rawConfigs[0]?.account.data.length);

  const configs: Array<{ publicKey: PublicKey; account: any }> = [];
  for (const { pubkey, account } of rawConfigs) {
    const data = account.data;
    if (!data || data.length < 9) continue;
    try {
      const acc = poolProgram.coder.accounts.decode("SoundMemeConfig", data);
      if (acc != null) {
        configs.push({ publicKey: pubkey, account: acc });
      }
    } catch (e) {
      console.warn(tag, 'decode error for', pubkey.toString(), e);
    }
  }
  console.log(tag, 'after decode:', configs.length);
  if (!configs.length) return [];

  const memeMints  = configs.map((c) => new PublicKey((c.account as any).memeMint));
  const quoteMints = configs.map((c) => new PublicKey((c.account as any).woodengMint));

  // derive PDAs — must use the CORRECT program ID for this version
  const memeVaults = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("pool_meme_vault"), m.toBuffer()],
      programId
    ))[0])
  );
  const woodVaults = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("pool_woodeng_vault"), m.toBuffer()],
      programId
    ))[0])
  );
  const metadataPDAs = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), m.toBuffer()],
      METADATA_PROGRAM_ID
    ))[0])
  );

  // batch fetch
  const mintInfos      = await getMultiple(memeMints, 100, conn);
  const memeVaultInfos = await getMultiple(memeVaults, 100, conn);
  const woodVaultInfos = await getMultiple(woodVaults, 100, conn);
  const metadataInfos  = await getMultiple(metadataPDAs, 100, conn);

  // decode per index
  const headerPools = configs.map((c, i) => {
    const cfg = c.account as any;

    // normalize poolType (0=bonding, 1=amm, 2=graduated, 3=migrated)
    const raw = cfg.poolType as number | { bonding?: {}; amm?: {} };
    const poolType: 0 | 1 | 2 | 3 = (typeof raw === "number"
      ? (raw === 3 ? 3 : raw === 2 ? 2 : raw === 1 ? 1 : 0)
      : ("amm" in raw ? 1 : 0)) as 0 | 1 | 2 | 3;

    // mint account
    const mi = mintInfos[i]?.data;
    let decimals = 0, supplyUi = 0;
    if (mi && mi.length >= 82) {
      decimals = mi[44];
      const supplyRaw = readU64LESafe(mi, 36);
      supplyUi = supplyRaw / 10 ** decimals;
    }

    // vault balances
    const memeAccInfo = memeVaultInfos[i];
    const woodAccInfo = woodVaultInfos[i];

    const memeReserveRaw =
      memeAccInfo &&
      memeAccInfo.owner.equals(TOKEN_PROGRAM_ID) &&
      memeAccInfo.data.length >= 72
        ? readU64LESafe(memeAccInfo.data, 64)
        : 0;

    const woodReserveLamports =
      woodAccInfo &&
      woodAccInfo.owner.equals(TOKEN_PROGRAM_ID) &&
      woodAccInfo.data.length >= 72
        ? readU64LESafe(woodAccInfo.data, 64)
        : 0;

    // on-chain metadata (name/symbol/URI only)
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

    // price — needs programVersion for targetsFor()
    const tmpPool: PoolType = {
      ...({} as any),
      vtokens: asNumber(cfg.vtokens),
      vwoodeng: asNumber(cfg.vwoodeng),
      bondingSold: asNumber(cfg.bondingSold),
      quoteMint: quoteMints[i],
      poolType,
      programVersion,
    } as PoolType;

    let price = 1;
    if (poolType === 0) {
      price = bondingSpotPriceForPool(tmpPool);
    } else if (poolType === 2 || poolType === 3) {
      // lastMemePrice is the bonding price at graduation — not perfect but better than 0.
      // The async Meteora/Jupiter fetch will overwrite with live price if available.
      const lmp = asNumber(cfg.lastMemePrice);
      if (lmp > 0) price = lmp / 1e9;
    } else if (memeReserveRaw > 0 && woodReserveLamports > 0) {
      price =
        (woodReserveLamports / 10 ** QUOTE_DECIMALS) /
        (memeReserveRaw / 10 ** decimals);
    }

    const marketCap = price * (supplyUi ?? 0);

    const creator = (() => {
      try { return new PublicKey((cfg as any).projectWallet ?? (cfg as any).project_wallet); } catch { return undefined; }
    })();
    const creatorFeeBps = undefined as unknown as number | undefined;

    return {
      pubkey: c.publicKey,
      poolType,
      lastMemePrice: asNumber(cfg.lastMemePrice),
      vtokens: asNumber(cfg.vtokens),
      vwoodeng: asNumber(cfg.vwoodeng),
      bondingSold: asNumber(cfg.bondingSold),
      memeMint: new PublicKey(cfg.memeMint),
      quoteMint: quoteMints[i],
      ammReserves: { meme: memeReserveRaw, woodeng: woodReserveLamports },
      price,
      decimals,
      totalSupply: supplyUi,
      marketCap,
      creator,
      creatorFeeBps,
      name: metaName || "",
      symbol: metaSymbol || "",
      metaUri,
      description: "",
      imageUrl: undefined,
      audioUrl: undefined,
      attributes: [],
      category: "",
      socials: undefined,
      hydrated: false,
      programVersion,
      minAvgHoldDays: Number((cfg as any).minAvgHoldDays ?? 0),
    } as PoolType;
  });

  // ── GRADUATION: fetch GraduationInfo PDA for pool_type 2 or 3 ──
  {
    const graduatedPools = headerPools.filter(p => p.poolType === 2 || p.poolType === 3);
    if (graduatedPools.length > 0) {
      const gradPdas = await Promise.all(
        graduatedPools.map(async (p) => {
          const [pda] = await PublicKey.findProgramAddress(
            [Buffer.from("graduation"), p.pubkey.toBuffer()],
            programId
          );
          return pda;
        })
      );
      const gradInfos = await getMultiple(gradPdas);

      for (let i = 0; i < graduatedPools.length; i++) {
        const data = gradInfos[i]?.data;
        if (!data || data.length < 8 + 106) continue;
        try {
          const offset = 8;
          const gradTimestamp = Number(data.readBigInt64LE(offset + 32));
          const meteoraPool = new PublicKey(data.subarray(offset + 40, offset + 72)).toBase58();
          const meteoraPositionNft = new PublicKey(data.subarray(offset + 72, offset + 104)).toBase58();
          const confirmed = data[offset + 104] === 1;

          graduatedPools[i].graduationTimestamp = gradTimestamp;
          graduatedPools[i].meteoraPool = meteoraPool === "11111111111111111111111111111111" ? undefined : meteoraPool;
          graduatedPools[i].meteoraPositionNft = meteoraPositionNft;
          graduatedPools[i].graduationConfirmed = confirmed;
        } catch (e) {
          console.warn("Failed to parse GraduationInfo for", graduatedPools[i].pubkey.toBase58(), e);
        }
      }
    }
  }

  return headerPools;
}

// Fetch from v1 (and v2 when deployed) programs and merge
async function fetchPoolHeadersOnly(_poolProgram: Program) {
  // Create version-specific programs so each fetch uses the correct IDL coder
  const dummyProvider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
  const v1Program = new Program(poolIdl, V1_POOL_PROGRAM_ID, dummyProvider);
  const v2Program = new Program(poolV2Idl, V2_POOL_PROGRAM_ID, dummyProvider);

  const fetches: Promise<PoolType[]>[] = [
    // V1 mainnet — always fetch using V1 IDL
    fetchPoolsFromProgram(V1_POOL_PROGRAM_ID, V1_CONFIG_VERSION, v1Program, 'v1', V1_ACCOUNT_SIZE)
      .catch(e => { console.warn('[fetchPoolHeaders] V1 fetch failed:', e); return [] as PoolType[]; }),
  ];

  // V2 — only fetch if deployed on mainnet, using V2 IDL
  if (V2_DEPLOYED_ON_MAINNET) {
    fetches.push(
      fetchPoolsFromProgram(V2_POOL_PROGRAM_ID, V2_CONFIG_VERSION, v2Program, 'v2', V2_ACCOUNT_SIZE)
        .catch(e => { console.warn('[fetchPoolHeaders] V2 fetch failed:', e); return [] as PoolType[]; })
    );
  }

  const results = await Promise.all(fetches);
  const v1Count = results[0].length;
  const v2Count = V2_DEPLOYED_ON_MAINNET ? (results[1]?.length ?? 0) : 0;
  console.log('[Pools] V1 count:', v1Count, 'V2 count:', v2Count);
  const all = results.flat().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return all;
}


// Fetch JSON for a **subset** of pools and merge into each
async function hydratePoolsDetails(poolsSubset: PoolType[], conn: Connection = connection): Promise<PoolType[]> {
  // ── Step 0: Resolve locker URIs for "living meme" overrides ─────────────
  // If a creator called update_locker_uri, the locker's meme_uri will differ
  // from the token's original metaUri. We use the locker version.
  const effectiveUris = poolsSubset.map(p => p.metaUri || '');
  try {
    const disc = BorshAccountsCoder.accountDiscriminator('LockerState');
    const allLockers = await conn.getProgramAccounts(LOCKER_PROGRAM_ID, {
      filters: [{ memcmp: { offset: 0, bytes: bs58.encode(disc) } }],
    });
    if (allLockers.length) {
      const dummyProvider = new AnchorProvider(conn, { publicKey: PublicKey.default } as any, {});
      const coder = new Program(lockerIdl, LOCKER_PROGRAM_ID, dummyProvider).coder.accounts;

      // SWL-444: Collect ALL lockers per mint, pick the creator-owned one with highest lockId
      const lockersByMint: Record<string, { uri: string; owner: string; lockId: number }[]> = {};
      for (const { account } of allLockers) {
        try {
          const s = coder.decode('LockerState', account.data) as any;
          const mint = new PublicKey(s.memeMint).toBase58();
          const uri = String(s.memeUri ?? '').replace(/\0/g, '').trim();
          const owner = new PublicKey(s.lockerOwner).toBase58();
          const lockId = Number(s.lockId ?? 0);
          if (uri) {
            if (!lockersByMint[mint]) lockersByMint[mint] = [];
            lockersByMint[mint].push({ uri, owner, lockId });
          }
        } catch {}
      }

      // For each pool, find the locker owned by pool.creator with the highest lockId
      for (let i = 0; i < poolsSubset.length; i++) {
        const mintStr = poolsSubset[i].memeMint.toBase58();
        const candidates = lockersByMint[mintStr];
        if (!candidates?.length) continue;

        const creatorStr = poolsSubset[i].creator?.toBase58();
        // Prefer creator-owned lockers; fall back to all if none match
        const creatorLockers = creatorStr
          ? candidates.filter(c => c.owner === creatorStr)
          : [];
        const pool_ = creatorLockers.length ? creatorLockers : candidates;
        // Pick the one with highest lockId (most recent)
        const best = pool_.reduce((a, b) => (b.lockId > a.lockId ? b : a));

        if (best.uri && best.uri !== effectiveUris[i]) {
          console.log('[hydratePoolsDetails] Locker URI override:', mintStr.slice(0,8), effectiveUris[i]?.slice(0,20), '→', best.uri.slice(0,20));
          effectiveUris[i] = best.uri;
        }
      }
    }
  } catch (e) {
    console.debug('[hydratePoolsDetails] locker lookup failed (non-fatal):', e);
  }

  // ── Step 1: Fetch metadata JSONs ────────────────────────────────────────
  const urls = effectiveUris.map(u => toHttp(u) || "");
  console.log('[hydratePoolsDetails] Fetching', poolsSubset.length, 'pools. URLs sample:', urls.slice(0, 3));
  const jsons = await mapLimit(urls, 10, async (uri) => {
    if (!uri) return null;
    try {
      const r = await fetch(uri, { cache: "no-store" });
      if (!r.ok) { console.warn('[hydratePoolsDetails] FETCH FAIL:', uri, r.status); return null; }
      return await r.json();
    } catch (e) { console.warn('[hydratePoolsDetails] FETCH ERR:', uri, e); return null; }
  });

  // Log result for GPKLDuj pool if present
  poolsSubset.forEach((p, i) => {
    if (p.memeMint.toBase58().startsWith('GPKLDuj')) {
      const j = jsons[i];
      console.log('[hydratePoolsDetails] GPKLDuj fetched URL:', urls[i], '| json image:', j?.image, '| json audio:', j?.animation_url);
    }
  });

  return poolsSubset.map((p, i) => {
    const j = jsons[i] || {};
    const attr = Array.isArray(j.attributes) ? j.attributes : [];

    const norm = (u?: string) => {
      if (!u) return undefined;
      const s = String(u).trim();
      return /^https?:\/\//i.test(s) ? s : `https://${s}`;
    };
    const attrVal = (name: string) => {
      if (!Array.isArray(j.attributes)) return undefined;
      const hit = j.attributes.find((a: any) =>
        String(a?.trait_type ?? "").toLowerCase() === name.toLowerCase()
      );
      return hit?.value;
    };
    const socials = {
      x:        norm(j?.extensions?.twitter ?? j?.socials?.x ?? j?.twitter ?? j?.x ?? attrVal("X") ?? attrVal("Twitter")),
      telegram: norm(j?.extensions?.telegram ?? j?.socials?.telegram ?? j?.telegram ?? attrVal("Telegram") ?? attrVal("TG")),
      website:  norm(j?.external_url ?? j?.extensions?.website ?? j?.socials?.website ?? j?.website ?? attrVal("Website")),
    };
    const coerceNum = (v: any) => {
      if (v == null) return NaN;
      const s = String(v).replace(/[,_\s]/g, '');
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };
    const thresholdMeta =
      j?.extensions?.threshold ??
      j?.socials?.threshold ??
      attrVal('Threshold') ?? attrVal('threshold');
    const nftThreshold =
      coerceNum(thresholdMeta) > 0 ? Math.floor(coerceNum(thresholdMeta)) : undefined;

    return {
      ...p,
      metaUri: effectiveUris[i] || p.metaUri,
      description: j.description || "",
      imageUrl: toHttp(j.image || ""),
      audioUrl: toHttp(j.animation_url || ""),
      attributes: attr,
      category: attr.find?.((a: any) => a?.trait_type === "Category")?.value ?? "",
      socials,
      nftThreshold,
      hydrated: true,
    } as PoolType;
  });
}




async function sellSoundMeme({
  pool, memeAmountIn, minWoodengOut, wallet, onStep
}: { pool: PoolType, memeAmountIn: number, minWoodengOut: number, wallet: any, onStep?: (step: number, total: number, msg: string) => void }) {
  if (!wallet.publicKey) throw new Error('Connect wallet first!');

  const [configPda] = await getConfigPda(pool.memeMint, poolProgramIdFor(pool));
  const provider    = new AnchorProvider(connection, getAnchorWallet(wallet)!, { preflightCommitment: 'confirmed' });
  const poolProgram = new Program(poolIdl, poolProgramIdFor(pool), provider);

  const [poolMemeVault]    = await PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'),    pool.memeMint.toBuffer()], poolProgramIdFor(pool));
  const [poolWoodengVault] = await PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], poolProgramIdFor(pool));

  const { ata: buyerMemeAta,  ix: buyerMemeAtaIx  } = await ensureAtaIx(wallet.publicKey, pool.memeMint,  wallet.publicKey);
  const { ata: buyerQuoteAta, ix: buyerQuoteAtaIx } = await ensureAtaIx(wallet.publicKey, pool.quoteMint, wallet.publicKey);

  // Fee recipient (creator or fallback). Allow off-curve if PDA.
  const feeRecipient = feeRecipientFor(pool);
  const allowOffCurve = !PublicKey.isOnCurve(feeRecipient.toBytes());
  const { ata: creatorWalletAta, ix: creatorWalletAtaIx } =
    await ensureAtaIx(feeRecipient, pool.quoteMint, wallet.publicKey, allowOffCurve);

  // staking PDAs
  // BUY / SELL
const { stakingConfig, rewardsVault, rewardsVaultWsol } = getStakingPdas(pool.quoteMint);
const stakingRewardsVault = quoteIsSol(pool) ? rewardsVaultWsol : rewardsVault;



  const coreIx = await poolProgram.methods
  .sell(new BN(memeAmountIn), new BN(minWoodengOut))
  .accounts({
    config:            configPda,
    poolMemeVault,
    poolWoodengVault,
    memeMint:          pool.memeMint,
    buyer:             wallet.publicKey,
    buyerMemeAta,
    buyerWoodengAta:   buyerQuoteAta,
    projectWalletAta:  creatorWalletAta,
    stakingConfig,
    stakingRewardsVault,
    stakingProgram:    STAKING_PROGRAM_ID,  // ← add this line
    tokenProgram:      TOKEN_PROGRAM_ID,
    systemProgram:     SystemProgram.programId,
  })
  .instruction();


  // ── TX A: ensure all ATAs exist (only if needed) ──────────────────
  const setupIxs = [
    buyerMemeAtaIx,
    buyerQuoteAtaIx,
    creatorWalletAtaIx,
  ].filter(Boolean) as TransactionInstruction[];

  const ataChecks = await connection.getMultipleAccountsInfo([
    buyerMemeAta,
    buyerQuoteAta,
    creatorWalletAta,
  ]);
  const needsSetup = ataChecks.some(info => info === null);

  if (needsSetup) {
    onStep?.(1, 2, "Setting up token accounts…");
    await sendIxsOnce(connection, getAnchorWallet(wallet)!, [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ...setupIxs,
    ], [], { skipPreflight: false });
  }

  // ── TX B: the actual sell (small tx) ─────────────────────────────
  onStep?.(needsSetup ? 2 : 1, needsSetup ? 2 : 1, "Confirming your sell…");
  const coreIxs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    coreIx,
  ];
  if (quoteIsSol(pool)) {
    coreIxs.push(
      createCloseAccountInstruction(
        buyerQuoteAta,
        wallet.publicKey,
        wallet.publicKey
      )
    );
  }

  return await sendIxsOnce(connection, getAnchorWallet(wallet)!, coreIxs, [], { skipPreflight: false });
}









// 1️⃣ keep the state hook at the top of the component
const [userPoolNfts, setUserPoolNfts] = useState<UserPoolNfts>({});
const [nftsLoaded,   setNftsLoaded]   = useState(false);
// one entry per memeMint base-58 string
const [ownedCounts, setOwnedCounts] = useState<Record<string, number>>({});


const [quoteBalancesRaw, setQuoteBalancesRaw] = useState<Record<string, number>>({});



// --- OPTIMISTIC PATCH HELPERS (place inside SoundMemesClient) ----------------
const adjustMemeBalanceRaw = (mintStr: string, deltaRaw: number) => {
  setBalancesByMint(prev => {
    const cur = prev[mintStr] ?? 0;
    const next = Math.max(0, cur + deltaRaw);
    return { ...prev, [mintStr]: next };
  });
};

const adjustQuoteBalanceRaw = (quoteMint: PublicKey, deltaLamports: number) => {
  const k = quoteMint.toBase58();
  setQuoteBalancesRaw(prev => {
    const cur = prev[k] ?? 0;
    const next = Math.max(0, cur + deltaLamports);
    return { ...prev, [k]: next };
  });
};

const patchPoolAfterBuy = (pool: PoolType, memeRawOut: number, woodLamportsIn: number) => {
  setPools(prev => prev.map(p => {
    if (!p.memeMint.equals(pool.memeMint)) return p;

    if (p.poolType === 1) {
      // AMM: y += woodIn, x -= memeOut
      return {
        ...p,
        ammReserves: {
          meme: Math.max(0, (p.ammReserves?.meme ?? 0) - memeRawOut),
          woodeng: (p.ammReserves?.woodeng ?? 0) + woodLamportsIn,
        },
      };
    } else {
      // Bonding: sold += memeOut, vault wood += woodIn
      return {
        ...p,
        bondingSold: (p.bondingSold ?? 0) + memeRawOut,
        ammReserves: {
          ...(p.ammReserves ?? { meme: 0, woodeng: 0 }),
          woodeng: (p.ammReserves?.woodeng ?? 0) + woodLamportsIn,
        },
      };
    }
  }));
};

const patchPoolAfterSell = (pool: PoolType, memeRawIn: number, woodLamportsOut: number) => {
  setPools(prev => prev.map(p => {
    if (!p.memeMint.equals(pool.memeMint)) return p;

    if (p.poolType === 1) {
      // AMM: x += memeIn, y -= woodOut
      return {
        ...p,
        ammReserves: {
          meme: (p.ammReserves?.meme ?? 0) + memeRawIn,
          woodeng: Math.max(0, (p.ammReserves?.woodeng ?? 0) - woodLamportsOut),
        },
      };
    } else {
      // Bonding: sold -= memeIn, vault wood -= woodOut
      return {
        ...p,
        bondingSold: Math.max(0, (p.bondingSold ?? 0) - memeRawIn),
        ammReserves: {
          ...(p.ammReserves ?? { meme: 0, woodeng: 0 }),
          woodeng: Math.max(0, (p.ammReserves?.woodeng ?? 0) - woodLamportsOut),
        },
      };
    }
  }));
};






// Fixed USD conversion for WOODENG/SOL quotes
const WOODENG_USD = 0.00015;
const fmtUSD = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: v < 1 ? 4 : 2,
      });


const refreshBalances = useCallback(async () => {
  if (!effectivePublicKey) {
    setBalancesByMint({});
    setQuoteBalancesRaw({});
    return;
  }

  // 1) Pull ALL SPL token accounts for the wallet in one RPC
  const encoded = await connection.getTokenAccountsByOwner(
  effectivePublicKey,
  { programId: TOKEN_PROGRAM_ID },
  'processed'
);
const rawByMint: Record<string, number> = {};
for (const { account } of encoded.value) {
  // web3.js returns a Buffer here
  const data = account.data as Buffer;
  const mint = new PublicKey(data.subarray(0, 32)).toBase58();
  const amountRaw = readU64LESafe(data, 64);
  rawByMint[mint] = amountRaw;
}



  // 2) Fill balances ONLY for the meme mints we display
  const memeMintStrs = pools.map(p => p.memeMint.toBase58());
  const memeBalances: Record<string, number> = {};
  for (const m of memeMintStrs) memeBalances[m] = rawByMint[m] ?? 0;
  setBalancesByMint(memeBalances);

  // 3) Quote balances
  const qMap: Record<string, number> = {};
  const quoteSet = Array.from(new Set(pools.map(p => p.quoteMint.toBase58())));
  for (const q of quoteSet) {
    if (q === WSOL_MINT.toBase58()) {
      // show **native SOL** only (wSOL is ephemeral)
      qMap[q] = await getCachedBalance(connection, effectivePublicKey, 'confirmed');
    } else {
      qMap[q] = rawByMint[q] ?? 0;
    }
  }
  setQuoteBalancesRaw(qMap);
}, [effectivePublicKey?.toBase58(), pools]);




// ↕ somewhere around the other modal hooks
// BUY filled state
const [buyFilled, setBuyFilled] = useState<FilledTrade>({
  open: false, symbol: "", amountMeme: 0, priceWoodeng: 0
});

// SELL filled state
const [sellFilled, setSellFilled] = useState<FilledTrade>({
  open: false, symbol: "", amountMeme: 0, priceWoodeng: 0
});
const [mintFilled, setMintFilled] = useState({
  open:false, symbol:"", lockId:0
});
const [burnFilled, setBurnFilled] = useState({
  open:false, symbol:"", amountUnlocked:0
});




// 2️⃣ leave the callback clean
const refreshUserNfts = useCallback(async () => {
  if (!effectivePublicKey) {
    setUserPoolNfts({});
    setOwnedCounts({});
    setNftsLoaded(true);
    return;
  }

  try {
    // build the mint list from whatever pools are already in state
    const mints = pools.map(p => p.memeMint);
    const nfts  = await getUserProtocolNfts(effectivePublicKey, mints);
    setUserPoolNfts(nfts);

     /* ─── NEW: count only the NFTs that still exist ─── */
    const counts: Record<string, number> = {};
    await Promise.all(
      Object.entries(nfts).map(async ([mintStr, lockers]) => {
        const alive = await Promise.all(
          Object.values(lockers).map(async ({ mint }) =>
            (await stillOwnsNft(mint, effectivePublicKey!)) ? 1 : 0
          )
        );
        counts[mintStr] = alive.reduce<number>((sum, v) => sum + v, 0);
      })
    );
    setOwnedCounts(counts);          // <-- this drives "You own X"

  } finally {
    // even if getUserProtocolNfts throws we stop the loading state
    setNftsLoaded(true);
  }
}, [effectivePublicKey?.toBase58(), pools]);








  const handleOpenSellModal = (pool: PoolType) => {
  if (!effectivePublicKey) {
    setStatus("connect your wallet");
    return;
  }
  if (isGraduated(pool)) {
    setStatus("This pool has graduated to Meteora — trade there instead.");
    return;
  }
  // Bonding sells are allowed; we'll warn about the tax in the modal.
  setSelectedPool(pool);
  setModalTokensToSell('');
  setShowSellModal(true);
  setTransactionStatus('idle');
  setTransactionMessage('');
};


  const [showSellModal, setShowSellModal] = useState(false);
  const [modalTokensToSell, setModalTokensToSell] = useState('');
  const [slippage, setSlippage] = useState(1); // default 1%
  const [status, setStatus] = useState<string | null>(null);
  const [txStep, setTxStep] = useState<{ step: number, total: number, message: string } | null>(null);

  // Slot machine multiplier for feature card
  const [multVal, setMultVal] = useState('?.?x');
  const [multDone, setMultDone] = useState(false);
  const multTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SLOT_VALS = ['1.0x','1.4x','2.1x','105x','3.2x','98x','1.5x','45x','23x','7x','444x','890x'];
  const startMultSlot = () => {
    setMultDone(false); setMultVal(SLOT_VALS[0]);
    let i = 0;
    const step = () => {
      i++;
      if (i >= 14) {
        const final = (Math.random() * 2 + 1.5).toFixed(1) + 'x';
        setMultVal(final); setMultDone(true);
      } else {
        setMultVal(SLOT_VALS[i % SLOT_VALS.length]);
        multTimerRef.current = setTimeout(step, 60 + i * 8);
      }
    };
    multTimerRef.current = setTimeout(step, 60);
  };
  const stopMultSlot = () => {
    if (multTimerRef.current) clearTimeout(multTimerRef.current);
    setMultVal('?.?x'); setMultDone(false);
  };

  // Auto-animate slot machine on mount + every 8s
  useEffect(() => {
    const kick = () => { startMultSlot(); };
    const t = setTimeout(kick, 800);
    const iv = setInterval(kick, 8000);
    return () => { clearTimeout(t); clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile feature card carousel dot index
  const [featCarouselIdx, setFeatCarouselIdx] = useState(0);
  const featCarouselRef = useRef<HTMLDivElement>(null);


  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);


  // stop audio when the route changes (e.g., navigating away from /sound-memes)
const pathname = usePathname();
useEffect(() => {
  if (audioRef.current) {
    try {
      audioRef.current.pause();
      audioRef.current.src = ""; // release
    } catch {}
    setPlaying(null);
  }
}, [pathname]);

// also stop audio on component unmount
useEffect(() => {
  return () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    } catch {}
  };
}, []);




  const [hoverDeltaPct, setHoverDeltaPct] = useState<number | null>(null);

  useEffect(() => { setHoverDeltaPct(null); }, [selectedTimeRange, detailPool, showDetail]);



 // near other effects, after refreshUserNfts is defined
useEffect(() => {
  if (!afterPaint || !poolsLoaded) return;
  let stop = false;

  // initial load
  (async () => {
    try { await refreshUserNfts(); } catch {}
  })();

  // light polling (every 20s) while page is open
  const id = window.setInterval(() => {
    if (!stop) refreshUserNfts().catch(()=>{});
  }, 20_000);

  return () => { stop = true; clearInterval(id); };
}, [afterPaint, poolsLoaded, effectivePublicKey?.toBase58(), pools.map(p=>p.memeMint.toBase58()).join(',')]);



  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PoolType | null>(null);

  const [modalTokensToBuy, setModalTokensToBuy] = useState('');



  // ⬇️ ADD THESE TWO LINES
const buyingRef  = React.useRef(false);
const sellingRef = React.useRef(false);


  const [transactionStatus, setTransactionStatus] = useState('idle');
  const [transactionMessage, setTransactionMessage] = useState('');

const [burnModal, setBurnModal] = useState<{
  pool: PoolType | null;
  nfts: { lockId: number; mint: PublicKey }[];
  open: boolean;
}>({ pool: null, nfts: [], open: false });

  


const handleMintNft = (pool: PoolType) => {
  // prevent a second click while the modal is open
  if (txStep) return;

  const effectiveWalletForLock = { ...wallet, publicKey: effectivePublicKey, connected: effectiveConnected, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };
  lockTokens(pool, setStatus, effectiveWalletForLock as any, refreshUserNfts, minted => {
    setUserPoolNfts(prev => {
      setMintFilled({
        open:  true,
        symbol: pool.symbol ?? '',
        lockId: Number(minted.lockId),
      });

      const key = minted.memeMint;
      return {
        ...prev,
        [key]: {
          ...(prev[key] ?? {}),
          [Number(minted.lockId)]: {
            mint: minted.mint,
            json: {
              attributes: [
                { trait_type: 'MemeMint', value: key },
                { trait_type: 'LockId',   value: String(minted.lockId) },
              ],
            },
          },
        },
      };
    });

    refreshUserNfts();          // refresh list after TX finality
  });
};









// 3e) Program events — subscribe only after the first paint
useEffect(() => {
  if (!afterPaint || !effectiveConnected) return;

  const anchorWallet = getAnchorWallet(wallet) ?? (unifiedPublicKey && unifiedSignTransaction ? {
    publicKey: unifiedPublicKey,
    signTransaction: unifiedSignTransaction,
    signAllTransactions: async (txs: Transaction[]) => {
      const signed = [];
      for (const tx of txs) {
        signed.push(await unifiedSignTransaction(tx));
      }
      return signed;
    },
  } : null);
  if (!anchorWallet) return;
  const provider = new AnchorProvider(connection, anchorWallet, {
    preflightCommitment: "confirmed",
  });
  // Subscribe to PriceUpdate events from v1 (and v2 when deployed)
  const progV1 = new Program(poolIdl, V1_POOL_PROGRAM_ID, provider);
  // Same instance used for registration must be reused for removal — a
  // freshly constructed Program has its own empty listener registry, so
  // calling removeEventListener on a new instance always throws
  // "Event listener N doesn't exist!".
  let progV2: Program | null = null;

  let subIdV1: number | null = null;
  let subIdV2: number | null = null;

  const handler = (ev: any) => {
    const mintStr = new PublicKey(ev.memeMint).toBase58();
    const lamports = Number(ev.priceLamports);
    if (lamports > 0) pushPricePoint(mintStr, lamports);
  };

  (async () => {
    try {
      subIdV1 = await progV1.addEventListener("PriceUpdate", handler);
    } catch (e) {
      console.warn("V1 event subscription failed:", e);
    }
    if (V2_DEPLOYED_ON_MAINNET) {
      try {
        progV2 = new Program(poolV2Idl, V2_POOL_PROGRAM_ID, provider);
        subIdV2 = await progV2.addEventListener("PriceUpdate", handler);
      } catch (e) {
        console.warn("V2 event subscription failed:", e);
      }
    }
  })();

  return () => {
    if (subIdV1 != null && subIdV1 >= 0) {
      try { progV1.removeEventListener(subIdV1); } catch {
        // listener already removed or never registered
      }
    }
    if (subIdV2 != null && subIdV2 >= 0 && progV2) {
      try { progV2.removeEventListener(subIdV2); } catch {
        // listener already removed or never registered
      }
    }
  };
}, [afterPaint, effectiveConnected, pushPricePoint]);









// Load existing history for charts — defer until after paint & pools loaded
useEffect(() => {
  if (!afterPaint || !poolsLoaded || visiblePools.length === 0) return;
  let cancelled = false;

  runIdle(async () => {
    try {
      const all = await Promise.all(visiblePools.map(async (p) => {
          const mintStr = p.memeMint.toBase58();
          

          // in the "Load existing history for charts" effect:
const res = await fetch(`/api/pricepoints/${mintStr}?limit=600`, { cache: 'force-cache' });


          if (!res.ok) return [mintStr, []] as const;
          const arr: Array<{ time: string; priceLamports: string }> = await res.json();
          return [mintStr, arr] as const;
        })
      );

      if (cancelled) return;

      const updateSeries: Record<string, { time: number; price: number }[]> = {};
      const updateFirst: Record<string, number> = {};

      for (const [mintStr, arr] of all) {
        const series = arr
          .map(pt => ({
            time: new Date(pt.time).getTime(),
            price: Number(pt.priceLamports) / 1e9, // lamports -> WOODENG
          }))
          .filter(p => Number.isFinite(p.time) && Number.isFinite(p.price))
          .sort((a, b) => a.time - b.time);

        if (series.length) {
          updateSeries[mintStr] = series;
          updateFirst[mintStr] = series[0].time;
        }
      }

      if (cancelled) return;

      if (Object.keys(updateSeries).length) {
        setPersistedSeriesByMint(prev => ({ ...prev, ...updateSeries }));
      }
      if (Object.keys(updateFirst).length) {
        setFirstSeenAtByMint(prev => ({ ...prev, ...updateFirst }));
      }
    } catch (e) {
      if (!cancelled) console.warn('Failed loading history', e);
    }
  });

  return () => { cancelled = true; };
}, [afterPaint, poolsLoaded, visiblePools.map(p => p.memeMint.toBase58()).join(',')]);







  // Bootstrap: if a mint has no DB history yet, write one initial point
useEffect(() => {
  if (pools.length === 0) return;

  for (const p of pools) {
    const mint = p.memeMint.toBase58();
    const hasHistory = (persistedSeriesByMint[mint]?.length ?? 0) > 0;
    if (hasHistory) continue;

    // prefer on-chain lastMemePrice; else derive from current displayed price
    const lamports =
      Number(p.lastMemePrice ?? 0) > 0
        ? Number(p.lastMemePrice)
        : Math.round(Number(p.price ?? 0) * 10 ** WOODENG_DECIMALS);

    if (lamports > 0) {
  pushPricePoint(mint, lamports);
  // force one bulk flush so the DB has a baseline now
  flushNow(false);
}

  }
}, [pools, persistedSeriesByMint]);




// 3c) Baseline seeding + config polling — defer until after paint & pools loaded
useEffect(() => {
  if (!afterPaint || !poolsLoaded || visiblePools.length === 0) return;


  let stop = false;
  let interval: number | null = null;

  // rolling offset for windowed polling
  const ROLLING_CHUNK = 100; // cap per tick
  const rollingIdxRef = { current: 0 }; // simple local ref for this effect run

  // 1) seed baseline in idle time so first paint isn't blocked (unchanged)
  runIdle(() => {
    if (stop) return;

    const seeds: Record<string, number> = {};

    for (const p of visiblePools) {
      const mintStr = p.memeMint.toBase58();
      if (seededOnceRef.current.has(mintStr)) continue;

      const haveHistory =
        (persistedSeriesByMint[mintStr]?.length ?? 0) > 0 ||
        (priceSeriesByMint[mintStr]?.length ?? 0) > 0;

      if (!haveHistory) {
        const lamports =
          Number(p.lastMemePrice ?? 0) > 0
            ? Number(p.lastMemePrice)
            : Math.round(Number(p.price ?? 0) * 10 ** WOODENG_DECIMALS);

        if (lamports > 0) {
          pushPricePoint(mintStr, lamports);
          flushNow(false); // ensure DB baseline exists
        }
      }

      seededOnceRef.current.add(mintStr);

      const seededAt = Date.now();
      seeds[mintStr] = seededAt;

      try {
        const raw = localStorage.getItem(`lastPrice:${mintStr}`);
        if (raw) {
          const { time, priceLamports } = JSON.parse(raw);
          if (Number.isFinite(time) && Number.isFinite(priceLamports) && time > seededAt) {
            pushPricePoint(mintStr, Number(priceLamports));
          }
        }
      } catch {}
    }

    if (!stop && Object.keys(seeds).length) {
      setFirstSeenAtByMint(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(seeds)) {
          if (next[k] == null) next[k] = v as number;
        }
        return next;
      });
    }
  });

  // 2) start config polling after a tiny delay so paint wins — now windowed
  const startTimer = setTimeout(() => {
    if (stop) return;

    const anchorWallet = getAnchorWallet(wallet) ?? (unifiedPublicKey && unifiedSignTransaction ? {
      publicKey: unifiedPublicKey,
      signTransaction: unifiedSignTransaction,
      signAllTransactions: async (txs: Transaction[]) => {
        const signed = [];
        for (const tx of txs) {
          signed.push(await unifiedSignTransaction(tx));
        }
        return signed;
      },
    } : null);
    const provider = new AnchorProvider(
      connection,
      anchorWallet ?? ({ publicKey: new PublicKey('11111111111111111111111111111111') } as any),
      { commitment: 'confirmed' }
    );
    const prog = new Program(poolIdl, V2_POOL_PROGRAM_ID, provider);

    interval = window.setInterval(async () => {
      if (stop) return;
      try {
  // only the current page
  const cfgKeys = visiblePools.map(p => p.pubkey);
  if (!cfgKeys.length) return;

  const infos = await getMultiple(cfgKeys);

  for (let i = 0; i < cfgKeys.length; i++) {
    const acc = infos[i];
    if (!acc?.data) continue;
    const cfg = prog.coder.accounts.decode("SoundMemeConfig", acc.data) as any;
    const lamports = Number(cfg.lastMemePrice ?? 0);
    if (lamports > 0) {
      const mintStr = visiblePools[i].memeMint.toBase58();
      pushPricePoint(mintStr, lamports);
    }
  }
} catch {
  /* ignore transient errors */
}
    }, 10_000); // keep the same cadence; coverage rolls over time
  }, 300);

  return () => {
    stop = true;
    clearTimeout(startTimer);
    if (interval != null) clearInterval(interval);
  };
}, [
  afterPaint,
  poolsLoaded,
  visiblePools,
  wallet.publicKey,
  pushPricePoint,
  persistedSeriesByMint,
  priceSeriesByMint,
]);




// ✅ single effect, proper cleanup
useEffect(() => {
  if (!showDetail || !detailPool) return;

  const mintStr = detailPool.memeMint.toBase58();
  let stop = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const fetchOnce = async () => {
    try {
      const res = await fetch(`/api/pricepoints/${mintStr}?limit=600`, { cache: 'no-store' });
      if (!res.ok || stop) return;
      const rows: Array<{ time: string; priceLamports: string }> = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return;

      setPersistedSeriesByMint(prev => ({
        ...prev,
        [mintStr]: rows
          .map(r => ({ time: +new Date(r.time), price: Number(r.priceLamports) / 1e9 }))
          .filter(p => Number.isFinite(p.time) && Number.isFinite(p.price))
          .slice(-1200),
      }));
    } catch {/* ignore */}
  };

  fetchOnce();
  timer = setInterval(fetchOnce, 30_000);

  return () => { stop = true; if (timer) clearInterval(timer); };
}, [showDetail, detailPool]);





useEffect(() => {
  if (!showDetail || !detailPool) return;

  const mintStr = detailPool.memeMint.toBase58();

  // How many points do we already have (persisted + live)?
  const have =
    (priceSeriesByMint[mintStr]?.length ?? 0) +
    (persistedSeriesByMint[mintStr]?.length ?? 0);

  if (have === 0) {
    // Use on-chain lastMemePrice if present; else fall back to current pool.price
    const lamports =
      Number(detailPool.lastMemePrice ?? 0) ||
      Math.round(Number(detailPool.price ?? 0) * 1e9);

    if (lamports > 0) {
  pushPricePoint(mintStr, lamports);
  flushNow(false); // immediate bulk baseline
}

  }
}, [
  showDetail,
  detailPool,
  priceSeriesByMint,
  persistedSeriesByMint,
  pushPricePoint,
]);






// Wallet balances — defer to idle, gate by paint & pools loaded
useEffect(() => {
  if (!afterPaint || !poolsLoaded) return;
  runIdle(() => {
    refreshBalances();
  });
}, [afterPaint, poolsLoaded, refreshBalances]);




// 3f) Auto-migrate watcher — DISABLED: graduation now goes directly to Meteora DAMM v2
// The bonding → AMM migration step is no longer needed. Pools graduate directly.
// Keeping the ref to avoid breaking other code that references it.
/* useEffect(() => { ... }, [...]); */






  // --------------------------------------------
  //  auto-open the Buy modal when we deep-link
  // --------------------------------------------
  const buyAutoOpened = useRef(false);

// 3g) Deep-link auto-open — only after first paint & once pools are loaded
useEffect(() => {
  if (!afterPaint || !poolsLoaded || buyAutoOpened.current) return;
  if (!deepLinkedMint || pools.length === 0) return;

  const pool = pools.find(p => p.memeMint.toBase58() === deepLinkedMint);
  if (pool) {
    handleOpenBuyModal(pool);
    buyAutoOpened.current = true;
  }
}, [afterPaint, poolsLoaded, deepLinkedMint, pools]);



  const playDemo = async (id: string, url?: string) => {
  if (!url || !audioRef.current) return;
  const el = audioRef.current;

  if (playing === id) { try { el.pause(); } catch {} setPlaying(null); return; }

  try {
    try { el.pause(); } catch {}
    el.src = url;               // just set the URL (HTTPS gateway), no <source> tag
    el.muted = false;
    (el as any).playsInline = true;
    el.load();                  // important on iOS
    await el.play();            // must be in user gesture
    setPlaying(id);
    el.onended = () => setPlaying(null);
    el.onerror = () => { setPlaying(null); setStatus("Audio load failed."); };
  } catch (e:any) {
    setPlaying(null);
    setStatus(`Playback blocked: ${e?.message || e}`);
  }
};







 

  // --- Buy Logic for Modal ---
// --- Buy Logic for Modal ---
async function buySoundMeme({
  pool, amountWoodengIn, minMemeOut, wallet, onStep
}: { pool: PoolType, amountWoodengIn: number, minMemeOut: number, wallet: any, onStep?: (step: number, total: number, msg: string) => void }) {
  if (!wallet.publicKey) throw new Error('Connect wallet first!');

  const [configPda] = await getConfigPda(pool.memeMint, poolProgramIdFor(pool));
  const provider    = new AnchorProvider(connection, getAnchorWallet(wallet)!, { preflightCommitment: 'confirmed' });
  const poolProgram = new Program(poolIdl, poolProgramIdFor(pool), provider);

  const [poolMemeVault]    = await PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'),    pool.memeMint.toBuffer()], poolProgramIdFor(pool));
  const [poolWoodengVault] = await PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], poolProgramIdFor(pool));

  const { ata: buyerMemeAta, ix: buyerMemeAtaIx } = await ensureAtaIx(wallet.publicKey, pool.memeMint, wallet.publicKey);

  // Quote (input) account: wrap for SOL, otherwise idempotent ATA
  let buyerQuoteAta: PublicKey;
let buyerQuoteAtaIx: TransactionInstruction | null = null;
let wrapIxs: TransactionInstruction[] = [];

if (pool.quoteMint.equals(NATIVE_MINT)) {
  const w = await buildWrapSolIxs(wallet.publicKey, amountWoodengIn);
  buyerQuoteAta = w.ata;       // <-- pass this as buyerWoodengAta
  wrapIxs = w.ixs;             // <-- include these ixs in the tx
} else {
  const r = await ensureAtaIx(wallet.publicKey, pool.quoteMint, wallet.publicKey);
  buyerQuoteAta = r.ata;
  buyerQuoteAtaIx = r.ix;
}


  // Fee recipient (creator or fallback). Allow off-curve if PDA.
  const feeRecipient = feeRecipientFor(pool);
  const allowOffCurve = !PublicKey.isOnCurve(feeRecipient.toBytes());
  const { ata: creatorWalletAta, ix: creatorWalletAtaIx } =
    await ensureAtaIx(feeRecipient, pool.quoteMint, wallet.publicKey, allowOffCurve);

  const isAmmPool  = pool.poolType === 1;
  const method = isAmmPool
    ? poolProgram.methods.swap(new BN(amountWoodengIn), new BN(minMemeOut))
    : poolProgram.methods.buy (new BN(amountWoodengIn), new BN(minMemeOut));

  // staking PDAs
  // BUY / SELL
const { stakingConfig, rewardsVault, rewardsVaultWsol } = getStakingPdas(pool.quoteMint);
const stakingRewardsVault = quoteIsSol(pool) ? rewardsVaultWsol : rewardsVault;



  const coreIx = await method.accounts({
  config:           configPda,
  memeMint:         pool.memeMint,
  poolMemeVault,
  poolWoodengVault,
  buyer:            wallet.publicKey,
  buyerMemeAta,
  buyerWoodengAta:  buyerQuoteAta,
  projectWalletAta: creatorWalletAta,
  stakingConfig,
  stakingRewardsVault,
  stakingProgram:   STAKING_PROGRAM_ID,   // ← add this line
  tokenProgram:     TOKEN_PROGRAM_ID,
  systemProgram:    SystemProgram.programId,
}).instruction();


  // ── TX A: ensure all ATAs exist (only if needed) ──────────────────
  const setupIxs = [
    buyerMemeAtaIx,
    buyerQuoteAtaIx,
    creatorWalletAtaIx,
  ].filter(Boolean) as TransactionInstruction[];

  const ataChecks = await connection.getMultipleAccountsInfo([
    buyerMemeAta,
    buyerQuoteAta,
    creatorWalletAta,
  ]);
  const needsSetup = ataChecks.some(info => info === null);

  if (needsSetup) {
    onStep?.(1, 2, "Setting up token accounts…");
    await sendIxsOnce(connection, getAnchorWallet(wallet)!, [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ...setupIxs,
    ], [], { skipPreflight: false });
  }

  // ── TX B: the actual buy (small tx) ──────────────────────────────
  onStep?.(needsSetup ? 2 : 1, needsSetup ? 2 : 1, "Confirming your buy…");
  const coreIxs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    ...wrapIxs,   // wrap SOL → wSOL (empty array for non-SOL pairs)
    coreIx,
  ];

  if (quoteIsSol(pool)) {
    coreIxs.push(
      createCloseAccountInstruction(
        buyerQuoteAta,
        wallet.publicKey,
        wallet.publicKey
      )
    );
  }

  return await sendIxsOnce(connection, getAnchorWallet(wallet)!, coreIxs, [], { skipPreflight: false });
}




const handleOpenBuyModal = async (poolFromGrid: PoolType) => {
  if (!wallet.publicKey) {
    setStatus("connect your wallet");
    return;
  }
  if (isGraduated(poolFromGrid)) {
    setStatus("This pool has graduated to Meteora — trade there instead.");
    return;
  }

  // 1) Open immediately with what we already have (zero wait)
  setSelectedPool(poolFromGrid);
  setModalTokensToBuy("");
  setShowBuyModal(true);
  setTransactionStatus("idle");
  setTransactionMessage("");

  // 2) Refresh in the background and swap in the fresh pool if found
  (async () => {
    try {
      const anchorWallet = getAnchorWallet(wallet) ?? (unifiedPublicKey && unifiedSignTransaction ? {
        publicKey: unifiedPublicKey,
        signTransaction: unifiedSignTransaction,
        signAllTransactions: async (txs: Transaction[]) => {
          const signed = [];
          for (const tx of txs) {
            signed.push(await unifiedSignTransaction(tx));
          }
          return signed;
        },
      } : null);
      if (!anchorWallet) return;
      const provider    = new AnchorProvider(connection, anchorWallet, {});
      const poolProgram = new Program(poolIdl, poolProgramIdFor(poolFromGrid), provider);
      const freshPools  = await fetchSoundMemePoolsWithMetadata(poolProgram);
      const freshPool   = freshPools.find(p => p.memeMint.equals(poolFromGrid.memeMint));
      if (freshPool) setSelectedPool(freshPool); // swaps silently, no blocking
    } catch {
      /* ignore background refresh errors */
    }
  })();
};



  const handleConfirmBuy = async () => {
  if (buyingRef.current) return;      // lock
  buyingRef.current = true;
  try {
    if (!selectedPool) return;
    const pool = selectedPool;

    const DEC = pool.decimals ?? MEME_DECIMALS;
    const amtUi = Number(modalTokensToBuy || 0);
    if (!Number.isFinite(amtUi) || amtUi <= 0) {
      setTransactionStatus('error');
      setTransactionMessage('Enter a valid amount to buy.');
      return;
    }

    const memeRawOut   = Math.floor(amtUi * 10 ** DEC);
    const woodengRawIn = getQuoteForMemeBuy(pool, amtUi);
    if (!Number.isFinite(woodengRawIn)) {
      setTransactionStatus('error');
      setTransactionMessage('Quote unavailable for this amount.');
      return;
    }

    const woodengUiIn = woodengRawIn / 1e9;
    const spotPrice   = Number(pool.price);
    const avgPrice    = amtUi > 0 ? (woodengUiIn / amtUi) : 0;
    const priceImpact = spotPrice > 0 ? ((avgPrice - spotPrice) / spotPrice) * 100 : 0;

    const s = Math.max(0, Number(slippage) || 0);
    // never allow 0, especially for 0-decimals mints
const minMemeOut = Math.max(1, Math.floor(memeRawOut * Math.max(0, 1 - s / 100)));


    if (priceImpact > slippage) {
      setTransactionStatus('error');
      setTransactionMessage('Price impact exceeds slippage tolerance.');
      return;
    }

    // --- Balance check BEFORE sending wallet popup ---
const quoteMintStr = pool.quoteMint.toBase58();
const quoteBalRaw  = quoteBalancesRaw[quoteMintStr] ?? 0;

// rough fee buffer (tx fee + priority fee + a bit extra)
const CU_LIMIT = 200_000;
const MICRO_LAMPORTS = 10_000;
const priorityFeeLamports = Math.ceil((CU_LIMIT * MICRO_LAMPORTS) / 1_000_000); // ≈ 2_500 lamports
const feeBufferLamports = 20_000 + priorityFeeLamports; // safety

if (quoteIsSol(pool)) {
  // need enough SOL to wrap + fees
  const solBal = quoteBalRaw; // you set SOL balance into quoteBalancesRaw for WSOL mint key
  const needed = woodengRawIn + feeBufferLamports;
  if (solBal < needed) {
    setTransactionStatus('error');
    setTransactionMessage(
      `Insufficient SOL. Need ${(needed/1e9).toFixed(6)} SOL, have ${(solBal/1e9).toFixed(6)} SOL.`
    );
    return;
  }
} else {
  // WOODENG quote
  if (quoteBalRaw < woodengRawIn) {
    setTransactionStatus('error');
    setTransactionMessage(
      `Insufficient ${quoteLabelOf(pool)}. Need ${(woodengRawIn/1e9).toFixed(6)}, have ${(quoteBalRaw/1e9).toFixed(6)}.`
    );
    return;
  }

  // still need SOL for fees
  const solBal = await getCachedBalance(connection, wallet.publicKey!, 'confirmed');
  if (solBal < feeBufferLamports) {
    setTransactionStatus('error');
    setTransactionMessage(
      `Insufficient SOL for network fees. Need ~${(feeBufferLamports/1e9).toFixed(6)} SOL.`
    );
    return;
  }
}


    setTransactionStatus('processing');
    setTransactionMessage('Processing transaction...');

    // …your existing try { await buySoundMeme(...); patches; toasts; etc. } catch { … }
    try {
      if (!effectivePublicKey) throw new Error('Please connect your wallet!');
      const effectiveWalletForTx = { ...wallet, publicKey: effectivePublicKey, connected: effectiveConnected, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };
      const tx = await buySoundMeme({
        pool,
        amountWoodengIn: woodengRawIn,
        minMemeOut,
        wallet: effectiveWalletForTx,
        onStep: (s, t, m) => setTxStep({ step: s, total: t, message: m }),
      });

      const mintStr = pool.memeMint.toBase58();

      setTxStep(null);

      adjustMemeBalanceRaw(mintStr, +memeRawOut);
      adjustQuoteBalanceRaw(pool.quoteMint, -woodengRawIn);
      patchPoolAfterBuy(pool, memeRawOut, woodengRawIn);

      try {
        const pLamports = nextPriceLamportsAfterTrade(pool, -memeRawOut, +woodengRawIn);
        pushPricePoint(mintStr, pLamports);
        flushNow(false);
      } catch {}

      setTransactionStatus('success');
      setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);
      await refreshUserNfts();
      await refreshBalances();
      setShowBuyModal(false);

      try {
        const anchorWalletNow = getAnchorWallet(wallet) ?? (unifiedPublicKey && unifiedSignTransaction ? {
          publicKey: unifiedPublicKey,
          signTransaction: unifiedSignTransaction,
          signAllTransactions: async (txs: Transaction[]) => {
            const signed = [];
            for (const tx of txs) {
              signed.push(await unifiedSignTransaction(tx));
            }
            return signed;
          },
        } : null);
        if (!anchorWalletNow) throw new Error('no wallet');
        const providerNow = new AnchorProvider(connection, anchorWalletNow, {});
        const progNow = new Program(poolIdl, poolProgramIdFor(pool), providerNow);
        const cfgNow = await progNow.account.soundMemeConfig.fetch(pool.pubkey);
        const lamportsNow = Number((cfgNow as any).lastMemePrice ?? 0);
        if (lamportsNow > 0) pushPricePoint(mintStr, lamportsNow);
      } catch {}

      setBuyFilled({
        open: true,
        symbol: pool.symbol ?? '',
        amountMeme: amtUi,
        priceWoodeng: woodengUiIn,
        quoteLabel: quoteLabelOf(pool),
      });
    } catch (e: any) {
      setTxStep(null);
      setTransactionStatus('error');
      setTransactionMessage('Error: ' + (e.message || 'Unknown error'));
    }
  } finally {
    buyingRef.current = false;        // always release
  }
};




const handleQuickBuyDirect = async (pool: PoolType, quoteRawIn: number) => {
  if (!effectivePublicKey) { setStatus('Connect your wallet first.'); return; }
  if (buyingRef.current) return;
  buyingRef.current = true;
  try {
    const DEC = pool.decimals ?? MEME_DECIMALS;

    // Step 1: estimate meme tokens receivable for the given WOODENG budget
    const memeUiOut = memeOutForWoodengIn(pool, quoteRawIn);
    if (memeUiOut <= 0) { setStatus('Cannot compute output for this pool.'); return; }

    // Step 2: recompute woodengRawIn via getQuoteForMemeBuy — IDENTICAL path to
    // handleConfirmBuy so the on-chain (amountWoodengIn, minMemeOut) pair is consistent
    const memeRawOut   = Math.floor(memeUiOut * 10 ** DEC);
    const woodengRawIn = getQuoteForMemeBuy(pool, memeUiOut);
    if (!Number.isFinite(woodengRawIn) || woodengRawIn <= 0) {
      setStatus('Quote unavailable for this amount.');
      return;
    }

    const s            = Math.max(0, Number(slippage) || 1);
    const minMemeOut   = Math.max(1, Math.floor(memeRawOut * Math.max(0, 1 - s / 100)));

    // Step 3: balance check (same constants as handleConfirmBuy)
    const quoteMintStr = pool.quoteMint.toBase58();
    const quoteBalRaw  = quoteBalancesRaw[quoteMintStr] ?? 0;
    const CU_LIMIT     = 200_000;
    const MICRO_LAMPORTS = 10_000;
    const priorityFeeLamports = Math.ceil((CU_LIMIT * MICRO_LAMPORTS) / 1_000_000);
    const feeBufferLamports   = 20_000 + priorityFeeLamports;

    if (quoteIsSol(pool)) {
      const needed = woodengRawIn + feeBufferLamports;
      if (quoteBalRaw < needed) {
        setStatus(`Insufficient SOL. Need ${(needed / 1e9).toFixed(6)} SOL, have ${(quoteBalRaw / 1e9).toFixed(6)} SOL.`);
        return;
      }
    } else {
      if (quoteBalRaw < woodengRawIn) {
        setStatus(`Insufficient ${quoteLabelOf(pool)}. Need ${(woodengRawIn / 1e9).toFixed(2)}, have ${(quoteBalRaw / 1e9).toFixed(2)}.`);
        return;
      }
      const solBal = await getCachedBalance(connection, wallet.publicKey!, 'confirmed');
      if (solBal < feeBufferLamports) {
        setStatus('Insufficient SOL for network fees.');
        return;
      }
    }

    // Step 4: execute — same buySoundMeme call and post-buy logic as handleConfirmBuy
    setTxStep({ step: 1, total: 3, message: 'Signing transaction…' });
    const effectiveWalletForTx2 = { ...wallet, publicKey: effectivePublicKey, connected: effectiveConnected, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };
    const tx = await buySoundMeme({
      pool,
      amountWoodengIn: woodengRawIn,
      minMemeOut,
      wallet: effectiveWalletForTx2,
      onStep: (step, total, message) => setTxStep({ step, total, message }),
    });

    const mintStr = pool.memeMint.toBase58();
    setTxStep(null);

    adjustMemeBalanceRaw(mintStr, +memeRawOut);
    adjustQuoteBalanceRaw(pool.quoteMint, -woodengRawIn);
    patchPoolAfterBuy(pool, memeRawOut, woodengRawIn);

    try {
      const pLamports = nextPriceLamportsAfterTrade(pool, -memeRawOut, +woodengRawIn);
      pushPricePoint(mintStr, pLamports);
      flushNow(false);
    } catch {}

    // Re-fetch on-chain price same as handleConfirmBuy
    try {
      const anchorWalletNow = getAnchorWallet(wallet) ?? (unifiedPublicKey && unifiedSignTransaction ? {
        publicKey: unifiedPublicKey,
        signTransaction: unifiedSignTransaction,
        signAllTransactions: async (txs: Transaction[]) => {
          const signed = [];
          for (const tx of txs) {
            signed.push(await unifiedSignTransaction(tx));
          }
          return signed;
        },
      } : null);
      if (!anchorWalletNow) throw new Error('no wallet');
      const providerNow = new AnchorProvider(connection, anchorWalletNow, {});
      const progNow = new Program(poolIdl, poolProgramIdFor(pool), providerNow);
      const cfgNow  = await progNow.account.soundMemeConfig.fetch(pool.pubkey);
      const lamportsNow = Number((cfgNow as any).lastMemePrice ?? 0);
      if (lamportsNow > 0) pushPricePoint(mintStr, lamportsNow);
    } catch {}

    setBuyFilled({
      open: true,
      symbol:       pool.symbol ?? '',
      amountMeme:   memeUiOut,
      priceWoodeng: woodengRawIn / 1e9,
      quoteLabel:   quoteLabelOf(pool),
    });

    await refreshUserNfts();
    await refreshBalances();

  } catch (e: any) {
    setTxStep(null);
    setStatus('Buy failed: ' + (e.message || 'Unknown error'));
  } finally {
    buyingRef.current = false;
  }
};

const handleConfirmSell = async () => {
  if (sellingRef.current) return;     // lock
  sellingRef.current = true;
  try {
    if (!selectedPool) return;
    const pool = selectedPool;

    const DEC = pool.decimals ?? MEME_DECIMALS;
const amtUi = Number(modalTokensToSell || 0);

// exact wallet raw balance for this mint (if we have it)
const mintStr = pool.memeMint.toBase58();
const walletRawBal = balancesByMint[mintStr] ?? undefined;

let memeRawIn = Math.floor(amtUi * 10 ** DEC);

// If user effectively clicked "max", snap to the exact raw balance
if (
  walletRawBal != null &&
  walletRawBal > 0 &&
  Math.abs(memeRawIn - walletRawBal) <= 1
) {
  memeRawIn = walletRawBal;
}

if (!Number.isFinite(memeRawIn) || memeRawIn <= 0) {
  setTransactionStatus('error');
  setTransactionMessage('Enter a valid amount to sell.');
  return;
}


    const woodengRawOut = getQuoteForMemeSell(pool, memeRawIn);
    const woodengUiOut  = woodengRawOut / 1e9;

    // We enforce user slippage via minWoodengOut; do not block by "price impact",
// which is naturally large on bonding curves for big trades.
const s = Math.max(0, Number(slippage) || 0);
const slipOut = Math.floor(woodengRawOut * Math.max(0, 1 - s / 100));
// tiny buffer (2–5 lamports) to absorb rounding/tax floors on bonding sells
const minWoodengOut = Math.max(1, slipOut - 5);






    setTransactionStatus('processing');
    setTransactionMessage('Processing transaction...');

    try {
      if (!effectivePublicKey) throw new Error('Please connect your wallet!');
      if (!modalTokensToSell) throw new Error('Select amount to sell');

      // --- Balance check BEFORE sending wallet popup ---
const mintStr = pool.memeMint.toBase58();
const userMemeRaw = balancesByMint[mintStr] ?? 0;

if (userMemeRaw < memeRawIn) {
  setTransactionStatus('error');
  setTransactionMessage(`Insufficient token balance to sell that amount.`);
  return;
}

// fees buffer
const CU_LIMIT = 250_000;
const MICRO_LAMPORTS = 10_000;
const priorityFeeLamports = Math.ceil((CU_LIMIT * MICRO_LAMPORTS) / 1_000_000);
const feeBufferLamports = 20_000 + priorityFeeLamports;

const solBal = await getCachedBalance(connection, wallet.publicKey!, 'confirmed');
if (solBal < feeBufferLamports) {
  setTransactionStatus('error');
  setTransactionMessage(
    `Insufficient SOL for network fees. Need ~${(feeBufferLamports/1e9).toFixed(6)} SOL.`
  );
  return;
}


      const effectiveWalletForSell = { ...wallet, publicKey: effectivePublicKey, connected: effectiveConnected, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };
      const tx = await sellSoundMeme({
        pool,
        memeAmountIn: memeRawIn,
        minWoodengOut,
        wallet: effectiveWalletForSell,
        onStep: (s, t, m) => setTxStep({ step: s, total: t, message: m }),
      });

      setTxStep(null);

      adjustMemeBalanceRaw(mintStr, -memeRawIn);
      adjustQuoteBalanceRaw(pool.quoteMint, +woodengRawOut);
      patchPoolAfterSell(pool, memeRawIn, woodengRawOut);

      try {
        const pLamports = nextPriceLamportsAfterTrade(pool, +memeRawIn, -woodengRawOut);
        pushPricePoint(mintStr, pLamports);
        flushNow(false);
      } catch {}

      setTransactionStatus('success');
      setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);
      await refreshUserNfts();
      await refreshBalances();
      setShowSellModal(false);

      try {
        const anchorWalletNow = getAnchorWallet(wallet) ?? (unifiedPublicKey && unifiedSignTransaction ? {
          publicKey: unifiedPublicKey,
          signTransaction: unifiedSignTransaction,
          signAllTransactions: async (txs: Transaction[]) => {
            const signed = [];
            for (const tx of txs) {
              signed.push(await unifiedSignTransaction(tx));
            }
            return signed;
          },
        } : null);
        if (!anchorWalletNow) throw new Error('no wallet');
        const providerNow = new AnchorProvider(connection, anchorWalletNow, {});
        const progNow = new Program(poolIdl, poolProgramIdFor(pool), providerNow);
        const cfgNow = await progNow.account.soundMemeConfig.fetch(pool.pubkey);
        const lamportsNow = Number((cfgNow as any).lastMemePrice ?? 0);
        if (lamportsNow > 0) pushPricePoint(mintStr, lamportsNow);
      } catch {}

      setSellFilled({
        open: true,
        symbol: pool.symbol ?? '',
        amountMeme: amtUi,
        priceWoodeng: woodengUiOut,
        quoteLabel: quoteLabelOf(pool),
      });
    } catch (e: any) {
  setTxStep(null);
  const msg = await renderError(e, connection);
  setTransactionStatus('error');
  setTransactionMessage('Error: ' + msg);
}

  } finally {
    sellingRef.current = false;       // always release
  }
};





 



async function unlockTokens(
  pool: PoolType,
  nftMint: PublicKey,
  lockId: number | bigint,
  refresh: () => Promise<void>
) {
  // ➊ show one-step progress modal
  setTxStep({ step: 1, total: 1, message: "Burning NFT & unlocking tokens…" });

  try {
    if (!effectivePublicKey) throw new Error("Connect wallet first");
    if (!nftMint) throw new Error("No NFT mint provided");
    const pk = effectivePublicKey!;
    const anchorWalletUnlock = { publicKey: pk, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) };

    // Guard: ensure the NFT account still exists & has balance
    const userNftAccount = await getAta(pk, nftMint);
    const accInfo = await connection.getAccountInfo(userNftAccount);
    if (!accInfo) throw new Error("NFT account not found – did you mint from this wallet?");
    const bal = (await connection.getTokenAccountBalance(userNftAccount)).value.uiAmount;
    if (!bal) throw new Error("This NFT is already burned (balance = 0).");

    // PDAs — inline derivation matching Rust seeds
    const lockIdLEUnlock = new Uint8Array(8);
    new DataView(lockIdLEUnlock.buffer).setBigUint64(0, BigInt(lockId), true);
    const [lockerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('locker'), pool.memeMint.toBuffer(), pk.toBuffer(), Buffer.from(lockIdLEUnlock)],
      LOCKER_PROGRAM_ID
    );
    const userMemeAta       = await getAta(pk, pool.memeMint);
    const lockerMemeAccount = await getAta(lockerPda,      pool.memeMint, true);

    // Anchor call
    const provider      = new AnchorProvider(connection, anchorWalletUnlock as any, { preflightCommitment: "confirmed" });
    const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

    await lockerProgram.methods
      .burnNftAndUnlockTokens()
      .accounts({
        user: pk,
        userMemeAccount: userMemeAta,
        locker: lockerPda,
        lockerMemeAccount,
        nftMint,
        userNftAccount,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .rpc();

    // ✅ Only on success:
    await refresh();
    await refreshBalances();

    setBurnFilled({
      open: true,
      symbol: pool.symbol ?? "",
      amountUnlocked: getMintThreshold(pool),
    });
  } catch (err: any) {
    // 🔒 Never show success if canceled or failed
    if (isUserRejectError(err)) {
      setStatus("Transaction canceled — nothing was burned.");
      return; // <- important: exit without any success updates
    }

    const msg = await renderError(err, connection);
    setStatus("Unlock failed: " + msg);
  } finally {
    // ➋ always close the progress modal
    setTxStep(null);
  }
}



function CompactBondingGauge({ pool }: { pool: PoolType }) {
  if (pool.poolType !== 0) return null;

  const woodLamports = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const thrLamports = Number(targetsFor(pool).migrateLowerLamports);
const pct = Math.min(1, woodLamports / Math.max(1, thrLamports));

  const pctInt       = Math.round(pct * 100);

  const woodUi = woodLamports / (10 ** WOODENG_DECIMALS);
  const thrUi  = thrLamports  / (10 ** WOODENG_DECIMALS);
  const leftUi = Math.max(0, thrUi - woodUi);

  return (
    <div
      className="group h-full flex flex-col items-center justify-center gap-2 pointer-events-auto select-none"
      onMouseDown={(e) => e.stopPropagation()} // don’t open the card if user clicks here
    >
      {/* top label (always visible) */}
      <div className="text-[11px] font-semibold text-white/95 bg-black/60 px-2 py-0.5 rounded-md ring-1 ring-white/10">
        Bonding in progress...
      </div>

      {/* vertical bar: wider & taller; percent lives INSIDE the bar */}
      <div className="relative w-8 h-full min-h-32 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/10">
        {/* hover tooltip (only on hover) */}
        <div className="
            absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full
            opacity-0 group-hover:opacity-100 transition-opacity
            bg-black/80 text-[11px] text-white px-2 py-1 rounded-md ring-1 ring-white/10
            whitespace-nowrap pointer-events-none
          ">
          Bonding · {pctInt}% · {leftUi.toFixed(2)} {quoteLabelOf(pool)} left
        </div>

        {/* percent label inside bar */}
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
          {pctInt}%
        </div>

        {/* fill */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-[#b484ff] to-[#6c47e2]"
          style={{ height: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}




  




  return (
  <div className="min-h-screen bg-[#181920] text-white px-3 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-6">

    <audio
  ref={audioRef}
  preload="metadata"
  playsInline
  x-webkit-airplay="allow"
  // NOTE: no crossOrigin here
  style={{ position:'fixed', left:-9999, width:1, height:1, opacity:0 }}
/>




  {/* ═══════════════════════════════════════════════════════════════════════
      SWL-444 LAUNCHPAD — HERO + LEADERBOARD + HOT + FILTERS
  ═══════════════════════════════════════════════════════════════════════ */}

  {/* ══ GLOBAL STYLES ══ */}
  <style>{`
    @keyframes hero-pulse {
      0%, 100% { opacity: 0.85; }
      50%       { opacity: 1; }
    }
    @keyframes live-glow {
      0%, 100% { box-shadow: 0 0 6px 2px rgba(239,68,68,0.5); }
      50%       { box-shadow: 0 0 14px 5px rgba(239,68,68,0.8); }
    }
    @keyframes grid-pulse {
      0%, 100% { opacity: 0.22; }
      50%       { opacity: 0.38; }
    }
    @keyframes chart-draw-loop {
      0%   { stroke-dashoffset: 1800; opacity: 0; }
      5%   { opacity: 1; }
      65%  { stroke-dashoffset: 0;    opacity: 1; }
      80%  { stroke-dashoffset: 0;    opacity: 0; }
      81%  { stroke-dashoffset: 1800; opacity: 0; }
      100% { stroke-dashoffset: 1800; opacity: 0; }
    }
    @keyframes chart-fill-loop {
      0%   { opacity: 0; }
      5%   { opacity: 0; }
      65%  { opacity: 0.45; }
      80%  { opacity: 0; }
      100% { opacity: 0; }
    }
    @keyframes chart-glow-pulse {
      0%, 100% { filter: drop-shadow(0 0 4px rgba(168,85,247,0.5)); }
      50%       { filter: drop-shadow(0 0 10px rgba(168,85,247,0.9)); }
    }
    @keyframes diamond-float {
      0%, 100% { transform: translateY(0px) rotate(45deg); opacity: 0.55; }
      50%       { transform: translateY(-8px) rotate(45deg); opacity: 0.9; }
    }
    @keyframes neon-glow-pulse {
      0%, 100% { opacity: 0.3; }
      50%       { opacity: 0.7; }
    }
    @keyframes shimmer-card {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes bar-fill { from { width: 0%; } to { width: var(--bar-w); } }
    @keyframes gate-open-left  { to { transform: translateX(-110%); } }
    @keyframes gate-open-right { to { transform: translateX(110%);  } }
    @keyframes crystal-shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }

    .hero-text-animated {
      background: linear-gradient(135deg, #ffffff 0%, #a855f7 50%, #ffffff 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: hero-pulse 3s ease-in-out infinite;
    }
    .live-badge-glow { animation: live-glow 2s ease-in-out infinite; }
    .card-shimmer:hover::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%);
      background-size: 200% 100%;
      animation: shimmer-card 0.7s ease forwards;
      pointer-events: none;
      border-radius: inherit;
    }
    .feature-card-gate:hover .gate-left  { animation: gate-open-left  0.5s cubic-bezier(.4,0,.2,1) forwards; }
    .feature-card-gate:hover .gate-right { animation: gate-open-right 0.5s cubic-bezier(.4,0,.2,1) forwards; }
    .feature-card-gate:hover .gate-inner { opacity: 1; transition: opacity 0.3s 0.3s; }
    .feature-card-rep:hover .rep-bar-1 { animation: bar-fill 0.6s 0s ease forwards; }
    .feature-card-rep:hover .rep-bar-2 { animation: bar-fill 0.6s 0.1s ease forwards; }
    .feature-card-rep:hover .rep-bar-3 { animation: bar-fill 0.6s 0.2s ease forwards; }
    .feature-card-rep:hover .rep-bar-4 { animation: bar-fill 0.6s 0.3s ease forwards; }
    .feature-card-rep:hover .rep-bar-5 { animation: bar-fill 0.6s 0.4s ease forwards; }
    .feature-card-cycle:hover .cycle-icon { animation: cycle-rotate 1s linear infinite; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0c0d12; }
    ::-webkit-scrollbar-thumb { background: #5b21b6; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #7c3aed; }
    button:hover, a:hover { --glow-active: 1; }
  `}</style>

  {/* ══ HERO BANNER ══ */}
  <div className="mb-6 rounded-2xl overflow-hidden relative"
       style={{
         background: 'linear-gradient(135deg, #0d0d12 0%, #1a0a2e 50%, #0d0d12 100%)',
         border: '1px solid rgba(124,58,237,0.3)',
         backdropFilter: 'blur(12px)',
       }}>

    {/* Animated grid background */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden"
         style={{ animation: 'grid-pulse 4s ease-in-out infinite' }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position:'absolute', inset:0 }}>
        <defs>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(124,58,237,0.18)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
    </div>

    {/* Scanline overlay */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.02]"
         style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)' }} />

    {/* Animated chart — realistic bullish line spanning full hero width */}
    <div className="absolute left-0 right-0 top-0 bottom-0 pointer-events-none overflow-hidden">
      <svg width="100%" height="100%" viewBox="0 0 1000 300" preserveAspectRatio="none"
           style={{ position:'absolute', inset:0, animation:'chart-glow-pulse 3s ease-in-out infinite' }}>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(168,85,247,0.22)"/>
            <stop offset="100%" stopColor="rgba(168,85,247,0)"/>
          </linearGradient>
        </defs>
        {/* Area fill under the line */}
        <path
          d="M 0,300 L 0,280 C 80,260 120,290 180,240 S 280,200 340,180 S 440,210 500,160 S 600,130 660,100 S 760,80 820,60 S 900,40 960,20 L 1000,15 L 1000,300 Z"
          fill="url(#chart-fill)"
          style={{ animation:'chart-fill-loop 12s ease-out infinite' }}
        />
        {/* Main chart line — draws itself over 8s then fades and restarts */}
        <path
          d="M 0,280 C 80,260 120,290 180,240 S 280,200 340,180 S 440,210 500,160 S 600,130 660,100 S 760,80 820,60 S 900,40 960,20"
          fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="1800" strokeDashoffset="1800"
          style={{ animation:'chart-draw-loop 12s ease-out infinite' }}
        />
        {/* Diamond markers at peaks — float gently */}
        {([{x:340,y:180},{x:500,y:160},{x:660,y:100},{x:820,y:60}] as {x:number;y:number}[]).map((pt,i) => (
          <g key={i} style={{ animation:`diamond-float ${2.8+i*0.5}s ease-in-out infinite ${i*0.7}s` }}>
            <rect x={pt.x-6} y={pt.y-6} width="12" height="12" fill="#a855f7" opacity="0.85"
                  transform={`rotate(45 ${pt.x} ${pt.y})`}/>
            <rect x={pt.x-3.5} y={pt.y-3.5} width="7" height="7" fill="#e9d5ff" opacity="0.65"
                  transform={`rotate(45 ${pt.x} ${pt.y})`}/>
          </g>
        ))}
      </svg>
    </div>

    {/* Purple neon glow lines only */}
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background:'linear-gradient(90deg, transparent, rgba(168,85,247,0.55), transparent)', animation:'neon-glow-pulse 3s ease-in-out infinite' }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background:'linear-gradient(90deg, transparent, rgba(168,85,247,0.35), transparent)', animation:'neon-glow-pulse 3s ease-in-out infinite 1.5s' }} />
    </div>

    <div className="px-5 py-6 sm:py-8 relative">
      {/* LIVE pill + active count */}
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-red-400 live-badge-glow"
              style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
          LIVE
        </span>
        <span className="text-xs text-[#6b7084]">{sortedPools.length} memes active</span>
      </div>

      {/* Animated gradient headline */}
      <h1 className="hero-text-animated text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-2">
        BUILD CULTURE.<br className="sm:hidden" /> Block Jeets. Create SWL-444 tokens
      </h1>
      <p className="text-sm sm:text-base text-[#9aa1af] max-w-xl">
        These tokens evolve. Their metadata can be updated and minted into an NFT. They save the trenches from short-term thinking.
        Launch. Gate. Ascend.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/meme-locker" className="hero-create-btn px-4 py-2 rounded-xl font-bold text-sm text-black"
           style={{ background:'linear-gradient(90deg, #ffc371, #ff6b6b)', display:'inline-block', position:'relative', overflow:'hidden' }}>
          <span style={{ position:'relative', zIndex:1 }}>+ Create Your Token</span>
        </a>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#9aa1af]"
             style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow:'0 0 6px rgba(52,211,153,0.8)' }} />
          {hotPools.length > 0 ? `${hotPools.length} trending now` : 'Markets live'}
        </div>
      </div>
    </div>
  </div>

  {/* ══ FEATURE CARDS ══ */}
  <style>{`
    @keyframes hero-btn-pulse { 0%{transform:scale(1)} 50%{transform:scale(1.07)} 100%{transform:scale(1)} }
    .hero-create-btn::before {
      content:''; position:absolute; bottom:0; left:0; right:0; height:100%;
      background:linear-gradient(to top, #f97316 0%, #fbbf24 100%);
      transform:translateY(100%);
      transition:transform 0.6s cubic-bezier(0.22,1,0.36,1);
      border-radius:inherit; z-index:0;
    }
    .hero-create-btn:hover::before { transform:translateY(0); }
    .hero-create-btn:hover { animation:hero-btn-pulse 0.3s ease 0.62s 1 both; }
    .hero-create-btn:active { transform:scale(0.95); transition:transform 0.08s ease; }
    .fc2 {
      border-radius: 16px;
      background: #0d0e16;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .fc2:hover { transform: translateY(-3px); }

    .fc2-gate { border: 1px solid rgba(96,165,250,0.28); overflow: hidden; }
    .fc2-gate:hover { box-shadow: 0 0 30px rgba(96,165,250,0.18), 0 0 60px rgba(167,139,250,0.1), 0 8px 24px rgba(0,0,0,0.5); }
    .fc2-rep  { border: 1px solid rgba(52,211,153,0.22); }
    .fc2-rep:hover  { box-shadow: 0 0 28px rgba(52,211,153,0.12), 0 8px 24px rgba(0,0,0,0.5); }
    .fc2-evo  { border: 1px solid rgba(167,139,250,0.22); }
    .fc2-evo:hover  { box-shadow: 0 0 28px rgba(167,139,250,0.12), 0 8px 24px rgba(0,0,0,0.5); }

    /* Gate scene */
    .fc2-gate-scene {
      height: 118px;
      background: #06070f;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    /* Blue/purple glow behind the gate — revealed on hover */
    .fc2-gate-glow {
      position: absolute; bottom: 0; left: 50%;
      transform: translateX(-50%);
      width: 180px; height: 110px;
      background: radial-gradient(ellipse at 50% 100%, rgba(167,139,250,0.55) 0%, rgba(96,165,250,0.2) 40%, transparent 72%);
      opacity: 0;
      transition: opacity 0.45s 0.15s ease;
      pointer-events: none;
      z-index: 0;
    }
    .fc2-gate:hover .fc2-gate-glow { opacity: 1; }

    /* Narrow vertical pillars on sides */
    .fc2-pillar {
      position: absolute; bottom: 0; top: 6px; width: 12px;
      background: linear-gradient(180deg, #3b82f6 0%, #1e40af 50%, #0f172a 100%);
      border-radius: 3px 3px 0 0;
      box-shadow: inset -2px 0 5px rgba(0,0,0,0.5), 0 0 8px rgba(59,130,246,0.25);
      z-index: 2;
    }
    .fc2-pillar-l { left: 8px; }
    .fc2-pillar-r { right: 8px; }

    /* Door halves — CSS-styled, slide apart on hover */
    .fc2-door-l {
      transition: transform 0.6s cubic-bezier(0.4,0,0.2,1);
      margin-right: 1px;
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: stretch;
    }
    .fc2-door-r {
      transition: transform 0.6s cubic-bezier(0.4,0,0.2,1);
      margin-left: 1px;
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: stretch;
    }
    .fc2-gate:hover .fc2-door-l { transform: translateX(-68%); }
    .fc2-gate:hover .fc2-door-r { transform: translateX(68%); }

    /* Pointed arch on top of each door */
    .fc2-door-arch {
      width: 62px; height: 18px;
      background: linear-gradient(135deg, #60a5fa 0%, #6366f1 55%, #4c1d95 100%);
      clip-path: polygon(0% 100%, 50% 0%, 100% 100%);
      filter: drop-shadow(0 -2px 6px rgba(96,165,250,0.5));
    }
    /* Door body with vertical bar texture and metallic sheen */
    .fc2-door-body {
      width: 62px; height: 88px;
      background:
        repeating-linear-gradient(90deg, transparent, transparent 9px, rgba(96,165,250,0.13) 9px, rgba(96,165,250,0.13) 10px),
        linear-gradient(180deg, #1e40af 0%, #3730a3 45%, #1e1b4b 100%);
      box-shadow: inset 3px 0 6px rgba(0,0,0,0.45), inset -3px 0 6px rgba(0,0,0,0.45), inset 0 -4px 8px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }
    /* Metallic sheen overlay */
    .fc2-door-body::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(120deg, rgba(255,255,255,0.10) 0%, transparent 38%, rgba(255,255,255,0.04) 100%);
      pointer-events: none;
    }
    /* Diamond medallion in center of each door */
    .fc2-door-medallion {
      width: 26px; height: 26px;
      border-radius: 50%;
      background: rgba(96,165,250,0.14);
      border: 1.5px solid rgba(96,165,250,0.65);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; color: #93c5fd;
      box-shadow: 0 0 10px rgba(96,165,250,0.35);
      position: relative; z-index: 1;
    }

    /* Mobile carousel */
    .feat-carousel {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      gap: 12px;
      padding-bottom: 4px;
    }
    .feat-carousel::-webkit-scrollbar { display: none; }
    .feat-carousel-item {
      scroll-snap-align: start;
      flex: 0 0 85vw;
      max-width: 320px;
    }
  `}</style>

  {/* ── Mobile carousel (hidden on sm+) / desktop grid (hidden on mobile) ── */}

  {/* MOBILE: horizontal swipe carousel */}
  <div className="sm:hidden mb-5">
    <div ref={featCarouselRef} className="feat-carousel"
      onScroll={() => {
        const el = featCarouselRef.current;
        if (!el) return;
        const idx = Math.round(el.scrollLeft / (el.scrollWidth / 3));
        setFeatCarouselIdx(Math.min(2, Math.max(0, idx)));
      }}>
      {[0,1,2].map(i => (
        <div key={i} className="feat-carousel-item fc2" style={{
          border: i === 0 ? '1px solid rgba(96,165,250,0.28)' : i === 1 ? '1px solid rgba(52,211,153,0.22)' : '1px solid rgba(167,139,250,0.22)',
          overflow: i === 0 ? 'hidden' : undefined,
        }}>
          {i === 0 && (
            <>
              <div className="fc2-gate-scene" style={{ height:100 }}>
                <div className="fc2-gate-glow"/>
                <div className="fc2-pillar fc2-pillar-l"/>
                <div className="fc2-pillar fc2-pillar-r"/>
                <div className="fc2-door-l"><div className="fc2-door-arch"/><div className="fc2-door-body"><div className="fc2-door-medallion">◆</div></div></div>
                <div className="fc2-door-r"><div className="fc2-door-arch"/><div className="fc2-door-body"><div className="fc2-door-medallion">◆</div></div></div>
              </div>
              <div className="p-4"><div className="text-sm font-black text-white mb-1.5">💎 Diamond Gate</div><div className="text-[11px] leading-relaxed" style={{color:'#6b7084'}}>Set a minimum avg hold time. Bundlers and flippers blocked at the door.</div></div>
            </>
          )}
          {i === 1 && (
            <>
              <div style={{height:100,display:'flex',alignItems:'center',justifyContent:'center',background:'#070810',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 50%, rgba(52,211,153,0.07) 0%, transparent 68%)'}}/>
                <div style={{textAlign:'center'}}>
                  <div className="text-4xl font-black tabular-nums" style={{color:'#34d399',textShadow:'0 0 20px rgba(52,211,153,0.6)'}}>?.?x</div>
                  <div className="text-[9px] font-bold mt-1" style={{color:'#6b7084',letterSpacing:'0.1em'}}>AVG MULTIPLIER</div>
                </div>
              </div>
              <div className="p-4"><div className="text-sm font-black text-white mb-1.5">📊 Dev Avg Multiplier</div><div className="text-[11px] leading-relaxed" style={{color:'#6b7084'}}>Every creator has a verifiable on-chain avg multiplier. Higher = longer holds. No more anon rugs.</div></div>
            </>
          )}
          {i === 2 && (
            <>
              <div style={{height:100,display:'flex',alignItems:'center',justifyContent:'center',background:'#070810',position:'relative',overflow:'hidden',gap:8}}>
                <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 50%, rgba(167,139,250,0.07) 0%, transparent 68%)'}}/>
                {(['🪙','🔒','🎨'] as string[]).map((ic,ii)=>(<React.Fragment key={ii}>{ii>0&&<div style={{color:'rgba(167,139,250,0.4)',fontSize:12,marginBottom:12}}>→</div>}<div style={{textAlign:'center'}}><div style={{width:36,height:36,borderRadius:'50%',background:'rgba(167,139,250,0.1)',border:'1px solid rgba(167,139,250,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{ic}</div></div></React.Fragment>))}
              </div>
              <div className="p-4"><div className="text-sm font-black text-white mb-1.5">🔄 Evolving Tokens</div><div className="text-[11px] leading-relaxed" style={{color:'#6b7084'}}>Lock tokens → mint a living NFT. Creator updates image & audio on-chain anytime.</div></div>
            </>
          )}
        </div>
      ))}
    </div>
    {/* Dot indicator */}
    <div className="flex justify-center gap-1.5 mt-2">
      {[0,1,2].map(i => (
        <div key={i} style={{ width: i === featCarouselIdx ? 16 : 6, height:6, borderRadius:3,
          background: i === featCarouselIdx ? '#a855f7' : 'rgba(167,139,250,0.25)',
          transition:'all 0.25s ease' }}/>
      ))}
    </div>
  </div>

  {/* DESKTOP: 3-column grid */}
  <div className="hidden sm:grid sm:grid-cols-3 gap-4 mb-5">

    {/* ── Card 1: Diamond Gate ── */}
    <div className="fc2 fc2-gate">
      <div className="fc2-gate-scene">
        <div className="fc2-gate-glow" />
        <div className="fc2-pillar fc2-pillar-l" />
        <div className="fc2-pillar fc2-pillar-r" />

        {/* Left door — CSS-based, slides left on hover */}
        <div className="fc2-door-l">
          <div className="fc2-door-arch" />
          <div className="fc2-door-body">
            <div className="fc2-door-medallion">◆</div>
          </div>
        </div>

        {/* Right door — slides right on hover */}
        <div className="fc2-door-r">
          <div className="fc2-door-arch" />
          <div className="fc2-door-body">
            <div className="fc2-door-medallion">◆</div>
          </div>
        </div>
      </div>

      <div className="p-5 flex-1">
        <div className="text-sm font-black text-white mb-2">💎 Diamond Gate</div>
        <div className="text-[11px] leading-relaxed" style={{ color:'#6b7084' }}>
          Set a minimum average hold time that traders must if they want to enter the bonding phase . Jeets and bundlers blocked before they ruin the launch. Only diamond hands allowed.
        </div>
      </div>
    </div>

    {/* ── Card 2: Creator Reputation (slot machine) ── */}
    <div className="fc2 fc2-rep"
         onMouseEnter={startMultSlot}
         onMouseLeave={stopMultSlot}>
      <div style={{ height:118, display:'flex', alignItems:'center', justifyContent:'center', background:'#06070f', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 50%, rgba(52,211,153,0.08) 0%, transparent 68%)' }}/>
        {/* Slot machine display */}
        <div style={{ textAlign:'center' }}>
          <div className="text-5xl font-black tabular-nums leading-none" style={{
            color: multDone ? (parseFloat(multVal) >= 2 ? '#34d399' : parseFloat(multVal) >= 1.5 ? '#fbbf24' : '#f87171') : '#34d399',
            textShadow: `0 0 24px ${multDone ? (parseFloat(multVal) >= 2 ? 'rgba(52,211,153,0.7)' : 'rgba(251,191,36,0.7)') : 'rgba(52,211,153,0.4)'}`,
            transition: 'color 0.3s, text-shadow 0.3s',
          }}>
            {multVal}
          </div>
          <div className="text-[9px] font-bold mt-2 tracking-widest" style={{ color:'#4a5568' }}>AVG MULTIPLIER</div>
          {multDone && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black"
                 style={{ background:'rgba(52,211,153,0.15)', color:'#34d399', border:'1px solid rgba(52,211,153,0.3)' }}>
              ✓ VERIFIED ON-CHAIN
            </div>
          )}
        </div>
      </div>
      <div className="p-5 flex-1">
        <div className="text-sm font-black text-white mb-2">📊 Dev Avg Multiplier</div>
        <div className="text-[11px] leading-relaxed" style={{ color:'#6b7084' }}>
          Every creator has an on-chain average multiplier of all their launches combined. Build your rep to reap. No more anon rugs.
        </div>
      </div>
    </div>

    {/* ── Card 3: Evolving Tokens ── */}
    <div className="fc2 fc2-evo">
      <div style={{ height:118, display:'flex', alignItems:'center', justifyContent:'center', background:'#06070f', position:'relative', overflow:'hidden', gap:10 }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 50%, rgba(167,139,250,0.07) 0%, transparent 68%)' }}/>
        {([
          { icon:'🪙', label:'TOKEN',   col:'rgba(167,139,250,0.4)' },
          { icon:'🔒', label:'LOCK',    col:'rgba(167,139,250,0.55)' },
          { icon:'🎨', label:'NFT',     col:'#a78bfa' },
        ] as { icon: string; label: string; col: string }[]).map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <div style={{ color:'rgba(167,139,250,0.35)', fontSize:13, flexShrink:0, marginBottom:14 }}>→</div>}
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(167,139,250,0.08)', border:`1px solid ${s.col}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{s.icon}</div>
              <div style={{ fontSize:8, color: s.col, marginTop:5, fontWeight:800, letterSpacing:'0.06em' }}>{s.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="p-5 flex-1">
        <div className="text-sm font-black text-white mb-2">🔄 Evolving Tokens</div>
        <div className="text-[11px] leading-relaxed" style={{ color:'#6b7084' }}>
          Lock tokens → mint a living NFT. Creator updates image & audio on-chain anytime. Your NFT evolves with the meme — not a dead JPEG.
        </div>
      </div>
    </div>

  </div>

  {/* ══ SCROLLING ACTIVITY TICKER ══ */}
  {sortedPools.length > 0 && (
    <div className="mb-5 overflow-hidden rounded-xl bg-[#1a1b25] border border-[#2a2b3a] py-2">
      <div className="flex items-center gap-0 whitespace-nowrap"
           style={{ animation: 'ticker-scroll 30s linear infinite' }}>
        {[...sortedPools.slice(0, 8), ...sortedPools.slice(0, 8)].map((p, i) => {
          const chg = change24hFor(p.memeMint.toBase58());
          const up = chg >= 0;
          return (
            <span key={`${p.pubkey.toBase58()}-${i}`}
                  className="inline-flex items-center gap-1.5 px-4 text-xs cursor-pointer shrink-0"
                  onClick={() => router.push(`/sound-memes/${p.memeMint.toBase58()}`)}>
              {p.poolType === 0 && <span className="text-blue-400">⏳</span>}
              {p.poolType >= 2 && <span className="text-purple-400">🎓</span>}
              <span className="font-bold text-white">{p.symbol || 'MEME'}</span>
              <span className={up ? 'text-emerald-400' : 'text-red-400'}>
                {up ? '▲' : '▼'}{Math.abs(chg).toFixed(1)}%
              </span>
              <span className="text-[#3a3b4a]">•</span>
            </span>
          );
        })}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )}

  {/* ── Admin button (hidden unless admin wallet) ── */}
  {wallet.publicKey &&
   wallet.publicKey.toBase58() === ADMIN_INIT_PUBKEY.toBase58() && (
    <div className="mb-3">
      <button type="button" onClick={() => ensureWsolRewardsVault(setStatus, wallet)}
        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/30 transition">
        Ensure WSOL Rewards Vault
      </button>
    </div>
  )}

  {/* ── Status Banner ── */}
  {status && (
    <div className="mb-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300">
      {status.includes('Processing') && <Loader2 className="animate-spin w-4 h-4" />}
      {status.includes('successful') && <CheckCircle2 className="w-4 h-4" />}
      {status.includes('failed') && <AlertCircle className="w-4 h-4" />}
      <span>{status}</span>
    </div>
  )}

  {/* ══ TOP LEADERBOARD RIBBON ══ */}
  <div className="mb-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

      {/* ── Top 3 Devs ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1a1b25] to-[#14151c] border border-[#2a2b3a] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">👑</span>
          <span className="text-sm font-bold text-white/90 uppercase tracking-wider">Top Creators</span>
        </div>
        <div className="space-y-2">
          {topCreators.length === 0 ? (
            <div className="text-xs text-[#6b7084]">Loading...</div>
          ) : topCreators.map((dev, i) => {
            const fmtMult = (m: number) => m >= 1000 ? `${(m/1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1);
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            return (
              <div key={dev.addr}
                className="flex items-center gap-2.5 group cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-white/[0.04] transition"
                onClick={() => { if (dev.bestPool) router.push(`/sound-memes/${dev.bestPool.memeMint.toBase58()}`); }}
              >
                <span className="text-base shrink-0">{medal}</span>
                {dev.bestPool?.imageUrl ? (
                  <img src={dev.bestPool.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/10 group-hover:ring-[#ffc371]/30 transition" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#2a2b3a] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono text-[#8a8fa3] truncate group-hover:text-[#ffc371] transition">{shortAddr(dev.addr, 4)}</div>
                  <div className="text-[10px] text-[#6b7084]">{dev.launches} launch{dev.launches !== 1 ? 'es' : ''}</div>
                </div>
                <span className={`text-sm font-black tabular-nums ${
                  dev.avgMult >= 10 ? 'text-emerald-400' : dev.avgMult >= 2 ? 'text-yellow-300' : 'text-[#8a8fa3]'
                }`}>
                  {fmtMult(dev.avgMult)}x
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top Diamond Hands ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1a1b25] to-[#14151c] border border-[#2a2b3a] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">💎</span>
          <span className="text-sm font-bold text-white/90 uppercase tracking-wider">Diamond Hands</span>
        </div>
        {topHoldersLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-2.5 animate-pulse">
                <div className="w-5 h-3 bg-[#2a2b3a] rounded shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="h-2.5 w-20 bg-[#2a2b3a] rounded" />
                </div>
                <div className="h-3 w-10 bg-[#2a2b3a] rounded" />
              </div>
            ))}
          </div>
        ) : topHolders.length === 0 ? (
          <div className="text-[11px] text-[#6b7084] text-center py-3">No holders yet</div>
        ) : (
          <div className="space-y-1.5">
            {topHolders.map((entry, i) => {
              const avgDays = entry.avgDays;
              const tierEmoji = avgDays >= 90 ? '👑' : avgDays >= 30 ? '🔥' : avgDays >= 7 ? '💎💎' : avgDays >= 1 ? '💎' : '🧻';
              const tierColor = avgDays >= 90 ? '#fbbf24' : avgDays >= 30 ? '#fb923c' : avgDays >= 7 ? '#a78bfa' : avgDays >= 1 ? '#60a5fa' : '#8a8fa3';
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
              return (
                <div key={entry.pda}
                     className="flex items-center gap-2 rounded-lg px-1.5 py-1 -mx-1.5 transition"
                     style={{ background: entry.isMe ? 'rgba(167,139,250,0.08)' : undefined }}>
                  <span className="text-[11px] shrink-0 w-5 text-center">{medal}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono truncate" style={{ color: entry.isMe ? '#a78bfa' : '#8a8fa3' }}>
                      {shortAddr(entry.pda, 4)}
                      {entry.isMe && <span className="ml-1 text-[8px] font-bold" style={{ color: '#a78bfa' }}>YOU</span>}
                    </div>
                  </div>
                  <span className="text-[10px] shrink-0">{tierEmoji}</span>
                  <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: tierColor }}>
                    {fmtHoldTime(avgDays)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>

  {/* ══ 🔥 HOT RIGHT NOW ══ */}
  {hotPools.length > 0 && (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔥</span>
        <span className="text-sm font-bold text-white/90 uppercase tracking-wider">Hot Right Now</span>
        <div className="flex-1 h-px bg-gradient-to-r from-[#ff6b35]/30 to-transparent" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
        {hotPools.map(({ pool: hp, chg, bondingProg }) => {
          const perf = poolPerfByMint[hp.memeMint.toBase58()];
          const fmtMult = (m: number) => m >= 1000 ? `${(m/1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1);
          return (
            <div
              key={hp.pubkey.toBase58()}
              className="snap-start shrink-0 w-[160px] sm:w-[180px] rounded-xl bg-[#1a1b25] border border-[#2a2b3a]
                         hover:border-[#ffc371]/30 hover:shadow-lg hover:shadow-[#ffc371]/5 transition-all cursor-pointer
                         overflow-hidden group"
              onClick={() => router.push(`/sound-memes/${hp.memeMint.toBase58()}`)}
            >
              {/* Image */}
              <div className="relative aspect-square w-full overflow-hidden">
                {hp.imageUrl ? (
                  <img src={hp.imageUrl} alt={hp.name || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-[#22232a] animate-pulse" />
                )}
                {/* Status badge */}
                {hp.poolType === 0 && (
                  <div className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-300 backdrop-blur-sm">
                    ⏳ {Math.round(bondingProg * 100)}%
                  </div>
                )}
                {chg > 0 && (
                  <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 backdrop-blur-sm">
                    +{chg.toFixed(1)}%
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <div className="text-xs font-bold truncate">{hp.name || shortAddr(hp.memeMint.toBase58(), 4)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-[#ffc371] font-mono">
                    <TinyPrice value={hp.price ?? 0} />
                  </span>
                  {perf && perf.currentMultiplier > 0 && (
                    <span className={`text-[10px] font-bold ${perf.currentMultiplier >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtMult(perf.currentMultiplier)}x
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* ══ FILTER TABS + SEARCH + PAGINATION ══ */}
  <div className="mb-4">
    {/* Filter pills — desktop only; mobile has its own tabs inside MobileVerticalStacks */}
    <div className="hidden md:flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
      {([
        { key: 'newest', label: '✨ New', icon: '' },
        { key: 'bonding', label: '🚀 To Market', icon: '' },
        { key: 'gainers', label: '📈 24h Gainers', icon: '' },
        { key: 'marketcap', label: '💰 Top MCap', icon: '' },
      ] as const).map(tab => (
        <button
          key={tab.key}
          onClick={() => { setSortMode(tab.key); setPage(1); }}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            sortMode === tab.key
              ? 'bg-[#ffc371] text-black shadow-lg shadow-[#ffc371]/20'
              : 'bg-[#1a1b25] text-[#8a8fa3] border border-[#2a2b3a] hover:text-white hover:border-[#3a3b4a]'
          }`}
        >
          {tab.label}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Pagination (desktop) */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={pageClamped === 1}
          className="w-8 h-8 rounded-lg bg-[#1a1b25] border border-[#2a2b3a] text-[#8a8fa3] hover:text-white hover:border-[#3a3b4a] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm"
        >‹</button>
        <span className="text-xs text-[#6b7084] tabular-nums px-2">{pageClamped}/{totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={pageClamped === totalPages}
          className="w-8 h-8 rounded-lg bg-[#1a1b25] border border-[#2a2b3a] text-[#8a8fa3] hover:text-white hover:border-[#3a3b4a] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm"
        >›</button>
      </div>
    </div>

    {/* Wallet connect hint */}
    {!wallet.publicKey && !authenticated && (
      <div className="mt-2 rounded-xl border border-[#ffc371]/20 bg-[#ffc371]/5 text-[#ffc371] px-3 py-2 text-xs font-medium">
        Connect your wallet to trade
      </div>
    )}
  </div>



    {/* Global step-progress modal */}
    {txStep && <StepModal {...txStep} />}

    {/* MOBILE — vertical climb stacks with rocket progress */}
<MobileVerticalStacks
  pools={sortedPools}
  onOpen={(p) => { router.push(`/sound-memes/${p.memeMint.toBase58()}`); }}
  onBuy={(p) => handleOpenBuyModal(p)}
  onQuickBuy={(p, quoteRawIn) => handleQuickBuyDirect(p, quoteRawIn)}
  onSell={(p) => handleOpenSellModal(p)}
  onMint={(p) => handleMintNft(p)}                 // NEW
  onBurn={(p) => handleOpenBurn(p)}                // NEW
  onPlay={(id, url) => playDemo(id, url)}          // NEW
  isPlayingFor={(p) => playing === p.pubkey.toBase58()}  // NEW
  tokensUiFor={(p) => {
    const raw = balancesByMint[p.memeMint.toBase58()];
    const d   = p.decimals ?? MEME_DECIMALS;
    return raw === undefined ? NaN : raw / 10 ** d;
  }}                                               // NEW
  mintThresholdFor={(p) => getMintThreshold(p)}    // NEW
  nftCountFor={(p) => ownedCounts[p.memeMint.toBase58()] ?? 0} // NEW
  change24hFor={change24hFor}
  createdAtFor={createdAtFor}
  walletConnected={!!effectivePublicKey}
  creatorRepFor={(mint) => creatorRepByMint[mint]}
  poolPerfLookup={poolPerfByMint}
/>
    {/* DESKTOP/TABLET — existing grid */}
<div className="hidden md:block">
  {/* Card Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {visiblePools.map((pool, i) => {

     // User NFT count for this pool
     const userNftCount = ownedCounts[pool.memeMint.toBase58()] ?? 0;
     const canBurn = nftsLoaded && userNftCount > 0;

     /* ---------- SELL-eligibility ------------------------------------- */
     const mcap    = pool.ammReserves?.woodeng ?? 0;
     const canSell = isAmm(pool);
          // 24h change for badge
     const showPerf = showPerfBadge(pool);
const chg = showPerf ? change24hFor(pool.memeMint.toBase58()) : 0;
const chgAbs = Math.abs(chg).toFixed(2);
const chgUp = chg >= 0;

        return (
          <div
            key={pool.pubkey.toBase58()}
            className="card-shimmer group bg-[#1a1b25] border border-[#2a2b3a] rounded-3xl hover:border-[#ffc371]/30 hover:shadow-2xl hover:shadow-[#ffc371]/8 hover:scale-[1.015] transition-all duration-200 cursor-pointer flex flex-col overflow-hidden relative"
            onClick={() => { router.push(`/sound-memes/${pool.memeMint.toBase58()}`); }}
          >
          
            {/* IMAGE + Overlay */}
<div className="relative aspect-square w-full overflow-hidden rounded-t-2xl isolate">
  {(pool.hydrated || pool.imageUrl) && pool.imageUrl ? (
    <img
      src={pool.imageUrl}
      alt={pool.name || 'Sound meme'}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
    />
  ) : (
    <div className="w-full h-full animate-pulse bg-[#1f2130]" />
  )}

  {/* play/pause overlay */}
  <div className="absolute inset-0 flex items-center justify-center p-2">
    <button
      className="bg-black/70 p-3 rounded-full hover:bg-black/80 transition"
      onClick={(e) => {
        e.stopPropagation();
        playDemo(pool.pubkey.toBase58(), pool.audioUrl);
      }}
      title={playing === pool.pubkey.toBase58() ? 'Pause' : 'Play'}
    >
      {playing === pool.pubkey.toBase58() ? (
        <Pause className="w-6 h-6 text-white" />
      ) : (
        <Play className="w-6 h-6 text-white" />
      )}
    </button>
  </div>

  {/* contract chip + copy (bottom-left) */}
  <div
    className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1
               rounded-md ring-1 ring-white/10 text-[11px] select-text"
  >
    <span className="font-mono">{shortAddr(pool.memeMint.toBase58())}</span>
    <button
      type="button"
      className="p-1 rounded hover:bg-white/10"
      title="Copy contract address"
      onClick={(e) => {
        e.stopPropagation();
        try { navigator.clipboard.writeText(pool.memeMint.toBase58()); } catch {}
        setCopied(pool.memeMint.toBase58());
        setTimeout(() => setCopied(null), 1200);
      }}
    >
      {copied === pool.memeMint.toBase58()
        ? <CheckCircle2 className="w-3.5 h-3.5" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  </div>
</div>



            

            {/* Main Card Info */}
            <div className="flex flex-col flex-1 p-4 min-w-0">

              
              {/* Name (front page) */}
<div className="flex items-center justify-between min-w-0">
  <h3 className="text-base font-semibold truncate min-w-0" title={pool.name ?? ""}>

    {pool.name ?? "Untitled Meme"}
  </h3>
  {pool.programVersion === 'v1' && (
    <span className="shrink-0 ml-1.5 text-[9px] font-bold bg-[#2b323c] text-[#8a8fa3] px-1.5 py-0.5 rounded-full">V1</span>
  )}
</div>

{/* Description */}
<div className="text-[#c2c2c9] text-sm mt-1 line-clamp-2 break-words [overflow-wrap:anywhere] hyphens-manual">

  {pool.description || "No description"}
</div>

              {/* Bonding status + gate badge + creator avg multiplier (desktop) */}
              {(() => {
                const perf = poolPerfByMint[pool.memeMint.toBase58()];
                const rep = creatorRepByMint[pool.memeMint.toBase58()];
                const fmtMult = (m: number) => m >= 1000 ? `${(m/1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1);
                const gated = (pool.minAvgHoldDays ?? 0) > 0;
                const gateTierEmoji = gated ? (() => {
                  const d = pool.minAvgHoldDays ?? 0;
                  if (d >= 360) return '⚡'; if (d >= 180) return '🌌'; if (d >= 90) return '👑';
                  if (d >= 30) return '🚀'; if (d >= 14) return '💎'; if (d >= 7) return '🌀';
                  if (d >= 3) return '💩'; if (d >= 1) return '🐀'; return '🧻';
                })() : null;
                return (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {perf && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        perf.bondingStatus === 'bonding' ? 'bg-blue-500/20 text-blue-300' :
                        perf.bondingStatus === 'bonded' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {perf.bondingStatus === 'bonding' ? '⏳ Bonding' :
                         perf.bondingStatus === 'bonded' ? '✓ Bonded' : '🚀 AMM'}
                      </span>
                    )}
                    {gated && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">
                        🔒 {gateTierEmoji} {pool.minAvgHoldDays}d
                      </span>
                    )}
                    {rep && rep.avgMultiplier > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                        rep.avgMultiplier >= 10 ? 'bg-emerald-500/20 text-emerald-300' :
                        rep.avgMultiplier >= 2 ? 'bg-yellow-500/20 text-yellow-300' :
                        rep.avgMultiplier >= 1 ? 'bg-[#2b323c] text-[#8a8fa3]' : 'bg-red-500/20 text-red-300'
                      }`}>
                        🔥 Avg {fmtMult(rep.avgMultiplier)}x
                      </span>
                    )}
                  </div>
                );
              })()}

              <SocialLinksBar socials={pool.socials} className="mt-2" />
               <div className="mt-3 flex items-center gap-3 min-w-0">
  {/* left side can shrink & truncate */}
  <div className="flex items-baseline gap-2 min-w-0 overflow-hidden flex-1">
    <span className="truncate max-w-[140px] sm:max-w-[180px]">
      <TinyPrice
        value={(pool.poolType === 2 || pool.poolType === 3) ? (pool.price ?? 0) : latestPriceOf(pool.memeMint.toBase58())}
        className="text-[#ffc371] font-bold text-lg"
      />
    </span>
    <span className="text-sm text-[#ffc371]/90 shrink-0">{quoteLabelOf(pool)}</span>
  </div>

  {/* right side never wraps or shrinks */}
  <div className="ml-auto flex items-center gap-2 shrink-0">
    <span className="text-xs bg-[#2b323c] px-2 py-[2px] rounded leading-none
                  whitespace-nowrap truncate max-w-[120px] shrink-0">
      {pool.symbol || "MEME"}
    </span>
    {/* gated badge */}
{showPerf ? (
  <span
    className={`text-[11px] px-2 py-[2px] rounded leading-none whitespace-nowrap shrink-0
      ${chgUp ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}
  >
    {chgUp ? '▲' : '▼'} {chgAbs}%
  </span>
) : (
  <span className="text-[11px] px-2 py-[2px] rounded leading-none whitespace-nowrap shrink-0 bg-[#2b323c] text-[#d6d8ff]">
    NEW
  </span>
)}

  </div>
</div>



{/* Market Cap only — compact */}
{isAmm(pool) && Number(pool.marketCap ?? 0) > 0 && (
  <div className="mt-1 text-xs text-[#adadff]">
    MCap: {Number(pool.marketCap ?? 0).toFixed(2)} {quoteLabelOf(pool)}
    <span className="text-[#9ea1ff]"> (≈ {fmtUSD(Number(pool.marketCap ?? 0) * WOODENG_USD)})</span>
  </div>
)}


              {/* Bonding progress (bonding pools only) */}
{pool.poolType === 0 && <BondingProgressBar pool={pool} />}

{/* ── GRADUATED POOL UI ────────────────────────────── */}
{/* ── GRADUATED POOL UI ────────────────────────────── */}
{isGraduated(pool) && (
  <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">🎓</span>
      <span className="text-sm font-bold text-purple-300">
        {pool.poolType === 3 ? 'Trading on Meteora DAMM v2' : 'Graduated — Awaiting DAMM v2 Pool'}
      </span>
    </div>
    {pool.poolType === 3 ? (
      <a
        href={`/sound-memes/${pool.memeMint.toBase58()}`}
        className="h-10 w-full inline-flex items-center justify-center gap-2 rounded font-semibold text-sm bg-purple-600/80 text-white hover:bg-purple-500 transition"
        onClick={e => e.stopPropagation()}
      >
        <Rocket className="w-4 h-4" /> Trade ${pool.symbol || 'Token'}
      </a>
    ) : pool.poolType === 2 ? (
      <a
        href={`/sound-memes/${pool.memeMint.toBase58()}`}
        className="h-10 w-full inline-flex items-center justify-center gap-2 rounded font-semibold text-sm bg-[#ffc371]/40 text-black/60 hover:bg-[#ffc371]/60 transition"
        onClick={e => e.stopPropagation()}
      >
        <Rocket className="w-4 h-4" /> Open to Create Pool
      </a>
    ) : null}
  </div>
)}

{/* ─────────── Burn & Claim badge only (actions on detail page) ─────────── */}
{nftsLoaded && userNftCount > 0 && !isGraduated(pool) && (
  <div className="mt-2">
    <button
      className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-sm bg-gradient-to-r from-[#ff5656] to-[#ff9a3c] text-white hover:opacity-90 transition"
      onClick={async (e) => {
        e.stopPropagation();
        const lockDict = userPoolNfts[pool.memeMint.toBase58()] ?? {};
        const maybeNfts = Object.entries(lockDict).map(([lockId, data]) => ({
          lockId: Number(lockId),
          mint: new PublicKey(data.mint),
        }));
        const ownedNfts = (
          await Promise.all(
            maybeNfts.map(async (n) =>
              (await stillOwnsNft(n.mint, effectivePublicKey!)) ? n : null
            )
          )
        ).filter(Boolean) as { lockId: number; mint: PublicKey }[];
        if (ownedNfts.length === 0) { setStatus("Already burned."); return; }
        setBurnModal({ pool, nfts: ownedNfts, open: true });
      }}
    >
      🔥 Burn &amp; Claim
      <span className="bg-white/20 rounded px-1.5 py-0.5 text-xs font-black">{userNftCount}</span>
    </button>
  </div>
)}
{false && !isGraduated(pool) && (
<div className="grid grid-cols-2 xl:grid-cols-3 gap-2 mt-2 text-sm font-semibold place-items-stretch">
  {canShowBuy(pool) && (
  <button
        className="h-9 md:h-10 w-full inline-flex items-center justify-center gap-1 px-3 rounded font-semibold leading-none whitespace-nowrap text-[13px] md:text-sm bg-[#907aff] text-white hover:bg-[#37ad71] transition disabled:opacity-40"
    disabled={walletMissing}
    title={walletMissing ? "connect your wallet" : undefined}

    onClick={e => { e.stopPropagation(); handleOpenBuyModal(pool); }}
  >
    Buy
  </button>
  )}

  {/* ► SELL ------------------------------------------------------ */}
<button
  onClick={e => { e.stopPropagation(); handleOpenSellModal(pool); }}
  className="h-9 md:h-10 w-full inline-flex items-center justify-center gap-1 px-3 rounded font-semibold leading-none whitespace-nowrap text-[13px] md:text-sm bg-[#ff5656] text-white hover:bg-[#f8d648] transition disabled:opacity-40"
  disabled={walletMissing}
  title={
    walletMissing
      ? "connect your wallet"
      : (pool.poolType === 0 ? "Bonding sell: 10% tax" : undefined)
  }
>
  {pool.poolType === 0 ? 'Sell (10% tax)' : 'Sell'}
</button>




{/* ► MIGRATE (bonding → AMM) — REMOVED: pools now graduate directly to Meteora DAMM v2 */}

{/* ► GRADUATE (AMM → Meteora DLMM) — only for v2 pools */}
{isAmm(pool) && pool.programVersion === 'v2' && wallet.publicKey && (
  <button
    className="h-9 md:h-10 w-full col-span-2 inline-flex items-center justify-center gap-1 px-3 rounded font-semibold leading-none whitespace-nowrap text-[13px] md:text-sm bg-purple-600 text-white hover:bg-purple-500 transition"
    onClick={async (e) => {
      e.stopPropagation();
      try { await graduatePool(pool); }
      catch (err: any) {
        setTxStep(null);
        if (!isUserRejectError(err)) setStatus(`Graduate failed: ${err?.message || err}`);
      }
    }}
  >
    🎓 Graduate&nbsp;to&nbsp;Meteora
  </button>
)}




  {/* ► MINT NFT -------------------------------------------------- */}
  <button
     className="h-9 md:h-10 w-full inline-flex items-center justify-center gap-1 px-3 rounded font-semibold leading-none whitespace-nowrap text-[13px] md:text-sm bg-[#907aff] text-white hover:bg-[#a593ff] transition disabled:opacity-40"
    disabled={walletMissing || !!txStep || userMemeTokens(pool) < getMintThreshold(pool)}
    title={walletMissing ? "connect your wallet" : undefined}
    onClick={e => { e.stopPropagation(); handleMintNft(pool); }}
  >
    <Pickaxe className="w-4 h-4" />
    Mint&nbsp;NFT
  </button>

  {/* ► BURN NFT -------------------------------------------------- */}
<button
  className="
    h-10 md:h-11 w-full
    col-span-2 sm:col-span-1 lg:col-span-2
    inline-flex items-center justify-between gap-2
    rounded px-3 md:px-4 font-semibold
    text-[12px] md:text-sm bg-[#ff5656] text-white
    hover:bg-[#ff7373] transition disabled:opacity-40
  "
   disabled={walletMissing || !canBurn}
  title={
    walletMissing
      ? 'connect your wallet'
      : canBurn
        ? 'Burn your NFT to unlock tokens'
        : 'No NFTs to burn'
  }
  onClick={async (e) => {
    e.stopPropagation();
    if (!canBurn) return;

    // ① raw list from lockers
    const lockDict = userPoolNfts[pool.memeMint.toBase58()] ?? {};
    const maybeNfts = Object.entries(lockDict).map(([lockId, data]) => ({
      lockId: Number(lockId),
      mint: new PublicKey(data.mint),
    }));

    // ② keep only NFTs still owned
    const ownedNfts = (
      await Promise.all(
        maybeNfts.map(async (n) =>
          (await stillOwnsNft(n.mint, effectivePublicKey!)) ? n : null
        )
      )
    ).filter(Boolean) as { lockId: number; mint: PublicKey }[];

    if (ownedNfts.length === 0) {
      setStatus("Looks like you’ve already burned every NFT for this meme.");
      return;
    }

    // ③ open modal with filtered list
    setBurnModal({ pool, nfts: ownedNfts, open: true });
  }}
>
       {/* left: icon + label */}
  <span className="inline-flex items-center gap-2 shrink-0">
    <span className="text-base leading-none" role="img" aria-label="burn">🔥</span>
    <span className="leading-none">Burn&nbsp;NFT</span>
  </span>

  {/* right: badge — only when loaded AND count ≥ 1 */}
  {nftsLoaded && userNftCount > 0 && (
    <span className="shrink-0 tabular-nums text-xs font-semibold leading-none
                     bg-white/10 rounded px-2 py-[2px] min-w-[30px] text-center">
      ({userNftCount})
    </span>
  )}
</button>


</div>
)}
              {/* Mint NFT button — only when user has enough tokens */}
              {!walletMissing && !isGraduated(pool) && Number.isFinite(userMemeTokens(pool)) && userMemeTokens(pool) >= getMintThreshold(pool) && (
                <div className="mt-2">
                  <button
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-sm bg-gradient-to-r from-[#907aff] to-[#6c47e2] text-white hover:opacity-90 transition"
                    onClick={e => { e.stopPropagation(); handleMintNft(pool); }}
                  >
                    🎨 Mint NFT
                  </button>
                </div>
              )}
              </div>
              {/* wallet hint just under actions on each card */}
              {walletMissing && (
                <div className="px-4 pb-3 -mt-2 text-[11px] text-[#f8c286]">connect your wallet</div>
              )}
              <div className="mt-2">
                {
  (() => {
    const current  = userMemeTokens(pool);
    const required = getMintThreshold(pool);

    if (Number.isNaN(current)) {
      // waiting for RPC – grey placeholder bar
      return <div className="w-11/12 h-4 bg-[#2b2b37] rounded animate-pulse" />;
    }

    return (
      <ProgressBar current={current} total={required} />
    );
  })()
}

                {userMemeTokens(pool) < getMintThreshold(pool) && (
  <div className="w-11/12 mx-auto mt-1 text-[11px] text-center text-[#f8c286]">
    Need {(Math.max(0, getMintThreshold(pool) - userMemeTokens(pool))).toLocaleString(
      undefined, { maximumFractionDigits: pool.decimals ?? 0 }
    )} more tokens to mint NFT
  </div>
)}

              </div>
            </div>
        );
      })}
    </div>
    </div>


{showBuyModal && selectedPool && (() => {
  const DEC = selectedPool.decimals ?? MEME_DECIMALS;

  // quote balances for this pool (WOODENG or SOL)
  const quoteMintStr = selectedPool.quoteMint.toBase58();
  const quoteBalRaw  = quoteBalancesRaw[quoteMintStr] ?? 0;
  const quoteBalUi   = quoteBalRaw / 10 ** QUOTE_DECIMALS;
  const quoteLabel   = quoteLabelOf(selectedPool);

  // user's current MEME balance (for display)
  const memeBalRaw = balancesByMint[selectedPool.memeMint.toBase58()] ?? 0;
  const memeBalUi  = memeBalRaw / 10 ** DEC;

  // how many MEME are left on bonding before migration (∞ on AMM)
  const tokensLeft = selectedPool.poolType === 0
    ? Math.max(0, tokensUntilAmm(selectedPool))
    : Infinity;

  // % chips: spend a portion of quote balance and solve for MEME out
  const setQuickBuyPct = (pct: number | "MAX") => {
    // keep a tiny SOL buffer when the quote is SOL
    const safety = quoteIsSol(selectedPool) ? 5_000 : 0; // lamports
    const budgetRaw = pct === "MAX"
      ? Math.max(0, quoteBalRaw - safety)
      : Math.floor(quoteBalRaw * pct);

    if (budgetRaw <= 0) return setModalTokensToBuy("");

    let amtUi = memeOutForWoodengIn(selectedPool, budgetRaw);
    if (Number.isFinite(tokensLeft)) amtUi = Math.min(amtUi, tokensLeft as number);

    const floored = Math.floor(amtUi * 10 ** DEC) / 10 ** DEC;
    setModalTokensToBuy(DEC === 0 ? String(Math.floor(floored)) : String(floored));
  };

  const maxUi = Number.isFinite(tokensLeft) ? (tokensLeft as number) : undefined;

  return (
    <div
  className="
    fixed inset-0 z-[2000] bg-black/70
    flex items-center justify-center
    p-4
  "
  onClick={() => setShowBuyModal(false)}
>

  <div
    className="
      bg-[#181920] rounded-2xl w-[min(92vw,420px)] p-4 sm:p-6 shadow-2xl
      flex flex-col items-center relative overflow-y-auto
      max-h-[calc(100dvh-var(--app-header-h,72px)-24px-env(safe-area-inset-top))]
    "
    onClick={e => e.stopPropagation()}
  >
        <button className="absolute top-4 right-4" onClick={() => setShowBuyModal(false)}>
          <X />
        </button>

        <h2 className="text-xl font-bold mb-2">Buy {selectedPool.symbol}</h2>
        <img
  src={selectedPool.imageUrl}
  className="w-24 h-24 rounded-xl mb-3"
  alt={selectedPool.name || 'meme'}
  loading="lazy"
  decoding="async"
  sizes="(max-width: 480px) 96px, 128px"
/>
        <span className="text-[#c2c2c9] mb-3">{selectedPool.name}</span>

        <div className="flex flex-col gap-2 w-full">
          <label className="flex items-center justify-between">
            <span>Amount to buy:</span>
          </label>

          <div className="text-xs text-[#aab] -mt-1">
            Balance:&nbsp;
            <span className="text-white font-medium">
              {memeBalUi.toLocaleString(undefined, { maximumFractionDigits: DEC })}
            </span>
            &nbsp;{selectedPool.symbol}
          </div>

          <div className="text-[11px] text-[#8ea] -mt-0.5">
            {quoteLabel} Balance:&nbsp;
            <span className="text-white/90">
              {quoteBalUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
          </div>

          <input
  type="number"
  inputMode="decimal"
  autoComplete="off"
  className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full text-base"
  placeholder="0"
  value={modalTokensToBuy}
  onChange={e => setModalTokensToBuy(e.target.value)}
  step={(selectedPool.decimals ?? MEME_DECIMALS) === 0 ? 1 : 'any'}
  min={(selectedPool.decimals ?? MEME_DECIMALS) === 0 ? 1 : 0}
/>


          <div className="grid grid-cols-4 gap-2 w-full">
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickBuyPct(0.10)}
              disabled={quoteBalRaw <= 0 || tokensLeft === 0}
              title={`Spend 10% of ${quoteLabel}`}
            >
              10%
            </button>
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickBuyPct(0.25)}
              disabled={quoteBalRaw <= 0 || tokensLeft === 0}
              title={`Spend 25% of ${quoteLabel}`}
            >
              25%
            </button>
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickBuyPct(0.50)}
              disabled={quoteBalRaw <= 0 || tokensLeft === 0}
              title={`Spend 50% of ${quoteLabel}`}
            >
              50%
            </button>
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickBuyPct("MAX")}
              disabled={quoteBalRaw <= 0 || tokensLeft === 0}
              title={`Spend almost all ${quoteLabel}`}
            >
              MAX
            </button>
          </div>

          {Number.isFinite(tokensLeft) && (
            <p className="text-xs text-[#f0eaff] mt-1">
              {Math.max(0, tokensLeft as number).toLocaleString()} {selectedPool.symbol} left before migration
            </p>
          )}

          <span className="text-sm text-[#d7bb7a]">
  Total:&nbsp;
  {(() => {
    const raw = getQuoteForMemeBuy(selectedPool, Number(modalTokensToBuy));
    return Number.isFinite(raw) ? (raw / 10 ** QUOTE_DECIMALS).toFixed(5) : '—';
  })()} {quoteLabel}
</span>
        </div>

        <div className="flex flex-col gap-2 w-full mt-2">
          <label>Slippage tolerance (%)</label>
          <input
            type="number"
            className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
            value={slippage}
            onChange={e => setSlippage(Number(e.target.value))}
            min={0.1}
          />
        </div>

        <button
          className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded"
          onClick={handleConfirmBuy}
          disabled={
            !modalTokensToBuy ||
            Number.isNaN(getQuoteForMemeBuy(selectedPool, Number(modalTokensToBuy))) ||
            transactionStatus === 'processing' ||
            tokensLeft === 0 ||
            buyingRef.current          // ← add this
          }
        >
          {transactionStatus === 'processing' ? 'Processing…' : 'Confirm Buy'}
        </button>

        {transactionStatus === 'success' && (
          <div className="text-green-400 mt-2">{transactionMessage}</div>
        )}
        {transactionStatus === 'error' && (
          <div className="text-red-400 mt-2">{transactionMessage}</div>
        )}
      </div>
    </div>
  );
})()}




    {/* SELL MODAL */}
{showSellModal && selectedPool && (() => {
  const DEC    = selectedPool.decimals ?? MEME_DECIMALS;
  const balRaw = balancesByMint[selectedPool.memeMint.toBase58()] ?? 0;
  const balUi  = balRaw / 10 ** DEC;
  const step   = DEC > 0 ? "any" : 1;

  // % quick buttons (10/25/50/MAX)
  const setQuickSellPct = (pct: number | "MAX") => {
    let targetUi =
      pct === "MAX" ? balUi : Math.max(0, Math.min(balUi, balUi * pct));
    // floor to decimals
    const floored = Math.floor(targetUi * 10 ** DEC) / 10 ** DEC;
    setModalTokensToSell(DEC === 0 ? String(Math.floor(floored)) : String(floored));
  };

  const amountUi = Number(modalTokensToSell || 0);
  const overBal  = amountUi > balUi || amountUi <= 0;

  // live receive preview
  const rawIn  = Math.floor(amountUi * 10 ** DEC);
  const wood   = getQuoteForMemeSell(selectedPool, rawIn);
  const woodUi = wood / 10 ** QUOTE_DECIMALS;
  const quoteLabel = quoteLabelOf(selectedPool);


  return (
   <div
  className="
    fixed inset-0 z-[2000] bg-black/70
    flex items-center justify-center
    p-4
  "
  onClick={() => setShowSellModal(false)}
>

  <div
  className="
    bg-[#181920] rounded-2xl w-[min(92vw,420px)] p-4 sm:p-6 shadow-2xl
    flex flex-col items-center relative overflow-y-auto
    max-h-[calc(100dvh-var(--app-header-h,72px)-24px-env(safe-area-inset-top))]
  "
  onClick={e => e.stopPropagation()}
>

  {selectedPool.poolType === 0 && (
  <div className="w-full mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 px-3 py-2 text-sm">
    Bonding sell: a 10% tax is applied to the amount you receive.
  </div>
)}


        <button className="absolute top-4 right-4" onClick={() => setShowSellModal(false)}>
          <X />
        </button>

        <h2 className="text-xl font-bold mb-2">Sell {selectedPool.symbol}</h2>
         <img
  src={selectedPool.imageUrl}
  className="w-24 h-24 rounded-xl mb-3"
  alt={selectedPool.name || 'meme'}
  loading="lazy"
  decoding="async"
  sizes="(max-width: 480px) 96px, 128px"
/>
        <span className="text-[#c2c2c9] mb-3">{selectedPool.name}</span>

        <div className="flex flex-col gap-2 w-full">
          <label className="flex items-center justify-between">
            <span>Amount to sell:</span>
          </label>

          {/* balance under the label */}
          <div className="text-xs text-[#aab] mb-1">
            Balance:&nbsp;
            <span className="text-white font-medium">
              {balUi.toLocaleString(undefined, { maximumFractionDigits: DEC })}
            </span>&nbsp;{selectedPool.symbol}
          </div>

          <input
  type="number"
  inputMode="decimal"
  autoComplete="off"
  step={step as any}
  className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full text-base"
  placeholder="0"
  value={modalTokensToSell}
  onChange={e => setModalTokensToSell(e.target.value)}
  min={DEC === 0 ? 1 : 0}
  max={balUi}
/>


          {/* % quick chips 10 / 25 / 50 / MAX */}
          <div className="grid grid-cols-4 gap-2 w-full">
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickSellPct(0.10)}
              disabled={balUi <= 0}
            >
              10%
            </button>
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickSellPct(0.25)}
              disabled={balUi <= 0}
            >
              25%
            </button>
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickSellPct(0.50)}
              disabled={balUi <= 0}
            >
              50%
            </button>
            <button
              className="text-xs bg-[#262635] hover:bg-[#2c2c3d] rounded px-2 py-1"
              onClick={() => setQuickSellPct("MAX")}
              disabled={balUi <= 0}
            >
              MAX
            </button>
          </div>

          <span className="text-sm text-[#d7bb7a]">
  Receive: {Number.isFinite(woodUi) ? woodUi.toFixed(5) : '0.00000'} {quoteLabel}
</span>

        </div>

        <div className="flex flex-col gap-2 w-full mt-2">
          <label>Slippage tolerance (%)</label>
          <input
            type="number"
            className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
            value={slippage}
            onChange={e => setSlippage(Number(e.target.value))}
            min={0.1}
            max={50}
          />
        </div>

        <button
          className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded disabled:opacity-50"
          onClick={handleConfirmSell}
          disabled={!modalTokensToSell || transactionStatus === 'processing' ||overBal ||
  sellingRef.current         // ← add this
}
          title={overBal ? 'Amount exceeds balance' : undefined}
        >
          {transactionStatus === 'processing' ? 'Processing...' : 'Confirm Sell'}
        </button>

        {transactionStatus === 'success' && <div className="text-green-400 mt-2">{transactionMessage}</div>}
        {transactionStatus === 'error'   && <div className="text-red-400 mt-2">{transactionMessage}</div>}
      </div>
    </div>
  );
})()}



    {/* BUY-FILLED MODAL */}
{buyFilled.open && (
  <div className="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button
        className="absolute top-5 right-5"
        onClick={() => setBuyFilled(b => ({ ...b, open: false }))}
      >
        <X />
      </button>

      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Purchase confirmed!</h2>

      <p className="text-[#c2c2c9] mb-4">
        You bought&nbsp;
        <span className="font-semibold">{buyFilled.amountMeme}</span>&nbsp;
        {buyFilled.symbol}&nbsp;for&nbsp;
        <span className="font-semibold">
          {buyFilled.priceWoodeng.toFixed(5)} {buyFilled.quoteLabel ?? 'WOODENG'}
        </span>.
      </p>

      <button
        onClick={() => setBuyFilled(b => ({ ...b, open: false }))}
        className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
      >
        Close
      </button>
    </div>
  </div>
)}


{sellFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button className="absolute top-5 right-5" onClick={() => setSellFilled(s => ({...s,open:false}))}><X/></button>
      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4"/>
      <h2 className="text-xl font-bold mb-2">Sale confirmed!</h2>
      <p className="text-[#c2c2c9] mb-4">
        You sold&nbsp;
        <span className="font-semibold">{sellFilled.amountMeme}</span>&nbsp;
        {sellFilled.symbol}&nbsp;for&nbsp;
        <span className="font-semibold">
          {sellFilled.priceWoodeng.toFixed(5)} {sellFilled.quoteLabel ?? 'WOODENG'}
        </span>.
      </p>
      <button className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
              onClick={() => setSellFilled(s => ({...s,open:false}))}>
        Close
      </button>
    </div>
  </div>
)}

{mintFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button
        className="absolute top-5 right-5"
        onClick={() => setMintFilled(m => ({ ...m, open: false }))}>
        <X />
      </button>

      {/* ✔️ green tick */}
      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />

      <h2 className="text-xl font-bold mb-2">Tokens locked!</h2>

      <p className="text-[#c2c2c9] mb-4">
        You locked&nbsp;
        <span className="font-semibold">{selectedPool ? getMintThreshold(selectedPool) : 0}
</span>
        &nbsp;{mintFilled.symbol} and minted locker&nbsp;#
        <span className="font-semibold">{mintFilled.lockId}</span>.
      </p>

      <button
        className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
        onClick={() => setMintFilled(m => ({ ...m, open: false }))}>
        Close
      </button>
    </div>
  </div>
)}



{burnFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button
        className="absolute top-5 right-5"
        onClick={() => setBurnFilled(b => ({ ...b, open: false }))}>
        <X />
      </button>

      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Tokens unlocked!</h2>

      <p className="text-[#c2c2c9] mb-4">
        You burned an&nbsp;
        <span className="font-semibold">{burnFilled.symbol}</span>
        &nbsp;NFT and received&nbsp;
        <span className="font-semibold">
          {burnFilled.amountUnlocked.toLocaleString()}
        </span>
        &nbsp;{burnFilled.symbol} back.
      </p>

      <button
        className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
        onClick={() => setBurnFilled(b => ({ ...b, open: false }))}>
        Close
      </button>
    </div>
  </div>
)}





    {/* BURN MODAL */}
{burnModal.open && burnModal.pool && (
  <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
     <div className="bg-[#23232e] rounded-2xl p-4 sm:p-6 w-[min(92vw,520px)] max-h-[85vh] overflow-y-auto relative">
      <button
        className="absolute top-4 right-4"
        onClick={() => setBurnModal(m => ({ ...m, open: false }))}>
        <X />
      </button>

      <h2 className="text-xl font-bold mb-4">Select NFT to Burn</h2>

      <div className="flex flex-col gap-3">
        {burnModal.nfts.map(({ lockId, mint }) => (
          <button
            key={lockId}
            className="flex items-center gap-3 p-3 bg-[#181920] rounded-xl hover:bg-[#291a22]"
            onClick={async () => {
              // close picker
              setBurnModal(m => ({ ...m, open: false }));
              // burn & unlock
              await unlockTokens(
                burnModal.pool!,
                mint,
                lockId,
                refreshUserNfts
              );
              
            }}>
            <div className="w-10 h-10 rounded bg-[#2b2b37] flex items-center justify-center text-xs">
              #{lockId}
            </div>
            <div className="break-all text-xs text-[#adadff]">{mint.toBase58()}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
)}


{/* Pool Detail Modal */}
{showDetail && detailPool && (() => {
  const mintKey = detailPool.memeMint.toBase58();



// ticks = merged (persisted + live) price points for this mint
const ticks = mergedSeries(mintKey);

const serverUi = (serverCandles[mintKey]?.[selectedTimeRange] ?? []).map((b: any) => ({
  t: Number(b.t), o: Number(b.o), h: Number(b.h), l: Number(b.l), c: Number(b.c),
})).filter(b =>
  Number.isFinite(b.t) && Number.isFinite(b.o) &&
  Number.isFinite(b.h) && Number.isFinite(b.l) && Number.isFinite(b.c)
);
let candles = serverUi.length ? serverUi : buildCandles(mintKey, selectedTimeRange);



  const bucketMs = TF_MS[selectedTimeRange];

  // merge live tick into the correct bucket
if (ticks.length) {
  const lastTick = ticks[ticks.length - 1];
  const tBucket  = bucketStart(lastTick.time, selectedTimeRange);

  if (!candles.length) {
    // first candle in range opens at the first trade
    const p = lastTick.price;
    candles = [{ t: tBucket, o: p, h: p, l: p, c: p }];
  } else {
    const last = candles[candles.length - 1];

    if (last.t === tBucket) {
      // update current (open stays the very first trade of the bucket)
      const o = last.o;
      const h = Math.max(last.h, lastTick.price);
      const l = Math.min(last.l, lastTick.price);
      const c = lastTick.price;
      candles[candles.length - 1] = { t: last.t, o, h, l, c };
    } else if (tBucket > last.t) {
      // first trade of a *new* bucket: OPEN MUST BE THIS TRADE (not prev close)
      const p = lastTick.price;
      candles.push({ t: tBucket, o: p, h: p, l: p, c: p });
    }
    // if tBucket < last.t, ignore out-of-order tick
  }
}


  // time-gap fill up to "now"
  if (candles.length) {
    const nowBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
    while (candles[candles.length - 1].t + bucketMs <= nowBucket) {
      const c0 = candles[candles.length - 1].c;
      const t  = candles[candles.length - 1].t + bucketMs;
      candles.push({ t, o: c0, h: c0, l: c0, c: c0 });
    }
  }

  // volume as "number of ticks per bucket"
  const volMap = new Map<number, number>();
  for (const pt of ticks) {
    const b = bucketStart(pt.time, selectedTimeRange);
    volMap.set(b, (volMap.get(b) ?? 0) + 1);
  }
  const volume = candles.map(b => ({ t: b.t, v: volMap.get(b.t) ?? 0, up: b.c >= b.o }));

// Use the last CLOSED bar if available (more stable across reloads)
const EPS = 1e-12;
const active = candles[candles.length - 1];
const closed = candles.length >= 2 ? candles[candles.length - 2] : active;
const basePct = (closed && Number.isFinite(closed.o) && Math.abs(closed.o) > EPS)
  ? ((closed.c - closed.o) / closed.o) * 100
  : 0;


  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#23232e] p-6 rounded-2xl max-w-lg w-full relative overflow-hidden">
        <button className="absolute top-4 right-4" onClick={() => setShowDetail(false)}><X /></button>

        {/* header */}
        <div className="flex gap-5 mb-4 items-start flex-wrap">
  <img
    src={detailPool.imageUrl}
    alt={detailPool.name || 'meme'}
    className="w-20 h-20 rounded-xl shrink-0"
    loading="lazy"
    decoding="async"
    sizes="(max-width: 480px) 80px, 96px"
  />
  <div className="min-w-0 flex-1">
    <h2 className="text-2xl font-bold mb-1 truncate" title={detailPool.name || ''}>
      {detailPool.name}
    </h2>
    <div className="text-sm text-[#aab] leading-snug break-words">
      {detailPool.description}
    </div>

    <SocialLinksBar
      socials={detailPool.socials}
      className="mt-2 flex flex-wrap gap-2"
    />

    <div className="flex items-center gap-2 mt-2">
      <span className="text-[#ffc371] font-bold whitespace-nowrap">
        <TinyPrice value={Number(detailPool.price ?? 0)} /> {quoteLabelOf(detailPool)}
      </span>
      <span className="bg-[#2b323c] text-xs px-2 py-1 rounded whitespace-nowrap">
        {detailPool.symbol}
      </span>
    </div>
  </div>
</div>


        {/* timeframe buttons */}
        <div className="flex gap-2 mt-4 mb-2">
          {(['15m','30m','1h','4h','24h'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              className={`text-xs px-2 py-1 rounded ${selectedTimeRange === tf ? 'bg-[#ffc371] text-black' : 'bg-[#262635] text-white'}`}
              onClick={() => setSelectedTimeRange(tf)}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* chart */}
        <div className="relative w-full h-56 sm:h-64 md:h-72 bg-[#141419] rounded-xl overflow-hidden">
          {candles.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6">
              <div className="text-sm text-[#8d92a8] leading-relaxed">
                Chart data will appear after the first trade.
                <br />
                Price: <TinyPrice value={Number(detailPool.price ?? 0)} /> {quoteLabelOf(detailPool)}
              </div>
            </div>
          ) : (
            <>
              <div className="absolute inset-0">
                <CandleChart
                  key={selectedTimeRange}
                  data={candles.map(b => ({
                    t: b.t,
                    o: b.o,
                    h: b.h,
                    l: b.l,
                    c: b.c,
                  }))}
                  volume={volume.map(b => ({
                    t:  b.t,
                    v:  b.v,
                    up: b.up,
                  }))}
                  onBarHover={({ pct }) => setHoverDeltaPct(pct)}
                />
              </div>
              <div
                className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-semibold ${
                  ((hoverDeltaPct ?? basePct) >= 0) ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'
                }`}
              >
                {selectedTimeRange.toUpperCase()} {((hoverDeltaPct ?? basePct) >= 0 ? '+' : '')}{((hoverDeltaPct ?? basePct) || 0).toFixed(2)}%
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
})()}



  </div>
)}