//C:\Users\burgu\woodeng-next\app\sound-memes\SOUNDMEMESClient.tsx

'use client';


export const dynamic = 'force-dynamic'; 
import poolIdlJson from '../../idl/my_sound_meme_pool.json';
import lockerIdlJson from '../../idl/hybrid_meme_coin_nft_locker.json';
import stakingIdlJson from '../../idl/woodeng_staking.json';

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair,
  ComputeBudgetProgram, TransactionInstruction, SendTransactionError
} from "@solana/web3.js";

import { useWallet } from "@solana/wallet-adapter-react";
import type { Idl } from "@project-serum/anchor";
import { Program, AnchorProvider, BN } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction
} from "@solana/spl-token";

import {
  Play, Pause, Loader2, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertCircle, Info, X, Pickaxe, Copy
} from "lucide-react";





import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Metaplex } from "@metaplex-foundation/js";
import { getLockerPda } from "@/lib/sound-memes";


import { getMint, NATIVE_MINT, createSyncNativeInstruction, createCloseAccountInstruction } from "@solana/spl-token";

import { Rocket } from "lucide-react";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";

import NextDynamic from 'next/dynamic';


import { Globe, Send, Twitter } from 'lucide-react';
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";


import bs58 from "bs58";
import { BorshAccountsCoder } from "@project-serum/anchor";

// at the top with other next/navigation imports
import { useSearchParams, usePathname } from "next/navigation";




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


const isAmm = (p: { poolType: 0 | 1 }) => p.poolType === 1;


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


// ADD props for buy/sell to MiniVerticalCard
function MiniVerticalCard({
  pool,
  rank,
  onOpen,
  change24h,
  onBuy,
  onSell,
  onMint,
  onBurn,
  onPlay,
  isPlaying,
  tokensUiOwned,
  mintThreshold,
  nftCount,
  active = false,
}: {
  pool: PoolType;
  rank: number;
  onOpen: (p: PoolType) => void;
  change24h: number;
  onBuy: (p: PoolType) => void;
  onSell: (p: PoolType) => void;
  onMint: (p: PoolType) => void;                  // NEW
  onBurn: (p: PoolType) => void;                  // NEW
  onPlay: (id: string, url?: string) => void;     // NEW (plays audio)
  isPlaying: boolean;                             // NEW
  tokensUiOwned: number;                          // NEW
  mintThreshold: number;                          // NEW
  nftCount: number;                               // NEW
  active?: boolean;
}) {
  const up = change24h >= 0;
  

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
          active:scale-[0.995]"

>
  {/* header ABOVE the image */}
  <div className="p-5 pb-3">
    <div className="font-semibold truncate">{pool.name || 'Untitled Meme'}</div>

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
    <div className="absolute top-2 left-2 text-[11px] bg-black/60 px-2 py-0.5 rounded">{`#${rank}`}</div>
    <div className="absolute top-2 right-2 text-[11px] bg-black/60 px-2 py-0.5 rounded">{pool.symbol ?? 'MEME'}</div>

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

{/* Sticky actions footer */}
<div
  className="
    sticky bottom-0 left-0 right-0 z-10 -mx-5 px-5
    pt-2 pb-[max(env(safe-area-inset-bottom),12px)]
    bg-gradient-to-t from-[#22232a] to-[#22232a]/0
    backdrop-blur-[2px]
  "
  onClick={(e) => e.stopPropagation()}
>
  <div className="grid grid-cols-2 gap-2">
    {/* Buy */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onBuy(pool); }}
      className="h-10 w-full inline-flex items-center justify-center rounded px-3 text-[13px] font-semibold bg-[#ffc371] text-black"
    >
      Buy
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

    

    {/* socials */}
    <SocialLinksBar socials={pool.socials} className="mt-2" />
  </div>
</div>

  );
}



function MobileVerticalSection({
  title,
  itemsBestFirst,
  onOpen,
  onBuy,
  onSell,
  onMint,
  onBurn,
  onPlay,
  isPlayingFor,
  tokensUiFor,
  mintThresholdFor,
  nftCountFor,
  change24hFor,
}: {
  title: string;
  itemsBestFirst: PoolType[];
  onOpen: (p: PoolType) => void;
  onBuy: (p: PoolType) => void;
  onSell: (p: PoolType) => void;
  onMint: (p: PoolType) => void;
  onBurn: (p: PoolType) => void;
  onPlay: (id: string, url?: string) => void;
  isPlayingFor: (p: PoolType) => boolean;
  tokensUiFor: (p: PoolType) => number;
  mintThresholdFor: (p: PoolType) => number;
  nftCountFor: (p: PoolType) => number;
  change24hFor: (mint: string) => number;
})
 {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [progress, setProgress] = React.useState(0); // 0..1 bottom→top
  const [activeIdx, setActiveIdx] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);


  // decorate cards based on distance to viewport center
  const applyDecorations = React.useCallback(() => {
  const el = scrollRef.current;
  if (!el) return;

  const mid = el.getBoundingClientRect().top + el.clientHeight / 2;
  let best = -1, bestDist = Infinity;

  cardRefs.current.forEach((c, i) => {
    if (!c) return;
    const r = c.getBoundingClientRect();
    const center = r.top + r.height / 2;
    const d = Math.abs(center - mid);

    if (d < bestDist) { bestDist = d; best = i; }

    const t = Math.min(1, d / (el.clientHeight * 0.6));
    c.style.transform  = `scale(${0.92 + (1 - t) * 0.08}) translateY(${(t * 20).toFixed(1)}px)`;
    c.style.opacity    = `${0.6 + (1 - t) * 0.4}`;
    c.style.zIndex     = `${1000 - Math.round(d)}`;
    // ❌ no blur on iOS (causes jank)
    c.style.transition = 'transform 180ms ease, opacity 180ms ease';
    c.style.willChange = 'transform, opacity';
  });

  if (best !== -1) setActiveIdx(best);
}, []);

