//C:\Users\burgu\woodeng-next\app\sound-memes\SOUNDMEMESClient.tsx

'use client';


export const dynamic = 'force-dynamic'; 
import poolIdlJson from '../../idl/my_sound_meme_pool.json';
import lockerIdlJson from '../../idl/hybrid_meme_coin_nft_locker.json';
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair,
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
  CheckCircle2, AlertCircle, Info, X, Pickaxe, Copy   // ← add Copy here
} from "lucide-react";




import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Metaplex } from "@metaplex-foundation/js";
import { getLockerPda } from "@/lib/sound-memes";

import { useSearchParams } from "next/navigation";
import { getMint, NATIVE_MINT, createSyncNativeInstruction, createCloseAccountInstruction } from "@solana/spl-token";

import { Rocket } from "lucide-react";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";

import NextDynamic from 'next/dynamic';


import { Globe, Send, Twitter } from 'lucide-react';
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";






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

// ADD props for buy/sell to MiniVerticalCard
function MiniVerticalCard({
  pool,
  rank,
  onOpen,
  change24h,
  onBuy,          // <—
  onSell,         // <—
  active = false, // <— for the pop-up animation section (next part)
}: {
  pool: PoolType;
  rank: number;
  onOpen: (p: PoolType) => void;
  change24h: number;
  onBuy: (p: PoolType) => void;    // <—
  onSell: (p: PoolType) => void;   // <—
  active?: boolean;                // <—
}) {
  const up = change24h >= 0;
  return (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onOpen(pool)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(pool);
      }
    }}
    className="
      snap-center w-full h-full text-left
      bg-[#22232a] border border-[#33334a] rounded-2xl shadow-xl
      overflow-hidden flex flex-col
      transition-transform duration-300 active:scale-[0.995]
    "
    style={{
      transform: active ? 'scale(1.0)' : 'scale(0.96)',
      opacity: active ? 1 : 0.8,
    }}
  >

     
      {/* image */}
      <div className="relative flex-1 min-h-0">
        <img
  src={pool.imageUrl || "https://placehold.co/600x600?text=No+Image"}
  alt={pool.name ?? "Sound Meme"}
  className="w-full h-full object-cover"
/>

        <div className="absolute top-2 left-2 ...">#{rank}</div>
        <div className="absolute top-2 right-2 ...">{pool.symbol ?? 'MEME'}</div>
      </div>

      {/* info + actions */}
      <div className="p-4">
        <div className="font-semibold truncate">{pool.name || 'Untitled Meme'}</div>

        <div className="mt-1 flex items-center gap-2">
          <TinyPrice value={Number(pool.price ?? 0)} className="text-[#ffc371] font-bold" />
          <span className="text-xs text-[#ffc371]/90">{quoteLabelOf(pool)}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded ${up ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}>
            {up ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
          </span>
        </div>

        {/* extra detail only when active (the ‘pop up’ feel) */}
        {active && (
          <div className="mt-2 text-[11px] text-[#c2c2c9] line-clamp-3">
            {pool.description || '—'}
          </div>
        )}

        {/* ACTIONS */}
<div className="mt-3 grid grid-cols-2 gap-2">
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onBuy(pool); }}
    className="h-9 rounded bg-[#ffc371] text-black font-semibold"
  >
    Buy
  </button>

  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onSell(pool); }}
    disabled={!isAmm(pool)}
    className="h-9 rounded bg-[#ff5656] text-white font-semibold disabled:opacity-40"
    title={isAmm(pool) ? '' : 'Sell available after AMM migration'}
  >
    Sell
  </button>
</div>

{/* ✅ Social links live outside buttons so they’re clickable */}
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
  change24hFor,
}: {
  title: string;
  itemsBestFirst: PoolType[];
  onOpen: (p: PoolType) => void;
  onBuy: (p: PoolType) => void;
  onSell: (p: PoolType) => void;
  change24hFor: (mint: string) => number;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [progress, setProgress] = React.useState(0); // 0..1 bottom→top
  const [activeIdx, setActiveIdx] = React.useState(0);

  // decorate cards based on distance to viewport center
  const decorate = React.useCallback(() => {
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

      // 0 (centered) … 1 (far)
      const t = Math.min(1, d / (el.clientHeight * 0.6));
      c.style.transform = `scale(${0.92 + (1 - t) * 0.08}) translateY(${(t * 20).toFixed(1)}px)`;
      c.style.opacity = `${0.6 + (1 - t) * 0.4}`;
      c.style.zIndex = `${1000 - Math.round(d)}`;
      c.style.filter = `blur(${(t * 1.2).toFixed(2)}px)`;
      c.style.transition = 'transform 180ms ease, opacity 180ms ease, filter 180ms ease';
    });

    if (best !== -1) setActiveIdx(best);
  }, []);

  // start at bottom so you "climb" to #1
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - el.clientHeight; // start at bottom
      setProgress(0);
      decorate();
    });
  }, [itemsBestFirst.length, decorate]);

  const onScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const pct = (max - el.scrollTop) / max; // bottom→top fill
    setProgress(Math.min(1, Math.max(0, pct)));
    decorate();
  }, [decorate]);

  const railH = 'calc(100dvh - 140px)';

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
    className="no-scrollbar px-4 pr-[48px] snap-y snap-mandatory overflow-y-auto overscroll-y-contain touch-pan-y"
    style={{ height: railH, WebkitOverflowScrolling: 'touch' as any }}
  >
    {itemsBestFirst.map((p, i) => (
      <div
        key={p.pubkey.toBase58()}
        ref={(el) => { cardRefs.current[i] = el; }}
        className="h-[calc(100dvh-160px)] flex-none snap-center pb-4"
      >
        <MiniVerticalCard
          pool={p}
          rank={i + 1}
          onOpen={onOpen}
          onBuy={onBuy}
          onSell={onSell}
          change24h={change24hFor(p.memeMint.toBase58())}
          active={i === activeIdx}
        />
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
  onBuy,         // NEW
  onSell,        // NEW
  change24hFor,
  createdAtFor,
}: {
  pools: PoolType[];
  onOpen: (p: PoolType) => void;
  onBuy: (p: PoolType) => void;     // NEW
  onSell: (p: PoolType) => void;    // NEW
  change24hFor: (mint: string) => number;
  createdAtFor: (mint: string) => number;
}) {

  type Mode = 'gainers' | 'marketcap' | 'newest';
  const [mode, setMode] = React.useState<Mode>('gainers'); // default: Top Gainers


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
      <div className="mb-3 flex items-center justify-between">
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
  title={title}
  itemsBestFirst={current}
  onOpen={onOpen}
  onBuy={onBuy}                                      // was: (p) => handleOpenBuyModal(p)
  onSell={(p) => { if (isAmm(p)) onSell(p); }}       // was: if (isAmm(p)) handleOpenSellModal(p)
  change24hFor={change24hFor}
/>
    </div>
  );
}




