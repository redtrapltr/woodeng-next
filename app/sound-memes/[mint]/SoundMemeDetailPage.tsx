'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Connection, PublicKey, SystemProgram, Transaction,
  Keypair, ComputeBudgetProgram, TransactionInstruction, SendTransactionError,
  LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  NATIVE_MINT, createSyncNativeInstruction, createCloseAccountInstruction,
  createInitializeMintInstruction,
} from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Idl } from '@project-serum/anchor';
import { Program, AnchorProvider, BN } from '@project-serum/anchor';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { PROGRAM_ID as METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { BorshAccountsCoder } from '@project-serum/anchor';
import bs58 from 'bs58';

import { CpAmm, CollectFeeMode, BaseFeeMode, encodeFeeTimeSchedulerParams } from '@meteora-ag/cp-amm-sdk';

import poolIdlJson from '../../../idl/my_sound_meme_pool.json';
import poolIdlV2Json from '../../../idl/my_sound_meme_pool_v2.json';
import lockerIdlJson from '../../../idl/hybrid_meme_coin_nft_locker.json';

import NextDynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft, Play, Pause, Copy, CheckCircle2, ExternalLink,
  TrendingUp, TrendingDown, Loader2, Volume2, VolumeX,
  Info, Globe, Send, Twitter, ChevronDown, Shield, Zap,
  BarChart3, Users, Clock, Award, Rocket, X, Sparkles,
  ImagePlus, Music, RefreshCw,
} from 'lucide-react';

const CandleChart = NextDynamic(
  () => import('../../../src/contexts/components/CandleChart'),
  { ssr: false }
);

// ─── Constants ───────────────────────────────────────────────────────────────

// Test tokens hidden from listings and excluded from creator reputation
const HIDDEN_MINTS = new Set([
  '35kXDQ7LdSBNdNo9iVfXi3ZRE4Mh4pyJt3t3G5rCDwoo',
  'Dn5xinGN5HWTCZr1sUVcExx4xcU9q4YpghreSprkVwoo',
  '9P1S4JQEsVWoW1Yu2Ucp4pLLvj67Z3kaN47k1kj6zwoo',
]);

const USE_DEVNET = false;

// ── V1 mainnet pool program (existing pools) ──
const V1_POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');
const V1_CONFIG_VERSION = 17;

// ── V2 pool program (devnet for now, graduation + holder whitelist) ──
const V2_POOL_PROGRAM_ID = new PublicKey('C1pGixxtxw1z8x7eGcG2kzs4ZWBkXKVLwPJsDjxWTsin');
const V2_CONFIG_VERSION = 22;


const POOL_PROGRAM_ID = V2_POOL_PROGRAM_ID;

const LOCKER_PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');

// Meteora CP-AMM (DAMM v2)
const CP_AMM_PROGRAM = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG');

const STAKING_PROGRAM_ID = new PublicKey(
  'BFJU3f7PXgzcrYPD2MkQsjRko9wDTpEbyJTtLUzSyhFG'
);
const STAKING_PROGRAM_ID_DEVNET = new PublicKey(
  '9Q5BUszjz6HFNXXPWerjn1HM7sTvdXVaNqswJAzZC1s'
);

const WOODENG_MINT = new PublicKey(
  '83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5'
);

// ── Devnet WOODENG mint (different from mainnet) ──
const WOODENG_MINT_DEVNET = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');

// ── Holder profile seed (v2 only) ──
const HOLDER_SEED = Buffer.from('holder');

// MAINNET RPC — reject devnet URLs from .env
const RPC_URL = (
  process.env.NEXT_PUBLIC_SOLANA_RPC &&
  process.env.NEXT_PUBLIC_SOLANA_RPC.startsWith('http') &&
  !process.env.NEXT_PUBLIC_SOLANA_RPC.includes('devnet')
)
    ? process.env.NEXT_PUBLIC_SOLANA_RPC
    : 'https://mainnet.helius-rpc.com/?api-key=6b56ae36-a263-4599-a807-43a5289701dc';

const connection = new Connection(RPC_URL, { commitment: 'processed' });
const devnetConnection = new Connection('https://api.devnet.solana.com', { commitment: 'processed' });
const poolIdl = poolIdlJson as Idl;
const lockerIdl = lockerIdlJson as Idl;

const WSOL_MINT = NATIVE_MINT;
const QUOTE_DECIMALS = 9;
const MEME_DECIMALS = 0;
const CONFIG_VERSION = V2_CONFIG_VERSION; // for new pool creation
const BONDING_SUPPLY = 444_000_000;
const CURVE_THRESHOLD = 44_000_000;

// V2 bonding constants
const V2_PRICE_TARGET_WOODENG_LAMPORTS = 100_000_000n;
// V1 bonding constants (existing mainnet pools)
const V1_PRICE_TARGET_WOODENG_LAMPORTS = 4_444_444n * 10n ** 9n;

const PRICE_TARGET_SOL_LAMPORTS = 44n * 10n ** 9n;

// V2 migration bounds
const V2_MIGRATE_LOWER_WOODENG = 1_400_000n * 10n ** 9n;
const V2_MIGRATE_UPPER_WOODENG = 3_000_000n * 10n ** 9n;
// V1 migration bounds
const V1_MIGRATE_LOWER_WOODENG = 4_317_460n * 10n ** 9n;
const V1_MIGRATE_UPPER_WOODENG = 9_284_888n * 10n ** 9n;

const MIGRATE_LOWER_SOL = 40n * 10n ** 9n;
const MIGRATE_UPPER_SOL = 100n * 10n ** 9n;
const CURVE_THRESHOLD_RAW = 44_000_000n;

const BONDING_CREATOR_FEE_BPS = 50;
const BONDING_STAKING_FEE_BPS = 100;
const AMM_CREATOR_FEE_BPS = 20;
const AMM_STAKING_FEE_BPS = 10;

const PROJECT_WALLET = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');

// ─── Timeframe types ─────────────────────────────────────────────────────────

type Timeframe = '15m' | '30m' | '1h' | '4h' | '24h';
const TF_MS: Record<Timeframe, number> = {
  '15m': 15 * 60_000, '30m': 30 * 60_000,
  '1h': 60 * 60_000, '4h': 4 * 60 * 60_000, '24h': 24 * 60 * 60_000,
};
const DAY_MS = 24 * 60 * 60 * 1000;

function bucketStart(t: number, tf: Timeframe): number {
  if (tf === '24h') return Math.floor(t / DAY_MS) * DAY_MS;
  const ms = TF_MS[tf];
  return Math.floor(t / ms) * ms;
}

// ─── PoolType ────────────────────────────────────────────────────────────────

type PoolType = {
  creator?: PublicKey;
  metaUri?: string;
  hydrated?: boolean;
  poolType: 0 | 1 | 2 | 3;
  graduationTimestamp?: number;
  meteoraPool?: string;
  meteoraPositionNft?: string;
  graduationConfirmed?: boolean;
  lastMemePrice?: number;
  ammReserves: { meme: number; woodeng: number };
  memeMint: PublicKey;
  pubkey: PublicKey;
  price?: number;
  decimals?: number;
  totalSupply?: number;
  marketCap?: number;
  volume24h?: number;
  quoteMint: PublicKey;
  socials?: { x?: string; telegram?: string; website?: string };
  symbol?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  audioUrl?: string;
  attributes?: any[];
  nftThreshold?: number;
  minAvgHoldDays?: number;
  vtokens?: number;
  vwoodeng?: number;
  bondingSold?: number;
  userMemeBalance?: number;
  // locker info (for living meme feature)
  lockerPda?: PublicKey;
  nftMint?: PublicKey;
  lockerOwner?: string;
  // SWL-444: timeline of all locker metadata versions (Living Meme evolution)
  lockerTimeline?: LockerTimelineEntry[];
  // program version (v1 = existing mainnet, v2 = graduation-enabled)
  programVersion?: 'v1' | 'v2';
};

// SWL-444: represents one locker's metadata snapshot in the evolution timeline
type LockerTimelineEntry = {
  lockId: number;
  uri: string;
  owner: string;
  // hydrated fields (resolved from URI)
  imageUrl?: string;
  audioUrl?: string;
  description?: string;
  name?: string;
};

// ─── Utilities ───────────────────────────────────────────────────────────────

const clean = (s?: string) =>
  (s ?? '').replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim();

const quoteIsSol = (p: PoolType) => p.quoteMint?.equals(WSOL_MINT);
const quoteLabelOf = (p: PoolType) => (quoteIsSol(p) ? 'SOL' : 'WOODENG');
const shortAddr = (s: string, chars = 4) => (s ? `${s.slice(0, chars)}…${s.slice(-chars)}` : '');

function targetsFor(pool: PoolType) {
  const isSol = quoteIsSol(pool);
  const isV1 = pool.programVersion === 'v1';
  return {
    priceTargetLamports: isSol
      ? PRICE_TARGET_SOL_LAMPORTS
      : (isV1 ? V1_PRICE_TARGET_WOODENG_LAMPORTS : V2_PRICE_TARGET_WOODENG_LAMPORTS),
    migrateLowerLamports: isSol ? MIGRATE_LOWER_SOL : (isV1 ? V1_MIGRATE_LOWER_WOODENG : V2_MIGRATE_LOWER_WOODENG),
    migrateUpperLamports: isSol ? MIGRATE_UPPER_SOL : (isV1 ? V1_MIGRATE_UPPER_WOODENG : V2_MIGRATE_UPPER_WOODENG),
    curveThresholdRaw: CURVE_THRESHOLD_RAW,
  };
}

function bondingSpotPriceForPool(pool: PoolType, bondingSoldRaw?: number) {
  const vtokens = pool.vtokens ?? 0;
  const vwoodeng = pool.vwoodeng ?? 0;
  const sold = bondingSoldRaw ?? (pool.bondingSold ?? 0);
  if (!vtokens || !vwoodeng) return NaN;
  const { priceTargetLamports, curveThresholdRaw } = targetsFor(pool);
  const p0 = vwoodeng / vtokens;
  const p1 = Number(priceTargetLamports);
  const thr = Number(curveThresholdRaw);
  const k = Math.log(p1 / p0) / thr;
  const priceLamports = p0 * Math.exp(k * sold);
  return priceLamports / 1e9;
}

const asNumber = (x?: any) => Number((x ?? 0).toString?.() ?? x ?? 0);

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
  keys: PublicKey[], chunk = 100, conn: Connection = connection
): Promise<(import('@solana/web3.js').AccountInfo<Buffer> | null)[]> {
  const out: (import('@solana/web3.js').AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    const infos = await conn.getMultipleAccountsInfo(part, 'confirmed');
    out.push(...infos);
  }
  return out;
}

function getAnchorWallet(wallet: WalletContextState) {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions)
    throw new Error('Wallet not ready.');
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };
}

async function fetchMeteoraPoolPrice(
  conn: Connection,
  meteoraPoolAddress: string,
  memeMintStr: string,
  memeDecimals = 6,
  quoteDecimals = 9,
): Promise<number> {
  try {
    const cpAmm = new CpAmm(conn);
    const poolState = await cpAmm.fetchPoolState(new PublicKey(meteoraPoolAddress));
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
  } catch { return 0; }
}

async function getConfigPda(memeMint: PublicKey, programId: PublicKey = POOL_PROGRAM_ID) {
  return await PublicKey.findProgramAddress([Buffer.from('config'), memeMint.toBuffer()], programId);
}

function poolProgramIdFor(pool: PoolType): PublicKey {
  return pool.programVersion === 'v1' ? V1_POOL_PROGRAM_ID : V2_POOL_PROGRAM_ID;
}

function getStakingPdas(quoteMint: PublicKey, woodengMint: PublicKey = WOODENG_MINT, stakingProgram: PublicKey = STAKING_PROGRAM_ID) {
  const [stakingConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), woodengMint.toBuffer()], stakingProgram
  );
  const [rewardsVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault'), woodengMint.toBuffer()], stakingProgram
  );
  const rewardsVaultWsol = getAssociatedTokenAddressSync(NATIVE_MINT, stakingConfig, true);
  return { stakingConfig, rewardsVault, rewardsVaultWsol };
}

async function ensureAtaIx(owner: PublicKey, mint: PublicKey, payer: PublicKey, isPdaOwner = false) {
  const ata = await getAssociatedTokenAddress(mint, owner, isPdaOwner, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const ix = createAssociatedTokenAccountIdempotentInstruction(payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  return { ata, ix };
}

async function sendIxsOnce(
  connection: Connection,
  wallet: any,
  ixs: TransactionInstruction[],
  signers: Keypair[] = [],
  { skipPreflight = false } = {}
) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;
  // Keypair signers must sign BEFORE wallet.signTransaction — many adapters reject
  // transactions that still have unfilled signature slots when they are asked to sign.
  if (signers.length) tx.partialSign(...signers);
  const signed = await wallet.signTransaction(tx);
  const expectedSig = bs58.encode(signed.signatures[0].signature as Buffer);
  try {
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight, preflightCommitment: 'confirmed' });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  } catch (e: any) {
    const msg = (e?.message ?? String(e)).toLowerCase();
    if (expectedSig && /already been processed|duplicate signature/.test(msg)) {
      const start = Date.now();
      while (Date.now() - start < 20_000) {
        const st = await connection.getSignatureStatuses([expectedSig]);
        if (st.value[0] && !st.value[0].err) return expectedSig;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw e;
  }
}

async function buildWrapSolIxs(payer: PublicKey, amountLamports: number) {
  const ata = await getAssociatedTokenAddress(WSOL_MINT, payer);
  return {
    ata,
    ixs: [
      createAssociatedTokenAccountIdempotentInstruction(payer, ata, payer, WSOL_MINT),
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: ata, lamports: amountLamports }),
      createSyncNativeInstruction(ata),
    ],
  };
}

// ─── IPFS upload helpers (Pinata — matching the rest of the app) ─────────────

async function uploadFileToIPFS(file: File): Promise<string> {
  const { jwt } = await fetch('/api/pinata-token')
    .then(r => {
      if (!r.ok) throw new Error('Could not fetch Pinata token');
      return r.json() as Promise<{ jwt: string }>;
    });
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Pinata upload failed');
  return `ipfs://${data.IpfsHash}`;
}

async function uploadMetadataJSON(metadata: object): Promise<string> {
  const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
  return uploadFileToIPFS(new File([blob], 'metadata.json'));
}

function findMetadataPda(nftMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
    METADATA_PROGRAM_ID
  )[0];
}

// ─── NFT Locker helpers ───────────────────────────────────────────────────────

function asciiClean(s?: string) {
  return (s ?? '').replace(/[^\x20-\x7E]/g, '').trim();
}