const scheduleDecorations = React.useCallback(() => {
  if (rafRef.current != null) return;                 // already queued
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    applyDecorations();                               // read+write once per frame
  });
}, [applyDecorations]);


  React.useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = 0;
    setProgress(0);
    scheduleDecorations();
  });
}, [itemsBestFirst, scheduleDecorations]);




  const onScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
  const el = e.currentTarget;
  const max = Math.max(1, el.scrollHeight - el.clientHeight);
  const pct = el.scrollTop / max;
  setProgress(Math.min(1, Math.max(0, pct)));
  scheduleDecorations();                          // ← coalesced behind rAF
}, [scheduleDecorations]);


React.useEffect(() => {
  return () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
}, []);



  // subtract your app header + safe-area bottom so nothing hides behind them
 const railH = 'calc(100svh - var(--app-header-h,72px) - max(16px, env(safe-area-inset-bottom)))'

  return (
    <section className="md:hidden">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">{title}</h2>
      </div>

      <div className="relative">
        

        <div className="relative">
  

  {/* slider */}
   <div
  ref={scrollRef}
  onScroll={onScroll}
  className="no-scrollbar px-4 pr-[48px] snap-y snap-proximity overflow-y-auto overscroll-y-none touch-pan-y
             pb-[max(env(safe-area-inset-bottom),16px)] scroll-pt-3 scroll-pb-3
             min-h-0"     // ⬅️ add this

  style={{
  height: railH,
  WebkitOverflowScrolling: 'touch',
  scrollPaddingTop: 'calc(var(--app-header-h,72px) + 8px)',
  scrollPaddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  scrollSnapStop: 'always' // ⟵ prevents “fly-past” to next card on iOS
}}

>



    {itemsBestFirst.map((p, i) => (
      // slide item wrapper
<div
  key={p.pubkey.toBase58()}
  ref={(el) => { cardRefs.current[i] = el; }}
  className="h-[calc(100svh-var(--app-header-h,72px)-max(16px,env(safe-area-inset-bottom)))]
             min-h-[calc(100svh-var(--app-header-h,72px)-max(16px,env(safe-area-inset-bottom)))]
             flex-none snap-start
             min-h-0"                    // ⬅️ add this
  style={{
    willChange: 'transform, opacity',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
    contain: 'layout paint',
  }}
>
  {/* INNER SCROLLER */}
  <div
    className="h-full overflow-y-auto overscroll-y-contain touch-pan-y no-scrollbar"
    style={{
      WebkitOverflowScrolling: 'touch',
      paddingBottom: 'max(52px, calc(env(safe-area-inset-bottom) + 20px))', // ⬅️ was 24px
      scrollbarGutter: 'stable'
    }}
  >
    

    <MiniVerticalCard
      pool={p}
      rank={i + 1}
      onOpen={onOpen}
      onBuy={onBuy}
      onSell={onSell}
      onMint={onMint}
      onBurn={onBurn}
      onPlay={(id, url) => onPlay(id, url)}
      isPlaying={isPlayingFor(p)}
      tokensUiOwned={tokensUiFor(p)}
      mintThreshold={mintThresholdFor(p)}
      nftCount={nftCountFor(p)}
      change24h={change24hFor(p.memeMint.toBase58())}
      active={i === activeIdx}
    />
  </div>
</div>

    ))}
  </div>
</div>
</div> {/* close the outer .relative */}
    </section>
  );
}


function MobileVerticalStacks({
  pools,
  onOpen,
  onBuy,
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
}: {
  pools: PoolType[];
  onOpen: (p: PoolType) => void;
  onBuy: (p: PoolType) => void;
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
})
{

  type Mode = 'gainers' | 'marketcap' | 'newest';
  const [mode, setMode] = React.useState<Mode>('marketcap'); // faster first paint





  useEffect(() => {
  const applyHash = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#','');
    if (h === 'top-gainers') setMode('gainers');
    if (h === 'top-marketcap') setMode('marketcap');
    if (h === 'newest') setMode('newest');
  };
  applyHash();
  window.addEventListener('hashchange', applyHash);
  return () => window.removeEventListener('hashchange', applyHash);
}, []);


  const topMcap = React.useMemo(
    () => [...pools].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
    [pools]
  );
  const topGainers = React.useMemo(
    () => [...pools].sort(
      (a, b) => change24hFor(b.memeMint.toBase58()) - change24hFor(a.memeMint.toBase58())
    ),
    [pools, change24hFor]
  );




  





  const newest = React.useMemo(() => {
  return [...pools].sort((a, b) => {
    const ta = createdAtFor(a.memeMint.toBase58()) || 0;
    const tb = createdAtFor(b.memeMint.toBase58()) || 0;
    if (tb !== ta) return tb - ta;
    // tie-breakers to keep order stable
    const ma = a.marketCap ?? 0, mb = b.marketCap ?? 0;
    if (mb !== ma) return mb - ma;
    return a.memeMint.toBase58().localeCompare(b.memeMint.toBase58());
  });
}, [pools, createdAtFor]);


  const current = mode === 'gainers' ? topGainers : mode === 'marketcap' ? topMcap : newest;
  const title   = mode === 'gainers' ? 'Top Gainers (24h)' : mode === 'marketcap' ? 'Top Market Cap' : 'Newest';

  return (
    <div className="md:hidden">
  <div className="mt-5 mb-3 flex items-center justify-between">
        <div className="text-sm opacity-80">Category</div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="bg-[#262635] border border-[#33334a] rounded px-3 py-1 text-sm"
        >
          <option value="gainers">Top Gainers (24h)</option>
          <option value="marketcap">Top Market Cap</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <MobileVerticalSection
  key={mode}
  title={title}
  itemsBestFirst={current}
  onOpen={onOpen}
  onBuy={onBuy}
  onSell={onSell}
  onMint={onMint}                   // NEW
  onBurn={onBurn}                   // NEW
  onPlay={onPlay}                   // NEW
  isPlayingFor={isPlayingFor}       // NEW
  tokensUiFor={tokensUiFor}         // NEW
  mintThresholdFor={mintThresholdFor} // NEW
  nftCountFor={nftCountFor}         // NEW
  change24hFor={change24hFor}
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
  poolType: 0 | 1;           // 0 = bonding, 1 = AMM
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
};