type PoolType = {
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

const QUOTE_DECIMALS = 9;              // WOODENG and wSOL both have 9
const WOODENG_DECIMALS = QUOTE_DECIMALS;
const WSOL_MINT = NATIVE_MINT;         // So111111... (wrapped SOL)

const quoteIsSol = (p: PoolType) => p.quoteMint?.equals(WSOL_MINT);
const quoteLabelOf = (p: PoolType) => (quoteIsSol(p) ? "SOL" : "WOODENG");

const MEME_DECIMALS = 0;
const PROTOCOL_FEE_BPS = 100; // 1 %
const BONDING_MCAP_THRESHOLD_LAMPORTS = 35 * 10 ** WOODENG_DECIMALS; // 35 WOODENG market-cap (lamports)



// % toward AMM migration based on WOODENG liquidity in the pool vault
function ammMigrationPct(pool: PoolType): number {
  if (pool.poolType === 1) return 1; // already AMM
  const wood = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const thr  = Math.max(1, BONDING_MCAP_THRESHOLD_LAMPORTS);
  return Math.min(1, wood / thr);
}


// wallet-like type for one-shot sender
type SignerWallet = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
};

// REPLACE your current sendIxsOnce(...) helper with this version
async function sendIxsOnce(
  connection: Connection,
  wallet: SignerWallet,
  ixs: TransactionInstruction[],
  signers: Keypair[] = [],
  { skipPreflight = false }: { skipPreflight?: boolean } = {}
) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;
  if (signers.length) tx.partialSign(...signers);

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight });

  try {
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  } catch (e) {
    // Devnet/websocket flake: fall back to polling and accept any non-error status.
    const start = Date.now();
    while (Date.now() - start < 20_000) {
      const st = await connection.getSignatureStatuses([sig]);
      const s = st.value[0];
      if (s && !s.err) return sig; // processed/confirmed/finalized with NO error = success
      await new Promise(r => setTimeout(r, 500));
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

// mint account builder (creates + initializes mint; you sign with `kp`)
// mint account builder (creates + initializes mint; you sign with `kp`)
async function buildCreateMintIx(
  connection: Connection,           // ← add this
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
  const initIx = createInitializeMintInstruction(kp.publicKey, decimals, mintAuthority, null, TOKEN_PROGRAM_ID);
  return { mint: kp.publicKey, ixs: [createIx, initIx], signers: [kp] };
}




export default function SoundMemesClient() {

  // 1) FIRST
  const wallet = useWallet();
  const [pools, setPools] = useState<PoolType[]>([]);
  const [balancesByMint, setBalancesByMint] = useState<Record<string, number>>({});

  const [copied, setCopied] = useState<string | null>(null);


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
      if (!stop && Array.isArray(bars)) {
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
    <div className="fixed inset-0 z-[1000] pointer-events-none">
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




// Returns threshold for minting NFT (from pool/locker config)
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


const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');
const LOCKER_PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');

const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');
const PROJECT_WALLET = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');
const connection = new Connection("https://api.devnet.solana.com", "confirmed");


const poolMcap = (p: PoolType) => p.ammReserves?.woodeng ?? 0;
// 44 000 000 MEME (raw, i.e. decimals *not* applied)
const BONDING_CURVE_THRESHOLD_RAW = 44_000_000;
const CONFIG_VERSION = 7;


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
  if (!Number.isFinite(priceLamports) || priceLamports <= 0) return; // ← hard guard

  const priceUi = priceLamports / 10 ** WOODENG_DECIMALS; // lamports → WOODENG
  const time = Date.now();

  setPriceSeriesByMint(prev => {
    const arr = [...(prev[mintStr] ?? []), { time, price: priceUi }];
    return { ...prev, [mintStr]: arr.slice(-500) };
  });

  try {
    // store only valid >0 prices
    localStorage.setItem(`lastPrice:${mintStr}`, JSON.stringify({ time, priceLamports }));
  } catch {}

  persistPricePoint(mintStr, priceLamports, time);
}, []);






// We always keep the most recent price and flush it shortly after the last update.
// was: useRef<Map<string, { timer: any; last: number }>>(new Map())
const flushTimersRef = useRef<Map<string, {
  timer: ReturnType<typeof setTimeout>;
  last: number;
  atMs: number;
}>>(new Map());

async function persistPricePoint(mintStr: string, priceLamports: number, atMs: number) {
  const existing = flushTimersRef.current.get(mintStr);
  if (existing) {
    existing.last = priceLamports;
    existing.atMs = atMs;                 // ✅ tracked timestamp
    clearTimeout(existing.timer);
  }

  const timer = setTimeout(async () => {
    const entry = flushTimersRef.current.get(mintStr);
    if (!entry) return;
    try {
      await fetch('/api/pricepoints/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mint: mintStr, priceLamports: entry.last, at: entry.atMs }),
      });
    } finally {
      flushTimersRef.current.delete(mintStr);
    }
  }, 1000);

  flushTimersRef.current.set(mintStr, { timer, last: priceLamports, atMs });
}



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







// % change over last 24h — use merged (persisted + live + localStorage) data
const change24hFor = React.useCallback((mintStr: string): number => {
  const all = mergedSeries(mintStr);          // full history (persisted + live + local)
  if (all.length < 2) return 0;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  // binary search: index of last point with time <= cutoff
  let lo = 0, hi = all.length - 1, baseIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid].time <= cutoff) { baseIdx = mid; lo = mid + 1; }
    else hi = mid - 1;
  }

  const base = (baseIdx >= 0 ? all[baseIdx].price : all[0].price);
  const last = all[all.length - 1].price;

  if (!Number.isFinite(base) || base <= 0) return 0;
  const pct = ((last - base) / base) * 100;
return Number.isFinite(pct) ? pct : 0;

}, [persistedSeriesByMint, priceSeriesByMint]);






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
    if (symbol === query)        s += 800;
    else if (symbol.startsWith(query)) s += 600;
    else if (symbol.includes(query))  s += 400;
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

// 2) your existing sorting, but on the filtered set
const sortedPools = React.useMemo(() => {
  const arr = [...filteredPools];

  // primary: match quality (desc)
  arr.sort((a, b) => scorePool(b) - scorePool(a));

  // secondary: your selected mode
  switch (sortMode) {
    case 'marketcap':
      arr.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
      break;
    case 'gainers':
      arr.sort((a, b) =>
        change24hFor(b.memeMint.toBase58()) - change24hFor(a.memeMint.toBase58())
      );
      break;
    case 'newest':
      arr.sort((a, b) =>
        createdAtFor(b.memeMint.toBase58()) - createdAtFor(a.memeMint.toBase58())
      );
      break;
  }
  return arr;
}, [filteredPools, sortMode, change24hFor, createdAtFor, seriesTick]);

// 3) paging stays the same, but uses sortedPools
const totalPages  = Math.min(10, Math.max(1, Math.ceil(sortedPools.length / PER_PAGE)));
const pageClamped = Math.min(page, totalPages);
const start       = (pageClamped - 1) * PER_PAGE;
const visiblePools = sortedPools.slice(start, start + PER_PAGE);

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

  await refreshBalances();
  await refreshUserNfts();
  const upd = await fetchSoundMemePoolsWithMetadata(prog);
  setPools(upd);
  setStatus(`Migrated! Tx ${sig.slice(0,8)}…`);
}






// ------------------------------------------------------------------
//  spot price for a bonding (virtual-reserve) pool
// ------------------------------------------------------------------
function bondingSpotPrice(cfg: { vtokens: number; vwoodeng: number; bondingSold: number }) {
  const { vtokens, vwoodeng, bondingSold } = cfg;
  if (!vtokens || !vwoodeng) return NaN;
  const p0 = vwoodeng / vtokens;
  const p1 = BONDING_MCAP_THRESHOLD_LAMPORTS;
  const k  = Math.log(p1 / p0) / BONDING_CURVE_THRESHOLD_RAW;
  return (p0 * Math.exp(k * bondingSold)) / 10 ** WOODENG_DECIMALS;
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
  return getAssociatedTokenAddress(mint, owner, isPdaOwner);
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

    // Last resort
    return String(e);
  } catch {
    return String(e);
  }
}