async function buildCreateMintIxDetail(
  conn: Connection,
  payer: PublicKey,
  decimals: number,
  mintAuthority: PublicKey
): Promise<{ mint: PublicKey; ixs: TransactionInstruction[]; signers: Keypair[] }> {
  const kp = Keypair.generate();
  const lamports = await conn.getMinimumBalanceForRentExemption(82);
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

// ─── TinyPrice component ──────────────────────────────────────────────────────

function TinyPrice({ value, className = '' }: { value: number; className?: string }) {
  if (!Number.isFinite(value) || value <= 0) return <span className={className}>0</span>;
  if (value >= 1e-6) {
    const s = value.toFixed(6).replace(/\.?0+$/, '');
    return <span className={`tabular-nums ${className}`}>{s}</span>;
  }
  const exp = value.toExponential();
  const m = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(exp);
  if (!m) return <span className={`tabular-nums ${className}`}>{value.toFixed(6).replace(/\.?0+$/, '')}</span>;
  const first = m[1], rest = m[2] || '', e = Number(m[3]);
  const zeroCount = Math.max(0, e - 1);
  const digits = (first + rest).slice(0, 6);
  return (
    <span className={`tabular-nums ${className}`}>
      0.0<sup className="align-super text-[10px] opacity-75">{zeroCount}</sup>{digits}
    </span>
  );
}

// ─── Trade History type ───────────────────────────────────────────────────────

type TradeEvent = {
  sig: string;
  type: 'buy' | 'sell';
  memeAmount: number;
  quoteAmount: number;
  price: number;
  time: number;
  trader: string;
};

// ─── Creator Info type ────────────────────────────────────────────────────────

type CreatorInfo = {
  address: string;
  totalLaunches: number;
  pools: Array<{
    mint: string;
    name: string;
    symbol: string;
    imageUrl?: string;
    currentPrice: number;
    athPrice: number;
    athPctGain: number;
    basePrice: number;      // 10% bonding base price (per-pool, handles SOL vs WOODENG)
    bondingSold: number;    // raw bondingSold — >0 means pool completed bonding
    poolType: number;
    quoteMint: string;
  }>;
  avgAthPctGain: number;
  reputationScore: number;
};

// ─── Update step type ─────────────────────────────────────────────────────────

type UpdateStep =
  | 'idle'
  | 'uploading-image'
  | 'uploading-audio'
  | 'uploading-metadata'
  | 'sending-tx'
  | 'confirming'
  | 'done'
  | 'error';

// ════════════════════════════════════════════════════════════════════════════════
// LIVING MEME STUDIO — creator-only metadata update panel
// ════════════════════════════════════════════════════════════════════════════════

// ─── SWL-444: Meme Evolution Timeline ────────────────────────────────────────
function MemeEvolutionTimeline({ timeline }: { timeline: LockerTimelineEntry[] }) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!timeline || timeline.length < 2) return null; // no evolution to show

  const toggleAudio = (idx: number, url?: string) => {
    if (!url) return;
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(url);
    a.onended = () => setPlayingIdx(null);
    a.play().catch(() => {});
    audioRef.current = a;
    setPlayingIdx(idx);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  return (
    <div className="mt-6 rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
      <h3 className="text-sm font-bold text-[#8a8fa3] uppercase tracking-wider mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#c8ff00]" /> Meme Evolution Timeline
      </h3>
      <div className="relative">
        {/* vertical timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-[#c8ff00]/40 via-[#907aff]/30 to-transparent" />

        <div className="space-y-4">
          {timeline.map((entry, i) => {
            const isOriginal = entry.lockId === -1;
            const isCurrent = i === timeline.length - 1;
            return (
              <div key={`${entry.lockId}-${i}`} className="relative pl-12">
                {/* dot on the timeline */}
                <div className={`absolute left-[14px] top-3 w-3 h-3 rounded-full border-2 ${
                  isCurrent
                    ? 'bg-[#c8ff00] border-[#c8ff00] shadow-[0_0_8px_rgba(200,255,0,0.4)]'
                    : 'bg-[#1f2028] border-[#3d4052]'
                }`} />

                <div className={`rounded-xl p-3 transition ${
                  isCurrent
                    ? 'bg-[#c8ff00]/5 border border-[#c8ff00]/20'
                    : 'bg-[#0c0d12] border border-white/[0.04] opacity-80 hover:opacity-100'
                }`}>
                  <div className="flex items-start gap-3">
                    {/* thumbnail */}
                    {entry.imageUrl ? (
                      <img
                        src={entry.imageUrl}
                        alt={entry.name || `Version ${i + 1}`}
                        className="w-14 h-14 rounded-lg object-cover bg-[#1f2028] shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[#1f2028] flex items-center justify-center shrink-0">
                        <ImagePlus className="w-5 h-5 text-[#3d4052]" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {isOriginal ? 'Original' : `Version ${i + 1}`}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold bg-[#c8ff00]/20 text-[#c8ff00] px-1.5 py-0.5 rounded-full uppercase">
                            Current
                          </span>
                        )}
                        {isOriginal && (
                          <span className="text-[9px] font-bold bg-[#907aff]/20 text-[#907aff] px-1.5 py-0.5 rounded-full uppercase">
                            Genesis
                          </span>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-[11px] text-[#6b7084] mt-1 line-clamp-2">{entry.description}</p>
                      )}
                      {/* audio play button */}
                      {entry.audioUrl && (
                        <button
                          onClick={() => toggleAudio(i, entry.audioUrl)}
                          className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#8a8fa3] hover:text-[#ffc371] transition"
                        >
                          {playingIdx === i ? (
                            <><Pause className="w-3 h-3" /> Playing...</>
                          ) : (
                            <><Play className="w-3 h-3" /> Listen</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LivingMemeStudio({
  pool,
  wallet,
  connection: conn,
  onSuccess,
  effectivePublicKey: extEffectivePk,
  unifiedSignTx,
}: {
  pool: PoolType;
  wallet: WalletContextState;
  connection: Connection;
  onSuccess: (newUri: string, newImageUrl: string, newAudioUrl: string) => void;
  effectivePublicKey?: PublicKey | null;
  unifiedSignTx?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
}) {
  const effectivePk = extEffectivePk ?? wallet.publicKey;
  // Only the sound meme creator sees this panel.
  // Check pool.lockerOwner first (locker-specific authority), then fall back to
  // pool.creator (projectWallet from SoundMemeConfig) for pools that haven't
  // had a locker fetched yet or where locker lookup failed.
  const isCreator =
    effectivePk && (
      (pool.lockerOwner && effectivePk.toBase58() === pool.lockerOwner) ||
      (pool.creator && effectivePk.toBase58() === pool.creator.toBase58())
    );
 
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(pool.imageUrl ?? '');
  const [audioPreview, setAudioPreview] = useState(pool.audioUrl ?? '');
  const [description, setDescription] = useState(pool.description ?? '');
  const [step, setStep] = useState<UpdateStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txSig, setTxSig] = useState('');

  // Sync previews when pool data updates (e.g. after locker URI re-hydration)
  React.useEffect(() => {
    if (!imageFile && pool.imageUrl) setImagePreview(pool.imageUrl);
  }, [pool.imageUrl]);
  React.useEffect(() => {
    if (!audioFile && pool.audioUrl) setAudioPreview(pool.audioUrl);
  }, [pool.audioUrl]);
  React.useEffect(() => {
    if (pool.description != null) setDescription(pool.description);
  }, [pool.description]);
 
  const imgInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
 
  if (!isCreator) return null;
 
  const hasChanges =
    !!imageFile || !!audioFile || description !== (pool.description ?? '');
 
  const busy = step !== 'idle' && step !== 'error' && step !== 'done';
 
  const handleUpdate = async () => {
    if (!effectivePk) return;
    if (!pool.lockerPda) {
      setStep('error');
      setErrorMsg('No locker found yet — a locker is created when the first token lock happens.');
      return;
    }
    setErrorMsg('');
    setStep('uploading-image'); // set busy immediately so button disables

    try {
      // ── Step 1: Upload image if changed ──────────────────────────────────
      let finalImageUri = pool.imageUrl ?? '';
      if (imageFile) {
        setStep('uploading-image');
        finalImageUri = await uploadFileToIPFS(imageFile);
      }
 
      // ── Step 2: Upload audio if changed ──────────────────────────────────
      let finalAudioUri = pool.audioUrl ?? '';
      if (audioFile) {
        setStep('uploading-audio');
        finalAudioUri = await uploadFileToIPFS(audioFile);
      }
 
      // ── Step 3: Build + upload new metadata JSON ──────────────────────────
      // This becomes the URI stored in locker.meme_uri going forward.
      // The NEXT person who calls lock_tokens_and_mint_nft will get an NFT
      // with CreateMetadataAccountV3 using this URI — permanently baked in.
      setStep('uploading-metadata');
      const newMetadata = {
        name: pool.name,
        symbol: pool.symbol,
        description,
        image: finalImageUri,
        animation_url: finalAudioUri,
        properties: {
          files: [
            { uri: finalImageUri, type: imageFile?.type ?? 'image/png' },
            { uri: finalAudioUri, type: audioFile?.type ?? 'audio/mpeg' },
          ],
          category: 'audio',
        },
        attributes: [
          { trait_type: 'Platform', value: 'SWL-444' },
          { trait_type: 'Type', value: 'Sound Meme' },
          { trait_type: 'Mint', value: pool.memeMint.toBase58() },
          ...(pool.attributes?.filter((a: any) =>
            !['Platform', 'Type', 'Mint'].includes(a.trait_type)
          ) ?? []),
        ],
        ...(pool.socials?.website ? { external_url: pool.socials.website } : {}),
        extensions: {
          ...(pool.socials?.x ? { twitter: pool.socials.x } : {}),
          ...(pool.socials?.telegram ? { telegram: pool.socials.telegram } : {}),
          ...(pool.socials?.website ? { website: pool.socials.website } : {}),
          ...(pool.nftThreshold ? { threshold: pool.nftThreshold.toString() } : {}),
        },
      };
      const newUri = await uploadMetadataJSON(newMetadata);
 
      // ── Step 4: Call locker program update_locker_uri ─────────────────────
      // This writes newUri into locker.meme_uri on-chain.
      // Simple: only needs caller + locker PDA. No metadata program needed.
      setStep('sending-tx');
      const signTxFn = (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTx;
      if (!signTxFn) throw new Error('No signing function available');
      const anchorWallet = {
        publicKey: effectivePk!,
        signTransaction: signTxFn,
        signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => signTxFn(tx)))),
      };
      const provider = new AnchorProvider(conn, anchorWallet, {
        preflightCommitment: 'confirmed',
      });
      const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

      const updateIx = await (lockerProgram.methods as any)
        .updateLockerUri(newUri)
        .accounts({
          caller: effectivePk,
          locker: pool.lockerPda,
        })
        .instruction();

      const sig = await sendIxsOnce(
        conn,
        anchorWallet,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }), // very cheap ix
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
          updateIx,
        ]
      );
      setTxSig(sig);

      setStep('confirming');
      await conn.confirmTransaction(sig, 'confirmed');
 
      setStep('done');
      // Update the pool display immediately — no page reload needed
      onSuccess(newUri, finalImageUri, finalAudioUri);
    } catch (e: any) {
      setStep('error');
      setErrorMsg(e?.message || String(e));
    }
  };
 
  return (
    <div className="mt-4 rounded-2xl border border-[#c8ff00]/20 bg-[#c8ff00]/[0.03] overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#c8ff00]/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#c8ff00]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#c8ff00]">Living Meme Studio</div>
            <div className="text-[11px] text-[#6b7084] mt-0.5">
              Update image &amp; audio · future minters get new version
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#c8ff00] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
 
      {open && (
        <div className="px-5 pb-5 border-t border-[#c8ff00]/10">
 
          {/* How it works callout */}
          <div className="mt-4 rounded-lg bg-[#1a1b23] border border-white/[0.06] p-3 text-[11px] text-[#8a8fa3] leading-relaxed space-y-1">
            <div className="flex gap-2">
              <span className="text-[#c8ff00]">✦</span>
              <span><strong className="text-white">Future minters</strong> will receive an NFT with your new image &amp; audio permanently baked in.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#6b7084]">·</span>
              <span><strong className="text-white">Existing NFT holders</strong> keep their original snapshot — they can still burn to redeem tokens anytime.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#6b7084]">·</span>
              <span>Name &amp; symbol <strong className="text-white">{pool.name} ({pool.symbol})</strong> are immutable.</span>
            </div>
          </div>
 
          {/* Upload grid */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Image */}
            <div>
              <div className="text-[11px] font-bold text-[#6b7084] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ImagePlus className="w-3 h-3" /> New Image
              </div>
              <div
                onClick={() => imgInputRef.current?.click()}
                className="relative rounded-xl border border-dashed border-[#2d2f3a] bg-[#14151c] cursor-pointer hover:border-[#c8ff00]/40 hover:bg-[#c8ff00]/[0.03] transition overflow-hidden group"
                style={{ aspectRatio: '1' }}
              >
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
                  }}
                />
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-[#c8ff00] text-xs font-bold">Replace →</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-[#6b7084]">
                    <ImagePlus className="w-7 h-7 opacity-40" />
                    <span className="text-[11px] text-center">Drop or click</span>
                  </div>
                )}
              </div>
              {imageFile && (
                <p className="text-[10px] font-mono text-[#c8ff00] mt-1.5 truncate">✓ {imageFile.name}</p>
              )}
            </div>
 
            {/* Audio */}
            <div>
              <div className="text-[11px] font-bold text-[#6b7084] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Music className="w-3 h-3" /> New Audio
              </div>
              <div
                onClick={() => audioInputRef.current?.click()}
                className="relative rounded-xl border border-dashed border-[#2d2f3a] bg-[#14151c] cursor-pointer hover:border-[#c8ff00]/40 hover:bg-[#c8ff00]/[0.03] transition group flex flex-col items-center justify-center gap-3 p-4"
                style={{ aspectRatio: '1' }}
              >
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setAudioFile(f); setAudioPreview(URL.createObjectURL(f)); }
                  }}
                />
                <Music className="w-7 h-7 text-[#6b7084] opacity-40 group-hover:opacity-70 transition" />
                {audioPreview ? (
                  <audio
                    src={audioPreview}
                    controls
                    onClick={e => e.stopPropagation()}
                    className="w-full h-8"
                  />
                ) : (
                  <>
                    <span className="text-[11px] text-[#6b7084]">Drop or click</span>
                    <span className="text-[10px] text-[#3d4052]">MP3, WAV, OGG…</span>
                  </>
                )}
              </div>
              {audioFile && (
                <p className="text-[10px] font-mono text-[#c8ff00] mt-1.5 truncate">✓ {audioFile.name}</p>
              )}
            </div>
          </div>
 
          {/* Description */}
          <div className="mt-4 relative">
            <div className="text-[11px] font-bold text-[#6b7084] uppercase tracking-wider mb-2">Description</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Describe this version of your living meme…"
              className="w-full bg-[#0c0d12] border border-[#2d2f3a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#3d4052] focus:border-[#c8ff00]/30 focus:outline-none resize-none transition font-mono"
            />
            <span className="absolute bottom-3 right-3 text-[10px] text-[#3d4052]">
              {description.length}/500
            </span>
          </div>
 
          {/* Status bar */}
          {step !== 'idle' && (
            <div className={`mt-3 flex items-center gap-2.5 rounded-lg px-4 py-3 text-xs font-mono border ${
              step === 'error'
                ? 'bg-red-500/08 border-red-500/20 text-red-400'
                : step === 'done'
                  ? 'bg-emerald-500/08 border-emerald-500/20 text-emerald-400'
                  : 'bg-[#c8ff00]/05 border-[#c8ff00]/15 text-[#c8ff00]'
            }`}>
              {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
              {step === 'uploading-image' && 'Uploading image to IPFS…'}
              {step === 'uploading-audio' && 'Uploading audio to IPFS…'}
              {step === 'uploading-metadata' && 'Pinning metadata JSON…'}
              {step === 'sending-tx' && 'Awaiting wallet signature…'}
              {step === 'confirming' && 'Confirming on-chain…'}
              {step === 'done' && (
                <>
                  ✅ Locker updated! Future minters get the new version.&nbsp;
                  <a
                    href={`https://solscan.io/tx/${txSig}${USE_DEVNET ? '?cluster=devnet' : ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-white"
                  >
                    View tx ↗
                  </a>
                </>
              )}
              {step === 'error' && `⚠ ${errorMsg}`}
            </div>
          )}
 
          {/* Submit */}
          <button
            onClick={handleUpdate}
            disabled={!hasChanges || busy}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm bg-[#c8ff00] text-black hover:bg-[#d8ff30] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {step === 'done' ? '✦ Updated!' : '✦ Publish New Version'}
          </button>
 
          <p className="mt-2 text-center text-[10px] text-[#3d4052] font-mono">
            ~0.000005 SOL · writes new URI into locker on-chain · IPFS via NFT.Storage
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Hold-time helpers ───────────────────────────────────────────────────────

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

// ─── Diamond Hand Gate ────────────────────────────────────────────────────────

const DH_TIERS = [
  { label: 'Paper Hand',   emoji: '🧻',   min: 0,  max: 1   },
  { label: 'Holder',       emoji: '💎',   min: 1,  max: 7   },
  { label: 'Diamond Hand', emoji: '💎💎', min: 7,  max: 30  },
  { label: 'HODL Legend',  emoji: '🔥',   min: 30, max: 90  },
  { label: 'Diamond God',  emoji: '👑',   min: 90, max: null },
] as const;

function getDHTier(days: number) {
  for (let i = DH_TIERS.length - 1; i >= 0; i--) {
    if (days >= DH_TIERS[i].min) return DH_TIERS[i];
  }
  return DH_TIERS[0];
}

function DiamondHandGate({
  minDays, myDays, loading, walletConnected,
}: {
  minDays: number;
  myDays: number | null;
  loading: boolean;
  walletConnected: boolean;
}) {
  const qualified = myDays !== null && myDays >= minDays;
  const progress   = myDays === null ? 0 : Math.min(100, (myDays / minDays) * 100);
  const daysLeft   = myDays === null ? minDays : Math.max(0, minDays - myDays);

  const myTier  = getDHTier(myDays ?? 0);
  const reqTier = getDHTier(minDays);

  // Progress colour: interpolate hue 0 (red) → 120 (green)
  const hue   = Math.round(progress * 1.2);
  const barColor = `hsl(${hue}, 90%, 52%)`;

  const motivation = progress < 25
    ? 'HODL longer to unlock this meme 💎'
    : progress < 50
    ? 'Keep holding — you\'re building your rep 🔥'
    : progress < 75
    ? 'Almost halfway there! Diamond hands don\'t quit 💎'
    : progress < 99
    ? 'So close! Just a few more days… 👑'
    : null; // won't be shown when qualified

  if (qualified) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
           style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)' }}>
        <span className="text-base">✅</span>
        <span className="text-sm font-bold" style={{ color: '#4ade80' }}>Diamond Hand Verified</span>
        <span className="text-xs font-mono ml-1" style={{ color: '#86efac' }}>
          {fmtHoldTime(myDays!)} avg hold
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0f101a, #12131e)', border: '1px solid rgba(139,92,246,0.35)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5"
           style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
             style={{ background: 'linear-gradient(135deg, #6d28d9, #0e7490)', boxShadow: '0 0 12px rgba(139,92,246,0.5)' }}>
          🔒
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black tracking-wide" style={{ color: '#e2d9ff' }}>Diamond Hand Gate</p>
          <p className="text-[10px]" style={{ color: '#7c6fa8' }}>
            Requires {minDays}d avg hold · {reqTier.emoji} {reqTier.label}
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        {!walletConnected ? (
          <p className="text-xs text-center py-2" style={{ color: '#6b7280' }}>
            Connect wallet to check eligibility
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a78bfa' }} />
            <span className="text-xs" style={{ color: '#6b7280' }}>Checking your diamond hands…</span>
          </div>
        ) : (
          <>
            {/* Days remaining hero */}
            <div className="text-center mb-3">
              <div className="text-3xl font-black tabular-nums leading-none mb-0.5"
                   style={{ color: daysLeft === 0 ? '#4ade80' : barColor, textShadow: `0 0 20px ${barColor}60` }}>
                {fmtHoldTime(daysLeft)}
              </div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: '#6b7280' }}>
                remaining to unlock
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 rounded-full overflow-hidden mb-3"
                 style={{ background: '#1a1b26' }}>
              {/* Full gradient track */}
              <div className="absolute inset-0 rounded-full opacity-20"
                   style={{ background: 'linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e)' }} />
              {/* Filled bar */}
              <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                   style={{ width: `${progress}%`, background: `linear-gradient(90deg, hsl(0,90%,52%), ${barColor})` }}>
                {/* Shimmer pulse */}
                <div className="absolute inset-0 rounded-full animate-pulse opacity-40"
                     style={{ background: `linear-gradient(90deg, transparent, white, transparent)` }} />
              </div>
              {/* Glow dot at progress tip */}
              {progress > 2 && progress < 100 && (
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white/50 transition-all duration-700"
                     style={{ left: `calc(${progress}% - 6px)`, background: barColor, boxShadow: `0 0 8px ${barColor}` }} />
              )}
            </div>

            {/* Tier row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                   style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <span className="text-xs">{myTier.emoji}</span>
                <span className="text-[10px] font-bold" style={{ color: '#a78bfa' }}>
                  {myTier.label} · {fmtHoldTime(myDays ?? 0)}
                </span>
              </div>
              <div className="text-[10px]" style={{ color: '#4b5563' }}>→</div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                   style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}>
                <span className="text-xs">{reqTier.emoji}</span>
                <span className="text-[10px] font-bold" style={{ color: '#67e8f9' }}>
                  {reqTier.label} · {minDays}d
                </span>
              </div>
            </div>

            {/* Motivational message */}
            {motivation && (
              <p className="text-[11px] text-center font-semibold py-1"
                 style={{ color: '#7c6fa8' }}>
                {motivation}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function SoundMemeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wallet = useWallet();
  const { publicKey: unifiedPublicKey, connected: unifiedConnected, sendTransaction: unifiedSendTransaction, signTransaction: unifiedSignTransaction } = useUnifiedWallet();
  const effectivePublicKey = (wallet.connected && wallet.publicKey) ? wallet.publicKey : unifiedPublicKey;
  const effectiveConnected = wallet.connected || unifiedConnected;
  const mintParam = params?.mint as string;

  // ── State ──────────────────────────────────────────────────────────────────
  const [pool, setPool] = useState<PoolType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart
  const [selectedTf, setSelectedTf] = useState<Timeframe>('1h');
  const [serverCandles, setServerCandles] = useState<any[]>([]);
  const [hoverDeltaPct, setHoverDeltaPct] = useState<number | null>(null);

  // Price series
  const [priceHistory, setPriceHistory] = useState<{ time: number; price: number }[]>([]);

  // Audio
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Trade panel
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeStatus, setTradeStatus] = useState('');

  // User balance
  const [userMemeBalance, setUserMemeBalance] = useState(0);
  const [userQuoteBalance, setUserQuoteBalance] = useState(0);

  // Diamond Hand Gate — proactive HolderProfile fetch for gated V2 pools
  const [myAvgDays, setMyAvgDays] = useState<number | null>(null);
  const [hpFetching, setHpFetching] = useState(false);

  // Creator info
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);

  // Trade history
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  // Copied
  const [copied, setCopied] = useState(false);

  // NFT Locker
  const [userNfts, setUserNfts] = useState<Array<{lockId: number; nftMint: PublicKey}>>([]);
  const [nftsLoaded, setNftsLoaded] = useState(false);
  const [nftBusy, setNftBusy] = useState(false);
  const [nftStatus, setNftStatus] = useState('');

  // Graduate to Meteora
  const [gradBusy, setGradBusy] = useState(false);
  const [gradStatus, setGradStatus] = useState('');

  // Create DAMM v2 pool
  const [dammBusy, setDammBusy] = useState(false);
  const [dammStatus, setDammStatus] = useState('');
  const [dammPoolPubkey, setDammPoolPubkey] = useState<string | null>(null);
  const [gradError, setGradError] = useState<string | null>(null);

  // Live price from Meteora for graduated pools
  const [livePrice, setLivePrice] = useState<number | null>(null);
  // WOODENG USD price from Jupiter
  const [woodengUsdPrice, setWoodengUsdPrice] = useState(0);

  // Meteora DAMM v2 swap (graduated pools)
  const [meteoraTradeTab, setMeteoraTradeTab] = useState<'buy' | 'sell'>('buy');
  const [meteoraAmount, setMeteoraAmount] = useState('');
  const [meteoraQuoteOut, setMeteoraQuoteOut] = useState<string | null>(null);
  const [meteoraBusy, setMeteoraBusy] = useState(false);
  const [meteoraStatus, setMeteoraStatus] = useState('');
  const [showJupiter, setShowJupiter] = useState(false);

  // ── Devnet detection ──
  const [isDevnetPool, setIsDevnetPool] = useState(false);
  // Active connection: devnet if pool is devnet, mainnet otherwise
  const activeConnection = isDevnetPool ? devnetConnection : connection;
  const activeWoodengMint = isDevnetPool ? WOODENG_MINT_DEVNET : WOODENG_MINT;

  // ── Fetch pool + locker data ───────────────────────────────────────────────

  useEffect(() => {
    if (!mintParam) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const memeMint = new PublicKey(mintParam);

        // Try mainnet first (V2 then V1), then devnet V2
        let conn = connection;
        let detectedDevnet = false;
        let poolProgramId = V2_POOL_PROGRAM_ID;
        let configVersion: number = V2_CONFIG_VERSION;
        let programVersion: 'v1' | 'v2' = 'v2';

        const [configPdaV2] = await getConfigPda(memeMint, V2_POOL_PROGRAM_ID);
        let cfgRaw = await connection.getAccountInfo(configPdaV2);
        let configPda = configPdaV2;

        if (!cfgRaw) {
          // Try V1 mainnet
          const [configPdaV1] = await getConfigPda(memeMint, V1_POOL_PROGRAM_ID);
          cfgRaw = await connection.getAccountInfo(configPdaV1);
          if (cfgRaw) {
            configPda = configPdaV1;
            poolProgramId = V1_POOL_PROGRAM_ID;
            configVersion = V1_CONFIG_VERSION;
            programVersion = 'v1';
          }
        }

        if (!cfgRaw) {
          // Try V2 on devnet
          cfgRaw = await devnetConnection.getAccountInfo(configPdaV2);
          if (cfgRaw) {
            configPda = configPdaV2;
            conn = devnetConnection;
            detectedDevnet = true;
            poolProgramId = V2_POOL_PROGRAM_ID;
            configVersion = V2_CONFIG_VERSION;
            programVersion = 'v2';
            console.log('[DetailPage] Pool found on devnet');
          }
        }

        if (!cfgRaw) throw new Error('Pool not found on mainnet or devnet');
        if (!cancelled) setIsDevnetPool(detectedDevnet);

        const provider = new AnchorProvider(
          conn,
          effectivePublicKey
            ? { publicKey: effectivePublicKey, signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction, signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))) }
            : { publicKey: new PublicKey('11111111111111111111111111111111') } as any,
          { preflightCommitment: 'processed' }
        );

        const poolProgram = new Program(
          programVersion === 'v2' ? (poolIdlV2Json as Idl) : poolIdl,
          poolProgramId,
          provider
        );
        const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

        const cfg = poolProgram.coder.accounts.decode('SoundMemeConfig', cfgRaw.data);
        console.log('[DetailPage] decoded cfg.minAvgHoldDays =', (cfg as any).minAvgHoldDays, 'programVersion =', programVersion);
        const cfgVersion = (cfg as any).version as number;
        if (cfgVersion !== V1_CONFIG_VERSION && cfgVersion !== V2_CONFIG_VERSION) {
          throw new Error('Pool version not supported (test pool)');
        }
        const quoteMint = new PublicKey((cfg as any).woodengMint);
        const rawPt = (cfg as any).poolType as number;
        const poolType = (rawPt === 3 ? 3 : rawPt === 2 ? 2 : rawPt === 1 ? 1 : 0) as 0 | 1 | 2 | 3;
        const creator = (() => {
          try { return new PublicKey((cfg as any).projectWallet ?? (cfg as any).project_wallet); } catch { return undefined; }
        })();

        // Vaults + metadata
        const [memeVault] = await PublicKey.findProgramAddress(
          [Buffer.from('pool_meme_vault'), memeMint.toBuffer()], poolProgramId
        );
        const [woodVault] = await PublicKey.findProgramAddress(
          [Buffer.from('pool_woodeng_vault'), memeMint.toBuffer()], poolProgramId
        );
        const [metaPda] = await PublicKey.findProgramAddress(
          [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), memeMint.toBuffer()], METADATA_PROGRAM_ID
        );

        const [mintInfo, memeVaultInfo, woodVaultInfo, metadataInfo] =
          await getMultiple([memeMint, memeVault, woodVault, metaPda], 100, conn);

        let decimals = 0, supplyUi = 0;
        if (mintInfo?.data && mintInfo.data.length >= 82) {
          decimals = mintInfo.data[44];
          supplyUi = readU64LESafe(mintInfo.data, 36) / 10 ** decimals;
        }

        const memeReserveRaw = memeVaultInfo?.data && memeVaultInfo.data.length >= 72
          ? readU64LESafe(memeVaultInfo.data, 64) : 0;
        const woodReserveLamports = woodVaultInfo?.data && woodVaultInfo.data.length >= 72
          ? readU64LESafe(woodVaultInfo.data, 64) : 0;

        let metaName = '', metaSymbol = '', metaUri: string | undefined;
        if (metadataInfo?.data) {
          try {
            const [md] = Metadata.deserialize(metadataInfo.data);
            metaName = clean((md as any).data.name);
            metaSymbol = clean((md as any).data.symbol);
            metaUri = clean((md as any).data.uri);
          } catch {}
        }

        // Price
        const tmpPool = {
          vtokens: asNumber((cfg as any).vtokens),
          vwoodeng: asNumber((cfg as any).vwoodeng),
          bondingSold: asNumber((cfg as any).bondingSold),
          quoteMint,
          poolType,
          programVersion,
        } as PoolType;

        let price = 1;
        if (poolType === 0) {
          price = bondingSpotPriceForPool(tmpPool);
        } else if (poolType === 2 || poolType === 3) {
          const lmp = asNumber((cfg as any).lastMemePrice);
          if (lmp > 0) price = lmp / 1e9;
        } else if (memeReserveRaw > 0 && woodReserveLamports > 0) {
          price = (woodReserveLamports / 1e9) / (memeReserveRaw / 10 ** decimals);
        }

        const poolObj: PoolType = {
          pubkey: configPda,
          poolType,
          lastMemePrice: asNumber((cfg as any).lastMemePrice),
          vtokens: asNumber((cfg as any).vtokens),
          vwoodeng: asNumber((cfg as any).vwoodeng),
          bondingSold: asNumber((cfg as any).bondingSold),
          nftThreshold: asNumber((cfg as any).nftThreshold),
          minAvgHoldDays: Number((cfg as any).minAvgHoldDays ?? 0),
          memeMint,
          quoteMint,
          ammReserves: { meme: memeReserveRaw, woodeng: woodReserveLamports },
          price,
          decimals,
          totalSupply: supplyUi,
          marketCap: price * supplyUi,
          creator,
          name: metaName,
          symbol: metaSymbol,
          metaUri,
          description: '',
          imageUrl: undefined,
          audioUrl: undefined,
          attributes: [],
          socials: undefined,
          hydrated: false,
          programVersion,
        };

        // Hydrate off-chain metadata
        if (metaUri) {
          try {
            const httpUri = toHttp(metaUri);
            if (httpUri) {
              const r = await fetch(httpUri, { cache: 'no-store' });
              if (r.ok) {
                const j = await r.json();
                const norm = (u?: string) => {
                  if (!u) return undefined;
                  const s = String(u).trim();
                  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
                };
                const attrVal = (name: string) => {
                  if (!Array.isArray(j.attributes)) return undefined;
                  const hit = j.attributes.find((a: any) =>
                    String(a?.trait_type ?? '').toLowerCase() === name.toLowerCase()
                  );
                  return hit?.value;
                };
                poolObj.description = j.description || '';
                poolObj.imageUrl = toHttp(j.image || '');
                poolObj.audioUrl = toHttp(j.animation_url || '');
                poolObj.attributes = Array.isArray(j.attributes) ? j.attributes : [];
                poolObj.socials = {
                  x: norm(j?.extensions?.twitter ?? j?.socials?.x ?? j?.twitter ?? attrVal('X') ?? attrVal('Twitter')),
                  telegram: norm(j?.extensions?.telegram ?? j?.socials?.telegram ?? j?.telegram ?? attrVal('Telegram')),
                  website: norm(j?.external_url ?? j?.extensions?.website ?? j?.socials?.website ?? attrVal('Website')),
                };
                const thresholdMeta = j?.extensions?.threshold ?? j?.socials?.threshold ?? attrVal('Threshold');
                const parsed = Number(String(thresholdMeta ?? '').replace(/[,_\s]/g, ''));
                if (Number.isFinite(parsed) && parsed > 0) poolObj.nftThreshold = Math.floor(parsed);
                poolObj.hydrated = true;
              }
            }
          } catch {}
        }

        // ── Fetch locker info for living meme feature ──────────────────────────
        // SWL-444: Find ALL lockers for this mint, pick creator-owned with highest lockId,
        // and build a chronological timeline of all metadata versions.
        try {
          const disc = BorshAccountsCoder.accountDiscriminator('LockerState');
          const lockerAccounts = await conn.getProgramAccounts(LOCKER_PROGRAM_ID, {
            filters: [
              { memcmp: { offset: 0, bytes: bs58.encode(disc) } },
              { memcmp: { offset: 8, bytes: memeMint.toBase58() } }, // meme_mint at offset 8
            ],
          });

          if (lockerAccounts.length > 0) {
            // Decode all lockers for this mint
            type DecodedLocker = {
              pubkey: PublicKey;
              lockId: number;
              owner: string;
              uri: string;
              nftMint: PublicKey;
            };
            const decoded: DecodedLocker[] = [];
            for (const { pubkey, account } of lockerAccounts) {
              try {
                const s = lockerProgram.coder.accounts.decode('LockerState', account.data) as any;
                decoded.push({
                  pubkey,
                  lockId: Number(s.lockId ?? 0),
                  owner: new PublicKey(s.lockerOwner).toBase58(),
                  uri: String(s.memeUri ?? '').replace(/\0/g, '').trim(),
                  nftMint: new PublicKey(s.nftMint),
                });
              } catch {}
            }

            if (decoded.length > 0) {
              // Pick the best locker: creator-owned with highest lockId
              const creatorStr = creator?.toBase58();
              const creatorLockers = creatorStr
                ? decoded.filter(d => d.owner === creatorStr)
                : [];
              const candidates = creatorLockers.length ? creatorLockers : decoded;
              const best = candidates.reduce((a, b) => (b.lockId > a.lockId ? b : a));

              poolObj.lockerPda = best.pubkey;
              poolObj.nftMint = best.nftMint;
              poolObj.lockerOwner = best.owner;

              // ── Living Meme: re-hydrate from the best locker's URI
              if (best.uri && best.uri !== metaUri) {
                try {
                  const httpLockerUri = toHttp(best.uri);
                  if (httpLockerUri) {
                    const lr = await fetch(httpLockerUri, { cache: 'no-store' });
                    if (lr.ok) {
                      const lj = await lr.json();
                      if (lj.image) poolObj.imageUrl = toHttp(lj.image);
                      if (lj.animation_url) poolObj.audioUrl = toHttp(lj.animation_url);
                      if (lj.description) poolObj.description = lj.description;
                      poolObj.metaUri = best.uri;
                      poolObj.hydrated = true;
                    }
                  }
                } catch (e) {
                  console.debug('Locker URI hydration failed:', e);
                }
              }

              // ── SWL-444: Build timeline from ALL lockers with distinct URIs
              // Sort by lockId ascending (chronological)
              const sorted = [...decoded]
                .filter(d => !!d.uri)
                .sort((a, b) => a.lockId - b.lockId);

              // Deduplicate by URI (same URI across different lockIds = same version)
              const seenUris = new Set<string>();
              const uniqueEntries = sorted.filter(d => {
                if (seenUris.has(d.uri)) return false;
                seenUris.add(d.uri);
                return true;
              });

              // Also include the original token metadata URI as the first entry if different
              if (metaUri && !seenUris.has(metaUri)) {
                uniqueEntries.unshift({
                  pubkey: PublicKey.default,
                  lockId: -1, // sentinel: original metadata
                  owner: creatorStr || '',
                  uri: metaUri,
                  nftMint: PublicKey.default,
                });
              }

              // Hydrate timeline entries (fetch metadata JSONs in parallel)
              if (uniqueEntries.length > 1) {
                const timelineResults = await Promise.allSettled(
                  uniqueEntries.map(async (entry): Promise<LockerTimelineEntry> => {
                    const base: LockerTimelineEntry = {
                      lockId: entry.lockId,
                      uri: entry.uri,
                      owner: entry.owner,
                    };
                    try {
                      const url = toHttp(entry.uri);
                      if (!url) return base;
                      const r = await fetch(url, { cache: 'no-store' });
                      if (!r.ok) return base;
                      const j = await r.json();
                      return {
                        ...base,
                        imageUrl: toHttp(j.image || ''),
                        audioUrl: toHttp(j.animation_url || ''),
                        description: j.description || '',
                        name: j.name || '',
                      };
                    } catch {
                      return base;
                    }
                  })
                );
                poolObj.lockerTimeline = timelineResults
                  .filter((r): r is PromiseFulfilledResult<LockerTimelineEntry> => r.status === 'fulfilled')
                  .map(r => r.value);
              }
            }
          }
        } catch (e) {
          // Locker may not exist yet — not an error
          console.debug('Locker lookup:', e);
        }

        // Graduation info
        if (poolType === 2 || poolType === 3) {
          try {
            const [gradPda] = await PublicKey.findProgramAddress(
              [Buffer.from('graduation'), configPda.toBuffer()], poolProgramId
            );
            const gradInfo = await connection.getAccountInfo(gradPda, 'confirmed');
            if (gradInfo?.data && gradInfo.data.length >= 8 + 106) {
              const offset = 8;
              poolObj.graduationTimestamp = Number(gradInfo.data.readBigInt64LE(offset + 32));
              poolObj.meteoraPool = new PublicKey(gradInfo.data.subarray(offset + 40, offset + 72)).toBase58();
              poolObj.meteoraPositionNft = new PublicKey(gradInfo.data.subarray(offset + 72, offset + 104)).toBase58();
              poolObj.graduationConfirmed = gradInfo.data[offset + 104] === 1;
            }
          } catch {}
        }

        if (!cancelled) setPool(poolObj);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load pool');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [mintParam, effectivePublicKey?.toBase58()]);

  // ── Fetch OHLC candles ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pool) return;
    let stop = false;
    (async () => {
      try {
        const r = await fetch(`/api/ohlc/${mintParam}?tf=${selectedTf}&limit=1000`, { cache: 'no-store' });
        const raw = r.ok ? await r.json() : [];
        const bars = Array.isArray(raw) ? raw.map((b: any) => ({
          t: Number(b.t), o: Number(b.o) / 1e9, h: Number(b.h) / 1e9,
          l: Number(b.l) / 1e9, c: Number(b.c) / 1e9, v: Number(b.v) | 0
        })) : [];
        if (!stop && Array.isArray(bars)) setServerCandles(bars);
      } catch {}
    })();
    return () => { stop = true; };
  }, [pool, selectedTf, mintParam]);

  // ── Fetch price history ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mintParam) return;
    let stop = false;
    (async () => {
      try {
        const r = await fetch(`/api/pricepoints/${mintParam}?limit=500`, { cache: 'no-store' });
        if (r.ok && !stop) {
          const pts = await r.json();
          if (Array.isArray(pts)) {
            setPriceHistory(pts.map((p: any) => ({
              time: Number(p.at ?? p.time ?? p.t),
              price: Number(p.priceLamports ?? p.price ?? p.p) / 1e9,
            })).filter((p: any) => Number.isFinite(p.time) && Number.isFinite(p.price) && p.price > 0));
          }
        }
      } catch {}
    })();
    return () => { stop = true; };
  }, [mintParam]);

  // ── Fetch user balances ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pool || !effectivePublicKey) return;
    let stop = false;
    (async () => {
      try {
        const memeAta = await getAssociatedTokenAddress(pool.memeMint, effectivePublicKey!);
        const quoteAta = await getAssociatedTokenAddress(pool.quoteMint, effectivePublicKey!);
        const [memeInfo, quoteInfo] = await getMultiple([memeAta, quoteAta], 100, activeConnection);
        if (!stop) {
          setUserMemeBalance(memeInfo?.data && memeInfo.data.length >= 72
            ? readU64LESafe(memeInfo.data, 64) / 10 ** (pool.decimals ?? 0) : 0);
          setUserQuoteBalance(quoteInfo?.data && quoteInfo.data.length >= 72
            ? readU64LESafe(quoteInfo.data, 64) / 1e9 : 0);
        }
      } catch {}
    })();
    return () => { stop = true; };
  }, [pool, effectivePublicKey?.toBase58(), activeConnection]);

  // ── Fetch creator info ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pool?.creator) return;
    const creatorAddr = pool.creator.toBase58();
    let stop = false;
    setCreatorLoading(true);
    (async () => {
      try {
        const provider = new AnchorProvider(
          connection,
          { publicKey: new PublicKey('11111111111111111111111111111111') } as any,
          { preflightCommitment: 'processed' }
        );
        const poolProgram = new Program(poolIdl, V2_POOL_PROGRAM_ID, provider);
        const disc = BorshAccountsCoder.accountDiscriminator('SoundMemeConfig');

        // Scan BOTH v1 and v2 programs for this creator's pools
        const [v1Raw, v2Raw] = await Promise.all([
          connection.getProgramAccounts(V1_POOL_PROGRAM_ID, {
            filters: [
              { memcmp: { offset: 0, bytes: bs58.encode(disc) } },
              { memcmp: { offset: 8, bytes: bs58.encode(Buffer.from([V1_CONFIG_VERSION])) } },
            ],
          }).catch(() => []),
          connection.getProgramAccounts(V2_POOL_PROGRAM_ID, {
            filters: [
              { memcmp: { offset: 0, bytes: bs58.encode(disc) } },
              { memcmp: { offset: 8, bytes: bs58.encode(Buffer.from([V2_CONFIG_VERSION])) } },
            ],
          }).catch(() => []),
        ]);

        // Tag each with version and program ID for PDA derivation
        const rawConfigs = [
          ...v1Raw.map(r => ({ ...r, _version: 'v1' as const, _programId: V1_POOL_PROGRAM_ID, _configVersion: V1_CONFIG_VERSION })),
          ...v2Raw.map(r => ({ ...r, _version: 'v2' as const, _programId: V2_POOL_PROGRAM_ID, _configVersion: V2_CONFIG_VERSION })),
        ];

        const creatorPools: CreatorInfo['pools'] = [];
        for (const entry of rawConfigs) {
          const { pubkey, account, _version, _programId, _configVersion } = entry;
          if (account.data[8] !== _configVersion) continue;
          try {
            const acc = poolProgram.coder.accounts.decode('SoundMemeConfig', account.data);
            const projWallet = new PublicKey((acc as any).projectWallet ?? (acc as any).project_wallet);
            if (!projWallet.equals(pool.creator!)) continue;
            const mm = new PublicKey((acc as any).memeMint);
            if (HIDDEN_MINTS.has(mm.toBase58())) continue;
            const qm = new PublicKey((acc as any).woodengMint);
            const pt = (acc as any).poolType as number;
            const [mv] = await PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'), mm.toBuffer()], _programId);
            const [wv] = await PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), mm.toBuffer()], _programId);
            const [metaPda] = await PublicKey.findProgramAddress([Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mm.toBuffer()], METADATA_PROGRAM_ID);
            const [mintAcc, mvi, wvi, mi] = await getMultiple([mm, mv, wv, metaPda]);
            let dec = 0;
            if (mintAcc?.data && mintAcc.data.length >= 82) dec = mintAcc.data[44];
            const memeR = mvi?.data && mvi.data.length >= 72 ? readU64LESafe(mvi.data, 64) : 0;
            const woodR = wvi?.data && wvi.data.length >= 72 ? readU64LESafe(wvi.data, 64) : 0;
            let currentPrice = 0;
            if (pt === 0) {
              const tmp = { vtokens: asNumber((acc as any).vtokens), vwoodeng: asNumber((acc as any).vwoodeng), bondingSold: asNumber((acc as any).bondingSold), quoteMint: qm, poolType: 0, programVersion: _version } as PoolType;
              currentPrice = bondingSpotPriceForPool(tmp);
            } else if (pt === 2 || pt === 3) {
              const lmp = asNumber((acc as any).lastMemePrice);
              if (lmp > 0) currentPrice = lmp / 1e9;
              // Try to fetch live Meteora price for this graduated pool
              try {
                const [gradPda] = await PublicKey.findProgramAddress(
                  [Buffer.from('graduation'), pubkey.toBuffer()],
                  _programId
                );
                const gradAcc = await activeConnection.getAccountInfo(gradPda);
                if (gradAcc?.data && gradAcc.data.length >= 8 + 106) {
                  const meteoraPoolAddr = new PublicKey(gradAcc.data.subarray(8 + 40, 8 + 72)).toBase58();
                  const liveP = await fetchMeteoraPoolPrice(activeConnection, meteoraPoolAddr, mm.toBase58(), dec, 9);
                  if (liveP > 0) currentPrice = liveP;
                }
              } catch {}
            } else if (memeR > 0 && woodR > 0) {
              currentPrice = (woodR / 1e9) / (memeR / 10 ** dec);
            }
            let metaName = '', metaSymbol = '', metaImage: string | undefined;
            if (mi?.data) {
              try {
                const [md] = Metadata.deserialize(mi.data);
                metaName = clean((md as any).data.name);
                metaSymbol = clean((md as any).data.symbol);
                const uri = clean((md as any).data.uri);
                if (uri) {
                  try {
                    const jr = await fetch(toHttp(uri) || '', { cache: 'no-store' });
                    if (jr.ok) { const jj = await jr.json(); metaImage = toHttp(jj.image); }
                  } catch {}
                }
              } catch {}
            }
            let athPrice = currentPrice;
            try {
              const hr = await fetch(`/api/pricepoints/${mm.toBase58()}?limit=1000`, { cache: 'no-store' });
              if (hr.ok) {
                const hpts = await hr.json();
                if (Array.isArray(hpts)) for (const hp of hpts) {
                  const p = Number(hp.priceLamports ?? hp.price ?? 0) / 1e9;
                  if (p > athPrice) athPrice = p;
                }
              }
            } catch {}
            // Base price: V2 graduated → graduation price; otherwise 0.1 WOODENG target
            let basePrice: number;
            if (pt === 2 || pt === 3) {
              const gradPrice = asNumber((acc as any).lastMemePrice) / 1e9;
              basePrice = gradPrice > 0 ? gradPrice : (qm.equals(WSOL_MINT) ? Number(PRICE_TARGET_SOL_LAMPORTS) / 1e9 : 0.1);
            } else {
              basePrice = qm.equals(WSOL_MINT) ? Number(PRICE_TARGET_SOL_LAMPORTS) / 1e9 : 0.1;
            }
            const currentMult = currentPrice > 0 ? currentPrice / basePrice : 0;
            const athMult = athPrice > 0 ? athPrice / basePrice : currentMult;
            const athPctGain = athMult > 0 ? (athMult - 1) * 100 : 0;
            const bondingSold = asNumber((acc as any).bondingSold);
            creatorPools.push({ mint: mm.toBase58(), name: metaName, symbol: metaSymbol, imageUrl: metaImage, currentPrice, athPrice, athPctGain, basePrice, poolType: pt, quoteMint: qm.toBase58(), bondingSold });
          } catch {}
        }
        if (stop) return;
        // Compute avg multiplier: currentPrice / basePrice (same formula as SoundMemesClient)
        const avgMult = creatorPools.length
          ? creatorPools.reduce((s, p) => s + (p.currentPrice > 0 ? p.currentPrice / p.basePrice : 0), 0) / creatorPools.length
          : 0;
        const avgAth = creatorPools.length ? creatorPools.reduce((s, p) => s + p.athPctGain, 0) / creatorPools.length : 0;
        // Graduated = finished bonding. v1: poolType>=1 with bondingSold>0. v2: poolType>=2.
        const graduated = creatorPools.filter(p =>
          p.poolType >= 2 || (p.poolType >= 1 && (p.bondingSold ?? 0) > 0)
        ).length;
        // Score: launches (max 30) + performance log10(avgMult)*20 (max 40) + graduated (max 30)
        const launchScore = Math.min(30, creatorPools.length * 10);
        const perfScore = avgMult > 1 ? Math.min(40, Math.log10(avgMult) * 20) : 0;
        const gradScore = Math.min(30, graduated * 15);
        const repScore = Math.min(100, Math.round(launchScore + perfScore + gradScore));
        setCreatorInfo({ address: creatorAddr, totalLaunches: creatorPools.length, pools: creatorPools.sort((a, b) => b.athPctGain - a.athPctGain), avgAthPctGain: avgAth, reputationScore: repScore });
      } catch (e) { console.warn('Creator info:', e); }
      finally { if (!stop) setCreatorLoading(false); }
    })();
    return () => { stop = true; };
  }, [pool?.creator?.toBase58()]);

  // ── Fetch trade history ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pool) return;
    let stop = false;
    setTradesLoading(true);
    (async () => {
      try {
        const [configPda] = await getConfigPda(pool.memeMint);
        const sigs = await connection.getSignaturesForAddress(configPda, { limit: 30 });
        const tradeEvents: TradeEvent[] = [];
        for (const sig of sigs) {
          try {
            const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            if (!tx?.meta) continue;
            const preBalances = tx.meta.preTokenBalances || [];
            const postBalances = tx.meta.postTokenBalances || [];
            const time = (tx.blockTime || 0) * 1000;
            const memePre = preBalances.find(b => b.mint === pool.memeMint.toBase58());
            const memePost = postBalances.find(b => b.mint === pool.memeMint.toBase58());
            const quotePre = preBalances.find(b => b.mint === pool.quoteMint.toBase58());
            const quotePost = postBalances.find(b => b.mint === pool.quoteMint.toBase58());
            if (memePre && memePost && quotePre && quotePost) {
              const memeDelta = (Number(memePost.uiTokenAmount.uiAmount) || 0) - (Number(memePre.uiTokenAmount.uiAmount) || 0);
              const quoteDelta = (Number(quotePost.uiTokenAmount.uiAmount) || 0) - (Number(quotePre.uiTokenAmount.uiAmount) || 0);
              if (Math.abs(memeDelta) > 0) {
                tradeEvents.push({ sig: sig.signature, type: memeDelta > 0 ? 'buy' : 'sell', memeAmount: Math.abs(memeDelta), quoteAmount: Math.abs(quoteDelta), price: Math.abs(quoteDelta) > 0 ? Math.abs(quoteDelta / memeDelta) : 0, time, trader: tx.transaction.message.accountKeys[0]?.pubkey?.toBase58() || '' });
              }
            }
          } catch {}
        }
        if (!stop) setTrades(tradeEvents);
      } catch {}
      finally { if (!stop) setTradesLoading(false); }
    })();
    return () => { stop = true; };
  }, [pool?.memeMint?.toBase58()]);

  // ── HolderProfile pre-fetch for Diamond Hand Gate ────────────────────────
  useEffect(() => {
    const minDays = pool?.minAvgHoldDays ?? 0;
    if (!effectivePublicKey || pool?.programVersion !== 'v2' || minDays === 0) {
      setMyAvgDays(null);
      return;
    }
    let cancelled = false;
    setHpFetching(true);
    (async () => {
      try {
        const conn = activeConnection;
        const programId = poolProgramIdFor(pool!);
        const [holderPda] = PublicKey.findProgramAddressSync(
          [HOLDER_SEED, effectivePublicKey!.toBuffer()],
          programId
        );
        const info = await conn.getAccountInfo(holderPda);
        if (cancelled) return;
        if (!info) { setMyAvgDays(0); return; }
        const coder = new BorshAccountsCoder(poolIdlV2Json as Idl);
        const hp = coder.decode('HolderProfile', info.data) as {
          cumulativeTokenSecs: BN; currentBalance: BN; totalSold: BN;
          lastUpdateTs: BN; firstBuyTs: BN;
        };
        if (!cancelled) setMyAvgDays(calcAvgDays(hp));
      } catch { if (!cancelled) setMyAvgDays(0); }
      finally { if (!cancelled) setHpFetching(false); }
    })();
    return () => { cancelled = true; };
  }, [effectivePublicKey?.toBase58(), pool?.pubkey?.toBase58(), pool?.minAvgHoldDays]);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (!pool?.audioUrl) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) audioRef.current = new Audio(pool.audioUrl);
      else audioRef.current.src = pool.audioUrl;
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setIsPlaying(false);
      setIsPlaying(true);
    }
  }, [pool?.audioUrl, isPlaying]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ── Candles ───────────────────────────────────────────────────────────────
  const candles = useMemo(() => {
    const bucketMs = TF_MS[selectedTf];
    const bars = serverCandles
      .map((b: any) => ({ t: Number(b.t), o: Number(b.o), h: Number(b.h), l: Number(b.l), c: Number(b.c) }))
      .filter((b: any) => [b.t, b.o, b.h, b.l, b.c].every(Number.isFinite));
    if (!bars.length && priceHistory.length) {
      const candleMap = new Map<number, any>();
      for (const pt of priceHistory) {
        const bk = bucketStart(pt.time, selectedTf);
        const existing = candleMap.get(bk);
        if (!existing) candleMap.set(bk, { t: bk, o: pt.price, h: pt.price, l: pt.price, c: pt.price });
        else { existing.h = Math.max(existing.h, pt.price); existing.l = Math.min(existing.l, pt.price); existing.c = pt.price; }
      }
      return Array.from(candleMap.values()).sort((a, b) => a.t - b.t);
    }
    if (bars.length) {
      const nowBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
      while (bars[bars.length - 1].t + bucketMs <= nowBucket) {
        const c0 = bars[bars.length - 1].c;
        bars.push({ t: bars[bars.length - 1].t + bucketMs, o: c0, h: c0, l: c0, c: c0 });
      }
    }
    return bars;
  }, [serverCandles, selectedTf, priceHistory]);

  const volume = useMemo(() => {
    const volMap = new Map<number, number>();
    for (const pt of priceHistory) {
      const b = bucketStart(pt.time, selectedTf);
      volMap.set(b, (volMap.get(b) ?? 0) + 1);
    }
    return candles.map(b => ({ t: b.t, v: volMap.get(b.t) ?? 0, up: b.c >= b.o }));
  }, [candles, selectedTf, priceHistory]);

  const basePct = useMemo(() => {
    if (candles.length < 2) return 0;
    const closed = candles[candles.length - 2];
    return closed.o > 0 ? ((closed.c - closed.o) / closed.o) * 100 : 0;
  }, [candles]);

  // ── Bonding progress ──────────────────────────────────────────────────────
  const bondingProgress = useMemo(() => {
    if (!pool || pool.poolType !== 0) return null;
    const woodLamports = Math.max(0, pool.ammReserves?.woodeng ?? 0);
    const thr = Number(targetsFor(pool).migrateLowerLamports);
    const pct = Math.min(1, woodLamports / Math.max(1, thr));
    return { pct, woodUi: woodLamports / 1e9, thrUi: thr / 1e9 };
  }, [pool]);

  // displayPrice: use live Meteora price for poolType 3, else on-chain price
  const displayPrice = useMemo(() => {
    if (pool?.poolType === 3 && livePrice && livePrice > 0) return livePrice;
    return pool?.price ?? 0;
  }, [pool?.poolType, pool?.price, livePrice]);

  const poolMultiplier = useMemo(() => {
    if (!pool) return null;
    const currentPrice = displayPrice;
    if (currentPrice <= 0) return null;

    // Bonding status
    let bondingStatus: 'bonding' | 'bonded' | 'amm-launch' = 'amm-launch';
    if (pool.poolType === 0) {
      bondingStatus = 'bonding';
    } else if ((pool.bondingSold ?? 0) > 0) {
      bondingStatus = 'bonded';
    }

    // Base price: V1 = 0.1 WOODENG target. V2 graduated = graduation price (lastMemePrice).
    // V2 still bonding = same 0.1 baseline.
    let basePrice: number;
    if (pool.poolType === 2 || pool.poolType === 3) {
      const gradPrice = (pool.lastMemePrice ?? 0) / 1e9;
      basePrice = gradPrice > 0 ? gradPrice : (quoteIsSol(pool) ? Number(PRICE_TARGET_SOL_LAMPORTS) / 1e9 : 0.1);
    } else {
      basePrice = quoteIsSol(pool) ? Number(PRICE_TARGET_SOL_LAMPORTS) / 1e9 : 0.1;
    }

    const currentMult = currentPrice / basePrice;
    const quote = quoteLabelOf(pool);

    // ATH from lastMemePrice
    const lastPrice = (pool.lastMemePrice ?? 0) / 1e9;
    const bestKnown = Math.max(currentPrice, lastPrice);
    const athMult = bestKnown / basePrice;

    return { currentMult, athMult, bondingStatus, currentPrice, basePrice, quote };
  }, [pool, displayPrice]);

  const poolStats = useMemo(() => {
    if (!pool) return [];
    const quote = quoteLabelOf(pool);
    const fmtMult = (m: number) => m >= 1000 ? `${(m/1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1);
    const stats = [
      { label: 'Pool Type', value: pool.poolType === 0 ? 'Bonding Curve' : pool.poolType === 1 ? 'AMM (XYK)' : pool.poolType === 2 ? 'Graduated' : 'Meteora DAMM v2' },
      { label: 'Market Cap', value: `${(pool.marketCap ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quote}` },
    ];

    // Add multiplier stats
    if (poolMultiplier) {
      const baseFmt = poolMultiplier.basePrice < 0.01
        ? poolMultiplier.basePrice.toExponential(2)
        : poolMultiplier.basePrice.toFixed(poolMultiplier.basePrice < 1 ? 4 : 2);
      stats.push({
        label: `From ${baseFmt} ${quote}`,
        value: `${fmtMult(poolMultiplier.currentMult)}x`,
      });
      if (poolMultiplier.athMult > poolMultiplier.currentMult * 1.05) {
        stats.push({
          label: 'ATH Multiplier',
          value: `${fmtMult(poolMultiplier.athMult)}x`,
        });
      }
    }

    stats.push(
      { label: 'Total Supply', value: `${(pool.totalSupply ?? 0).toLocaleString()} ${pool.symbol}` },
      { label: 'Meme Reserve', value: `${((pool.ammReserves?.meme ?? 0) / 10 ** (pool.decimals ?? 0)).toLocaleString()} ${pool.symbol}` },
      { label: `${quote} Reserve`, value: `${((pool.ammReserves?.woodeng ?? 0) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${quote}` },
      { label: 'NFT Threshold', value: `${(pool.nftThreshold ?? 10000).toLocaleString()} tokens` },
    );
    return stats;
  }, [pool, poolMultiplier]);

  const copyAddress = useCallback(() => {
    if (!mintParam) return;
    navigator.clipboard.writeText(mintParam).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [mintParam]);

  // ── Living meme: handle successful update ─────────────────────────────────
  const handleMetaUpdateSuccess = useCallback((newUri: string, newImageUrl: string, newAudioUrl: string) => {
    // Convert ipfs:// to https:// for display
    const httpImage = toHttp(newImageUrl) || newImageUrl;
    const httpAudio = toHttp(newAudioUrl) || newAudioUrl;
    setPool(prev => prev ? {
      ...prev,
      metaUri: newUri,
      imageUrl: httpImage,
      audioUrl: httpAudio,
    } : prev);
    // Reset audio player with new source
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = httpAudio;
      setIsPlaying(false);
    }
  }, []);

  // ── Graduate to Meteora ───────────────────────────────────────────────────
  // SECURITY NOTE: The Rust program's graduate_to_meteora instruction currently has no
  // authority check. Anyone could call it. This frontend-only guard prevents the UI from
  // showing the button to non-creators, but the Rust program should be fixed to add a
  // `has_one = authority` (or `project_wallet`) constraint to the GraduateToMeteora accounts.
  const handleGraduate = useCallback(async () => {
    if (!pool || !effectivePublicKey) return;
    setGradBusy(true);
    setGradStatus('');
    try {
      const conn = activeConnection;
      const pk = effectivePublicKey!;
      const poolProgramId = poolProgramIdFor(pool);
      const anchorWallet = {
        publicKey: pk,
        signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction,
        signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))),
      };
      const provider = new AnchorProvider(conn, anchorWallet, { preflightCommitment: 'confirmed' });
      const poolProgram = new Program(poolIdlV2Json as Idl, poolProgramId, provider);
      const configPda = pool.pubkey;
      const [poolMemeVault] = await PublicKey.findProgramAddress(
        [Buffer.from('pool_meme_vault'), pool.memeMint.toBuffer()], poolProgramId
      );
      const [poolWoodengVault] = await PublicKey.findProgramAddress(
        [Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], poolProgramId
      );
      const [graduationInfo] = await PublicKey.findProgramAddress(
        [Buffer.from('graduation'), configPda.toBuffer()], poolProgramId
      );
      const gradIx = await (poolProgram.methods as any)
        .graduateToMeteora()
        .accounts({
          config: configPda,
          payer: pk,
          poolMemeVault,
          poolWoodengVault,
          graduationInfo,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      await sendIxsOnce(conn, anchorWallet, [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        gradIx,
      ]);
      setGradStatus('Graduated! Pool type is now 2. Create the DAMM v2 pool to finalize.');
      setGradError(null);
      setPool(prev => prev ? { ...prev, poolType: 2 } : prev);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('insufficient lamports') || msg.includes('custom program error: 0x1')) {
        setGradStatus('');
        setGradError('You need more SOL in your wallet to cover transaction fees. Add at least 0.05 SOL and try again.');
      } else {
        setGradError(null);
        setGradStatus(`Error: ${msg}`);
      }
    } finally {
      setGradBusy(false);
    }
  }, [pool, wallet, effectivePublicKey, unifiedSignTransaction, activeConnection, isDevnetPool]);

  // ── Create Meteora DAMM v2 pool (3-step graduation) ─────────────────────
  const handleCreateMeteoraPool = useCallback(async () => {
    if (!pool || !effectivePublicKey) return;
    setDammBusy(true);
    setDammStatus('');
    try {
      const conn = activeConnection;
      const pk = effectivePublicKey!;
      const poolProgramId = poolProgramIdFor(pool);
      const anchorWallet = {
        publicKey: pk,
        signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction,
        signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))),
      };
      const provider = new AnchorProvider(conn, anchorWallet, { preflightCommitment: 'confirmed' });
      const poolProgram = new Program(poolIdlV2Json as Idl, poolProgramId, provider);

      const memeMintPk = pool.memeMint instanceof PublicKey ? pool.memeMint : new PublicKey(pool.memeMint as any);
      const quoteMintPk = pool.quoteMint instanceof PublicKey ? pool.quoteMint : new PublicKey(pool.quoteMint as any);
      const configPk = pool.pubkey instanceof PublicKey ? pool.pubkey : new PublicKey(pool.pubkey as any);
      console.log('[GRADUATE] memeMintPk:', memeMintPk.toBase58(), 'quoteMintPk:', quoteMintPk.toBase58(), 'configPk:', configPk.toBase58());

      const payerMemeAta = getAssociatedTokenAddressSync(memeMintPk, pk, false, TOKEN_PROGRAM_ID);
      const payerQuoteAta = getAssociatedTokenAddressSync(quoteMintPk, pk, false, TOKEN_PROGRAM_ID);

      const [graduationInfoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('graduation'), configPk.toBuffer()],
        poolProgramId
      );
      const [poolMemeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool_meme_vault'), memeMintPk.toBuffer()],
        poolProgramId
      );
      const [poolQuoteVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool_woodeng_vault'), memeMintPk.toBuffer()],
        poolProgramId
      );

      // ─── STEP 1+2 ATOMIC: Withdraw + Create Meteora pool in one tx ───
      // Read BOTH vault balances. Only treat as withdrawn when BOTH are zero.
      // Never fall through to reading the user's personal wallet — that would
      // deposit their own tokens into the Meteora pool instead of the bonding liquidity.
      const memeVaultBal = await conn.getTokenAccountBalance(poolMemeVaultPda).catch(() => null);
      const quoteVaultBal = await conn.getTokenAccountBalance(poolQuoteVaultPda).catch(() => null);

      const memeVaultAmount = memeVaultBal?.value?.amount ? new BN(memeVaultBal.value.amount) : new BN(0);
      const quoteVaultAmount = quoteVaultBal?.value?.amount ? new BN(quoteVaultBal.value.amount) : new BN(0);
      const alreadyWithdrawn = memeVaultAmount.isZero() && quoteVaultAmount.isZero();

      let memeAmount: BN;
      let quoteAmount: BN;
      if (alreadyWithdrawn) {
        // Retry path: tokens were already withdrawn to payer's ATAs by a prior attempt.
        // Read ATA balances but ask the user to confirm they match bonding liquidity.
        console.log('[GRADUATE] Both vaults empty — reading from payer ATAs for retry');
        const memeBalInfo = await conn.getTokenAccountBalance(payerMemeAta);
        const quoteBalInfo = await conn.getTokenAccountBalance(payerQuoteAta);
        memeAmount = new BN(memeBalInfo.value.amount);
        quoteAmount = new BN(quoteBalInfo.value.amount);
        const proceed = window.confirm(
          `Pool vaults are empty — tokens were already withdrawn.\n\n` +
          `Will deposit your current wallet balances into Meteora:\n` +
          `  Meme:  ${memeBalInfo.value.uiAmountString}\n` +
          `  Quote: ${quoteBalInfo.value.uiAmountString}\n\n` +
          `Only confirm if these are the bonding-pool amounts. Cancel to abort.`
        );
        if (!proceed) throw new Error('Cancelled — please verify your token amounts before retrying');
      } else {
        // Normal path: deposit exactly what is in the bonding vaults.
        memeAmount = memeVaultAmount;
        quoteAmount = quoteVaultAmount;
      }

      console.log('[GRADUATE] Meme amount:', memeAmount.toString(), 'Quote amount:', quoteAmount.toString());

      if (memeAmount.isZero() || quoteAmount.isZero()) {
        throw new Error('Vault/wallet balances are zero — cannot create pool with empty liquidity');
      }

      const memeIsA = memeMintPk.toBuffer().compare(quoteMintPk.toBuffer()) > 0;
      const tokenAMint = memeIsA ? memeMintPk : quoteMintPk;
      const tokenBMint = memeIsA ? quoteMintPk : memeMintPk;
      const tokenAAmount = memeIsA ? memeAmount : quoteAmount;
      const tokenBAmount = memeIsA ? quoteAmount : memeAmount;

      const cpAmm = new CpAmm(conn);
      const positionNftKp = Keypair.generate();

      const MAX_SQRT_PRICE = new BN('79226673521066979257578248091');
      const MIN_SQRT_PRICE = new BN('4295048016');

      // baseFee must be { data: Buffer } — a Borsh-encoded byte array.
      // The SDK's validatePoolFees calls getBaseFeeHandlerFromBorshData(poolFees.baseFee.data)
      // which calls Buffer.from(rawData), crashing if rawData is undefined.
      const poolFees = {
        baseFee: {
          data: Array.from(encodeFeeTimeSchedulerParams(
            new BN(3_000_000),                    // cliffFeeNumerator (~0.03% fee)
            0,                                    // numberOfPeriod (no decay)
            new BN(0),                            // periodFrequency
            new BN(0),                            // reductionFactor
            BaseFeeMode.FeeTimeSchedulerLinear,   // baseFeeMode = 0
          )),
        },
        compoundingFeeBps: 0,
        padding: 0,
        dynamicFee: null,
      };

      setDammStatus('Step 1/2: Building atomic withdraw + pool creation…');
      console.log('[GRADUATE] Building atomic withdraw + Meteora pool tx...');

      // Derive initSqrtPrice and liquidityDelta from actual token amounts so
      // Meteora's minimum-liquidity check passes.
      const { initSqrtPrice, liquidityDelta } = cpAmm.preparePoolCreationParams({
        tokenAAmount,
        tokenBAmount,
        minSqrtPrice: MIN_SQRT_PRICE,
        maxSqrtPrice: MAX_SQRT_PRICE,
        collectFeeMode: CollectFeeMode.BothToken,
      });
      console.log('[GRADUATE] initSqrtPrice:', initSqrtPrice.toString(), 'liquidityDelta:', liquidityDelta.toString());

      const { tx: meteoraTx, pool: meteoraPoolAddr } =
        await cpAmm.createCustomPool({
          payer: pk,
          creator: pk,
          positionNft: positionNftKp.publicKey,
          tokenAMint,
          tokenBMint,
          tokenAAmount,
          tokenBAmount,
          sqrtMinPrice: MIN_SQRT_PRICE,
          sqrtMaxPrice: MAX_SQRT_PRICE,
          liquidityDelta,
          initSqrtPrice,
          poolFees,
          hasAlphaVault: false,
          activationType: 1,
          collectFeeMode: CollectFeeMode.BothToken,
          activationPoint: new BN(Math.floor(Date.now() / 1000) + 120),
          tokenAProgram: TOKEN_PROGRAM_ID,
          tokenBProgram: TOKEN_PROGRAM_ID,
        });

      // Build the atomic instruction list
      const atomicIxs: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        createAssociatedTokenAccountIdempotentInstruction(
          pk, payerMemeAta, pk, memeMintPk, TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          pk, payerQuoteAta, pk, quoteMintPk, TOKEN_PROGRAM_ID
        ),
      ];

      if (!alreadyWithdrawn) {
        const withdrawIx = await (poolProgram.methods as any)
          .withdrawGraduationTokens()
          .accounts({
            config: configPk,
            graduationInfo: graduationInfoPda,
            poolMemeVault: poolMemeVaultPda,
            poolWoodengVault: poolQuoteVaultPda,
            payerMemeAta,
            payerQuoteAta,
            payer: pk,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
        atomicIxs.push(withdrawIx);
      }

      for (const ix of meteoraTx.instructions) {
        atomicIxs.push(ix);
      }

      setDammStatus('Step 1/2: Signing & sending atomic withdraw + pool creation…');
      const atomicSig = await sendIxsOnce(conn, anchorWallet, atomicIxs, [positionNftKp]);
      console.log('[GRADUATE] Atomic withdraw + pool creation complete:', atomicSig, 'Pool:', meteoraPoolAddr.toBase58());

      // ─── STEP 2: Finalize graduation in our program ───
      setDammStatus('Step 2/2: Finalizing graduation…');
      console.log('[GRADUATE] Step 2: Finalizing graduation...');

      const finalizeIx = await (poolProgram.methods as any)
        .finalizeGraduation(
          meteoraPoolAddr,
          positionNftKp.publicKey,
          memeAmount,
          quoteAmount
        )
        .accounts({
          config: configPk,
          graduationInfo: graduationInfoPda,
          payer: pk,
        })
        .instruction();

      const finalizeSig = await sendIxsOnce(conn, anchorWallet, [finalizeIx]);
      console.log('[GRADUATE] Step 2 complete:', finalizeSig);

      setDammStatus(`✅ Graduated to Meteora! Pool: ${meteoraPoolAddr.toBase58().slice(0, 8)}…`);
      setDammPoolPubkey(meteoraPoolAddr.toBase58());
      setPool(prev => prev ? { ...prev, poolType: 3, meteoraPool: meteoraPoolAddr.toBase58() } : prev);

    } catch (err: any) {
      console.error('[GRADUATE] Failed:', err);
      const msg = err?.message || String(err);
      if (msg.includes('insufficient lamports') || msg.includes('custom program error: 0x1')) {
        setDammStatus('');
        setGradError('You need more SOL in your wallet to cover transaction fees. Add at least 0.05 SOL and try again.');
      } else {
        setGradError(null);
        setDammStatus(`Error: ${msg}`);
      }
    } finally {
      setDammBusy(false);
    }
  }, [pool, wallet, effectivePublicKey, unifiedSignTransaction, activeConnection]);

  // ── Trade ─────────────────────────────────────────────────────────────────
  const handleTrade = useCallback(async () => {
    if (!pool || !effectivePublicKey || !tradeAmount) return;
    const pk = effectivePublicKey!;
    const anchorW = {
      publicKey: pk,
      signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction,
      signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))),
    };
    setTradeBusy(true);
    setTradeStatus('');
    try {
      const amt = parseFloat(tradeAmount);
      if (!amt || amt <= 0) throw new Error('Enter a valid amount');
      const conn = activeConnection;
      const isV2Pool = pool.programVersion === 'v2';
      const activeStakingProgram = isDevnetPool ? STAKING_PROGRAM_ID_DEVNET : STAKING_PROGRAM_ID;
      const idlToUse = isV2Pool ? (poolIdlV2Json as Idl) : poolIdl;

      const [configPda] = await getConfigPda(pool.memeMint, poolProgramIdFor(pool));
      const provider = new AnchorProvider(conn, anchorW as any, { preflightCommitment: 'confirmed' });
      const poolProgram = new Program(idlToUse, poolProgramIdFor(pool), provider);
      const [poolMemeVault] = await PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'), pool.memeMint.toBuffer()], poolProgramIdFor(pool));
      const [poolWoodengVault] = await PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()], poolProgramIdFor(pool));
      const isSol = quoteIsSol(pool);
      const { ata: buyerMemeAta, ix: buyerMemeAtaIx } = await ensureAtaIx(pk, pool.memeMint, pk);
      const { ata: buyerQuoteAta, ix: buyerQuoteAtaIx } = await ensureAtaIx(pk, pool.quoteMint, pk);
      const feeRecipient = pool.creator ?? PROJECT_WALLET;
      const allowOffCurve = !PublicKey.isOnCurve(feeRecipient.toBytes());
      const { ata: creatorAta, ix: creatorAtaIx } = await ensureAtaIx(feeRecipient, pool.quoteMint, pk, allowOffCurve);
      const { stakingConfig, rewardsVault, rewardsVaultWsol } = getStakingPdas(pool.quoteMint, activeWoodengMint, activeStakingProgram);
      const stakingRewardsVault = isSol ? rewardsVaultWsol : rewardsVault;
      const setupIxs = [buyerMemeAtaIx, buyerQuoteAtaIx, creatorAtaIx].filter(Boolean) as TransactionInstruction[];

      // v2: derive holderProfile PDA (required by v21 Trade accounts)
      const [holderProfile] = isV2Pool
        ? PublicKey.findProgramAddressSync([HOLDER_SEED, pk.toBuffer()], poolProgramIdFor(pool))
        : [PublicKey.default]; // unused for v1

      // v2: check if holderProfile needs init_if_needed (first buy uses more compute)
      let holderProfileNeedsInit = false;
      if (isV2Pool) {
        const hpInfo = await conn.getAccountInfo(holderProfile);
        holderProfileNeedsInit = !hpInfo;
      }

      // Build accounts object — v2 adds holderProfile
      const baseAccounts: any = {
        config: configPda, memeMint: pool.memeMint, poolMemeVault, poolWoodengVault,
        buyer: pk, buyerMemeAta, buyerWoodengAta: buyerQuoteAta,
        projectWalletAta: creatorAta, stakingConfig, stakingRewardsVault,
        stakingProgram: activeStakingProgram,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      };
      if (isV2Pool) baseAccounts.holderProfile = holderProfile;

      if (tradeTab === 'buy') {
        const lamportsIn = Math.floor(amt * 1e9);
        const minMemeOut = new BN(1);
        const preIxs: TransactionInstruction[] = [];
        if (isSol) { const { ixs } = await buildWrapSolIxs(pk, lamportsIn); preIxs.push(...ixs); }
        const method = pool.poolType === 0 ? 'buy' : 'swap';
        const buyIx = await (poolProgram.methods as any)[method](new BN(lamportsIn), minMemeOut).accounts(baseAccounts).instruction();
        const postIxs: TransactionInstruction[] = [];
        if (isSol) postIxs.push(createCloseAccountInstruction(buyerQuoteAta, pk, pk));
        if (holderProfileNeedsInit) {
          const initIx = await (poolProgram.methods as any).initHolderProfile().accounts({
            buyer: pk,
            holderProfile,
            systemProgram: SystemProgram.programId,
          }).instruction();
          setTradeStatus('Initializing profile…');
          await sendIxsOnce(conn, anchorW, [ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }), initIx]);
        }
        setTradeStatus('Confirm in wallet…');
        await sendIxsOnce(conn, anchorW, [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }), ...setupIxs, ...preIxs, buyIx, ...postIxs]);
        setTradeStatus('Buy successful!');
      } else {
        const memeRawIn = Math.floor(amt * 10 ** (pool.decimals ?? 0));
        const minQuoteOut = new BN(0);
        const sellIx = await (poolProgram.methods as any).sell(new BN(memeRawIn), minQuoteOut).accounts(baseAccounts).instruction();
        const postIxs: TransactionInstruction[] = [];
        if (isSol) postIxs.push(createCloseAccountInstruction(buyerQuoteAta, pk, pk));
        setTradeStatus('Confirm in wallet…');
        await sendIxsOnce(conn, anchorW, [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }), ...setupIxs, sellIx, ...postIxs]);
        setTradeStatus('Sell successful!');
      }
      setTradeAmount('');
      setTimeout(async () => {
        try {
          const memeAta = await getAssociatedTokenAddress(pool.memeMint, pk);
          const quoteAta = await getAssociatedTokenAddress(pool.quoteMint, pk);
          const [mi, qi] = await getMultiple([memeAta, quoteAta], 100, conn);
          setUserMemeBalance(mi?.data && mi.data.length >= 72 ? readU64LESafe(mi.data, 64) / 10 ** (pool.decimals ?? 0) : 0);
          setUserQuoteBalance(qi?.data && qi.data.length >= 72 ? readU64LESafe(qi.data, 64) / 1e9 : 0);
        } catch {}
      }, 2000);
    } catch (e: any) {
      const msg: string = e?.message || String(e);
      // 0x1781 = HolderRequirementNotMet — re-fetch profile so gate reflects current state
      if (msg.includes('0x1781') || msg.includes('HolderRequirementNotMet')) {
        setTradeStatus('Error: Diamond hand requirement not met — keep holding! 💎');
        setMyAvgDays(prev => prev); // trigger a re-render; full re-fetch handled by effect
      } else {
        setTradeStatus(`Error: ${msg}`);
      }
    } finally {
      setTradeBusy(false);
    }
  }, [pool, wallet, tradeAmount, tradeTab, activeConnection, activeWoodengMint, isDevnetPool]);

  // ── NFT Locker: fetch user's NFTs for this pool ───────────────────────────
  const refreshUserNftsForPool = useCallback(async () => {
    if (!effectivePublicKey || !pool) { setNftsLoaded(true); return; }
    const pk = effectivePublicKey!;
    try {
      const dummyWallet = { publicKey: pk } as any;
      const provider = new AnchorProvider(activeConnection, dummyWallet, {});
      const lockerProgram = new Program(lockerIdl as Idl, LOCKER_PROGRAM_ID, provider);
      const memeMint = pool.memeMint;
      const [counterPda] = await PublicKey.findProgramAddress(
        [Buffer.from('counter'), memeMint.toBuffer(), pk.toBuffer()],
        LOCKER_PROGRAM_ID
      );
      let counter: any;
      try { counter = await lockerProgram.account.lockCounter.fetch(counterPda); }
      catch { setNftsLoaded(true); return; }
      const found: Array<{lockId: number; nftMint: PublicKey}> = [];
      for (let i = 0; i < Number(counter.count); i++) {
        const lockIdLE = new Uint8Array(8);
        new DataView(lockIdLE.buffer).setBigUint64(0, BigInt(i), true);
        const [lockerPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('locker'), memeMint.toBuffer(), pk.toBuffer(), Buffer.from(lockIdLE)],
          LOCKER_PROGRAM_ID
        );
        try {
          const l = await lockerProgram.account.lockerState.fetch(lockerPda);
          const nftMint = l.nftMint as PublicKey;
          const ata = await getAssociatedTokenAddress(nftMint, pk);
          const info = await activeConnection.getAccountInfo(ata);
          if (info) {
            const bal = await activeConnection.getTokenAccountBalance(ata);
            if (bal.value.uiAmount && bal.value.uiAmount > 0) found.push({ lockId: i, nftMint });
          }
        } catch {}
      }
      setUserNfts(found);
    } catch {}
    finally { setNftsLoaded(true); }
  }, [effectivePublicKey?.toBase58(), pool, activeConnection]);

  useEffect(() => {
    setNftsLoaded(false);
    setUserNfts([]);
    refreshUserNftsForPool();
  }, [refreshUserNftsForPool]);

  // ── Jupiter Terminal: initialize when user expands the Jupiter section ────
  useEffect(() => {
    if (!pool || pool.poolType !== 3 || !showJupiter) return;

    const memeMint = pool.memeMint instanceof PublicKey
      ? pool.memeMint.toBase58()
      : String(pool.memeMint);
    const quoteMint = pool.quoteMint instanceof PublicKey
      ? pool.quoteMint.toBase58()
      : String(pool.quoteMint);

    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (typeof window === 'undefined' || !window.Jupiter) {
        setTimeout(tryInit, 500);
        return;
      }
      window.Jupiter.init({
        displayMode: 'integrated',
        integratedTargetId: 'jupiter-terminal-graduated',
        endpoint: activeConnection.rpcEndpoint,
        enableWalletPassthrough: true,
        passthroughWalletContextState: wallet,
        formProps: {
          initialInputMint: quoteMint,
          initialOutputMint: memeMint,
        },
        containerStyles: {
          borderRadius: '16px',
          background: 'transparent',
        },
      });
    };
    tryInit();

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && window.Jupiter?.close) window.Jupiter.close();
    };
  }, [pool?.poolType, pool?.memeMint, pool?.quoteMint, activeConnection, wallet, showJupiter]);

  // Sync wallet passthrough state into Jupiter Terminal whenever wallet changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Jupiter?.syncProps) return;
    if (pool?.poolType !== 3 || !showJupiter) return;
    window.Jupiter.syncProps({ passthroughWalletContextState: wallet });
  }, [effectiveConnected, effectivePublicKey?.toBase58(), wallet.signTransaction, pool?.poolType, showJupiter]);

  // ── Fetch WOODENG USD price from Jupiter once ─────────────────────────────
  useEffect(() => {
    const WOODENG_MINT_STR = '83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5';
    fetch(`https://api.jup.ag/price/v2?ids=${WOODENG_MINT_STR}`)
      .then(r => r.json())
      .then(data => {
        const p = Number(data?.data?.[WOODENG_MINT_STR]?.price ?? 0);
        if (p > 0) setWoodengUsdPrice(p);
      })
      .catch(() => {});
  }, []);

  // ── Poll live Meteora price for graduated pools (every 30s) ───────────────
  useEffect(() => {
    if (!pool || pool.poolType !== 3 || !pool.meteoraPool) return;
    const memeMintStr = pool.memeMint instanceof PublicKey
      ? pool.memeMint.toBase58() : String(pool.memeMint);
    const memeDecimals = pool.decimals ?? 0;
    const doFetch = () =>
      fetchMeteoraPoolPrice(activeConnection, pool.meteoraPool!, memeMintStr, memeDecimals, 9)
        .then(p => { if (p > 0) setLivePrice(p); });
    doFetch();
    const id = setInterval(doFetch, 30_000);
    return () => clearInterval(id);
  }, [pool?.poolType, pool?.meteoraPool, activeConnection]);

  // ── Meteora DAMM v2 swap quote (graduated pools) ─────────────────────────
  useEffect(() => {
    setMeteoraQuoteOut(null);
    if (
      !pool || pool.poolType !== 3 || !pool.meteoraPool ||
      !meteoraAmount || isNaN(Number(meteoraAmount)) || Number(meteoraAmount) <= 0
    ) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const cpAmm = new CpAmm(activeConnection);
        const meteoraPoolPk = new PublicKey(pool.meteoraPool!);
        const poolState = await cpAmm.fetchPoolState(meteoraPoolPk);

        const memeMintPk = pool.memeMint instanceof PublicKey ? pool.memeMint : new PublicKey(pool.memeMint as any);
        const quoteMintPk = pool.quoteMint instanceof PublicKey ? pool.quoteMint : new PublicKey(pool.quoteMint as any);

        const isBuy = meteoraTradeTab === 'buy';
        const inputMint = isBuy ? quoteMintPk : memeMintPk;
        const inputDecimals = isBuy ? 9 : (pool.decimals ?? 6);
        const outputDecimals = isBuy ? (pool.decimals ?? 6) : 9;

        const inAmountRaw = new BN(Math.floor(Number(meteoraAmount) * 10 ** inputDecimals));
        const slot = await activeConnection.getSlot();
        const currentTime = Math.floor(Date.now() / 1000);

        const tokenAIsInput = poolState.tokenAMint.equals(inputMint);
        const tokenADecimal = tokenAIsInput ? inputDecimals : outputDecimals;
        const tokenBDecimal = tokenAIsInput ? outputDecimals : inputDecimals;

        const q = cpAmm.getQuote({
          inAmount: inAmountRaw,
          inputTokenMint: inputMint,
          slippage: 1,
          poolState,
          currentTime,
          currentSlot: slot,
          tokenADecimal,
          tokenBDecimal,
        });

        if (!cancelled) {
          const outHuman = Number(q.swapOutAmount.toString()) / 10 ** outputDecimals;
          setMeteoraQuoteOut(outHuman.toLocaleString(undefined, { maximumFractionDigits: 6 }));
        }
      } catch {
        if (!cancelled) setMeteoraQuoteOut(null);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [meteoraAmount, meteoraTradeTab, pool?.poolType, pool?.meteoraPool, activeConnection]);

  // ── Meteora DAMM v2 swap handler ─────────────────────────────────────────
  const handleMeteoraSwap = useCallback(async () => {
    if (!pool || !effectivePublicKey || !meteoraAmount || !pool.meteoraPool) return;
    const pk = effectivePublicKey!;
    const effectiveSendTx = (wallet.connected && wallet.sendTransaction) ? wallet.sendTransaction : unifiedSendTransaction;
    setMeteoraBusy(true);
    setMeteoraStatus('');
    try {
      const cpAmm = new CpAmm(activeConnection);
      const meteoraPoolPk = new PublicKey(pool.meteoraPool);
      const poolState = await cpAmm.fetchPoolState(meteoraPoolPk);

      const memeMintPk = pool.memeMint instanceof PublicKey ? pool.memeMint : new PublicKey(pool.memeMint as any);
      const quoteMintPk = pool.quoteMint instanceof PublicKey ? pool.quoteMint : new PublicKey(pool.quoteMint as any);

      const isBuy = meteoraTradeTab === 'buy';
      const inputMint = isBuy ? quoteMintPk : memeMintPk;
      const outputMint = isBuy ? memeMintPk : quoteMintPk;
      const inputDecimals = isBuy ? 9 : (pool.decimals ?? 6);
      const outputDecimals = isBuy ? (pool.decimals ?? 6) : 9;

      const inAmountRaw = new BN(Math.floor(Number(meteoraAmount) * 10 ** inputDecimals));
      const slot = await activeConnection.getSlot();
      const currentTime = Math.floor(Date.now() / 1000);

      const tokenAIsInput = poolState.tokenAMint.equals(inputMint);
      const tokenADecimal = tokenAIsInput ? inputDecimals : outputDecimals;
      const tokenBDecimal = tokenAIsInput ? outputDecimals : inputDecimals;

      const q = cpAmm.getQuote({
        inAmount: inAmountRaw,
        inputTokenMint: inputMint,
        slippage: 1,
        poolState,
        currentTime,
        currentSlot: slot,
        tokenADecimal,
        tokenBDecimal,
      });

      setMeteoraStatus('Building transaction…');
      const swapTx = await cpAmm.swap({
        payer: pk,
        pool: meteoraPoolPk,
        inputTokenMint: inputMint,
        outputTokenMint: outputMint,
        tokenAMint: poolState.tokenAMint,
        tokenBMint: poolState.tokenBMint,
        tokenAVault: poolState.tokenAVault,
        tokenBVault: poolState.tokenBVault,
        tokenAProgram: TOKEN_PROGRAM_ID,
        tokenBProgram: TOKEN_PROGRAM_ID,
        referralTokenAccount: null,
        amountIn: inAmountRaw,
        minimumAmountOut: q.minSwapOutAmount,
        poolState,
      });

      setMeteoraStatus('Awaiting wallet approval…');
      const sig = await effectiveSendTx(swapTx, activeConnection);
      setMeteoraStatus('Confirming…');
      await activeConnection.confirmTransaction(sig, 'confirmed');
      setMeteoraStatus(`Swapped! tx: ${sig.slice(0, 8)}…`);
      setMeteoraAmount('');
      setMeteoraQuoteOut(null);

      setTimeout(async () => {
        try {
          const memeAta = await getAssociatedTokenAddress(memeMintPk, pk);
          const quoteAta = await getAssociatedTokenAddress(quoteMintPk, pk);
          const [mi, qi] = await getMultiple([memeAta, quoteAta], 100, activeConnection);
          setUserMemeBalance(mi?.data && mi.data.length >= 72 ? readU64LESafe(mi.data, 64) / 10 ** (pool.decimals ?? 6) : 0);
          setUserQuoteBalance(qi?.data && qi.data.length >= 72 ? readU64LESafe(qi.data, 64) / 1e9 : 0);
        } catch {}
      }, 2000);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.toLowerCase().includes('swap') && msg.toLowerCase().includes('disabled')) {
        setMeteoraStatus('__warming__');
      } else {
        setMeteoraStatus(`Error: ${msg}`);
      }
    } finally {
      setMeteoraBusy(false);
    }
  }, [pool, wallet, meteoraAmount, meteoraTradeTab, activeConnection]);

  // ── NFT Locker: mint ──────────────────────────────────────────────────────
  const handleMintNft = useCallback(async () => {
    if (!pool || !effectivePublicKey) return;
    const pk = effectivePublicKey!;
    const anchorWallet = {
      publicKey: pk,
      signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction,
      signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))),
    };
    setNftBusy(true);
    setNftStatus('Uploading NFT metadata…');
    try {
      const provider = new AnchorProvider(activeConnection, anchorWallet as any, { preflightCommitment: 'confirmed' });
      const lockerProgram = new Program(lockerIdl as Idl, LOCKER_PROGRAM_ID, provider);
      const memeMint = pool.memeMint;
      const nameRaw = pool.name ?? 'Meme';
      const symbolRaw = pool.symbol ?? 'MEME';
      const name = asciiClean(nameRaw).slice(0, 32);
      const symbol = asciiClean(symbolRaw).slice(0, 10);

      // Build metadata URI using existing pool image/audio
      const meta = {
        name: nameRaw, symbol: symbolRaw, description: pool.description ?? '',
        image: pool.imageUrl ?? '',
        animation_url: pool.audioUrl ?? '',
        attributes: [{ trait_type: 'MemeMint', value: memeMint.toBase58() }],
      };
      const metaUri = (await uploadMetadataJSON(meta)).slice(0, 200);

      // Derive PDAs
      const [counterPda] = await PublicKey.findProgramAddress(
        [Buffer.from('counter'), memeMint.toBuffer(), pk.toBuffer()],
        LOCKER_PROGRAM_ID
      );
      let lockId = 0;
      const counterInfo = await activeConnection.getAccountInfo(counterPda);
      if (counterInfo) {
        const c = await lockerProgram.account.lockCounter.fetch(counterPda);
        lockId = Number(c.count);
      }
      const lockIdLE = new Uint8Array(8);
      new DataView(lockIdLE.buffer).setBigUint64(0, BigInt(lockId), true);
      let [lockerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('locker'), memeMint.toBuffer(), pk.toBuffer(), Buffer.from(lockIdLE)],
        LOCKER_PROGRAM_ID
      );

      const mintBuild = await buildCreateMintIxDetail(activeConnection, pk, 0, lockerPda);
      const nftMint = mintBuild.mint;

      const { ata: userMemeAta, ix: userMemeAtaIx } = await ensureAtaIx(pk, memeMint, pk, false);
      const { ata: userNftAta, ix: userNftAtaIx } = await ensureAtaIx(pk, nftMint, pk, false);
      const { ata: lockerMemeAccount, ix: lockerMemeAtaIx } = await ensureAtaIx(lockerPda, memeMint, pk, true);

      const needInitCounter = !counterInfo;
      let needInitLocker = false;
      try { await lockerProgram.account.lockerState.fetch(lockerPda); }
      catch { needInitLocker = true; }

      const thresholdRaw = pool.nftThreshold ?? 44400;

      // TX A1: create mint + ATAs
      setNftStatus('Creating NFT mint…');
      await sendIxsOnce(activeConnection, anchorWallet, [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
        ...mintBuild.ixs, userMemeAtaIx, userNftAtaIx, lockerMemeAtaIx,
      ], mintBuild.signers);

      // TX A2: init counter
      if (needInitCounter) {
        setNftStatus('Initializing counter…');
        await sendIxsOnce(activeConnection, anchorWallet, [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
          await lockerProgram.methods.initializeCounter().accounts({
            user: pk, counter: counterPda, memeMint,
            systemProgram: SystemProgram.programId,
          }).instruction(),
        ], []);
      }

      // TX A3: init locker
      if (needInitLocker) {
        setNftStatus('Initializing locker…');
        const freshCounter = await lockerProgram.account.lockCounter.fetch(counterPda);
        const freshLockId = Number(freshCounter.count);
        const freshLE = new Uint8Array(8);
        new DataView(freshLE.buffer).setBigUint64(0, BigInt(freshLockId), true);
        const [freshLockerPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('locker'), memeMint.toBuffer(), pk.toBuffer(), Buffer.from(freshLE)],
          LOCKER_PROGRAM_ID
        );
        let alreadyExists = false;
        try { await lockerProgram.account.lockerState.fetch(freshLockerPda); alreadyExists = true; } catch {}
        if (!alreadyExists) {
          await sendIxsOnce(activeConnection, anchorWallet, [
            ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
            await lockerProgram.methods.initializeLocker(new BN(thresholdRaw), name, symbol, metaUri)
              .accounts({
                user: pk, counter: counterPda, locker: freshLockerPda,
                memeMint, nftMint, lockerMemeAccount,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
              }).instruction(),
          ], []);
          lockerPda = freshLockerPda;
        }
      }

      // TX B: lock tokens + mint NFT
      setNftStatus('Locking tokens & minting NFT…');
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()], METADATA_PROGRAM_ID
      );
      const [editionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer(), Buffer.from('edition')], METADATA_PROGRAM_ID
      );
      await sendIxsOnce(activeConnection, anchorWallet, [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
        await lockerProgram.methods.lockTokensAndMintNft(name, symbol, metaUri).accounts({
          user: pk,
          userMemeAccount: userMemeAta, locker: lockerPda, lockerMemeAccount,
          nftMint, userNftAccount: userNftAta,
          metadata: metadataPda, edition: editionPda,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        }).instruction(),
      ], []);

      setNftStatus('NFT minted! 🎨');
      await refreshUserNftsForPool();
      // Refresh meme balance
      try {
        const memeAta = await getAssociatedTokenAddress(memeMint, pk);
        const info = await activeConnection.getAccountInfo(memeAta);
        setUserMemeBalance(info?.data && info.data.length >= 72 ? readU64LESafe(info.data, 64) / 10 ** (pool.decimals ?? 0) : 0);
      } catch {}
    } catch (e: any) {
      const msg: string = e?.message || String(e);
      setNftStatus(msg.includes('User rejected') || msg.includes('canceled') ? 'Canceled.' : `Error: ${msg.slice(0, 80)}`);
    } finally {
      setNftBusy(false);
    }
  }, [pool, wallet, effectivePublicKey, activeConnection, refreshUserNftsForPool]);

  // ── NFT Locker: burn & claim ──────────────────────────────────────────────
  const handleBurnNft = useCallback(async (lockId: number, nftMint: PublicKey) => {
    if (!pool || !effectivePublicKey) return;
    const pk = effectivePublicKey!;
    const anchorWallet = {
      publicKey: pk,
      signTransaction: (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction,
      signAllTransactions: (wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction)(tx)))),
    };
    setNftBusy(true);
    setNftStatus('Burning NFT & unlocking tokens…');
    try {
      const provider = new AnchorProvider(activeConnection, anchorWallet as any, { preflightCommitment: 'confirmed' });
      const lockerProgram = new Program(lockerIdl as Idl, LOCKER_PROGRAM_ID, provider);
      const memeMint = pool.memeMint;

      const lockIdLE = new Uint8Array(8);
      new DataView(lockIdLE.buffer).setBigUint64(0, BigInt(lockId), true);
      const [lockerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('locker'), memeMint.toBuffer(), pk.toBuffer(), Buffer.from(lockIdLE)],
        LOCKER_PROGRAM_ID
      );
      const userMemeAta = await getAssociatedTokenAddress(memeMint, pk);
      const lockerMemeAccount = await getAssociatedTokenAddress(lockerPda, memeMint, true);
      const userNftAta = await getAssociatedTokenAddress(nftMint, pk);

      await lockerProgram.methods.burnNftAndUnlockTokens().accounts({
        user: pk,
        userMemeAccount: userMemeAta,
        locker: lockerPda,
        lockerMemeAccount,
        nftMint,
        userNftAccount: userNftAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();

      setNftStatus(`Tokens unlocked! 🔥`);
      await refreshUserNftsForPool();
      try {
        const memeAta = await getAssociatedTokenAddress(memeMint, pk);
        const info = await activeConnection.getAccountInfo(memeAta);
        setUserMemeBalance(info?.data && info.data.length >= 72 ? readU64LESafe(info.data, 64) / 10 ** (pool.decimals ?? 0) : 0);
      } catch {}
    } catch (e: any) {
      const msg: string = e?.message || String(e);
      setNftStatus(msg.includes('User rejected') || msg.includes('canceled') ? 'Canceled.' : `Error: ${msg.slice(0, 80)}`);
    } finally {
      setNftBusy(false);
    }
  }, [pool, wallet, effectivePublicKey, activeConnection, refreshUserNftsForPool]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) return (
    <div className="min-h-screen bg-[#0c0d12] text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#ffc371]" />
        <span className="text-[#8a8fa3] text-sm">Loading sound meme…</span>
      </div>
    </div>
  );

  if (error || !pool) return (
    <div className="min-h-screen bg-[#0c0d12] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🔇</div>
        <h1 className="text-xl font-bold mb-2">Pool Not Found</h1>
        <p className="text-[#8a8fa3] mb-6">{error || 'This sound meme does not exist.'}</p>
        <Link href="/sound-memes" className="inline-flex items-center gap-2 bg-[#1f2028] hover:bg-[#272830] border border-[#2d2f3a] px-5 py-2.5 rounded-xl text-sm font-medium transition">
          <ArrowLeft className="w-4 h-4" /> Back to Tokens
        </Link>
      </div>
    </div>
  );

  const quote = quoteLabelOf(pool);
  const pctDisplay = hoverDeltaPct ?? basePct;
  const isGraduated = pool.poolType === 2 || pool.poolType === 3;
  const poolTypeLabel = pool.poolType === 0 ? 'BONDING' : pool.poolType === 1 ? 'AMM' : pool.poolType === 2 ? 'GRADUATED' : 'METEORA';
  const poolTypeColor = pool.poolType === 0 ? 'bg-amber-500/20 text-amber-300' : pool.poolType === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-purple-500/20 text-purple-300';
  // Only show graduate/update controls to the pool creator
  const isPoolCreator = !!(effectivePublicKey && pool.creator && effectivePublicKey.toBase58() === pool.creator.toBase58());
  const repColor = (s: number) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';
  const repLabel = (s: number) => s >= 80 ? 'Legendary' : s >= 60 ? 'Established' : s >= 40 ? 'Rising' : s >= 20 ? 'New' : 'Unknown';

  return (
    <div className="min-h-screen bg-[#0c0d12] text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[#ffc371]/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#907aff]/[0.04] blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 bg-[#0c0d12]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/sound-memes" className="inline-flex items-center gap-2 text-[#8a8fa3] hover:text-white transition text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <WalletMultiButton className="!bg-[#1f2028] !border-[#2d2f3a] !rounded-xl !h-9 !text-sm" />
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 mb-8">

          {/* ── Left column ─────────────────────────────────────── */}
          <div className="lg:w-[340px] shrink-0">
            {/* Image card */}
            <div className="relative rounded-2xl overflow-hidden bg-[#14151c] border border-white/[0.06] group">
              <img
                src={pool.imageUrl || 'https://placehold.co/600x600?text=No+Image'}
                alt={pool.name ?? 'Sound Meme'}
                className="w-full aspect-square object-contain bg-[#14151c]"
              />
              {pool.audioUrl && (
                <button onClick={toggleAudio}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="bg-black/70 backdrop-blur-sm rounded-full p-5 ring-2 ring-white/10 hover:ring-[#ffc371]/40 transition">
                    {isPlaying ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white ml-1" />}
                  </span>
                </button>
              )}
              {isPlaying && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#ffc371] text-black text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <Volume2 className="w-3.5 h-3.5" /> Playing
                </div>
              )}
              {/* Living meme badge */}
              {pool.lockerPda && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#c8ff00]/90 text-black text-[10px] font-bold px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" /> Living Meme
                </div>
              )}
              <div className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${poolTypeColor}`}>
                {poolTypeLabel}
              </div>
            </div>

            {/* Name + meta */}
            <div className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold truncate">{pool.name || 'Untitled'}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-[#1f2028] border border-[#2d2f3a] px-2 py-0.5 rounded-md font-mono uppercase">
                      ${pool.symbol || 'MEME'}
                    </span>
                    <button onClick={copyAddress} className="flex items-center gap-1 text-xs text-[#6b7084] hover:text-[#ffc371] transition font-mono">
                      {shortAddr(mintParam, 4)}
                      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#ffc371] font-bold text-xl flex items-center gap-2 justify-end">
                    {pool.poolType === 3 && woodengUsdPrice > 0 && displayPrice > 0 ? (
                      <span>${(displayPrice * woodengUsdPrice).toFixed(8)}</span>
                    ) : (
                      <TinyPrice value={Number(displayPrice)} />
                    )}
                    {poolMultiplier && poolMultiplier.currentMult > 0 && (
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                        poolMultiplier.currentMult >= 1 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {poolMultiplier.currentMult >= 1000 ? `${(poolMultiplier.currentMult/1000).toFixed(1)}K` : poolMultiplier.currentMult >= 10 ? poolMultiplier.currentMult.toFixed(0) : poolMultiplier.currentMult.toFixed(1)}x
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#6b7084] flex items-center gap-2 justify-end">
                    <span>{pool.poolType === 3 && woodengUsdPrice > 0 ? 'USD' : quote}</span>
                    {poolMultiplier && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        poolMultiplier.bondingStatus === 'bonding' ? 'bg-blue-500/20 text-blue-300' :
                        poolMultiplier.bondingStatus === 'bonded' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {poolMultiplier.bondingStatus === 'bonding' ? '⏳ Bonding' :
                         poolMultiplier.bondingStatus === 'bonded' ? '✓ Bonded' : '🚀 AMM'}
                      </span>
                    )}
                  </div>
                  {poolMultiplier && poolMultiplier.athMult > poolMultiplier.currentMult * 1.05 && (
                    <div className="text-[10px] text-[#6b7084] mt-0.5 text-right">
                      ATH: {poolMultiplier.athMult >= 1000 ? `${(poolMultiplier.athMult/1000).toFixed(1)}K` : poolMultiplier.athMult >= 10 ? poolMultiplier.athMult.toFixed(0) : poolMultiplier.athMult.toFixed(1)}x
                    </div>
                  )}
                </div>
              </div>

              {pool.description && (
                <p className="text-sm text-[#8a8fa3] mt-3 leading-relaxed">{pool.description}</p>
              )}

              {pool.socials && (
                <div className="flex items-center gap-2 mt-3">
                  {pool.socials.x && <a href={pool.socials.x} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#1a1b23] hover:bg-[#22232e] border border-[#2d2f3a] flex items-center justify-center transition"><Twitter className="w-3.5 h-3.5 text-[#8a8fa3]" /></a>}
                  {pool.socials.telegram && <a href={pool.socials.telegram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#1a1b23] hover:bg-[#22232e] border border-[#2d2f3a] flex items-center justify-center transition"><Send className="w-3.5 h-3.5 text-[#8a8fa3]" /></a>}
                  {pool.socials.website && <a href={pool.socials.website} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#1a1b23] hover:bg-[#22232e] border border-[#2d2f3a] flex items-center justify-center transition"><Globe className="w-3.5 h-3.5 text-[#8a8fa3]" /></a>}
                  <a href={`https://solscan.io/token/${mintParam}${USE_DEVNET ? '?cluster=devnet' : ''}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#1a1b23] hover:bg-[#22232e] border border-[#2d2f3a] flex items-center justify-center transition"><ExternalLink className="w-3.5 h-3.5 text-[#8a8fa3]" /></a>
                </div>
              )}
            </div>

            {bondingProgress && (
              <div className="mt-4 rounded-xl bg-[#14151c] border border-white/[0.06] p-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[#8a8fa3] font-medium">Bonding Progress</span>
                  <span className="text-white font-bold">{Math.round(bondingProgress.pct * 100)}%</span>
                </div>
                <div className="relative w-full h-3 bg-[#1f2028] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r from-[#ffc371] to-[#ff8a3d] transition-all duration-500 ${bondingProgress.pct >= 1 ? 'animate-pulse' : ''}`} style={{ width: `${bondingProgress.pct * 100}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-[#6b7084] mt-1.5">
                  <span>{bondingProgress.woodUi.toFixed(2)} {quote}</span>
                  <span>{bondingProgress.thrUi.toFixed(2)} {quote} target</span>
                </div>
              </div>
            )}

            {isGraduated && (
              <div className="mt-4 rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-purple-300">{pool.poolType === 3 ? 'Trading on Meteora' : 'Graduated'}</span>
                </div>
                {pool.meteoraPool && pool.poolType === 3 && (
                  <div className="flex flex-col gap-2">
                    <a href={`https://app.meteora.ag/dammv2/${pool.meteoraPool}`} target="_blank" rel="noopener noreferrer" className="h-9 w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-sm bg-[#ffc371] text-black hover:bg-[#ffd491] transition">
                      Trade on Meteora <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a href={`https://jup.ag/swap/SOL-${mintParam}`} target="_blank" rel="noopener noreferrer" className="h-9 w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-xs bg-[#1f2028] text-white border border-[#2d2f3a] hover:bg-[#272830] transition">
                      Swap on Jupiter <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ✦ LIVING MEME STUDIO — shown only to creator */}
            <LivingMemeStudio
              pool={pool}
              wallet={wallet}
              connection={activeConnection}
              onSuccess={handleMetaUpdateSuccess}
              effectivePublicKey={effectivePublicKey}
              unifiedSignTx={unifiedSignTransaction}
            />

            {/* ✦ SWL-444: Meme Evolution Timeline — shown when multiple versions exist */}
            {pool.lockerTimeline && pool.lockerTimeline.length > 1 && (
              <MemeEvolutionTimeline timeline={pool.lockerTimeline} />
            )}

            {/* ✦ Graduate to Meteora — creator only, AMM (type 1) or post-grad (type 2) */}
            {isPoolCreator && (pool.poolType === 1 || pool.poolType === 2) && (
              <div className="mt-4 rounded-2xl overflow-hidden border border-[#907aff]/30 bg-gradient-to-br from-[#907aff]/[0.06] to-[#14151c]">
                <div className="px-5 py-4 flex items-center gap-3 border-b border-[#907aff]/15">
                  <div className="w-8 h-8 rounded-xl bg-[#907aff]/15 flex items-center justify-center shrink-0">
                    <Rocket className="w-4 h-4 text-[#907aff]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#907aff]">
                      {pool.poolType === 1 ? '🚀 Graduate to Meteora' : '✅ Graduated — Finalize on Meteora'}
                    </div>
                    <div className="text-[11px] text-[#6b7084] mt-0.5">Creator only</div>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {pool.poolType === 1 && (
                    <>
                      <p className="text-xs text-[#8a8fa3]">
                        Lock liquidity permanently on Meteora DAMM v2. This removes your creator fees but builds maximum community trust through a decentralized, permanent pool.
                      </p>
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
                        <span className="text-sm mt-0.5 shrink-0">⚠️</span>
                        <p className="text-xs text-amber-300/80">
                          This is <strong className="text-amber-300">permanent and irreversible</strong>. You will lose creator fees but gain long-term community credibility.
                        </p>
                      </div>
                      <button
                        onClick={handleGraduate}
                        disabled={gradBusy}
                        className="w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#907aff]/20 text-[#907aff] border border-[#907aff]/40 hover:bg-[#907aff]/30"
                      >
                        {gradBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🚀 Graduate to Meteora'}
                      </button>
                    </>
                  )}
                  {pool.poolType === 2 && (
                    <>
                      <p className="text-xs text-emerald-400 font-semibold">✅ Graduation confirmed. Create the Meteora DAMM v2 pool to finalize.</p>
                      <p className="text-xs text-[#8a8fa3]">
                        This deposits all pooled liquidity into a permanent Meteora DAMM v2 pool. The position NFT will be minted to your wallet.
                      </p>
                      <button
                        onClick={handleCreateMeteoraPool}
                        disabled={dammBusy}
                        className="w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30"
                      >
                        {dammBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🌊 Create DAMM v2 Pool'}
                      </button>
                      {dammStatus && (
                        <div className={`text-xs text-center mt-1 ${dammStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                          {dammStatus}
                        </div>
                      )}
                      {dammPoolPubkey && (
                        <a
                          href="https://app.meteora.ag"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View on Meteora →
                        </a>
                      )}
                    </>
                  )}
                  {gradStatus && (
                    <div className={`text-xs text-center mt-1 ${gradStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                      {gradStatus}
                    </div>
                  )}
                  {gradError && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-2">
                      <p className="text-xs text-amber-300 font-medium">⚠️ Insufficient SOL for fees</p>
                      <p className="text-xs text-[#8a8fa3] mt-1">{gradError}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: Chart + Trade panel ─────────────── */}
          <div className="flex-1 min-w-0">

            {/* Chart */}
            <div className="rounded-2xl bg-[#14151c] border border-white/[0.06] overflow-hidden">
              {pool.poolType === 3 ? (
                <>
                  <div className="relative w-full h-[280px] sm:h-[340px] lg:h-[420px]">
                    <iframe
                      src={`https://birdeye.so/tv-widget/${mintParam}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=Europe%2FZurich&theme=dark`}
                      frameBorder={0}
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                  <div className="px-4 py-2 text-center border-t border-white/[0.04]">
                    <span className="text-[10px] text-[#6b7084]">
                      Chart by{' '}
                      <a
                        href={`https://birdeye.so/token/${mintParam}?chain=solana`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300"
                      >
                        Birdeye
                      </a>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex gap-1">
                      {(['15m', '30m', '1h', '4h', '24h'] as Timeframe[]).map(tf => (
                        <button key={tf} onClick={() => setSelectedTf(tf)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${selectedTf === tf ? 'bg-[#ffc371] text-black' : 'text-[#6b7084] hover:text-white hover:bg-white/[0.04]'}`}>
                          {tf.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${pctDisplay >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                      {selectedTf.toUpperCase()} {pctDisplay >= 0 ? '+' : ''}{pctDisplay.toFixed(2)}%
                    </div>
                  </div>
                  <div className="relative w-full h-[280px] sm:h-[340px] lg:h-[380px]">
                    {candles.length > 0 ? (
                      <CandleChart key={selectedTf} data={candles} volume={volume} onBarHover={({ pct }) => setHoverDeltaPct(pct ?? null)} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-[#6b7084] text-sm">
                        <BarChart3 className="w-5 h-5 mr-2 opacity-50" /> No chart data yet
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Meteora DAMM v2 swap panel (poolType === 3) ── */}
            {pool.poolType === 3 && (
              <div className="mt-4 rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
                {/* Buy / Sell tabs */}
                <div className="flex rounded-xl bg-[#0c0d12] p-1 mb-4">
                  <button
                    onClick={() => { setMeteoraTradeTab('buy'); setMeteoraAmount(''); setMeteoraQuoteOut(null); }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${meteoraTradeTab === 'buy' ? 'bg-[#ffc371] text-black' : 'text-[#6b7084] hover:text-white'}`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => { setMeteoraTradeTab('sell'); setMeteoraAmount(''); setMeteoraQuoteOut(null); }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${meteoraTradeTab === 'sell' ? 'bg-[#ff5656] text-white' : 'text-[#6b7084] hover:text-white'}`}
                  >
                    Sell
                  </button>
                </div>

                {/* Balance row */}
                {effectivePublicKey && (
                  <div className="flex items-center justify-between text-xs text-[#6b7084] mb-3">
                    <span>Balance:</span>
                    <span className="font-mono">
                      {meteoraTradeTab === 'buy'
                        ? `${userQuoteBalance.toFixed(4)} ${quote}`
                        : `${userMemeBalance.toLocaleString()} ${pool.symbol}`}
                    </span>
                  </div>
                )}

                {/* Amount input */}
                <div className="relative">
                  <input
                    type="number"
                    value={meteoraAmount}
                    onChange={e => setMeteoraAmount(e.target.value)}
                    placeholder={meteoraTradeTab === 'buy' ? `Amount in ${quote}` : `Amount in ${pool.symbol}`}
                    className="w-full bg-[#0c0d12] border border-[#2d2f3a] rounded-xl px-4 py-3 text-white placeholder:text-[#3d4052] focus:border-[#ffc371]/40 focus:ring-1 focus:ring-[#ffc371]/20 outline-none transition font-mono"
                  />
                  {effectivePublicKey && (
                    <button
                      onClick={() => setMeteoraAmount(
                        meteoraTradeTab === 'buy'
                          ? (userQuoteBalance * 0.95).toFixed(4)
                          : userMemeBalance.toString()
                      )}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#ffc371] bg-[#ffc371]/10 px-2 py-1 rounded-md hover:bg-[#ffc371]/20 transition"
                    >
                      MAX
                    </button>
                  )}
                </div>

                {/* Preset % buttons */}
                {effectivePublicKey && (
                  <div className="flex gap-2 mt-2">
                    {[10, 25, 50, 100].map(pct => (
                      <button
                        key={pct}
                        onClick={() => {
                          if (meteoraTradeTab === 'buy') {
                            const bal = pct === 100 ? userQuoteBalance * 0.95 : userQuoteBalance * (pct / 100);
                            setMeteoraAmount(bal > 0 ? bal.toFixed(4) : '');
                          } else {
                            const bal = pct === 100 ? userMemeBalance : Math.floor(userMemeBalance * (pct / 100));
                            setMeteoraAmount(bal > 0 ? bal.toString() : '');
                          }
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-[#1a1b23] border border-[#2d2f3a] text-xs text-[#8a8fa3] hover:text-white hover:border-[#ffc371]/30 transition font-semibold"
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Estimated output */}
                {meteoraQuoteOut && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-[#1a1b23] border border-[#2d2f3a] flex items-center justify-between text-xs">
                    <span className="text-[#6b7084]">Est. received (1% slippage)</span>
                    <span className="font-mono text-white font-semibold">
                      {meteoraQuoteOut} {meteoraTradeTab === 'buy' ? pool.symbol : quote}
                    </span>
                  </div>
                )}

                {/* Swap button */}
                <button
                  onClick={handleMeteoraSwap}
                  disabled={meteoraBusy || !effectivePublicKey || !meteoraAmount}
                  className={`w-full mt-4 py-3 rounded-xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    meteoraTradeTab === 'buy'
                      ? 'bg-gradient-to-r from-[#ffc371] to-[#ff9f43] text-black hover:shadow-lg hover:shadow-[#ffc371]/20'
                      : 'bg-gradient-to-r from-[#ff5656] to-[#ff4040] text-white hover:shadow-lg hover:shadow-[#ff5656]/20'
                  }`}
                >
                  {meteoraBusy
                    ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    : !effectivePublicKey
                      ? 'Connect Wallet'
                      : meteoraTradeTab === 'buy'
                        ? `Buy ${pool.symbol}`
                        : `Sell ${pool.symbol}`}
                </button>

                {meteoraStatus === '__warming__' ? (
                  <div className="mt-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                    <p className="text-sm text-purple-300 font-medium">⏳ Meteora pool is warming up</p>
                    <p className="text-xs text-[#8a8fa3] mt-1">Trading opens ~2 minutes after pool creation</p>
                  </div>
                ) : meteoraStatus ? (
                  <div className={`mt-2 text-xs text-center ${meteoraStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {meteoraStatus}
                  </div>
                ) : null}

                {/* External links */}
                <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-white/[0.04] text-[11px] text-[#6b7084]">
                  <span>Also available on:</span>
                  {pool.meteoraPool && (
                    <a href={`https://app.meteora.ag/dammv2/${pool.meteoraPool}`} target="_blank" rel="noopener noreferrer" className="text-[#ffc371] hover:text-[#ffd491] flex items-center gap-1 transition">
                      Meteora <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <a href={`https://jup.ag/swap/SOL-${mintParam}`} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 flex items-center gap-1 transition">
                    Jupiter <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Collapsed Jupiter Terminal */}
                <div className="mt-3 border-t border-white/[0.04]">
                  <button
                    onClick={() => setShowJupiter(v => !v)}
                    className="w-full flex items-center justify-between py-3 text-xs text-[#6b7084] hover:text-white transition"
                  >
                    <span>Swap via Jupiter Terminal</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showJupiter ? 'rotate-180' : ''}`} />
                  </button>
                  {showJupiter && (
                    <div id="jupiter-terminal-graduated" className="w-full min-h-[400px]" />
                  )}
                </div>
              </div>
            )}

            {/* Trade panel */}
            {!isGraduated && (
              <div className="mt-4 rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
                <div className="flex rounded-xl bg-[#0c0d12] p-1 mb-4">
                  <button onClick={() => setTradeTab('buy')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${tradeTab === 'buy' ? 'bg-[#ffc371] text-black' : 'text-[#6b7084] hover:text-white'}`}>Buy</button>
                  <button onClick={() => setTradeTab('sell')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${tradeTab === 'sell' ? 'bg-[#ff5656] text-white' : 'text-[#6b7084] hover:text-white'}`}>
                    Sell {pool.poolType === 0 && <span className="text-[10px] opacity-70 ml-1">(10% tax)</span>}
                  </button>
                </div>
                {effectivePublicKey && (
                  <div className="flex items-center justify-between text-xs text-[#6b7084] mb-3">
                    <span>Balance:</span>
                    <span className="font-mono">{tradeTab === 'buy' ? `${userQuoteBalance.toFixed(4)} ${quote}` : `${userMemeBalance.toLocaleString()} ${pool.symbol}`}</span>
                  </div>
                )}
                <div className="relative">
                  <input type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)}
                    placeholder={tradeTab === 'buy' ? `Amount in ${quote}` : `Amount in ${pool.symbol}`}
                    className="w-full bg-[#0c0d12] border border-[#2d2f3a] rounded-xl px-4 py-3 text-white placeholder:text-[#3d4052] focus:border-[#ffc371]/40 focus:ring-1 focus:ring-[#ffc371]/20 outline-none transition font-mono" />
                  {effectivePublicKey && (
                    <button onClick={() => setTradeAmount(tradeTab === 'buy' ? (userQuoteBalance * 0.95).toFixed(4) : userMemeBalance.toString())}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#ffc371] bg-[#ffc371]/10 px-2 py-1 rounded-md hover:bg-[#ffc371]/20 transition">
                      MAX
                    </button>
                  )}
                </div>
                {effectivePublicKey && (
                  <div className="flex gap-2 mt-2">
                    {[10, 25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => {
                        if (tradeTab === 'buy') {
                          const bal = pct === 100 ? userQuoteBalance * 0.95 : userQuoteBalance * (pct / 100);
                          setTradeAmount(bal > 0 ? bal.toFixed(4) : '');
                        } else {
                          const bal = pct === 100 ? userMemeBalance : Math.floor(userMemeBalance * (pct / 100));
                          setTradeAmount(bal > 0 ? bal.toString() : '');
                        }
                      }}
                        className="flex-1 py-1.5 rounded-lg bg-[#1a1b23] border border-[#2d2f3a] text-xs text-[#8a8fa3] hover:text-white hover:border-[#ffc371]/30 transition font-semibold">
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
                {/* ── Diamond Hand Gate: shown in buy tab for gated V2 bonding pools ── */}
                {(() => {
                  const minDays = pool.minAvgHoldDays ?? 0;
                  const isGated = tradeTab === 'buy' && pool.programVersion === 'v2' && minDays > 0;
                  console.log('[GATE DEBUG]', {
                    tradeTab,
                    programVersion: pool.programVersion,
                    minAvgHoldDays: pool.minAvgHoldDays,
                    minDays: pool.minAvgHoldDays ?? 0,
                    isGated,
                  });
                  const userQualifies = isGated && myAvgDays !== null && myAvgDays >= minDays;
                  const buyBlocked = isGated && !userQualifies;
                  return (
                    <>
                      {isGated && (
                        <DiamondHandGate
                          minDays={minDays}
                          myDays={myAvgDays}
                          loading={hpFetching}
                          walletConnected={!!effectivePublicKey}
                        />
                      )}
                      {!buyBlocked && (
                        <button onClick={handleTrade} disabled={tradeBusy || !effectivePublicKey || !tradeAmount}
                          className={`w-full mt-4 py-3 rounded-xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${tradeTab === 'buy' ? 'bg-gradient-to-r from-[#ffc371] to-[#ff9f43] text-black hover:shadow-lg hover:shadow-[#ffc371]/20' : 'bg-gradient-to-r from-[#ff5656] to-[#ff4040] text-white hover:shadow-lg hover:shadow-[#ff5656]/20'}`}>
                          {tradeBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : !effectivePublicKey ? 'Connect Wallet' : tradeTab === 'buy' ? `Buy ${pool.symbol}` : `Sell ${pool.symbol}`}
                        </button>
                      )}
                      {tradeStatus && (
                        <div className={`mt-2 text-xs text-center ${tradeStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{tradeStatus}</div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── NFT Locker card ── */}
            {!isGraduated && (
              <div className="mt-4 rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
                <h3 className="text-sm font-bold text-[#8a8fa3] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ImagePlus className="w-4 h-4 text-purple-400" />
                  NFT Locker
                  {nftsLoaded && userNfts.length > 0 && (
                    <span className="ml-auto bg-purple-500/20 text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {userNfts.length} NFT{userNfts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>

                {/* Threshold progress */}
                {(() => {
                  const threshold = pool.nftThreshold ?? 44400;
                  const pct = Math.min(1, userMemeBalance / threshold);
                  const qualifies = userMemeBalance >= threshold;
                  return (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#6b7084]">Your balance</span>
                        <span className={`font-mono font-semibold ${qualifies ? 'text-emerald-400' : 'text-[#8a8fa3]'}`}>
                          {userMemeBalance.toLocaleString()} / {threshold.toLocaleString()} {pool.symbol}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1a1b23] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round(pct * 100)}%`,
                            background: qualifies
                              ? 'linear-gradient(90deg,#a78bfa,#7c3aed)'
                              : 'linear-gradient(90deg,#4b5563,#6b7280)',
                          }}
                        />
                      </div>
                      {!effectivePublicKey && (
                        <p className="text-xs text-[#6b7084] mt-2">Connect wallet to mint NFTs</p>
                      )}
                      {effectivePublicKey && !qualifies && (
                        <p className="text-xs text-[#6b7084] mt-2">
                          Need {Math.max(0, threshold - Math.floor(userMemeBalance)).toLocaleString()} more {pool.symbol} to mint
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Mint NFT button */}
                {effectivePublicKey && userMemeBalance >= (pool.nftThreshold ?? 44400) && (
                  <button
                    onClick={handleMintNft}
                    disabled={nftBusy}
                    className="w-full py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed mb-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    {nftBusy && nftStatus.includes('mint') ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🎨 Mint NFT'}
                  </button>
                )}

                {/* User's NFTs — burn & claim */}
                {nftsLoaded && userNfts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#6b7084] mb-2">Your locked NFTs:</p>
                    {userNfts.map(({ lockId, nftMint }) => (
                      <div key={lockId} className="flex items-center justify-between bg-[#0c0d12] rounded-xl px-3 py-2.5 border border-white/[0.04]">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-[#8a8fa3] truncate">
                            Lock #{lockId} · {nftMint.toBase58().slice(0, 8)}…
                          </p>
                          <p className="text-[11px] text-[#6b7084] mt-0.5">
                            Claim ~{(pool.nftThreshold ?? 44400).toLocaleString()} {pool.symbol}
                          </p>
                        </div>
                        <button
                          onClick={() => handleBurnNft(lockId, nftMint)}
                          disabled={nftBusy}
                          className="shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500/15 text-orange-300 border border-orange-500/20 hover:bg-orange-500/25 transition disabled:opacity-50"
                        >
                          {nftBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔥 Burn & Claim'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status message */}
                {nftStatus && (
                  <div className={`mt-3 text-xs text-center ${nftStatus.startsWith('Error') ? 'text-red-400' : nftStatus === 'Canceled.' ? 'text-[#6b7084]' : 'text-emerald-400'}`}>
                    {nftBusy && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
                    {nftStatus}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ Bottom grid ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Pool Info */}
          <div className="rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
            <h3 className="text-sm font-bold text-[#8a8fa3] uppercase tracking-wider mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Pool Info</h3>
            <div className="space-y-3">
              {poolStats.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[#6b7084]">{label}</span>
                  <span className="text-xs text-white font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meme Evolution Timeline */}
          <div className="rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
            {pool.lockerTimeline && pool.lockerTimeline.length > 0 ? (
              <MemeEvolutionTimeline timeline={pool.lockerTimeline} />
            ) : (
              <>
                <h3 className="text-sm font-bold text-[#8a8fa3] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#c8ff00]" /> Meme Evolution Timeline
                </h3>
                <div className="text-center py-8 text-[#6b7084] text-xs">No evolution history yet</div>
              </>
            )}
          </div>

          {/* Creator Info */}
          <div className="rounded-2xl bg-[#14151c] border border-white/[0.06] p-5">
            <h3 className="text-sm font-bold text-[#8a8fa3] uppercase tracking-wider mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Creator</h3>
            {creatorLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#6b7084]" /></div>
            ) : !creatorInfo ? (
              <div className="text-center py-8 text-[#6b7084] text-xs">Creator info unavailable</div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffc371]/20 to-[#907aff]/20 flex items-center justify-center">
                    <Award className={`w-5 h-5 ${repColor(creatorInfo.reputationScore)}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <a href={`https://solscan.io/account/${creatorInfo.address}${USE_DEVNET ? '?cluster=devnet' : ''}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-[#8a8fa3] hover:text-[#ffc371] transition flex items-center gap-1">
                      {shortAddr(creatorInfo.address, 6)} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(() => {
                        const avgMult = (creatorInfo.avgAthPctGain / 100) + 1;
                        const fmtM = avgMult >= 1000 ? `${(avgMult/1000).toFixed(1)}K` : avgMult >= 10 ? avgMult.toFixed(0) : avgMult.toFixed(1);
                        return (
                          <span className={`text-sm font-bold ${avgMult >= 10 ? 'text-emerald-400' : avgMult >= 2 ? 'text-yellow-400' : avgMult >= 1 ? 'text-[#8a8fa3]' : 'text-red-400'}`}>
                            🔥 Avg {fmtM}x
                          </span>
                        );
                      })()}
                      <span className="text-[11px] text-[#6b7084]">{creatorInfo.totalLaunches} launch{creatorInfo.totalLaunches !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-[#0c0d12] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-white">{creatorInfo.totalLaunches}</div>
                    <div className="text-[10px] text-[#6b7084] mt-0.5">Launches</div>
                  </div>
                  <div className="bg-[#0c0d12] rounded-lg p-2.5 text-center">
                    <div className={`text-lg font-bold ${creatorInfo.avgAthPctGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(() => {
                        const avgMult = (creatorInfo.avgAthPctGain / 100) + 1;
                        return avgMult >= 1000 ? `${(avgMult/1000).toFixed(1)}K` : avgMult >= 10 ? avgMult.toFixed(0) : avgMult.toFixed(1);
                      })()}x
                    </div>
                    <div className="text-[10px] text-[#6b7084] mt-0.5">Avg ATH</div>
                  </div>
                  <div className="bg-[#0c0d12] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-purple-400">{creatorInfo.pools.filter(p => p.poolType >= 2 || (p.poolType >= 1 && (p.bondingSold ?? 0) > 0)).length}</div>
                    <div className="text-[10px] text-[#6b7084] mt-0.5">Graduated</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#6b7084] uppercase tracking-wider font-bold mb-2">Previous Launches</div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                  {creatorInfo.pools.map(p => (
                    <Link key={p.mint} href={`/sound-memes/${p.mint}`} className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition group">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover bg-[#1f2028]" /> : <div className="w-8 h-8 rounded-lg bg-[#1f2028] flex items-center justify-center text-[10px] text-[#6b7084]">🔊</div>}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate group-hover:text-[#ffc371] transition">{p.name || shortAddr(p.mint, 4)}</div>
                        <div className="text-[10px] text-[#6b7084] font-mono">${p.symbol}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-bold ${p.currentPrice / p.basePrice >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(() => {
                            const m = p.currentPrice / p.basePrice;
                            return m >= 1000 ? `${(m/1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1);
                          })()}x
                        </div>
                        <div className="text-[10px] text-[#6b7084]">
                          {(() => {
                            const athM = Math.max(p.athPrice, p.currentPrice) / p.basePrice;
                            const curM = p.currentPrice / p.basePrice;
                            if (athM > curM * 1.05) {
                              const f = athM >= 1000 ? `${(athM/1000).toFixed(1)}K` : athM >= 10 ? athM.toFixed(0) : athM.toFixed(1);
                              return `ATH ${f}x`;
                            }
                            return 'Now';
                          })()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}