// Filled trade toast payloads (used by buy/sell “filled” modals)
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


// --- Chain-aligned targets & thresholds (LAMPORTS = 1e9) ---
const CURVE_THRESHOLD_RAW_COMMON = 44_000_000n; // 44,000,000 raw MEME (same for both pairs)

// Pricing target p1 (used in the bonding-curve exponential)
const PRICE_TARGET_WOODENG_LAMPORTS = 4_444_444n * 10n ** 9n; // TARGET_PRICE_LAMPORTS_WOODENG
const PRICE_TARGET_SOL_LAMPORTS     = 44n       * 10n ** 9n; // TARGET_PRICE_LAMPORTS_SOL

// Migration window bounds (pool vault 'quote' lamports)
const MIGRATE_LOWER_WOODENG = 4_317_460n * 10n ** 9n; // MIGRATE_LOWER_LAMPORTS_WOODENG
const MIGRATE_UPPER_WOODENG = 9_284_888n * 10n ** 9n; // MIGRATE_UPPER_LAMPORTS_WOODENG

const MIGRATE_LOWER_SOL     = 40n       * 10n ** 9n; // MIGRATE_LOWER_LAMPORTS_SOL
const MIGRATE_UPPER_SOL     = 100n       * 10n ** 9n; // MIGRATE_UPPER_LAMPORTS_SOL

// Helper: pick the right set for the pool's quote mint
function targetsFor(pool: PoolType) {
  const isSol = quoteIsSol(pool);
  return {
    // p1 for the exponential curve
    priceTargetLamports: isSol ? PRICE_TARGET_SOL_LAMPORTS : PRICE_TARGET_WOODENG_LAMPORTS,

    // migration window [lower, upper)
    migrateLowerLamports: isSol ? MIGRATE_LOWER_SOL : MIGRATE_LOWER_WOODENG,
    migrateUpperLamports: isSol ? MIGRATE_UPPER_SOL : MIGRATE_UPPER_WOODENG,

    // x-threshold (raw MEME sold) to reach p1
    curveThresholdRaw: CURVE_THRESHOLD_RAW_COMMON,
  };
}









// % toward AMM migration based on WOODENG liquidity in the pool vault
function ammMigrationPct(pool: PoolType): number {
  if (pool.poolType === 1) return 1;
  const wood = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const lower = Number(targetsFor(pool).migrateLowerLamports);
  return Math.min(1, wood / Math.max(1, lower));
}


// Show performance metrics?
function showPerfBadge(pool: PoolType): boolean {
  // AMM always shows perf; bonding only after 10% of the lower migration target
  return isAmm(pool) || ammMigrationPct(pool) >= 0.10;
}