async function ensureLockerInitialized(
  pool: PoolType & { nftMint: PublicKey },
  walletCtx: WalletContextState
) {
  const memeMint    = pool.memeMint;
  const nftMint     = pool.nftMint;
  const threshold   = getMintThreshold(pool);

  const meme_name   = pool.name   ?? "Meme";
  const meme_symbol = pool.symbol ?? "MEME";
  const meme_uri    = pool.imageUrl ?? "";

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
  new BN(threshold),
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
    const name   = pool.name   ?? "Meme";
    const symbol = pool.symbol ?? "MEME";

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
  name, symbol, description: pool.description ?? "",
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
    const lockerMemeAccount = await getAssociatedTokenAddress(memeMint, lockerPda, true);

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
  new BN(threshold), name, symbol, metaUri
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


    // final mint (locks tokens & mints NFT, creates metadata inside the program)
    const [metadataPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
  METADATA_PROGRAM_ID
);


    ixs.push(
      await lockerProgram.methods
        .lockTokensAndMintNft(name, symbol, metaUri)
        .accounts({
          user: wallet.publicKey,
          userMemeAccount:   userMemeAta,
          locker:            lockerPda,
          lockerMemeAccount,
          nftMint,
          userNftAccount:    userNftAta,
          metadata:          metadataPda,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
          tokenProgram:      TOKEN_PROGRAM_ID,
          systemProgram:     SystemProgram.programId,
          rent:              SYSVAR_RENT_PUBKEY,
        })
        .instruction()
    );

    // -------- 2) single signature send --------------------------
setStep(3, 3, "Sign once to mint your sound NFT…");

let sig: string;
try {
  sig = await sendIxsOnce(connection, wallet, ixs, mintBuild.signers);
} catch (e: any) {
  setTxStep(null);
  const msg = await renderError(e, connection);
  console.error('Mint failed (post-send):', e);
  setStatus(`NFT mint failed: ${msg}`);
  throw e; // keep bubbling so outer refresh is skipped
}


// we minted — close the stepper and notify
setTxStep(null);
onMintSuccess?.({ mint: nftMint, memeMint: memeMint.toBase58(), lockId });

// refresh UI, but don't treat failures here as mint failures
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
    const BONDING_FEE_BPS = 100;
    const threshold = BONDING_CURVE_THRESHOLD_RAW;

    const vtokens  = pool.vtokens ?? 0;
    const vwoodeng = pool.vwoodeng ?? 0;
    const sold     = pool.bondingSold ?? 0;

    if (!vtokens || !vwoodeng || memeRawOut <= 0) return NaN;

    // p(x) = p0 * e^(k x)
    const p0 = vwoodeng / vtokens;
    const p1 = BONDING_MCAP_THRESHOLD_LAMPORTS; 
    const k  = Math.log(p1 / p0) / threshold;

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
  return (BONDING_CURVE_THRESHOLD_RAW - pool.bondingSold) / 10 ** dec;
 
}




function getQuoteForMemeSell(pool: PoolType, memeRawIn: number): number {
  if (pool.poolType === 0) return NaN; // selling disabled on bonding

  const x = Number(pool.ammReserves.meme);     // MEME reserve (raw)
  const y = Number(pool.ammReserves.woodeng);  // WOODENG reserve (lamports)
  if (memeRawIn <= 0) return NaN;

  // AMM XYK exact-in (user sells MEME to receive WOODENG)
  // Δy = floor( (y * Δx_eff) / (x + Δx_eff) ), with fee applied to input
  const FEE = 0.003;
  const dxEff = Math.floor(memeRawIn * (1 - FEE));
  let dy = Math.floor((y * dxEff) / (x + dxEff));
  return Math.max(0, dy);
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


function BondingProgressBar({ pool }: { pool: PoolType }) {
  if (pool.poolType !== 0) return null; // bonding only

  const woodLamports = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const thrLamports  = BONDING_MCAP_THRESHOLD_LAMPORTS; // your 35 WOODENG goal
  const pct          = Math.min(1, woodLamports / Math.max(1, thrLamports));
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


// ------ Fetch pools and calculate price from AMM reserves ------
// ---- helpers used by the batched fetch --------------------------------
function readU64LE(buf: Buffer, offset: number): number {
  // token amounts & supply fit safely in JS number for this app
  return Number(buf.readBigUInt64LE(offset));
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
async function fetchSoundMemePoolsWithMetadata(poolProgram: Program) {
  // 1) Pull raw configs once
  const rawConfigs = await connection.getProgramAccounts(POOL_PROGRAM_ID, {
    filters: [{ dataSize: 8 + 350 }], // your config size
  });

  const configs = rawConfigs
    .map(({ pubkey, account: { data } }) => ({
      publicKey: pubkey,
      account: poolProgram.coder.accounts.decode("SoundMemeConfig", data),
    }))
    .filter((c: any) => (c.account as any).version === CONFIG_VERSION);

  if (configs.length === 0) return [];

  // 2) Derive all addresses we’ll need (CPU-only)
  const memeMints = configs.map((c: any) => new PublicKey((c.account as any).memeMint));
  const quoteMints = configs.map((c: any) => new PublicKey((c.account as any).woodengMint));

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

  // 3) Batch-fetch mint accounts, token accounts, and metadata PDAs
  const mintInfos = await getMultiple(memeMints);
  const memeVaultInfos = await getMultiple(memeVaults);
  const woodVaultInfos = await getMultiple(woodVaults);
  const metadataInfos = await getMultiple(metadataPDAs);

  // 4) Decode on-chain pieces (no extra RPC)
  type DecodedOnChain = {
    decimals: number;
    supplyUi: number;
    memeReserveRaw: number;
    woodReserveLamports: number;
    metaName: string;
    metaSymbol: string;
    metaUri?: string;
  };

  const decoded: DecodedOnChain[] = memeMints.map((_, i) => {
    // Mint account (size 82)
    const mi = mintInfos[i]?.data;
    let decimals = 0;
    let supplyUi = 0;
    if (mi && mi.length >= 82) {
      decimals = mi[44];
      const supplyRaw = readU64LE(mi, 36);
      supplyUi = supplyRaw / 10 ** decimals;
    }

    // Token vaults (size 165)
    const memeAcc = memeVaultInfos[i]?.data;
    const woodAcc = woodVaultInfos[i]?.data;
    const memeReserveRaw = memeAcc ? readU64LE(memeAcc, 64) : 0;
    const woodReserveLamports = woodAcc ? readU64LE(woodAcc, 64) : 0;

    // Token Metadata PDA
    const mdi = metadataInfos[i]?.data;
    let metaName = "";
    let metaSymbol = "";
    let metaUri: string | undefined = undefined;
    if (mdi) {
      try {
        const [md] = Metadata.deserialize(mdi);
        metaName   = clean((md as any).data.name);
metaSymbol = clean((md as any).data.symbol);
metaUri    = clean((md as any).data.uri);
      } catch {
        // ignore malformed metadata
      }
    }

    return { decimals, supplyUi, memeReserveRaw, woodReserveLamports, metaName, metaSymbol, metaUri };
  });

  // 5) Pull off-chain JSON in a limited-concurrency pool (HTTP only)
  const jsons = await mapLimit(
    decoded.map((d) => toHttp(d.metaUri)),
    6,
    async (uri) => {
      if (!uri) return null;
      try {
        const r = await fetch(uri, { cache: "no-store" });
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    }
  );

  // 6) Build final objects without more RPC
  const out = configs.map((c: any, i: number) => {
    const cfg = c.account as any;

    // Normalize enum poolType: number | { bonding|amm: {} } -> 0|1
    const raw = cfg.poolType as number | { bonding?: {}; amm?: {} };
    const poolType: 0 | 1 = (typeof raw === "number" ? raw : ("amm" in raw ? 1 : 0)) as 0 | 1;

    const m = decoded[i];
    const quoteMintPk = quoteMints[i];

    // Price
    let price = 1;
    if (poolType === 0) {
      price = bondingSpotPrice({
        vtokens: asNumber(cfg.vtokens),
        vwoodeng: asNumber(cfg.vwoodeng),
        bondingSold: asNumber(cfg.bondingSold),
      });
    } else if (m.memeReserveRaw > 0 && m.woodReserveLamports > 0) {
      // AMM: (quote / quoteDec) / (meme / memeDec)
      price =
        (m.woodReserveLamports / 10 ** QUOTE_DECIMALS) /
        (m.memeReserveRaw / 10 ** m.decimals);
    }

    const marketCap = price * (m.supplyUi ?? 0);

    const j = jsons[i] || {};
    const attributes = Array.isArray(j.attributes) ? j.attributes : [];
    const category =
      attributes.find?.((a: any) => a?.trait_type === "Category")?.value ?? "";


      // --- Social links extraction ---
const norm = (u?: string) => {
  if (!u) return undefined;
  const s = String(u).trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
// attribute helper fallback
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



// --- Threshold extraction from metadata (robust) ---
const coerceNum = (v: any) => {
  if (v == null) return NaN;
  const s = String(v).replace(/[,_\s]/g, ''); // "50,000" -> "50000"
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// `attrVal` already exists a few lines above; we reuse it here.
// If it doesn't in your copy, paste this helper:
// const attrVal = (name: string) => {
//   if (!Array.isArray(j.attributes)) return undefined;
//   const hit = j.attributes.find((a: any) =>
//     String(a?.trait_type ?? '').toLowerCase() === name.toLowerCase()
//   );
//   return hit?.value;
// };

const thresholdMeta =
  j?.extensions?.threshold ??
  j?.socials?.threshold ??      // tolerate odd metadata
  attrVal('Threshold') ??       // trait casing
  attrVal('threshold');

const nftThreshold =
  coerceNum(thresholdMeta) > 0 ? Math.floor(coerceNum(thresholdMeta)) : undefined;





    return {
      pubkey: c.publicKey,
      poolType,
      lastMemePrice: asNumber(cfg.lastMemePrice),
      vtokens: asNumber(cfg.vtokens),
      vwoodeng: asNumber(cfg.vwoodeng),
      bondingSold: asNumber(cfg.bondingSold),
      memeMint: new PublicKey(cfg.memeMint),
      quoteMint: quoteMintPk,
      ammReserves: {
        meme: m.memeReserveRaw,
        woodeng: m.woodReserveLamports,
      },
      price,
      decimals: m.decimals,
      totalSupply: m.supplyUi,
      marketCap,

      // metadata / UI
      name: m.metaName || j.name || "",
      symbol: m.metaSymbol || j.symbol || "",
      description: j.description || "",
      imageUrl: toHttp(j.image || ""),
audioUrl: toHttp(j.animation_url || ""),

      attributes,
      category,
      socials,
      nftThreshold,
    } as PoolType;
  });

  return out;
}



// REPLACE the whole sellSoundMeme with this version (auto-unwrap to SOL)
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
  const { ata: projectWalletAta, ix: projectWalletAtaIx } = await ensureAtaIx(PROJECT_WALLET, pool.quoteMint, wallet.publicKey);

  const coreIx = await poolProgram.methods
    .sell(new BN(memeAmountIn), new BN(minWoodengOut))
    .accounts({
      config:           configPda,
      poolMemeVault,
      poolWoodengVault,
      memeMint:         pool.memeMint,
      buyer:            wallet.publicKey,
      buyerMemeAta,
      buyerWoodengAta:  buyerQuoteAta,     // destination (quote) ATA
      projectWalletAta,
      lpFeeVault:       projectWalletAta,
      tokenProgram:     TOKEN_PROGRAM_ID,
      systemProgram:    SystemProgram.programId,
    })
    .instruction();

  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    buyerMemeAtaIx,
    buyerQuoteAtaIx,
    projectWalletAtaIx,
    coreIx,
  ].filter(Boolean) as TransactionInstruction[];

  // 🚀 NEW: if quote is SOL, unwrap by closing the wSOL ATA → SOL back to the user
  if (quoteIsSol(pool)) {
    ixs.push(createCloseAccountInstruction(
      buyerQuoteAta,         // the wSOL ATA we just received into
      wallet.publicKey,      // send SOL (lamports) to user
      wallet.publicKey       // close authority
    ));
  }

  return await sendIxsOnce(connection, getAnchorWallet(wallet), ixs);
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
  if (pool.poolType !== 1) return; // only AMM sells
  setPools(prev => prev.map(p => {
    if (!p.memeMint.equals(pool.memeMint)) return p;
    return {
      ...p,
      ammReserves: {
        meme: (p.ammReserves?.meme ?? 0) + memeRawIn,
        woodeng: Math.max(0, (p.ammReserves?.woodeng ?? 0) - woodLamportsOut),
      },
    };
  }));
};





// 1 WOODENG ≡ 1 SOL — on récupère le prix USD de Solana
const [solUsd, setSolUsd] = useState<number | null>(null);
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
  const parsed = await connection.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    { programId: TOKEN_PROGRAM_ID },         // classic SPL-Token
    'confirmed'
  );

  // Map of mint -> raw amount (no decimals applied)
  const rawByMint: Record<string, number> = {};
  for (const { account } of parsed.value) {
    try {
      const info = (account.data as any).parsed.info;
      const mint = String(info.mint);
      const amountRaw = Number(info.tokenAmount.amount);
      rawByMint[mint] = amountRaw;
    } catch {/* ignore malformed */ }
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
const [buyFilled, setBuyFilled] = useState<{
  open: boolean;
  symbol: string;
  amountMeme: number;      // UI units
  priceWoodeng: number;    // UI units
  quoteLabel?: string; 
}>({ open: false, symbol: "", amountMeme: 0, priceWoodeng: 0 });

// ↕ right below const [buyFilled, …]
const [sellFilled, setSellFilled] = useState({
  open:false, symbol:"", amountMeme:0, priceWoodeng:0
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
  const mcap = pool.ammReserves?.woodeng ?? 0;
  const canSell = isAmm(pool);
  if (!canSell) return;
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



  const [hoverDeltaPct, setHoverDeltaPct] = useState<number | null>(null);

  useEffect(() => { setHoverDeltaPct(null); }, [selectedTimeRange, detailPool, showDetail]);



 


  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<any | null>(null);
  const [modalTokensToBuy, setModalTokensToBuy] = useState('');
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




useEffect(() => {
  const flushAll = () => {
    flushTimersRef.current.forEach((entry, mint) => {
      try {
        // Prefer sendBeacon for reliability during unload
        const ok = navigator.sendBeacon?.(
  '/api/pricepoints/ingest',
  new Blob([JSON.stringify({ mint, priceLamports: entry.last, at: entry.atMs })],
  { type: 'application/json' })
);
if (!ok) {
  fetch('/api/pricepoints/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mint, priceLamports: entry.last, at: entry.atMs }),
    keepalive: true,
  });
}

      } catch {
        fetch('/api/pricepoints/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mint, priceLamports: entry.last }),
          keepalive: true,
        });
      }
    });
    flushTimersRef.current.clear();
  };

  const onVis = () => { if (document.visibilityState === 'hidden') flushAll(); };

  window.addEventListener('visibilitychange', onVis);
  window.addEventListener('beforeunload', flushAll);
  return () => {
    window.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('beforeunload', flushAll);
    flushAll();
  };
}, []);






  useEffect(() => {
  if (!wallet.connected) return;
  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);
  fetchSoundMemePoolsWithMetadata(poolProgram)

    .then(async fetchedPools => {
    // ✅ keep *every* pool – threshold is **only** for NFT minting
    const balances = await Promise.all(
      fetchedPools.map(pool => fetchUserMemeBalance(wallet, pool.memeMint))
    );
    setPools(fetchedPools);
  })

    .catch((e) => setStatus("Failed to load pools: " + e));
}, [wallet.connected]);

useEffect(() => {
  if (!wallet.connected) return;

  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  const prog = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  let subId: number | null = null;

  (async () => {
    try {
      subId = await prog.addEventListener('PriceUpdate', (ev: any /* { memeMint, priceLamports } */, _slot) => {
        const mintStr = new PublicKey(ev.memeMint).toBase58();
        const lamports = Number(ev.priceLamports);
if (lamports > 0) {
  pushPricePoint(mintStr, lamports);
  persistPricePoint(mintStr, lamports, Date.now());
}

      });
    } catch (e) {
      console.warn('Event subscription failed (RPC may not support logs). Will rely on polling.', e);
    }
  })();

  return () => {
    if (subId != null) prog.removeEventListener(subId);
  };
}, [wallet.connected, pushPricePoint]);





// Load existing history for each pool so charts show up on first open
// 1) Load history (persisted) once per pool set
useEffect(() => {
  if (pools.length === 0) return;

  (async () => {
    try {
      const all = await Promise.all(
        pools.map(async (p) => {
          const mintStr = p.memeMint.toBase58();
          const res = await fetch(`/api/pricepoints/${mintStr}?limit=2000`, { cache: 'no-store' });
          if (!res.ok) return [mintStr, []] as const;
          const arr: Array<{ time: string; priceLamports: string }> = await res.json();
          return [mintStr, arr] as const;
        })
      );

      const seriesByMint: Record<string, { time: number; price: number }[]> = {};
      const firstSeen:    Record<string, number> = {};

      for (const [mintStr, arr] of all) {
        const series = arr
          .map(pt => ({
            time: new Date(pt.time).getTime(),
            price: Number(pt.priceLamports) / 10 ** WOODENG_DECIMALS,
          }))
          .sort((a, b) => a.time - b.time);

        seriesByMint[mintStr] = series;
        if (series.length) firstSeen[mintStr] = series[0].time;
      }

      setPersistedSeriesByMint(prev => ({ ...prev, ...seriesByMint }));
      setFirstSeenAtByMint(prev => ({ ...prev, ...firstSeen }));
    } catch (e) {
      console.warn('Failed loading history', e);
    }
  })();
}, [pools]);





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
      // debounced server write so reloads have a baseline
      persistPricePoint(mint, lamports, Date.now());
    }
  }
}, [pools, persistedSeriesByMint]);