// Show the Buy button?
function canShowBuy(pool: PoolType): boolean {
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

// replace your sendIxsOnce with this version
async function sendIxsOnce(
  connection: Connection,
  wallet: SignerWallet,
  ixs: TransactionInstruction[],
  signers: Keypair[] = [],
  { skipPreflight = true }: { skipPreflight?: boolean } = {} // <-- default true
) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized');

  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;
  if (signers.length) tx.partialSign(...signers);

  const signed = await wallet.signTransaction(tx);

  // expected signature even if sendRawTransaction throws
  const expectedSig = bs58.encode(signed.signatures[0].signature as Buffer);

  try {
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).toLowerCase();

    // if RPC claims it's already processed / duplicate, try confirming our expected sig
    if (expectedSig && /already been processed|duplicate signature/.test(msg)) {
      const start = Date.now();
      while (Date.now() - start < 20_000) {
        const st = await connection.getSignatureStatuses([expectedSig]);
        const s = st.value[0];
        if (s && !s.err) return expectedSig;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // enrich SendTransactionError with logs
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
    // simple flag we can re-use in UI
  const walletMissing = !wallet?.publicKey;

  // a tiny record we use to sort/paginate cheaply
type LitePoolKey = {
  pubkey: string;        // pool config PDA (string)
  memeMint: string;      // mint (string)
  symbol?: string;
  name?: string;
  marketCap: number;
  createdAt?: number;    // firstSeenAtByMint or 0
  poolType: 0 | 1;
  metaUri?: string;
  quoteMint: string;
};

const [allPoolKeys, setAllPoolKeys] = useState<LitePoolKey[]>([]);                 // whole catalog (light)
const [headersByKey, setHeadersByKey] = useState<Record<string, PoolType>>({});    // header objects by pubkey
const [poolsByKey,   setPoolsByKey]   = useState<Record<string, PoolType>>({});    // hydrated full objects (only window)


// a concrete list the UI and helpers can use
const [pools, setPools] = useState<PoolType[]>([]);


  const [balancesByMint, setBalancesByMint] = useState<Record<string, number>>({});


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



// load pools once we’ve painted (unblocks the rest of the pipeline)
useEffect(() => {
  if (!afterPaint) return;
  let cancelled = false;

  (async () => {
    try {
      const provider = new AnchorProvider(
        connection,
        wallet.publicKey
          ? getAnchorWallet(wallet)
          : ({ publicKey: new PublicKey('11111111111111111111111111111111') } as any),
        { preflightCommitment: 'processed' }
      );
      const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);

      // 1) fetch headers (fast + no HTTP JSON)
// 1) fetch headers (fast + no HTTP JSON)
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
}, [afterPaint, wallet.publicKey]);



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
        (await stillOwnsNft(n.mint, wallet.publicKey!)) ? n : null
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
      const bars: ServerCandle[] = r.ok ? await r.json() : [];
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
    <div className="fixed inset-0 z-[2000] pointer-events-none">
      {/* centred card */}
      <div className="
        absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
        w-72 rounded-2xl bg-[#23232e]/90 backdrop-blur-sm
        shadow-2xl p-6 text-center text-white pointer-events-auto
      ">
        <h2 className="text-lg font-bold mb-1">
          Step {step} of {total}
        </h2>
        <p className="text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
}



// Anchor expects a Wallet object, not WalletContextState, so we create an adapter
function getAnchorWallet(wallet: WalletContextState): {
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>
} {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet not ready for Anchor.");
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions
  };
}

const poolIdl = poolIdlJson as Idl;
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


const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');
const LOCKER_PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');
// ⬇️ ADD THIS
const STAKING_PROGRAM_ID = new PublicKey('BFJU3f7PXgzcrYPD2MkQsjRko9wDTpEbyJTtLUzSyhFG');

// Admin wallet allowed to run the initializer
const ADMIN_INIT_PUBKEY = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');

// Cast the staking IDL
const stakingIdl = stakingIdlJson as Idl;


const WOODENG_MINT = new PublicKey('83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5');
const PROJECT_WALLET = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');


const RPC_URL =
  (process.env.NEXT_PUBLIC_SOLANA_RPC && process.env.NEXT_PUBLIC_SOLANA_RPC.startsWith('http'))
    ? process.env.NEXT_PUBLIC_SOLANA_RPC
    : 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY';

const connection = new Connection(RPC_URL, { commitment: "processed" });



function feeRecipientFor(pool: PoolType): PublicKey {
  // If the pool config exposes a creator address, use it; else fallback.
  return pool.creator ?? PROJECT_WALLET;
}


const poolMcap = (p: PoolType) => p.ammReserves?.woodeng ?? 0;

const CONFIG_VERSION = 17;


type SortMode = 'marketcap' | 'gainers' | 'newest';
const PER_PAGE = 12;

const [sortMode, setSortMode] = useState<SortMode>('marketcap');
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

  // WSOL rewards vault (mint = WSOL) — includes CONFIG + WSOL mint
  const [rewardsVaultWsol] = PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault_wsol'), stakingConfig.toBuffer(), NATIVE_MINT.toBuffer()],
    STAKING_PROGRAM_ID
  );

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

    const provider = new AnchorProvider(connection, getAnchorWallet(walletCtx), {
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

    await sendIxsOnce(connection, getAnchorWallet(walletCtx), [
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

// 1) reduce the set by query (if any)
const filteredPools = React.useMemo(() => {
  if (!query) return pools;

  if (isPubkey(queryRaw)) {
    return pools.filter(p => p.memeMint.toBase58() === queryRaw);
  }
  return pools.filter(p => scorePool(p) > 0);
}, [pools, query, queryRaw, seriesTick]);

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
    if (sortMode === 'newest'  && a.created !== b.created) return b.created - a.created;
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

// NEW: a “window” you can use for background work (hydrate/prefetch, polling, etc.)
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






// Batch 24h OHLC fetch — only if we don't already have bars for these mints
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
  for (const p of filled) map.set(p.pubkey.toBase58(), p);
  return Array.from(map.values());
});

  })();
}, [poolsLoaded, windowKeys.map(k=>k.pubkey).join(','), headersByKey]);



// reset to page 1 when sort, pools or query change
useEffect(() => { setPage(1); }, [sortMode, pools.length, query]);



async function migratePool(pool: PoolType) {
  if (!wallet.publicKey) throw new Error('Connect wallet first!');
  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: 'confirmed' });
  const prog     = new Program(poolIdl, POOL_PROGRAM_ID, provider);
  const [cfgPda] = await getConfigPda(pool.memeMint);
  const [memeVault]   = await PublicKey.findProgramAddress(
    [Buffer.from('pool_meme_vault'),   pool.memeMint.toBuffer()], POOL_PROGRAM_ID);
  const [woodengVault]= await PublicKey.findProgramAddress(
    [Buffer.from('pool_woodeng_vault'),pool.memeMint.toBuffer()], POOL_PROGRAM_ID);

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
      const [lockerPda] = await getLockerPda(memeMint, owner, BigInt(i));
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

async function getConfigPda(memeMint: PublicKey) {
  return await PublicKey.findProgramAddress([Buffer.from('config'), memeMint.toBuffer()], POOL_PROGRAM_ID);
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

  const provider      = new AnchorProvider(connection, getAnchorWallet(walletCtx), { preflightCommitment: "confirmed" });
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
  const [lockerPda] = await getLockerPda(memeMint, walletCtx.publicKey!, BigInt(lockId));

  // 4) If locker already exists, done
  try {
    await lockerProgram.account.lockerState.fetch(lockerPda);
    return;
  } catch {}

  // 5) Ensure locker’s meme ATA exists (owned by the PDA) — send once
  const { ata: lockerMemeAccount, ix: lockerMemeAtaIx } =
    await ensureAtaIx(lockerPda, memeMint, walletCtx.publicKey!, true);
  await sendIxsOnce(connection, getAnchorWallet(walletCtx), [lockerMemeAtaIx]);

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
    const wallet = getAnchorWallet(walletCtx);
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

    const [lockerPda] = await getLockerPda(memeMint, wallet.publicKey, BigInt(lockId));

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





    // -------- 2) send TX A (state/mint/ATAs/init) --------------------------
setStep(3, 4, "Initializing locker…"); // 4 steps now (IPFS, prep, init, mint)

const ixsA: TransactionInstruction[] = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
  ...mintBuild.ixs,
  userMemeAtaIx,
  userNftAtaIx,
  lockerMemeAtaIx,
];