// seed a point when pools load or refresh, and keep polling every 10s
useEffect(() => {
  if (pools.length === 0) return;

  let stop = false;

  // seed current price for every pool right away
    // seed current price for every pool right away
  const seeds: Record<string, number> = {};
  for (const p of pools) {
  const mintStr = p.memeMint.toBase58();
  if (!seededOnceRef.current.has(mintStr)) {
    const lamportsFromChain = Number(p.lastMemePrice ?? 0);

if (lamportsFromChain > 0) {
  // seed + persist real chain price so reloads are consistent across users
  pushPricePoint(mintStr, lamportsFromChain);
  persistPricePoint(mintStr, lamportsFromChain, Date.now());
} else if (p.price && p.price > 0) {
  // derive for UI only; DO NOT persist to server
  const derivedLamports = Math.round(p.price * 10 ** WOODENG_DECIMALS);
  if (derivedLamports > 0) {
    pushPricePoint(mintStr, derivedLamports);
  }
}

    seededOnceRef.current.add(mintStr);

// remember when we seeded, to only accept newer local values
const seededAt = Date.now();
seeds[mintStr] = seededAt;

// try to patch with a more recent local value (if exists)
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
}


  // set firstSeenAt only for mints that don't have it yet (no clobbering)
  setFirstSeenAtByMint(prev => {
    const next = { ...prev };
    for (const [k, v] of Object.entries(seeds)) {
      if (next[k] == null) next[k] = v;
    }
    return next;
  });


  // polling: read config.lastMemePrice every 10s
  const provider = new AnchorProvider(connection, (wallet.publicKey
    ? getAnchorWallet(wallet)
    : ({ publicKey: new PublicKey('11111111111111111111111111111111') } as any)
  ), { commitment: 'confirmed' });
  const prog = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  const id = setInterval(async () => {
    if (stop) return;
    try {
      const cfgKeys = pools.map(p => p.pubkey);
const infos = await getMultiple(cfgKeys); // your helper (chunks of 100)

for (let i = 0; i < cfgKeys.length; i++) {
  const acc = infos[i];
  if (!acc?.data) continue;

  const cfg = prog.coder.accounts.decode("SoundMemeConfig", acc.data) as any;
  const lamports = Number(cfg.lastMemePrice ?? 0);
  if (lamports > 0) {
    const mintStr = pools[i].memeMint.toBase58();
    pushPricePoint(mintStr, lamports);        // live
    persistPricePoint(mintStr, lamports, Date.now());
  }
}

    } catch (e) {
      // swallow intermittent RPC errors
    }
  }, 10_000);

  return () => {
    stop = true;
    clearInterval(id);
  };
}, [pools, wallet.publicKey, pushPricePoint]);


useEffect(() => {
  if (!showDetail || !detailPool) return;

  const mintStr = detailPool.memeMint.toBase58();
  let stop = false;
  let timer: any = null;

  const fetchOnce = async () => {
    try {
      const res = await fetch(`/api/pricepoints/${mintStr}?limit=2000`, { cache: 'no-store' });
      if (!res.ok) return;
      const rows: Array<{ time: string; priceLamports: string }> = await res.json();

      if (stop) return;
      setPersistedSeriesByMint(prev => ({
        ...prev,
        [mintStr]: rows
          .map(r => ({
            time: new Date(r.time).getTime(),
            price: Number(r.priceLamports) / 10 ** WOODENG_DECIMALS, // lamports → WOODENG
          }))
          .sort((a, b) => a.time - b.time)
          .slice(-2000),
      }));
    } catch {
      /* ignore transient errors */
    }
  };

  // initial fetch
  fetchOnce();

  // keep it fresh while the modal is open (every 10s)
  timer = setInterval(fetchOnce, 10_000);

  return () => {
    stop = true;
    if (timer) clearInterval(timer);
  };
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
      // show instantly
      pushPricePoint(mintStr, lamports);
      // also persist so a reload keeps it
      persistPricePoint(mintStr, lamports, Date.now());;
    }
  }
}, [
  showDetail,
  detailPool,
  priceSeriesByMint,
  persistedSeriesByMint,
  pushPricePoint,
]);