if (needInitCounter) {
  ixsA.push(
    await lockerProgram.methods.initializeCounter()
      .accounts({
        user: wallet.publicKey, counter: counterPda, memeMint,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
  );
}

if (needInitLocker) {
  ixsA.push(
    await lockerProgram.methods.initializeLocker(
      new BN(thresholdRaw),
      nameSan,
      symbolSan,
      metaUriSan
    )
    .accounts({
      user: wallet.publicKey,
      counter: counterPda,
      locker: lockerPda,
      memeMint,
      nftMint,                 // just-created mint (authority = lockerPda)
      lockerMemeAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()
  );
}

// If we had any init to do, send TX A; else skip it
if (needInitCounter || needInitLocker) {
  await sendIxsOnce(connection, wallet, ixsA, mintBuild.signers);
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



function PoolTypeBadge({ poolType }: { poolType: 0 | 1 }) {
  const cfg =
    poolType === 0
      ? { text: "Bonding", bg: "bg-orange-600/80" }
      : { text: "AMM",      bg: "bg-green-600/80" };

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
  return url;
}


async function getMultiple(
  keys: PublicKey[],
  chunk = 100
): Promise<(import("@solana/web3.js").AccountInfo<Buffer> | null)[]> {
  const out: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    const infos = await connection.getMultipleAccountsInfo(part, "confirmed");
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
async function fetchPoolHeadersOnly(poolProgram: Program) {
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
    if (!data || data.length < 9) continue;
    if (data[8] !== CONFIG_VERSION) continue;
    try {
      const acc = poolProgram.coder.accounts.decode("SoundMemeConfig", data);
      if ((acc as any).version === CONFIG_VERSION) {
        configs.push({ publicKey: pubkey, account: acc });
      }
    } catch {}
  }
  if (!configs.length) return [];

  const memeMints  = configs.map((c) => new PublicKey((c.account as any).memeMint));
  const quoteMints = configs.map((c) => new PublicKey((c.account as any).woodengMint));

  // derive PDAs
  const memeVaults = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("pool_meme_vault"), m.toBuffer()],
      POOL_PROGRAM_ID
    ))[0])
  );
  const woodVaults = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("pool_woodeng_vault"), m.toBuffer()],
      POOL_PROGRAM_ID
    ))[0])
  );
  const metadataPDAs = await Promise.all(
    memeMints.map(async (m) => (await PublicKey.findProgramAddress(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), m.toBuffer()],
      METADATA_PROGRAM_ID
    ))[0])
  );

  // batch fetch
  const mintInfos      = await getMultiple(memeMints);
  const memeVaultInfos = await getMultiple(memeVaults);
  const woodVaultInfos = await getMultiple(woodVaults);
  const metadataInfos  = await getMultiple(metadataPDAs);

  // decode per index
  return configs.map((c, i) => {
    const cfg = c.account as any;

    // normalize poolType
    const raw = cfg.poolType as number | { bonding?: {}; amm?: {} };
    const poolType: 0 | 1 = (typeof raw === "number" ? raw : ("amm" in raw ? 1 : 0)) as 0 | 1;

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

    // price
    let price = 1;
    if (poolType === 0) {
  const tmpPool: PoolType = {
    ...({} as any),
    vtokens: asNumber(cfg.vtokens),
    vwoodeng: asNumber(cfg.vwoodeng),
    bondingSold: asNumber(cfg.bondingSold),
    quoteMint: quoteMints[i],
    poolType: 0,
  } as PoolType;
  price = bondingSpotPriceForPool(tmpPool);
}
 else if (memeReserveRaw > 0 && woodReserveLamports > 0) {
      price =
        (woodReserveLamports / 10 ** QUOTE_DECIMALS) /
        (memeReserveRaw / 10 ** decimals);
    }

    const marketCap = price * (supplyUi ?? 0);

    // NEW: pull creator (project_wallet) from config
const creator = (() => {
  try { return new PublicKey((cfg as any).projectWallet ?? (cfg as any).project_wallet); } catch { return undefined; }
})();
// No explicit fee bps on-chain for display; keep your UI default or omit
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

      // NEW: surface on the pool object
      creator,
      creatorFeeBps,

      name: metaName || "",
      symbol: metaSymbol || "",
      // keep URI for later hydration
      metaUri,
      description: "",
      imageUrl: undefined,
      audioUrl: undefined,
      attributes: [],
      category: "",
      socials: undefined,
      hydrated: false,
    } as PoolType;
  });
}