// place just after the other useEffect hooks
useEffect(() => {
  // don't run until we know which meme mints to query
  if (!wallet.publicKey || pools.length === 0) return;

  setNftsLoaded(false);          // show spinner only while fetching
  refreshUserNfts();             // will set nftsLoaded → true when done
}, [wallet.publicKey, pools, refreshUserNfts]);

useEffect(() => {
  refreshBalances();            // ← fetch raw balances
}, [refreshBalances]);


// Récupère le prix USD de SOL (1 WOODENG = 1 SOL)
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        { cache: 'no-store' }
      );
      const j = await r.json();
      if (mounted) setSolUsd(Number(j?.solana?.usd) || null);
    } catch {
      if (mounted) setSolUsd(null);
    }
  })();
  return () => { mounted = false; };
}, []);


  // --------------------------------------------
  //  auto-open the Buy modal when we deep-link
  // --------------------------------------------
  const buyAutoOpened = useRef(false);

  useEffect(() => {
    if (buyAutoOpened.current) return;            // already opened once
    if (!deepLinkedMint || pools.length === 0) return;

    const pool = pools.find(p => p.memeMint.toBase58() === deepLinkedMint);
    if (pool) {
      handleOpenBuyModal(pool);
      buyAutoOpened.current = true;
    }
  }, [deepLinkedMint, pools]);                     // ← deps


  const playDemo = (id: string, url?: string) => {
    if (!url) return;
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const el = new Audio(url);
    audioRef.current = el;
    setPlaying(id);
    el.onended = () => setPlaying(null);
    el.play();
  };


 

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
  if (quoteIsSol(pool)) {
    const w = await buildWrapSolIxs(wallet.publicKey, amountWoodengIn);
    buyerQuoteAta = w.ata;
    wrapIxs = w.ixs;                                   // create + fund + sync
  } else {
    const r = await ensureAtaIx(wallet.publicKey, pool.quoteMint, wallet.publicKey);
    buyerQuoteAta = r.ata;
    buyerQuoteAtaIx = r.ix;
  }

  const { ata: projectWalletAta, ix: projectWalletAtaIx } =
    await ensureAtaIx(PROJECT_WALLET, pool.quoteMint, wallet.publicKey);

  const isAmm  = pool.poolType === 1;
  const method = isAmm
    ? poolProgram.methods.swap(new BN(amountWoodengIn), new BN(minMemeOut))
    : poolProgram.methods.buy (new BN(amountWoodengIn), new BN(minMemeOut));

  const coreIx = await method.accounts({
    config:        configPda,
    memeMint:      pool.memeMint,
    poolMemeVault,
    poolWoodengVault,
    buyer:         wallet.publicKey,
    buyerMemeAta,
    buyerWoodengAta: buyerQuoteAta,     // << input (quote) ATA
    projectWalletAta,
    lpFeeVault:    projectWalletAta,
    tokenProgram:  TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).instruction();

  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    buyerMemeAtaIx,
    buyerQuoteAtaIx,     // may be null for SOL
    projectWalletAtaIx,
    ...wrapIxs,          // only for SOL
    coreIx,
  ].filter(Boolean) as TransactionInstruction[];

  return await sendIxsOnce(connection, getAnchorWallet(wallet), ixs);
}


  // REPLACE the entire handleOpenBuyModal function with this
const handleOpenBuyModal = async (poolFromGrid: PoolType) => {
  if (!wallet.publicKey) {
    setStatus("Please connect your wallet first.");          // quick guard
    return;
  }

  /* — pull the latest on-chain config for this mint — */
  const provider    = new AnchorProvider(connection, getAnchorWallet(wallet), {});
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);
  const freshPools  = await fetchSoundMemePoolsWithMetadata(poolProgram);
  const freshPool   = freshPools.find(p =>
    p.memeMint.equals(poolFromGrid.memeMint)
  );

  if (!freshPool) {
    setStatus("Couldn’t fetch this pool from chain – try again.");
    return;
  }
 

  setSelectedPool(freshPool);          // ← use the fresh object
  setModalTokensToBuy("");
  setShowBuyModal(true);
  setTransactionStatus("idle");
  setTransactionMessage("");
};


  const handleConfirmBuy = async () => {
    const DEC = selectedPool.decimals ?? MEME_DECIMALS;
  // lamports of WOODENG we will actually spend


  // lamports of WOODENG we will actually spend (exact-in)
const spendRaw = getQuoteForMemeBuy(
  selectedPool,
  Number(modalTokensToBuy)
);

// never add slippage to the input – send the solved amount exactly
const maxWoodengIn = spendRaw;


// exact spend at *current* curve state (used for maths & UI)
const quoteUiExact  = spendRaw / 10 ** QUOTE_DECIMALS;
// buffered spend that actually goes into the TX
const woodengUiNeeded = maxWoodengIn / 10 ** WOODENG_DECIMALS;

const isBonding       = selectedPool.poolType === 0;




    // only enforce slippage on AMM pools
  if (!isBonding) {
    const spotPrice = Number(selectedPool.price);
    const avgPrice  = quoteUiExact / Number(modalTokensToBuy);
    const priceImpact = ((avgPrice - spotPrice) / spotPrice) * 100;
    if (priceImpact > slippage) {
      setTransactionStatus('error');
      setTransactionMessage('Price impact exceeds slippage tolerance.');
      return;
    }
  }



  // we always want exactly N tokens (in raw units) back
 const memeRawOut = Math.floor(Number(modalTokensToBuy) * 10 ** DEC);

 /* -----------------------------------------------------------
  *  minMemeOut = desired_out × (1 − protocol_fee − user_slippage)
  *               but never less than 1 raw token
  * --------------------------------------------------------- */
 const feePct  = selectedPool.poolType === 0                      // 1 % only
               ? PROTOCOL_FEE_BPS / 10_000
               : 0;
const slipPct = slippage / 100;

const minMemeOut = Math.max(
  1,
  Math.floor(memeRawOut * (1 - feePct - slipPct))
);

    setTransactionStatus('processing');
    setTransactionMessage('Processing transaction...');
    try {
      if (!wallet.publicKey) throw new Error('Please connect your wallet!');
      if (!selectedPool || !modalTokensToBuy) throw new Error('Select amount to buy');
         const tx = await buySoundMeme({
      pool:            selectedPool,
      amountWoodengIn: maxWoodengIn,
      minMemeOut,        // ← now demands exactly N raw tokens
      wallet,
    });


    const DEC = selectedPool.decimals ?? MEME_DECIMALS;
const memeRawOut = Math.floor(Number(modalTokensToBuy) * 10 ** DEC);
const mintStr = selectedPool.memeMint.toBase58();

// ✅ user MEME balance up
adjustMemeBalanceRaw(mintStr, +memeRawOut);

// ✅ user quote balance down (SOL or WOODENG) — we spent exactly maxWoodengIn
adjustQuoteBalanceRaw(selectedPool.quoteMint, -maxWoodengIn);

// ✅ pool reserves / bonding progress patched locally
patchPoolAfterBuy(selectedPool, memeRawOut, maxWoodengIn);

// (you already do these, keep them)
setTransactionStatus('success');
setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);

// keep your reconciliations
await refreshUserNfts();
await refreshBalances();

// (optional) keep the buy modal open for a moment so the live “Balance” line
// visibly updates, or just close as you do now:
setShowBuyModal(false);

    // Immediately persist the on-chain price so a page reload keeps your last trade
try {
  const providerNow = new AnchorProvider(connection, getAnchorWallet(wallet), {});
  const progNow = new Program(poolIdl, POOL_PROGRAM_ID, providerNow);
  const cfgNow = await progNow.account.soundMemeConfig.fetch(selectedPool.pubkey);
  const lamportsNow = Number((cfgNow as any).lastMemePrice ?? 0);
  if (lamportsNow > 0) {
    const mintStr = selectedPool.memeMint.toBase58();
    pushPricePoint(mintStr, lamportsNow);       // update in-memory
    await persistPricePoint(mintStr, lamportsNow, Date.now());
  }
} catch {}



      setTransactionStatus('success');
setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);
   await refreshUserNfts();          // ⬅️ NEW
   await refreshBalances();


   // NEW: refetch pools (so poolType is up-to-date)
const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);
const updatedPools = await fetchSoundMemePoolsWithMetadata(poolProgram);
setPools(updatedPools);
setShowBuyModal(false);                 // close the buy form

// >>> open filled-order pop-up <<<
setBuyFilled({
  open: true,
  symbol: selectedPool.symbol,
  amountMeme: Number(modalTokensToBuy),
  priceWoodeng: quoteUiExact,        // we computed this a few lines above
  quoteLabel: quoteLabelOf(selectedPool),   // ← add this
});

    } catch (e: any) {
      setTransactionStatus('error');
      setTransactionMessage('Error: ' + (e.message || 'Unknown error'));
    }
  };

  const handleConfirmSell = async () => {
  if (!selectedPool) return;

  const DEC = selectedPool.decimals ?? MEME_DECIMALS;
  const amtUi = Number(modalTokensToSell || 0);
  const memeRawIn = Math.floor(amtUi * 10 ** DEC);

  const woodengRawOut  = getQuoteForMemeSell(selectedPool, memeRawIn);
  const woodengUiOut   = woodengRawOut / 10 ** WOODENG_DECIMALS;

  const spotPrice   = Number(selectedPool.price);
  const avgPrice    = amtUi > 0 ? (woodengUiOut / amtUi) : 0;
  const priceImpact = spotPrice > 0 ? ((spotPrice - avgPrice) / spotPrice) * 100 : 0;

  // slippage guard
  const minWoodengOut = Math.floor(woodengRawOut * (1 - slippage / 100));
  if (priceImpact > slippage) {
    setTransactionStatus('error');
    setTransactionMessage('Price impact exceeds slippage tolerance.');
    return;
  }

  setTransactionStatus('processing');
  setTransactionMessage('Processing transaction...');

  try {
    if (!wallet.publicKey) throw new Error('Please connect your wallet!');
    if (!modalTokensToSell) throw new Error('Select amount to sell');

    const tx = await sellSoundMeme({
      pool: selectedPool,
      memeAmountIn: memeRawIn,
      minWoodengOut,
      wallet,
    });

    const mintStr = selectedPool.memeMint.toBase58();

    // optimistic patches
    adjustMemeBalanceRaw(mintStr, -memeRawIn);
    adjustQuoteBalanceRaw(selectedPool.quoteMint, +woodengRawOut);
    patchPoolAfterSell(selectedPool, memeRawIn, woodengRawOut);

    setTransactionStatus('success');
    setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);
    await refreshUserNfts();
    await refreshBalances();
    setShowSellModal(false);

    // optional: refresh last price & persist
    try {
      const providerNow = new AnchorProvider(connection, getAnchorWallet(wallet), {});
      const progNow = new Program(poolIdl, POOL_PROGRAM_ID, providerNow);
      const cfgNow = await progNow.account.soundMemeConfig.fetch(selectedPool.pubkey);
      const lamportsNow = Number((cfgNow as any).lastMemePrice ?? 0);
      if (lamportsNow > 0) {
        const mint = selectedPool.memeMint.toBase58();
        pushPricePoint(mint, lamportsNow);
        await persistPricePoint(mint, lamportsNow, Date.now());
      }
    } catch {}

    // filled-order toast
    setSellFilled({
      open: true,
      symbol: selectedPool.symbol,
      amountMeme: amtUi,
      priceWoodeng: woodengUiOut,
    });
  } catch (e: any) {
    setTransactionStatus('error');
    setTransactionMessage('Error: ' + (e.message || 'Unknown error'));
  }
};



 



async function unlockTokens(
  pool: PoolType,
  nftMint: PublicKey,
  lockId: number | bigint,
  refresh: () => Promise<void>
) {
  /* ➊ — show one-step progress modal */
  setTxStep({
    step : 1,
    total: 1,
    message: "Burning NFT & unlocking tokens…"
  });

  try {
    if (!wallet.publicKey) throw new Error("Connect wallet first");
    if (!nftMint) throw new Error("No NFT mint provided");

    /* —— guard: is the NFT account still there? —— */
    const userNftAccount = await getAta(wallet.publicKey, nftMint);
    const accInfo = await connection.getAccountInfo(userNftAccount);
    if (!accInfo) throw new Error("NFT account not found – did you mint from this wallet?");
    const bal = (await connection.getTokenAccountBalance(userNftAccount)).value.uiAmount;
    if (!bal) throw new Error("This NFT is already burned (balance = 0).");

    /* —— PDAs —— */
    const [lockerPda]       = await getLockerPda(pool.memeMint, wallet.publicKey, BigInt(lockId));
    const userMemeAta       = await getAta(wallet.publicKey, pool.memeMint);
    const lockerMemeAccount = await getAta(lockerPda,      pool.memeMint, true);

    /* —— Anchor call —— */
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

    /* refresh local state & show success pop-up */
    await refresh();
    await refreshBalances();
    setBurnFilled({
      open: true,
      symbol: pool.symbol ?? "",
      amountUnlocked: getMintThreshold(pool)
    });
  } catch (err: any) {
    /* keep error banner behaviour */
    setStatus("Unlock failed: " + (err.message ?? err.toString()));
  } finally {
    /* ➋ — always close the progress modal */
    setTxStep(null);
  }
}