// Fetch JSON for a **subset** of pools and merge into each
async function hydratePoolsDetails(poolsSubset: PoolType[]): Promise<PoolType[]> {
  const urls = poolsSubset.map(p => toHttp(p.metaUri)).map(u => u || "");
  const jsons = await mapLimit(urls, 10, async (uri) => {
    if (!uri) return null;
    try {
      const r = await fetch(uri, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  });

  return poolsSubset.map((p, i) => {
    const j = jsons[i] || {};
    const attr = Array.isArray(j.attributes) ? j.attributes : [];

    // socials + threshold extraction (same logic you had)
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
  pool, memeAmountIn, minWoodengOut, wallet
}: { pool: PoolType, memeAmountIn: number, minWoodengOut: number, wallet: any }) {
  if (!wallet.publicKey) throw new Error('Connect wallet first!');

  const [configPda] = await getConfigPda(pool.memeMint);
  const provider    = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: 'confirmed' });
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  const [poolMemeVault]    = await PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'),    pool.memeMint.toBuffer()], POOL_PROGRAM_ID);
  const [poolWoodengVault] = await PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], POOL_PROGRAM_ID);

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


  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    buyerMemeAtaIx,
    buyerQuoteAtaIx,
    creatorWalletAtaIx,                         // 👈 was projectWalletAtaIx
    coreIx,
  ].filter(Boolean) as TransactionInstruction[];

  if (quoteIsSol(pool)) {
  ixs.push(
    createCloseAccountInstruction(
      buyerQuoteAta,       // WSOL ATA receiving the proceeds
      wallet.publicKey,    // unwrap back to native SOL
      wallet.publicKey
    )
  );
}


  

  return await sendIxsOnce(connection, getAnchorWallet(wallet), ixs, [], { skipPreflight: true });
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
  if (!wallet.publicKey) {
    setBalancesByMint({});
    setQuoteBalancesRaw({});
    return;
  }

  // 1) Pull ALL SPL token accounts for the wallet in one RPC
  const encoded = await connection.getTokenAccountsByOwner(
  wallet.publicKey,
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
      qMap[q] = await connection.getBalance(wallet.publicKey, 'confirmed');
    } else {
      qMap[q] = rawByMint[q] ?? 0;
    }
  }
  setQuoteBalancesRaw(qMap);
}, [wallet.publicKey, pools]);




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
  if (!wallet.publicKey) {
    setUserPoolNfts({});
    setOwnedCounts({});
    setNftsLoaded(true);
    return;
  }

  try {
    // build the mint list from whatever pools are already in state
    const mints = pools.map(p => p.memeMint);
    const nfts  = await getUserProtocolNfts(wallet.publicKey, mints);
    setUserPoolNfts(nfts);

     /* ─── NEW: count only the NFTs that still exist ─── */
    const counts: Record<string, number> = {};
    await Promise.all(
      Object.entries(nfts).map(async ([mintStr, lockers]) => {
        const alive = await Promise.all(
          Object.values(lockers).map(async ({ mint }) =>
            (await stillOwnsNft(mint, wallet.publicKey!)) ? 1 : 0
          )
        );
        counts[mintStr] = alive.reduce<number>((sum, v) => sum + v, 0);
      })
    );
    setOwnedCounts(counts);          // <-- this drives “You own X”

  } finally {
    // even if getUserProtocolNfts throws we stop the loading state
    setNftsLoaded(true);
  }
}, [wallet.publicKey, pools]);








  const handleOpenSellModal = (pool: PoolType) => {
  if (!wallet.publicKey) {
    setStatus("connect your wallet");
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
}, [afterPaint, poolsLoaded, wallet.publicKey, pools.map(p=>p.memeMint.toBase58()).join(',')]);



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

  lockTokens(pool, setStatus, wallet, refreshUserNfts, minted => {
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
  if (!afterPaint || !wallet.connected) return;

  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), {
    preflightCommitment: "confirmed",
  });
  const prog = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  let subId: number | null = null;

  (async () => {
    try {
      subId = await prog.addEventListener("PriceUpdate", (ev: any) => {
        const mintStr = new PublicKey(ev.memeMint).toBase58();
        const lamports = Number(ev.priceLamports);
        if (lamports > 0) pushPricePoint(mintStr, lamports);
      });
    } catch (e) {
      console.warn("Event subscription failed; will rely on polling.", e);
    }
  })();

  return () => {
    if (subId != null) prog.removeEventListener(subId);
  };
}, [afterPaint, wallet.connected, pushPricePoint]);









// Load existing history for charts — defer until after paint & pools loaded
useEffect(() => {
  if (!afterPaint || !poolsLoaded || visiblePools.length === 0) return;
  let cancelled = false;

  runIdle(async () => {
    try {
      const all = await Promise.all(visiblePools.map(async (p) => {
          const mintStr = p.memeMint.toBase58();
          

          // in the “Load existing history for charts” effect:
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

    const provider = new AnchorProvider(
      connection,
      wallet.publicKey
        ? getAnchorWallet(wallet)
        : ({ publicKey: new PublicKey('11111111111111111111111111111111') } as any),
      { commitment: 'confirmed' }
    );
    const prog = new Program(poolIdl, POOL_PROGRAM_ID, provider);

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




// 3f) Auto-migrate watcher — run only after first paint & once pools are loaded
useEffect(() => {
  if (!afterPaint || !poolsLoaded || !wallet.publicKey || visiblePools.length === 0) return;


  let cancelled = false;

  runIdle(async () => {
    if (cancelled) return;

    for (const p of visiblePools) {
      // only bonding pools
      if (p.poolType !== 0) continue;

      const v   = Math.max(0, p.ammReserves?.woodeng ?? 0);
const thr = Number(targetsFor(p).priceTargetLamports);
const cap = Number(targetsFor(p).migrateUpperLamports);

if (v < thr || v >= cap) continue;


      const k = p.memeMint.toBase58();
      if (autoMigratingRef.current.has(k)) continue; // avoid double-fire

      try {
        autoMigratingRef.current.add(k);
        await migratePool(p); // will prompt the wallet once
      } catch (e) {
        console.warn("Auto-migrate watcher failed for", k, e);
      } finally {
        autoMigratingRef.current.delete(k);
      }
    }
  });

  return () => { cancelled = true; };
}, [afterPaint, poolsLoaded, wallet.publicKey, visiblePools]);






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
  pool, amountWoodengIn, minMemeOut, wallet
}: { pool: PoolType, amountWoodengIn: number, minMemeOut: number, wallet: any }) {
  if (!wallet.publicKey) throw new Error('Connect wallet first!');

  const [configPda] = await getConfigPda(pool.memeMint);
  const provider    = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: 'confirmed' });
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  const [poolMemeVault]    = await PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'),    pool.memeMint.toBuffer()], POOL_PROGRAM_ID);
  const [poolWoodengVault] = await PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], POOL_PROGRAM_ID);

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


  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    buyerMemeAtaIx,
    buyerQuoteAtaIx,          // may be null when wrapping SOL
    creatorWalletAtaIx,       // 👈 was projectWalletAtaIx
    ...wrapIxs,
    coreIx,
  ].filter(Boolean) as TransactionInstruction[];


if (quoteIsSol(pool)) {
  ixs.push(
    createCloseAccountInstruction(
      buyerQuoteAta,       // the WSOL ATA you used as buyerWoodengAta
      wallet.publicKey,    // send SOL back to the user
      wallet.publicKey
    )
  );
}




 

  return await sendIxsOnce(connection, getAnchorWallet(wallet), ixs, [], { skipPreflight: true });
}




const handleOpenBuyModal = async (poolFromGrid: PoolType) => {
  if (!wallet.publicKey) {
    setStatus("connect your wallet");
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
      const provider    = new AnchorProvider(connection, getAnchorWallet(wallet), {});
      const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);
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

    setTransactionStatus('processing');
    setTransactionMessage('Processing transaction...');

    // …your existing try { await buySoundMeme(...); patches; toasts; etc. } catch { … }
    try {
      if (!wallet.publicKey) throw new Error('Please connect your wallet!');
      const tx = await buySoundMeme({
        pool,
        amountWoodengIn: woodengRawIn,
        minMemeOut,
        wallet,
      });

      const mintStr = pool.memeMint.toBase58();

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
        const providerNow = new AnchorProvider(connection, getAnchorWallet(wallet), {});
        const progNow = new Program(poolIdl, POOL_PROGRAM_ID, providerNow);
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
      setTransactionStatus('error');
      setTransactionMessage('Error: ' + (e.message || 'Unknown error'));
    }
  } finally {
    buyingRef.current = false;        // always release
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

// If user effectively clicked “max”, snap to the exact raw balance
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

    // We enforce user slippage via minWoodengOut; do not block by “price impact”,
// which is naturally large on bonding curves for big trades.
const s = Math.max(0, Number(slippage) || 0);
const slipOut = Math.floor(woodengRawOut * Math.max(0, 1 - s / 100));
// tiny buffer (2–5 lamports) to absorb rounding/tax floors on bonding sells
const minWoodengOut = Math.max(1, slipOut - 5);



    setTransactionStatus('processing');
    setTransactionMessage('Processing transaction...');

    try {
      if (!wallet.publicKey) throw new Error('Please connect your wallet!');
      if (!modalTokensToSell) throw new Error('Select amount to sell');

      const tx = await sellSoundMeme({
        pool,
        memeAmountIn: memeRawIn,
        minWoodengOut,
        wallet,
      });

      const mintStr = pool.memeMint.toBase58();

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
        const providerNow = new AnchorProvider(connection, getAnchorWallet(wallet), {});
        const progNow = new Program(poolIdl, POOL_PROGRAM_ID, providerNow);
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
    if (!wallet.publicKey) throw new Error("Connect wallet first");
    if (!nftMint) throw new Error("No NFT mint provided");

    // Guard: ensure the NFT account still exists & has balance
    const userNftAccount = await getAta(wallet.publicKey, nftMint);
    const accInfo = await connection.getAccountInfo(userNftAccount);
    if (!accInfo) throw new Error("NFT account not found – did you mint from this wallet?");
    const bal = (await connection.getTokenAccountBalance(userNftAccount)).value.uiAmount;
    if (!bal) throw new Error("This NFT is already burned (balance = 0).");

    // PDAs
    const [lockerPda]       = await getLockerPda(pool.memeMint, wallet.publicKey, BigInt(lockId));
    const userMemeAta       = await getAta(wallet.publicKey, pool.memeMint);
    const lockerMemeAccount = await getAta(lockerPda,      pool.memeMint, true);

    // Anchor call
    const provider      = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
    const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

    await lockerProgram.methods
      .burnNftAndUnlockTokens()
      .accounts({
        user: wallet.publicKey,
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




  {/* Header */}
  <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8">Sound Meme Pools</h1>

 {wallet.publicKey &&
 wallet.publicKey.toBase58() === ADMIN_INIT_PUBKEY.toBase58() && (
  <div className="mb-4">
    <button
      type="button"
      onClick={() => ensureWsolRewardsVault(setStatus, wallet)}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg
                 bg-[#37ad71] hover:bg-[#49c283] text-white text-sm font-semibold
                 border border-white/10"
      title="One-time setup to enable SOL-quoted pool buys/sells"
    >
      Ensure SOL (WSOL) Rewards Vault
    </button>
    <p className="text-xs text-white/70 mt-1">
      Runs once. Needed so SOL (WSOL) pairs can buy/sell.
    </p>
  </div>
)}



  {/* Wallet notice */}
  {!wallet.publicKey && (
    <div
      className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 px-3 py-2 text-sm"
      role="status"
    >connect your wallet</div>
  )}


    {/* Status Banner */}
    {status && (
      <div className="mb-4 flex items-center gap-2 text-yellow-400">
        {status.includes('Processing') && <Loader2 className="animate-spin w-5 h-5" />}
        {status.includes('successful') && <CheckCircle2 className="w-5 h-5" />}
        {status.includes('failed') && <AlertCircle className="w-5 h-5" />}
        <span>{status}</span>
      </div>
    )}



    {/* Toolbar */}
<div className="hidden md:flex mb-4 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="inline-flex rounded-lg overflow-hidden border border-[#33334a] overflow-x-auto whitespace-nowrap">

    <button
      onClick={() => setSortMode('marketcap')}
      className={`px-3 py-1 text-sm ${sortMode==='marketcap' ? 'bg-[#ffc371] text-black' : 'bg-[#262635] text-white'}`}
    >
      Top Market Cap
    </button>
    <button
      onClick={() => setSortMode('gainers')}
      className={`px-3 py-1 text-sm ${sortMode==='gainers' ? 'bg-[#ffc371] text-black' : 'bg-[#262635] text-white'}`}
    >
      Top Gainers 24h
    </button>
    <button
      onClick={() => setSortMode('newest')}
      className={`px-3 py-1 text-sm ${sortMode==='newest' ? 'bg-[#ffc371] text-black' : 'bg-[#262635] text-white'}`}
    >
      Newest
    </button>
  </div>

  {/* Pagination */}
  <div className="flex items-center gap-2">
    <button
  className="px-3 py-2 text-sm bg-[#262635] rounded disabled:opacity-40"

      onClick={() => setPage(p => Math.max(1, p - 1))}
      disabled={pageClamped === 1}
    >
      Prev
    </button>
    <span className="text-xs text-[#c2c2c9]">{pageClamped} / {totalPages}</span>
    <button
  className="px-3 py-2 text-sm bg-[#262635] rounded disabled:opacity-40"

      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
      disabled={pageClamped === totalPages}
    >
      Next
    </button>
  </div>


</div>



    {/* Global step-progress modal */}
    {txStep && <StepModal {...txStep} />}

    {/* MOBILE — vertical climb stacks with rocket progress */}
<MobileVerticalStacks
  pools={pools}
  onOpen={(p) => { setDetailPool(p); setShowDetail(true); }}
  onBuy={(p) => handleOpenBuyModal(p)}
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
            className="group bg-[#22232a] border border-[#33334a] rounded-2xl shadow-xl hover:scale-105 transition-all cursor-pointer flex flex-col overflow-hidden"
            onClick={() => { setDetailPool(pool); setShowDetail(true); }}
          >
          
            {/* IMAGE + Overlay */}
<div className="relative aspect-square w-full overflow-hidden rounded-t-2xl">
  {pool.hydrated && pool.imageUrl ? (
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
            <div className="flex flex-col flex-1 p-4">
              
              {/* Name (front page) */}
<div className="flex items-center justify-between">
  <h3 className="text-base font-semibold truncate" title={pool.name ?? ""}>
    {pool.name ?? "Untitled Meme"}
  </h3>
</div>

{/* Description */}
<div className="text-[#c2c2c9] text-sm mt-1 line-clamp-2">
  {pool.description || "No description"}
</div>

              <SocialLinksBar socials={pool.socials} className="mt-2" />
               <div className="mt-3 flex items-center gap-3 min-w-0">
  {/* left side can shrink & truncate */}
  <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
    <span className="truncate max-w-[140px] sm:max-w-[180px]">
      <TinyPrice
        value={latestPriceOf(pool.memeMint.toBase58())}
        className="text-[#ffc371] font-bold text-lg"
      />
    </span>
    <span className="text-sm text-[#ffc371]/90 shrink-0">{quoteLabelOf(pool)}</span>
  </div>

  {/* right side never wraps or shrinks */}
  <div className="ml-auto flex items-center gap-2 shrink-0">
    <span className="text-xs bg-[#2b323c] px-2 py-[2px] rounded leading-none whitespace-nowrap">
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



              {/* Liquidity row — SHOW ONLY ON AMM */}
{isAmm(pool) && (
  <div className="flex items-center gap-2 mt-2">
    <span className="text-xs">Liquidity:</span>
    <span className="text-xs text-[#d3d3d3]">
  {(pool.ammReserves?.woodeng / 10 ** QUOTE_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 })} {quoteLabelOf(pool)}
  {" / "}
  {(pool.ammReserves?.meme / 10 ** (pool.decimals ?? MEME_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {pool.symbol || "MEME"}
</span>

  </div>
)}

{/* Supply + Market Cap — SHOW ONLY ON AMM */}
{isAmm(pool) && (
  <div className="mt-1 text-xs text-[#adadff]">
    <div>
      Supply: {(pool.totalSupply ?? 0).toLocaleString()} {pool.symbol ?? ""}
    </div>
    <div className="whitespace-nowrap">
      Market Cap: {Number(pool.marketCap ?? 0).toFixed(2)} {quoteLabelOf(pool)}
      <span className="text-[#9ea1ff]">
        {" "} (≈ {fmtUSD(Number(pool.marketCap ?? 0) * WOODENG_USD)})
      </span>
    </div>
  </div>
)}


              {/* Bonding progress (bonding pools only) */}
{pool.poolType === 0 && <BondingProgressBar pool={pool} />}

{/* ─────────── Action buttons ─────────── */}
<div className="grid grid-cols-2 xl:grid-cols-3 gap-2 mt-2 text-sm font-semibold place-items-stretch">



  {/* ► BUY ------------------------------------------------------- */}

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




{/* ► MIGRATE  */}
{!isAmm(pool) && (() => {
  const { 
  priceTargetLamports: targetLamports, 
  migrateUpperLamports: upperCapLamports 
} = targetsFor(pool);

  const mcap = poolMcap(pool);

  if (mcap >= Number(targetLamports) && mcap < Number(upperCapLamports)) {
    return (
      <button
        className="h-9 md:h-10 w-full inline-flex items-center justify-center gap-1 px-3 rounded font-semibold leading-none whitespace-nowrap text-[13px] md:text-sm bg-[#37ad71] text-white hover:bg-[#4cd488] transition"
        onClick={(e) => { e.stopPropagation(); migratePool(pool); }}
      >
        Migrate&nbsp;to&nbsp;AMM
      </button>
    );
  }
  return null;
})()}




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
          (await stillOwnsNft(n.mint, wallet.publicKey!)) ? n : null
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

  // volume as “number of ticks per bucket”
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
        <div className="flex items-center gap-5 mb-4">
          <img
            src={detailPool.imageUrl}
            alt={detailPool.name || 'meme'}
            className="w-20 h-20 rounded-xl"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 480px) 80px, 96px"
          />
          <div>
            <h2 className="text-2xl font-bold mb-1">{detailPool.name}</h2>
            <div className="text-sm text-[#aab]">{detailPool.description}</div>
            <SocialLinksBar socials={detailPool.socials} className="mt-2" />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[#ffc371] font-bold">
                <TinyPrice value={Number(detailPool.price ?? 0)} /> {quoteLabelOf(detailPool)}
              </span>
              <span className="bg-[#2b323c] text-xs px-2 py-1 rounded">{detailPool.symbol}</span>
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
        </div>
      </div>
    </div>
  );
})()}



  </div>
)}