function CompactBondingGauge({ pool }: { pool: PoolType }) {
  if (pool.poolType !== 0) return null;

  const woodLamports = Math.max(0, pool.ammReserves?.woodeng ?? 0);
  const thrLamports  = BONDING_MCAP_THRESHOLD_LAMPORTS; // 35 WOODENG
  const pct          = Math.min(1, woodLamports / thrLamports);
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
  <div className="min-h-screen bg-[#181920] text-white px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
  {/* Header */}
  <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8">Sound Meme Pools</h1>


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

     /* ---------- SELL-eligibility ------------------------------------- */
     const mcap    = pool.ammReserves?.woodeng ?? 0;
     const canSell = isAmm(pool);
          // 24h change for badge
     const chg = change24hFor(pool.memeMint.toBase58());
     const chgAbs = Math.abs(chg).toFixed(2);
     const chgUp = chg >= 0;
        return (
          <div
            key={pool.pubkey.toBase58()}
            className="group bg-[#22232a] border border-[#33334a] rounded-2xl shadow-xl hover:scale-105 transition-all cursor-pointer flex flex-col"
            onClick={() => { setDetailPool(pool); setShowDetail(true); }}
          >
            {/* IMAGE + Overlay */}
            {/* IMAGE + Overlay */}
<div className="relative aspect-square w-full overflow-hidden rounded-t-2xl">
  <img
    src={pool.imageUrl || "https://placehold.co/400x400?text=No+Image"}
    alt={pool.name || 'Sound meme'}
    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
    loading="lazy"
    decoding="async"
    fetchPriority="low"
    sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
  />
  <div className="absolute inset-0 flex items-center justify-center p-2">
    <button
      className="bg-black/70 p-3 rounded-full hover:bg-black/80 transition"
      onClick={e => { e.stopPropagation(); playDemo(pool.pubkey.toBase58(), pool.audioUrl); }}
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
               <div className="mt-3 flex items-center gap-3">
  {/* price + unit */}
  <div className="flex items-baseline gap-2 whitespace-nowrap">
    <TinyPrice
  value={latestPriceOf(pool.memeMint.toBase58())}
  className="text-[#ffc371] font-bold text-lg"
/>

    <span className="text-sm text-[#ffc371]/90">{quoteLabelOf(pool)}</span>
  </div>

  


  {/* right side pushed to edge */}
  <div className="ml-auto flex items-center gap-2">
    <span className="text-xs bg-[#2b323c] px-2 py-1 rounded">{pool.symbol || "MEME"}</span>
    <span className={`text-xs px-2 py-0.5 rounded ${chgUp ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}>
      {chgUp ? '▲' : '▼'} {chgAbs}%
    </span>
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
      {solUsd && (
        <span className="text-[#9ea1ff]">
          {" "} (≈ {fmtUSD(Number(pool.marketCap ?? 0) * solUsd)})
        </span>
      )}
    </div>
  </div>
)}

              {/* Bonding progress (bonding pools only) */}
{pool.poolType === 0 && <BondingProgressBar pool={pool} />}

{/* ─────────── Action buttons ─────────── */}
<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-sm font-semibold">



  {/* ► BUY ------------------------------------------------------- */}

  {!( !isAmm(pool) && poolMcap(pool) >= 69 * 10 ** WOODENG_DECIMALS ) && (
  <button
    className="h-10 rounded bg-[#907aff] text-white hover:bg-[#37ad71] transition"
    onClick={e => { e.stopPropagation(); handleOpenBuyModal(pool); }}
  >
    Buy
  </button>
  )}

  {/* ► SELL ------------------------------------------------------ */}
 {canSell && (
  <button
    onClick={e => { e.stopPropagation(); handleOpenSellModal(pool); }}
    className="h-10 rounded bg-[#ff5656] text-white hover:bg-[#f8d648] transition">
    Sell
  </button>
)}

{/* ► MIGRATE – shown when 35 ≤ mcap < 69 WOODENG */}
{!isAmm(pool) &&
  poolMcap(pool) >= 34 * 10 ** WOODENG_DECIMALS &&
  poolMcap(pool) <  69 * 10 ** WOODENG_DECIMALS && (
    <button
      className="h-10 rounded bg-[#37ad71] text-white hover:bg-[#4cd488] transition"
      onClick={e => { e.stopPropagation(); migratePool(pool); }}>
      Migrate&nbsp;to&nbsp;AMM
    </button>
)}



  {/* ► MINT NFT -------------------------------------------------- */}
  <button
    className="h-10 rounded bg-[#907aff] text-white hover:bg-[#a593ff] transition disabled:opacity-40 flex items-center justify-center gap-1"
    disabled={!!txStep || userMemeTokens(pool) < getMintThreshold(pool)}
    onClick={e => { e.stopPropagation(); handleMintNft(pool); }}
  >
    <Pickaxe className="w-4 h-4" />
    Mint&nbsp;NFT
  </button>

  {/* ► BURN NFT -------------------------------------------------- */}
  <button
     className="h-10 rounded bg-[#ff5656] text-white hover:bg-[#ff7373] transition flex items-center justify-center gap-1 disabled:opacity-40"
    disabled={!nftsLoaded}
    title="Burn your NFT to unlock tokens"
    onClick={async e => {
      e.stopPropagation();
      if (!nftsLoaded || !wallet.publicKey) return;

      // ① raw list from lockers
      const lockDict = userPoolNfts[pool.memeMint.toBase58()] ?? {};
      const maybeNfts = Object.entries(lockDict).map(([lockId, data]) => ({
        lockId: Number(lockId),
        mint:   new PublicKey(data.mint),
      }));

      // ② keep only NFTs still owned
      const ownedNfts = (
        await Promise.all(
          maybeNfts.map(async n =>
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
    {!nftsLoaded ? (
      <Loader2 className="animate-spin w-4 h-4" />
    ) : (
      <>
        <span role="img" aria-label="burn">🔥</span>
        Burn&nbsp;NFT
        {userNftCount > 1 && (
          <span className="ml-1 text-xs">({userNftCount})</span>
        )}
      </>
    )}
  </button>

</div>
              </div>
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
  className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-3 py-[env(safe-area-inset-top)]"
  onClick={() => setShowBuyModal(false)}
>
  <div
    className="bg-[#181920] rounded-2xl w-[min(92vw,420px)] p-4 sm:p-6 shadow-2xl
               flex flex-col items-center relative max-h-[85vh] overflow-y-auto"
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
            tokensLeft === 0
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
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
      onClick={() => setShowSellModal(false)}
    >
      <div
        className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl
                   flex flex-col items-center relative"
        onClick={e => e.stopPropagation()}
      >
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
          disabled={!modalTokensToSell || transactionStatus === 'processing' || overBal}
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
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
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
          {sellFilled.priceWoodeng.toFixed(5)} {quoteLabelOf(selectedPool!)}
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
        <span className="font-semibold">{getMintThreshold(selectedPool ?? {})}</span>
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
              // show toast
              setBurnFilled({
                open: true,
                symbol: burnModal.pool!.symbol ?? '',
                amountUnlocked: getMintThreshold(burnModal.pool!)
              });
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

// history
// Normalize server OHLC (lamports) to UI units; fallback to client build if not ready
const raw = serverCandles[mintKey]?.[selectedTimeRange] ?? [];

const lamportsToUi = (x: number) => x / 10 ** WOODENG_DECIMALS;
const normalize = (b: { t:number; o:number; h:number; l:number; c:number }) => {
  // If server already sent UI values (< 1), leave them; if integers (e.g., 2000),
  // treat as lamports and divide by 1e9 (WOODENG_DECIMALS).
  const M = Math.max(b.o, b.h, b.l, b.c);
  const scale = M > 1 ? 10 ** WOODENG_DECIMALS : 1;
  const f = (v: number) => v / scale;
  return { t: b.t, o: f(b.o), h: f(b.h), l: f(b.l), c: f(b.c) };
};

let candles = raw.map(normalize);
if (!candles.length) {
  candles = buildCandles(mintKey, selectedTimeRange);
}


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
const active = candles[candles.length - 1];
const closed = candles.length >= 2 ? candles[candles.length - 2] : active;
const basePct = closed && closed.o > 0 ? ((closed.c - closed.o) / closed.o) * 100 : 0;


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
