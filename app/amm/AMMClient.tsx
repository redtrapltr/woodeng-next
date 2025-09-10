// app/amm/AMMClient.tsx
'use client';


import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PublicKey, Connection, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, clusterApiUrl, SendTransactionError
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getMint,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token';

import { Buffer } from 'buffer';

import * as anchor from '@project-serum/anchor';
import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import type { Idl } from '@project-serum/anchor';

import { useWallet } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Brush
} from 'recharts';
import { Loader2, CheckCircle2, AlertCircle, Info, Play, Pause, X, Search, Coins, ArrowUpRight } from 'lucide-react';
import idl from '../../idl/idl.json';




// Minimal shapes of on-chain accounts we read
interface PoolAccount {
  nftMints: PublicKey[];
  nftReserves: BN[];     // array length 1 for single pools
  vx: BN;
  vy: BN;
  tokenReserve: BN;
  tokenMint: PublicKey;
  creator: PublicKey;
  royaltyBps: number;    // u16 on-chain
}

interface BundleConfigAccount {
  mints: PublicKey[];
  nftReserves: BN[];
  vx: BN;
  vy: BN;
  tokenReserve: BN;
  tokenMint: PublicKey;
  creator: PublicKey;
  royaltyBps: number;
}



// ---- IPFS helpers (ADD) ----
const toHttp = (u?: string | null) =>
  u ? u.replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/') : null;

async function safeJson(uri?: string | null) {
  if (!uri) return null;
  try {
    const res = await fetch(toHttp(uri)!);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}


export default function AMMClient() {


const PROGRAM_ID = new PublicKey('FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS');
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');
const WSOL_MINT = NATIVE_MINT; // So11111111111111111111111111111111111111112
const fmt = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
const [poolCanPay, setPoolCanPay] = useState(true);


const newOrderId = () => BigInt(Date.now() * 1_000 + Math.floor(Math.random() * 1_000));

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ');
}

interface OrderData {
  bump: number;
  id: BN;                  // optional but nice to have
  seller: PublicKey;
  nftMint: PublicKey;
  price: BN;
  escrow: PublicKey;
  creator: PublicKey;      // ← add
  royaltyBps: number;      // ← add (u16)
}

interface OrderAccount { publicKey: PublicKey; account: OrderData }


  const wallet = useWallet();
  const { publicKey, signTransaction, signAllTransactions } = wallet;

  // State
  const [program, setProgram] = useState<Program<Idl> | null>(null);
  const searchParams = useSearchParams();
  const initialAddr = (searchParams.get('addr') ?? '').trim();
  const [searchInput, setSearchInput] = useState(initialAddr);

  const [poolPk, setPoolPk] = useState<PublicKey | null>(null);
  const [poolType, setPoolType] = useState<'single' | 'bundle' | null>(null);
  const [poolState, setPoolState] = useState<PoolAccount | null>(null);
  const [bundleState, setBundleState] = useState<BundleConfigAccount | null>(null);

  const [poolSigner, setPoolSigner] = useState<PublicKey | null>(null);
  const [tokenVault, setTokenVault] = useState<PublicKey | null>(null);
  const [nftVaults, setNftVaults] = useState<PublicKey[]>([]);
  const [selectedMintIndex, setSelectedMintIndex] = useState(0);
  const [mintNames, setMintNames] = useState<string[]>([]);
  const [mintImages, setMintImages] = useState<string[]>([]);
  const [available, setAvailable] = useState<boolean[]>([]);
  const [orders, setOrders] = useState<OrderAccount[]>([]);
  const [tradeHistory, setTradeHistory] = useState<{ time: string; price: number }[]>([]);
  const [newPrice, setNewPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [transactionMessage, setTransactionMessage] = useState('');
  const [selectedDataPoint, setSelectedDataPoint] = useState<number | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recentPools, setRecentPools] = useState<string[]>([]);
  const [brushStartIndex, setBrushStartIndex] = useState(0);



  // --- Create Pool (quick form)
const [newPoolNft, setNewPoolNft] = useState('');
const [seedAmount, setSeedAmount] = useState('0.50');  // UI units (SOL or WOODENG)
const [royaltyBpsInput, setRoyaltyBpsInput] = useState('500'); // 5%
const [useSOL, setUseSOL] = useState(true);            // toggle SOL vs WOODENG


  const [quoteMint, setQuoteMint] = useState<PublicKey | null>(null);
  const [quoteDecimals, setQuoteDecimals] = useState<number>(9);
  const [quoteSymbol, setQuoteSymbol] = useState<string>('WOODENG'); // or 'SOL'


  const [vaultTick, setVaultTick] = useState(0);


  const fetchPoolAcc = async (pk: PublicKey) =>
  (await program!.account.pool.fetch(pk)) as unknown as PoolAccount;

const fetchBundleAcc = async (pk: PublicKey) =>
  (await program!.account.bundleConfig.fetch(pk)) as unknown as BundleConfigAccount;

const [userBalances, setUserBalances] = useState<number[]>([]);




  // Track last persisted to avoid spam
const persistRef = useRef<{lastTs:number; lastPrice:number; pool:string}>({ lastTs:0, lastPrice:NaN, pool:'' });

async function persistPrice(p: number, reason: 'trade'|'limit_fill'|'tick' = 'trade', tx?: string) {
  if (!poolPk) return;
  const poolBase58 = poolPk.toBase58();
  const now = Date.now();

  // dedupe identical writes within 5s
  if (
    persistRef.current.pool === poolBase58 &&
    Math.abs((persistRef.current.lastPrice ?? NaN) - p) < 1e-9 &&
    (now - persistRef.current.lastTs) < 5000
  ) return;

  persistRef.current = { lastTs: now, lastPrice: p, pool: poolBase58 };

  const payload = { pool: poolBase58, quote: quoteSymbol, price: p, ts: new Date(now).toISOString(), source: reason, tx };
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/amm/prices', blob);
    } else {
      await fetch('/api/amm/prices', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive: true
      });
    }
  } catch { /* non-blocking */ }
}

// NEW pushPrice (ISO timestamps)
const pushPrice = (p: number, reason: 'trade'|'limit_fill'|'tick' = 'tick', tx?: string) => {
  const iso = new Date().toISOString();
  setTradeHistory(h => [...h, { time: iso, price: p }]);
  persistPrice(p, reason, tx);
};

// Load persisted history when a pool is opened
async function loadHistory(pk: PublicKey) {
  try {
    const res = await fetch(`/api/amm/prices?pool=${pk.toBase58()}&limit=500`, { cache: 'no-store' });
    const json = await res.json();
    const rows = Array.isArray(json.rows) ? json.rows : [];
    setTradeHistory(rows.map((r: any) => ({ time: r.ts, price: Number(r.price) })));
  } catch {
    setTradeHistory([]);
  }
}


async function rpcWithLogs<T>(p: Promise<T>, conn: Connection) {
  try {
    return await p;
  } catch (e: any) {
    try {
      if (e instanceof SendTransactionError && typeof e.getLogs === 'function') {
        const logs = await e.getLogs(conn);
        console.error('Transaction logs:\n' + (logs?.join('\n') ?? '(none)'));
      } else if (Array.isArray(e.logs)) {
        console.error('Transaction logs:\n' + e.logs.join('\n'));
      }
    } catch { /* ignore */ }
    throw e;
  }
}

 







  



  async function ensureQuoteAtaAndMaybeWrap(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey,
  wallet: ReturnType<typeof useWallet>,
  lamportsToWrap = 0
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const ixs: anchor.web3.TransactionInstruction[] = [];

  // Create ATA if missing
  try {
    await getAccount(conn, ata);
  } catch {
    ixs.push(createAssociatedTokenAccountInstruction(owner, ata, owner, mint));
  }

  // For wSOL, optionally pre-fund and sync
  if (mint.equals(WSOL_MINT) && lamportsToWrap > 0) {
    ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports: lamportsToWrap }));
    ixs.push(createSyncNativeInstruction(ata));
  }

  if (ixs.length) {
    const tx = new anchor.web3.Transaction().add(...ixs);
    tx.feePayer = owner;
    tx.recentBlockhash = (await conn.getLatestBlockhash('finalized')).blockhash;
    const signed = await wallet.signTransaction!(tx);
    const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(sig, 'confirmed');
  }

  return ata;
}




  async function ensureAta(conn: Connection, owner: PublicKey, mint: PublicKey): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(mint, owner);
    try {
      await getAccount(conn, ata);
    } catch {
      const ix = createAssociatedTokenAccountInstruction(owner, ata, owner, mint);
      const tx = new Transaction().add(ix);
      tx.feePayer = owner;
      tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
      const signed = await signTransaction!(tx);
      const sig = await conn.sendRawTransaction(signed.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
    }
    return ata;
  }



  async function ensureAtaFor(
  conn: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  try {
    await getAccount(conn, ata);
  } catch {
    const ix = createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
    const tx = new Transaction().add(ix);
    tx.feePayer = payer;
    tx.recentBlockhash = (await conn.getLatestBlockhash('finalized')).blockhash;
    const signed = await wallet.signTransaction!(tx);
    const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(sig, 'confirmed');
  }
  return ata;
}





// === CREATE A SINGLE-MINT POOL IN ONE TX (WOODENG or SOL) ===
async function createSinglePoolOneTx(opts: {
  nftMint: PublicKey;
  quoteMint: PublicKey;     // WOODENG_MINT or WSOL_MINT
  initialUi: number;        // UI units, e.g. 0.5 for SOL or 100 for WOODENG
  vxUi?: number;
  vyUi?: number;
  royaltyBps: number;       // 0..10000
  creator: PublicKey;
}) {
  if (!program || !publicKey) throw new Error("Wallet/program not ready");
  const conn = program.provider.connection;
  const { nftMint, quoteMint, initialUi, vxUi = 0, vyUi = 0, royaltyBps, creator } = opts;

  // decimals for quote mint
  const mi = await getMint(conn, quoteMint);
  const d = mi.decimals;
  const toRaw = (x: number) => new BN(Math.round(x * 10 ** d).toString());

  const initialRaw = toRaw(initialUi);
  const vxRaw = toRaw(vxUi);
  const vyRaw = toRaw(vyUi);

  // fresh keypair for pool (init + signer)
  const poolKp = anchor.web3.Keypair.generate();

  // PDAs from pool pubkey (must match on-chain seeds)
  const [poolSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), poolKp.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [nftVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_vault"), poolKp.publicKey.toBuffer(), Uint8Array.of(0)],
    PROGRAM_ID
  );
  const [tokenVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), poolKp.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // pre-instructions: ensure/fund payer ATA (and wrap if SOL)
  const payerAta = await getAssociatedTokenAddress(quoteMint, publicKey);
  const preIxs: anchor.web3.TransactionInstruction[] = [];

  try { await getAccount(conn, payerAta); }
  catch {
    preIxs.push(createAssociatedTokenAccountInstruction(publicKey, payerAta, publicKey, quoteMint));
  }

  const isWSOL = quoteMint.equals(WSOL_MINT);
  if (isWSOL) {
    preIxs.push(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: payerAta, lamports: initialRaw.toNumber() }));
    preIxs.push(createSyncNativeInstruction(payerAta));
  }

  // post-instructions: close wSOL ATA (reclaim rent) if we wrapped
  const postIxs: anchor.web3.TransactionInstruction[] = [];
  if (isWSOL) {
    postIxs.push(createCloseAccountInstruction(payerAta, publicKey, publicKey));
  }

  // IMPORTANT: add .signers([poolKp]) so Anchor knows `pool` is a signer,
  // and let Anchor send ONE tx with pre/post instructions.
  await program.methods
    .createPool(vxRaw, vyRaw, initialRaw, creator, royaltyBps)
    .accounts({
      pool: poolKp.publicKey,
      poolSigner,
      nftVault,
      tokenVault,
      payerTokenAta: payerAta,
      nftMint,
      tokenMint: quoteMint,
      payer: publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([poolKp])                  // <= this fixes "pool not provided"
    .preInstructions(preIxs)            // wrap/create ATA before
    .postInstructions(postIxs)          // close wSOL ATA after
    .rpc();                             // single transaction

  // reflect in UI
  setPoolPk(poolKp.publicKey);
  setPoolType("single");
  await loadHistory(poolKp.publicKey);
  setRecentPools((prev) => {
    const b = poolKp.publicKey.toBase58();
    return prev.includes(b) ? prev : [b, ...prev.slice(0, 4)];
  });

  return poolKp.publicKey;
}




async function handleCreatePoolClick() {
  try {
    if (!publicKey) throw new Error("Connect wallet");
    const mintPk = new PublicKey(newPoolNft.trim());
    const initial = parseFloat(seedAmount || '0') || 0;

    const quote = useSOL ? WSOL_MINT : WOODENG_MINT;
    const royalty = Math.max(0, Math.min(10000, parseInt(royaltyBpsInput || '0', 10) || 0));

    setIsLoading(true);
    await createSinglePoolOneTx({
      nftMint: mintPk,
      quoteMint: quote,
      initialUi: initial,
      vxUi: 0,
      vyUi: 0,
      royaltyBps: royalty,
      creator: publicKey!, // or any wallet to receive royalties
    });
    alert('Pool created!');
  } catch (e: any) {
    alert(e.message ?? String(e));
  } finally {
    setIsLoading(false);
  }
}


useEffect(() => {
  (async () => {
    if (!program || !tokenVault || !poolType) return;
    try {
      const conn = program.provider.connection;
      const vaultAcc = await getAccount(conn, tokenVault);
      const vaultBal = Number(vaultAcc.amount); // base units

      let outflow = 0; // what must leave tokenVault (seller + creator)
if (poolType === 'single' && poolState) {
  const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
  const y0 = poolState.tokenReserve.toNumber() + poolState.vy.toNumber();
  const k  = BigInt(x0) * BigInt(y0);
  const y1 = k / BigInt(x0 + 1);                        // sell → x increases by 1
  const need = Number(BigInt(y0) - y1);                 // base payout before royalty
  const roy  = Math.floor(need * (poolState.royaltyBps ?? 0) / 10_000);
  outflow = need + roy;
} else if (poolType === 'bundle' && bundleState) {
  let sumX = bundleState.vx.toNumber();
  bundleState.nftReserves.forEach((r: BN) => (sumX += r.toNumber()));
  const y0 = bundleState.tokenReserve.toNumber() + bundleState.vy.toNumber();
  const k  = BigInt(sumX) * BigInt(y0);
  const y1 = k / BigInt(sumX + 1);
  const need = Number(BigInt(y0) - y1);
  const roy  = Math.floor(need * (bundleState.royaltyBps ?? 0) / 10_000);
  outflow = need + roy;
}

setPoolCanPay(outflow > 0 && vaultBal >= outflow);

    } catch {
      setPoolCanPay(false);
    }
  })();
}, [program, tokenVault, poolType, poolState, bundleState, quoteDecimals, vaultTick]);



// Active mint for orders (single = the only mint, bundle = selected)
const activeMint: PublicKey | null =
  poolType === 'single'
    ? poolState?.nftMints[0] ?? null
    : bundleState?.mints[selectedMintIndex] ?? null;




  // --- Fetch Limit Orders (mint-agnostic; works for single & bundle)
const fetchOrders = async (mintOverride?: PublicKey) => {
  if (!program) return;
  const mint = mintOverride ?? activeMint;
  if (!mint) return;

  const OFF = 8 + 1 + 8 + 32; // bump + id + seller + nftMint
  const raw = await program.account.order.all([{
    memcmp: { offset: OFF, bytes: mint.toBase58() },
  }]);

  const alive: OrderAccount[] = [];
  for (const o of raw as any as OrderAccount[]) {
    const info = await program.provider.connection.getAccountInfo(o.account.escrow);
    if (info?.owner.equals(TOKEN_PROGRAM_ID)) alive.push(o);
  }
  setOrders(alive);
};

// Live updates for Order accounts for the active mint (single or bundle)
useEffect(() => {
  if (!program || !activeMint) return;
  const conn = program.provider.connection;
  const OFF = 8 + 1 + 8 + 32;

  const subId = conn.onProgramAccountChange(
    PROGRAM_ID,
    () => fetchOrders(activeMint),
    {
      commitment: 'confirmed',
      filters: [{ memcmp: { offset: OFF, bytes: activeMint.toBase58() } }],
    } as any
  );

  return () => { conn.removeProgramAccountChangeListener(subId); };
}, [program, activeMint]);






  useEffect(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    const conn = new Connection(clusterApiUrl('devnet'));
    const provider = new AnchorProvider(conn, wallet as any, {});
    setProgram(new Program(idl as Idl, PROGRAM_ID, provider));
  }, [publicKey, signTransaction, signAllTransactions]);

  useEffect(() => {
  if (!program || !initialAddr) return;
  handleSearchPool(initialAddr);          // ← auto-loads the pool
}, [program, initialAddr]);


  // --- Search Pool
  
const handleSearchPool = async (addr?: string) => {
    setIsLoading(true);
    try {
      if (!program) return;
      let pk: PublicKey;
      const addrStr = (addr ?? searchInput).trim();
      try {
        pk = new PublicKey(addrStr);
      } catch {
        alert('Invalid address');
        setIsLoading(false);
        return;
      }
      const info = await program.provider.connection.getAccountInfo(pk);
      if (!info) {
        alert('Account not found on devnet');
        setIsLoading(false);
        return;
      }
      if (!info.owner.equals(PROGRAM_ID)) {
        alert('Address exists but is not a Woodeng pool');
        setIsLoading(false);
        return;
      }

      // Try Single-mint pool
      // Try Single-mint pool
try {
  const p = await fetchPoolAcc(pk);
  setPoolType('single');
  setPoolState(p);
  setBundleState(null);
  setPoolPk(pk);
  await loadHistory(pk);
  setRecentPools((prev) => {
    const base = pk.toBase58();
    if (prev.includes(base)) return prev;
    return [base, ...prev.slice(0, 4)];
  });
  setIsLoading(false);
  return;
} catch {}


      // Try BundleConfig
      // Try BundleConfig
try {
  const b = await fetchBundleAcc(pk);
  setPoolType('bundle');
  setBundleState(b);
  setPoolState(null);
  setPoolPk(pk);
  await loadHistory(pk);
  setRecentPools((prev) => {
    const base = pk.toBase58();
    if (prev.includes(base)) return prev;
    return [base, ...prev.slice(0, 4)];
  });
  setIsLoading(false);
  return;
} catch {}


      alert('Not a Woodeng pool');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Derive PDAs
  useEffect(() => {
    if (!program || !poolPk || !poolType) return;
    // poolSigner
    const [ps] = PublicKey.findProgramAddressSync(
      [Buffer.from(poolType === 'single' ? 'vault' : 'bundle_signer'), poolPk.toBuffer()],
      PROGRAM_ID
    );
    setPoolSigner(ps);

    // tokenVault
    const [tv] = PublicKey.findProgramAddressSync(
      [Buffer.from(poolType === 'single' ? 'token_vault' : 'bundle_token_vault'), poolPk.toBuffer()],
      PROGRAM_ID
    );
    setTokenVault(tv);

    // nftVaults
    if (poolType === 'single') {
      const [nv] = PublicKey.findProgramAddressSync(
        [Buffer.from('nft_vault'), poolPk.toBuffer(), Uint8Array.of(0)],
        PROGRAM_ID
      );
      setNftVaults([nv]);
      setSelectedMintIndex(0);
    } else if (bundleState) {
      const vaults = bundleState.mints.map((m: PublicKey) =>
        PublicKey.findProgramAddressSync(
          [Buffer.from('nft_vault'), poolPk.toBuffer(), m.toBuffer()],
          PROGRAM_ID
        )[0]
      );
      setNftVaults(vaults);
      setSelectedMintIndex(i => Math.min(i, vaults.length - 1));
    }
  }, [program, poolPk, poolType, bundleState]);

  // --- Fetch pool/bundle state
  useEffect(() => {
    if (!program || !poolPk || !poolType) return;
    if (poolType === 'single') {
  fetchPoolAcc(poolPk).then(setPoolState);
  setOrders([]);
} else {
  fetchBundleAcc(poolPk).then(setBundleState);
}

  }, [program, poolPk, poolType]);






  // Live updates for pool/bundle accounts
useEffect(() => {
  if (!program || !poolPk || !poolType) return;
  const conn = program.provider.connection;
  let subId: number | null = null;

  if (poolType === 'single') {
    subId = conn.onAccountChange(
      poolPk,
      async () => {
        try {
          const p = await fetchPoolAcc(poolPk);
setPoolState(p);

// Update chart...
const x0 = p.nftReserves[0].toNumber() + p.vx.toNumber();
const y0 = p.tokenReserve.toNumber() + p.vy.toNumber();

          if (x0 > 1) {
            const k = BigInt(x0) * BigInt(y0);
            const y1 = k / BigInt(x0 - 1);
            const lam = Number(y1 - BigInt(y0));
            const price = lam / (10 ** quoteDecimals);
            pushPrice(price, 'tick');
          }
        } catch {/* noop */}
      },
      'confirmed'
    );
  } else {
    subId = conn.onAccountChange(
      poolPk,
      async () => {
        try {
          const b = await fetchBundleAcc(poolPk);
setBundleState(b);

// Update chart...
let sumX = b.vx.toNumber();
b.nftReserves.forEach((r: BN) => (sumX += r.toNumber()));

          if (sumX > 1) {
            const sumY = b.tokenReserve.toNumber() + b.vy.toNumber();
            const k = BigInt(sumX) * BigInt(sumY);
            const newY = k / BigInt(sumX - 1);
            const lam = Number(newY - BigInt(sumY));
            const price = lam / (10 ** quoteDecimals);
            pushPrice(price, 'tick');
          }
        } catch {/* noop */}
      },
      'confirmed'
    );
  }

  return () => { if (subId !== null) conn.removeAccountChangeListener(subId); };
}, [program, poolPk, poolType, quoteDecimals]);



// Live updates for token vault balance (affects "poolCanPay")
useEffect(() => {
  if (!program || !tokenVault) return;
  const id = program.provider.connection.onAccountChange(
    tokenVault,
    () => setVaultTick(t => t + 1),
    'confirmed'
  );
  return () => { program.provider.connection.removeAccountChangeListener(id); };
}, [program, tokenVault]);


  // --- Fetch NFT metadata names + availability + user balances
useEffect(() => {
  (async () => {
    if (!(bundleState || poolState) || !program) return;
    const conn = program.provider.connection;
    const mx = Metaplex.make(conn).use(walletAdapterIdentity(wallet));

    const mints: PublicKey[] = poolType === 'single'
      ? (poolState?.nftMints || [])
      : (bundleState?.mints || []);

    // 1) Names / images / audio
    const metaArr = await Promise.all(
      mints.map(async (m: PublicKey) => {
        try {
          const nft = await mx.nfts().findByMint({ mintAddress: m });
          const j = nft.json ?? (await safeJson(nft.uri));
          const img = toHttp(j?.image) ?? null;
          const audio = toHttp(j?.animation_url) ?? null;
          return { name: nft.name, img, audio };
        } catch {
          return { name: m.toBase58().slice(0, 8) + '…', img: null, audio: null };
        }
      })
    );

    setMintNames(metaArr.map((m) => m.name));
    setMintImages(metaArr.map((m) => m.img || ''));
    setAudioUrl(metaArr[selectedMintIndex]?.audio || null);

    // 2) "In pool" (buyable) flags
    if (poolType === 'bundle') {
      setAvailable(bundleState!.nftReserves.map((r: BN) => r.toNumber() > 0));
    }

    // 3) "You own" counts for each mint (sellable check)
    if (publicKey) {
      const youOwn = await Promise.all(
        mints.map(async (m) => {
          try {
            const ata = await getAssociatedTokenAddress(m, publicKey);
            const acc = await getAccount(conn, ata);
            return Number(acc.amount); // decimals = 0 for your SFTs
          } catch {
            return 0;
          }
        })
      );
      setUserBalances(youOwn);
    } else {
      setUserBalances(new Array(mints.length).fill(0));
    }
  })();
}, [bundleState, poolState, program, wallet, selectedMintIndex, poolType, publicKey]);









  useEffect(() => {
  (async () => {
    if (!program || !publicKey) return;

    // Read the quote mint from whichever is active
    const mint: PublicKey | undefined =
      poolType === 'single' ? poolState?.tokenMint : bundleState?.tokenMint;
    if (!mint) return;

    setQuoteMint(mint);

    // Fetch decimals + set symbol
    const mi = await getMint(program.provider.connection, mint);
    setQuoteDecimals(mi.decimals);
    setQuoteSymbol(
  mint.equals(WSOL_MINT)    ? 'SOL' :
  mint.equals(WOODENG_MINT) ? 'WOODENG' :
                              'TOKEN'
);


    // Cache the user's quote ATA (create lazily later if needed)
    const ata = await getAssociatedTokenAddress(mint, publicKey);
  })();
}, [program, publicKey, poolType, poolState, bundleState]);





// refresh orders when pool changes or user switches mint in a bundle
useEffect(() => { fetchOrders().catch(() => {}); }, [program, poolType, activeMint]);



  // --- Buy/Sell Handlers (using your existing logic, but now with modal for UX)
  const handleSell = async () => {
    setShowSellModal(true);
  };

  const confirmSell = async () => {
  setTransactionStatus('processing');
  setTransactionMessage('Processing your sale...');
  try {
    if (!program || !poolPk || !poolSigner || !tokenVault || !publicKey || !quoteMint) return;
    const conn = program.provider.connection;

// --- OWNERSHIP GUARD: block sells if user doesn't own the selected song ---
if (poolType === 'single') {
  if ((userBalances[0] ?? 0) < 1) {
    setTransactionStatus('error');
    setTransactionMessage('You do not own a copy of this song.');
    return;
  }
} else if (poolType === 'bundle' && bundleState) {
  const idx = selectedMintIndex;
  if ((userBalances[idx] ?? 0) < 1) {
    setTransactionStatus('error');
    setTransactionMessage('You do not own a copy of this song.');
    return;
  }
}
// --- end ownership guard ---


    // 1) Compute expected payout and read vault balance (include royalty)
let need = 0;     // base payout used for price display
let outflow = 0;  // what must leave tokenVault (seller + creator)
if (poolType === 'single' && poolState) {
  const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
  const y0 = poolState.tokenReserve.toNumber() + poolState.vy.toNumber();
  const k  = BigInt(x0) * BigInt(y0);
  const y1 = k / BigInt(x0 + 1);
  need = Number(BigInt(y0) - y1);
  const roy = Math.floor(need * (poolState.royaltyBps ?? 0) / 10_000);
  outflow = need + roy;
} else if (poolType === 'bundle' && bundleState) {
  let sumX = bundleState.vx.toNumber();
  bundleState.nftReserves.forEach((r: BN) => (sumX += r.toNumber()));
  const y0 = bundleState.tokenReserve.toNumber() + bundleState.vy.toNumber();
  const k  = BigInt(sumX) * BigInt(y0);
  const y1 = k / BigInt(sumX + 1);
  need = Number(BigInt(y0) - y1);
  const roy = Math.floor(need * (bundleState.royaltyBps ?? 0) / 10_000);
  outflow = need + roy;
}

const vaultAcc = await getAccount(conn, tokenVault);
const vaultBal = Number(vaultAcc.amount);
if (outflow <= 0 || vaultBal < outflow) {
  setTransactionStatus('error');
  setTransactionMessage(
    `Pool has ${(vaultBal / (10 ** quoteDecimals)).toFixed(6)} ${quoteSymbol}, ` +
    `needs ${(outflow / (10 ** quoteDecimals)).toFixed(6)} (incl. royalties) for this sale.`
  );
  return;
}


    // 2) Ensure destination token ATAs
    const userTokenAta = await ensureQuoteAtaAndMaybeWrap(conn, publicKey, quoteMint, wallet, 0);
    const creator = poolType === 'single' ? poolState!.creator : bundleState!.creator;
    const creatorTokenAta = await ensureAtaFor(conn, publicKey, creator, quoteMint!);

    if (poolType === 'single') {
      const sellerAta = await ensureAta(conn, publicKey, poolState!.nftMints[0]);

      const sig = await rpcWithLogs(
  program.methods.sellNft(new BN(0)).accounts({
    pool: poolPk,
    poolSigner,
    nftVault: nftVaults[0],
    tokenVault,
    userNftAta: sellerAta,
    userTokenAta,
    creatorTokenAta,
    user: publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc(),
  conn
);

      
      setPoolState(await fetchPoolAcc(poolPk));
      pushPrice(need / (10 ** quoteDecimals), 'trade', sig);
    } else {
      const idx = selectedMintIndex;
      const mint = bundleState!.mints[idx] as PublicKey;
      const vaultPda = nftVaults[idx];
      const sellerAta = await ensureAta(conn, publicKey, mint);
      const sig = await rpcWithLogs(
  program.methods.sellBundleNft(new BN(0)).accounts({
    bundle: poolPk,
    bundleSigner: poolSigner!,
    tokenVault,
    vault: vaultPda,
    mint,
    userNftAta: sellerAta,
    userTokenAta,
    creatorTokenAta,
    user: publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc(),
  conn
);

      setBundleState(await fetchBundleAcc(poolPk));
      pushPrice(need / (10 ** quoteDecimals), 'trade', sig);
    }

    setTransactionStatus('success');
    setTransactionMessage('NFT sold successfully!');
  } catch (e: any) {
    setTransactionStatus('error');
    setTransactionMessage(e.message || 'Failed to sell NFT');
  } finally {
    setTimeout(() => {
      setShowSellModal(false);
      setTransactionStatus('idle');
    }, 2000);
  }
};






















  const handleBuy = async () => {
    setShowBuyModal(true);
  };
  


  const confirmBuy = async () => {
  setTransactionStatus('processing');
  setTransactionMessage('Processing your purchase...');
  try {
    if (!program || !poolPk || !poolSigner || !tokenVault || !publicKey || !quoteMint)
      return;

    const conn = program.provider.connection;

    if (poolType === 'single') {
  if (!poolState) throw new Error('Pool not loaded');

  // AMM math
  const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
  const y0 = poolState.tokenReserve.toNumber() + poolState.vy.toNumber();

      const k = BigInt(x0) * BigInt(y0);
      const y1 = k / BigInt(x0 - 1);
      const lam = Number(y1 - BigInt(y0));               // base units of quote token
      const maxIn = Math.ceil(lam * 1.03);               // 3% buffer

      const buyerNftAta = await ensureAta(conn, publicKey, poolState.nftMints[0]);
      const buyerTokenAta = await ensureQuoteAtaAndMaybeWrap(
        conn,
        publicKey,
        quoteMint,
        wallet,
        quoteMint.equals(WSOL_MINT) ? maxIn : 0
      );

      const creator = poolState.creator;
const creatorTokenAta = await ensureAtaFor(
  conn,
  publicKey,
  creator,
  quoteMint!
);


      const sig = await program.methods.buyNft(new BN(maxIn)).accounts({
          pool: poolPk,
          poolSigner,
          nftVault: nftVaults[0],
          tokenVault,
          userTokenAta: buyerTokenAta,
          userNftAta: buyerNftAta,
          creatorTokenAta, 
          user: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Optional: auto-close wrapped SOL ATA to reclaim rent (if empty)
      if (quoteMint.equals(WSOL_MINT)) {
        try {
          const closeTx = new anchor.web3.Transaction().add(
            createCloseAccountInstruction(buyerTokenAta, publicKey, publicKey)
          );
          closeTx.feePayer = publicKey;
          closeTx.recentBlockhash = (await conn.getLatestBlockhash('finalized')).blockhash;
          const signed = await wallet.signTransaction!(closeTx);
          const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
          await conn.confirmTransaction(sig, 'confirmed');
        } catch { /* ok if not empty*/ }
      }

      setPoolState(await fetchPoolAcc(poolPk));
      pushPrice(lam / (10 ** quoteDecimals), 'trade', sig);
      setTransactionStatus('success');
      setTransactionMessage('NFT purchased successfully!');
    } else if (bundleState) {
      // AMM math for bundle
      const vx = bundleState.vx.toNumber();
      const vy = bundleState.vy.toNumber();
      let sumX = vx;
      bundleState.nftReserves.forEach((r: BN) => (sumX += r.toNumber()));
      const sumY = bundleState.tokenReserve.toNumber() + vy;
      const k = BigInt(sumX) * BigInt(sumY);
      const newY = k / BigInt(sumX - 1);
      const lam = Number(newY - BigInt(sumY));
      const maxIn = Math.ceil(lam * 1.03);

      const idx = selectedMintIndex;
      const mint = bundleState.mints[idx] as PublicKey;
      const vaultPda = nftVaults[idx];

      const buyerNftAta = await ensureAta(conn, publicKey, mint);
      const buyerTokenAta = await ensureQuoteAtaAndMaybeWrap(
        conn,
        publicKey,
        quoteMint,
        wallet,
        quoteMint.equals(WSOL_MINT) ? maxIn : 0
      );

      const creator = bundleState.creator;
const creatorTokenAta = await ensureAtaFor(
  conn,
  publicKey,
  creator,
  quoteMint!
);

      const sig = await program.methods.buyBundleNft(new BN(maxIn)).accounts({
          bundle: poolPk,
          bundleSigner: poolSigner,
          tokenVault,
          vault: vaultPda,
          mint,
          userNftAta: buyerNftAta,
          userTokenAta: buyerTokenAta,
          creatorTokenAta,
          user: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      if (quoteMint.equals(WSOL_MINT)) {
        try {
          const closeTx = new anchor.web3.Transaction().add(
            createCloseAccountInstruction(buyerTokenAta, publicKey, publicKey)
          );
          closeTx.feePayer = publicKey;
          closeTx.recentBlockhash = (await conn.getLatestBlockhash('finalized')).blockhash;
          const signed = await wallet.signTransaction!(closeTx);
          const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
          await conn.confirmTransaction(sig, 'confirmed');
        } catch { /* ok if not empty*/ }
      }

      setBundleState(await fetchBundleAcc(poolPk));
      pushPrice(lam / (10 ** quoteDecimals), 'trade', sig);
      setTransactionStatus('success');
      setTransactionMessage('NFT purchased successfully!');
    }
  } catch (e: any) {
    setTransactionStatus('error');
    setTransactionMessage(e.message || 'Failed to purchase NFT');
  } finally {
    setTimeout(() => {
      setShowBuyModal(false);
      setTransactionStatus('idle');
    }, 2000);
  }
};


  // --- Limit Orders (single only)
  
  const handleListOrder = async () => {
  if (!program || !publicKey || !newPrice || !activeMint) return;

  const id  = newOrderId();
  const buf = Buffer.alloc(8); buf.writeBigUInt64LE(id);

  const uiPrice  = parseFloat(newPrice || '0') || 0;
  const priceRaw = new BN(Math.round(uiPrice * (10 ** quoteDecimals)).toString());

  const [orderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('order'), activeMint.toBuffer(), publicKey.toBuffer(), buf],
    PROGRAM_ID
  );
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), orderPda.toBuffer()],
    PROGRAM_ID
  );
  const [escAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), orderPda.toBuffer()],
    PROGRAM_ID
  );

  const sellerAta = await ensureAta(program.provider.connection, publicKey, activeMint);

  const creator     = poolType === 'single' ? poolState!.creator     : bundleState!.creator;
  const royaltyBps  = poolType === 'single' ? poolState!.royaltyBps  : bundleState!.royaltyBps;

  await program.methods
    .listOrder(new BN(id.toString()), priceRaw, creator, royaltyBps)
    .accounts({
      nftMint: activeMint,
      seller: publicKey,
      order: orderPda,
      escrow: escrowPda,
      escrowAuthority: escAuth,
      userNftAta: sellerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  setNewPrice('');
  fetchOrders(activeMint);
};


  const handleCancel = async (o: OrderAccount) => {
  if (!program || !publicKey || !activeMint) return;

  const [escAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const sellerAta = await getAssociatedTokenAddress(activeMint, publicKey);

  await program.methods.cancelOrder()
    .accounts({
      order: o.publicKey,
      escrow: o.account.escrow,
      escrowAuthority: escAuth,
      seller: publicKey,
      sellerNftAta: sellerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  fetchOrders(activeMint);
};



  const handleFill = async (o: OrderAccount) => {
  if (!program || !publicKey || !quoteMint || !activeMint) return;

  // pay seller in quote token (create their ATA if needed; you pay rent)
  const sellerTokenAta = await ensureAtaFor(
    program.provider.connection,
    publicKey,        // payer = you
    o.account.seller, // owner = seller
    quoteMint
  );

  // Ensure escrow still holds the NFT
  const info = await program.provider.connection.getAccountInfo(o.account.escrow);
  if (!info?.owner.equals(TOKEN_PROGRAM_ID)) {
    return fetchOrders(activeMint);
  }

  const [escAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // prepare your ATAs
  const buyerNftAta = await ensureAta(program.provider.connection, publicKey, activeMint);

  const buyerTokenAta = await ensureQuoteAtaAndMaybeWrap(
    program.provider.connection,
    publicKey,
    quoteMint,
    wallet,
    quoteMint.equals(WSOL_MINT) ? o.account.price.toNumber() : 0
  );

  // royalty receiver from the order (was embedded at listing time)
  const creatorTokenAta = await ensureAtaFor(
    program.provider.connection,
    publicKey,           // payer
    o.account.creator,   // owner = order’s creator
    quoteMint
  );

  const sig = await program.methods.fillOrder().accounts({
      order: o.publicKey,
      escrow: o.account.escrow,
      escrowAuthority: escAuth,
      buyer: publicKey,
      buyerTokenAta,
      buyerNftAta,
      seller: o.account.seller,
      sellerTokenAta,
      creatorTokenAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  if (quoteMint.equals(WSOL_MINT)) {
    try {
      const closeTx = new anchor.web3.Transaction().add(
        createCloseAccountInstruction(buyerTokenAta, publicKey, publicKey)
      );
      closeTx.feePayer = publicKey;
      closeTx.recentBlockhash = (await program.provider.connection.getLatestBlockhash('finalized')).blockhash;
      const signed = await wallet.signTransaction!(closeTx);
      const sig2 = await program.provider.connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await program.provider.connection.confirmTransaction(sig2, 'confirmed');
    } catch {}
  }

  const p = o.account.price.toNumber() / (10 ** quoteDecimals);
  pushPrice(p, 'limit_fill', sig);
  fetchOrders(activeMint);
};



  // --- Price + UI data
  const foreignOrders = orders.filter(o => !o.account.seller.equals(publicKey!));
  const bestAsk = foreignOrders.length
    ? foreignOrders.sort((a, b) => a.account.price.sub(b.account.price).toNumber())[0]
    : null;
  const bestAskPrice = bestAsk ? bestAsk.account.price.toNumber() / (10 ** quoteDecimals) : Infinity;
  const pooledNfts = poolType === 'single'
    ? poolState?.nftReserves[0].toNumber() ?? 0
    : bundleState
      ? bundleState.nftReserves.reduce((sum: number, r: BN) => sum + r.toNumber(), 0)
      : 0;
  const pooledWood = poolType === 'single'
    ? poolState?.tokenReserve.toNumber() ?? 0
    : bundleState
      ? bundleState.tokenReserve.toNumber()
      : 0;
  


      let ammCost = Infinity;

if (poolType === 'single' && poolState) {
  const x0 = (pooledNfts) + poolState.vx.toNumber();
  const y0 = pooledWood + poolState.vy.toNumber();
  if (x0 > 1) {
    const k  = BigInt(x0) * BigInt(y0);
    const y1 = k / BigInt(x0 - 1);
    ammCost  = Number(y1 - BigInt(y0)) / (10 ** quoteDecimals);
  }
} else if (poolType === 'bundle' && bundleState) {
  let sumX = bundleState.vx.toNumber();
  bundleState.nftReserves.forEach(r => (sumX += r.toNumber()));
  const sumY = bundleState.tokenReserve.toNumber() + bundleState.vy.toNumber();
  if (sumX > 1) {
    const k    = BigInt(sumX) * BigInt(sumY);
    const newY = k / BigInt(sumX - 1);
    ammCost    = Number(newY - BigInt(sumY)) / (10 ** quoteDecimals);
  }
}



  const finalPrice = Math.min(bestAskPrice, ammCost);
  const orderAvailable = foreignOrders.length > 0;




const youOwnSelected =
  poolType === 'bundle'
    ? (userBalances[selectedMintIndex] ?? 0) > 0
    : (userBalances[0] ?? 0) > 0;


const inPoolSelected =
  poolType === 'bundle'
    ? (bundleState?.nftReserves[selectedMintIndex]?.toNumber?.() ?? 0) > 0
    : pooledNfts > 0;
// ↑↑↑ END INSERT ↑↑↑

  useEffect(() => {
    const last = tradeHistory.at(-1)?.price ?? 0;
    if (Number.isFinite(finalPrice) && Math.abs(finalPrice - last) > 1e-9) {
      pushPrice(finalPrice);
    }
  }, [finalPrice]);

  // --- Audio Player
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
    }
  }, [audioUrl]);
  const togglePlayPause = () => {
    if (!audioUrl || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  // --- Chart formatting
  const formatTime = (time: string) => {
  const d = new Date(time);
  return isNaN(d.getTime()) ? time : d.toLocaleTimeString();
};



  // ---- Mosaic helpers (ADD just above return) ----
const mosaicImgs = (poolType === 'bundle' ? mintImages : [mintImages[selectedMintIndex]])
  .filter(Boolean);
const gridCols = Math.min(4, Math.ceil(Math.sqrt(poolType === 'bundle' ? mosaicImgs.length || 1 : 1)));
const showMosaic = poolType === 'bundle' && mosaicImgs.length > 1;


  // --- Render
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Pools & Orders</h1>
      {/* Search Section */}
      {!publicKey ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Pools & Orders</h1>
            <p className="text-xl text-muted-foreground">Connect your wallet to access pools</p>
          </div>
        </div>
      ) : (
        <div>
          {!poolPk || (!poolState && !bundleState) ? (
            <div className="max-w-2xl mx-auto text-center space-y-6 py-8">
              <h2 className="text-2xl font-bold">Search for a Pool</h2>
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Paste pool address…"
                    className="pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg w-full focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={() => handleSearchPool()}
                  disabled={isLoading}
                  className="px-6 py-3 bg-purple-600 rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                  Load Pool
                </button>
              </div>

              {/* Quick Create Pool (one TX) */}
<div className="mt-10 text-left w-full bg-gray-800 border border-gray-700 rounded-lg p-4">
  <h3 className="text-lg font-semibold mb-3">Create Pool (Single-Mint)</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div className="col-span-2">
      <label className="text-xs text-gray-400">NFT Mint</label>
      <input
        value={newPoolNft}
        onChange={(e) => setNewPoolNft(e.target.value)}
        placeholder="Paste the minted NFT mint address (e.g., D2DNKx...)"
        className="mt-1 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
      />
    </div>

    <div>
      <label className="text-xs text-gray-400">Quote Token</label>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setUseSOL(true)}
          className={`px-3 py-2 rounded border ${useSOL ? 'border-purple-500' : 'border-gray-700'} bg-gray-900`}
        >
          SOL (wSOL)
        </button>
        <button
          type="button"
          onClick={() => setUseSOL(false)}
          className={`px-3 py-2 rounded border ${!useSOL ? 'border-purple-500' : 'border-gray-700'} bg-gray-900`}
        >
          WOODENG
        </button>
      </div>
    </div>

    <div>
      <label className="text-xs text-gray-400">Seed Amount ({useSOL ? 'SOL' : 'WOODENG'})</label>
      <input
        value={seedAmount}
        onChange={(e) => setSeedAmount(e.target.value)}
        className="mt-1 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
      />
    </div>

    <div>
      <label className="text-xs text-gray-400">Royalty (bps)</label>
      <input
        value={royaltyBpsInput}
        onChange={(e) => setRoyaltyBpsInput(e.target.value)}
        className="mt-1 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded"
      />
    </div>
  </div>

  <button
    onClick={handleCreatePoolClick}
    disabled={isLoading || !newPoolNft.trim()}
    className="mt-4 px-6 py-2 bg-purple-600 rounded hover:bg-purple-700"
  >
    {isLoading ? 'Creating…' : 'Create Pool (1 TX)'}
  </button>
  <p className="mt-2 text-xs text-gray-400">
    For SOL pools, this wraps the SOL, calls <code>createPool</code>, and closes the wSOL ATA to reclaim rent — all in one transaction.
  </p>
</div>

              {recentPools.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">Recent Pools</h3>
                  <div className="space-y-3">
                    {recentPools.map((pool, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSearchInput(pool);
                          handleSearchPool();
                        }}
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-purple-500 transition-colors text-left flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Coins className="w-5 h-5 text-purple-500" />
                          <span className="font-mono text-sm truncate">{pool}</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* NFT/Pool Main Card */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-800">
  {showMosaic ? (
    <div
      className="grid w-full h-full"
      style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
    >
      {mosaicImgs.slice(0, 16).map((src, i) => (
        <div key={i} className="border border-gray-900">
          {src ? (
            <img
              src={src}
              alt={mintNames[i] ?? `NFT ${i + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-gray-700" />
          )}
        </div>
      ))}
      {mosaicImgs.length > 16 && (
        <div className="absolute bottom-2 right-2 text-xs bg-black/60 px-2 py-1 rounded">
          +{mosaicImgs.length - 16}
        </div>
      )}
    </div>
  ) : mintImages[selectedMintIndex] ? (
    <img
      src={mintImages[selectedMintIndex]}
      alt={mintNames[selectedMintIndex]}
      className="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
  )}

  {audioUrl && (
    <button
      onClick={togglePlayPause}
      className="absolute top-4 right-4 p-3 bg-purple-600 rounded-full text-white"
    >
      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
    </button>
  )}
</div>



{/* Bundle picker – bigger card layout */}
{poolType === 'bundle' && bundleState && (
  <div className="mt-4 space-y-2">
    <p className="text-xs text-gray-400">Pick a song in the bundle:</p>

    {/* auto-fill responsive grid of wider cards */}
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))' }}
    >
      {bundleState.mints.map((_, i) => {
        const name     = mintNames[i] ?? `#${i + 1}`;
        const img      = mintImages[i];
        const mine     = userBalances[i] ?? 0;
        const inPool   = bundleState.nftReserves[i]?.toNumber?.() > 0;
        const isActive = i === selectedMintIndex;

        return (
          <button
            key={i}
            onClick={() => setSelectedMintIndex(i)}
            className={cn(
              "relative rounded-xl border bg-gray-900/60 p-3 text-left transition-all",
              isActive
                ? "border-purple-500 ring-2 ring-purple-500/30"
                : "border-gray-700 hover:border-purple-400"
            )}
          >
            {/* thumb with badges */}
            <div className="relative">
              {img ? (
                <img
                  src={img}
                  alt={name}
                  className="w-full aspect-square rounded-lg object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-gray-700
                                flex items-center justify-center text-[11px] text-gray-300">
                  no img
                </div>
              )}
              {inPool && (
                <span
                  className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full
                             bg-emerald-600/20 text-emerald-300 border border-emerald-700/40
                             whitespace-nowrap"
                >
                  in pool
                </span>
              )}
              {isActive && (
                <span
                  className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full
                             bg-purple-600/20 text-purple-300 border border-purple-700/40
                             whitespace-nowrap"
                >
                  selected
                </span>
              )}
            </div>

            {/* footer info */}
            <div className="mt-2">
              <div className="truncate text-sm font-medium" title={name}>
                {name}
              </div>
              <div className="mt-1 grid grid-cols-2 text-[11px] text-gray-400">
                <div>
                  In pool: <span className="text-gray-200">
                    {bundleState.nftReserves[i].toNumber()}
                  </span>
                </div>
                <div className="text-right">
                  You: <span className="text-gray-200">{mine}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
)}





                  {/* Pool Summary */}
                  <div className="md:col-span-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-xl font-bold">{mintNames[selectedMintIndex]}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowMetadata(true)} className="p-2 hover:bg-gray-700 rounded-full">
                            <Info className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 mb-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Pooled NFTs</p>
                            <p className="font-medium">{pooledNfts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Pooled {quoteSymbol}</p>
                            <p className="font-medium">{(pooledWood / (10 ** quoteDecimals)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 9 })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Pool Type</p>
                            <p className="font-medium">{poolType === 'bundle' ? 'Bundle' : 'Single'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-4">
                        {/* SELL */}
<button
  onClick={handleSell}
  disabled={!poolCanPay || !youOwnSelected}
  className={cn(
    "flex-1 py-2 rounded transition-colors",
    (!poolCanPay || !youOwnSelected) ? "bg-gray-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-500"
  )}
>
  {!youOwnSelected ? "You don't own this song" : (poolCanPay ? "Sell NFT to AMM" : `Pool out of ${quoteSymbol}`)}
</button>

{/* BUY */}
<button
  onClick={orderAvailable && bestAskPrice < ammCost ? () => handleFill(bestAsk!) : handleBuy}
  disabled={!inPoolSelected && !(orderAvailable && bestAskPrice < ammCost)}
  className={cn(
    "flex-1 py-2 rounded",
    (!inPoolSelected && !(orderAvailable && bestAskPrice < ammCost))
      ? 'bg-gray-600 cursor-not-allowed'
      : 'bg-green-600 hover:bg-green-500'
  )}
>
  {!inPoolSelected && !(orderAvailable && bestAskPrice < ammCost)
    ? 'No copies in pool'
    : orderAvailable && bestAskPrice < ammCost
      ? `Buy @ ${fmt(bestAskPrice)} ${quoteSymbol} (limit)`
      : `Buy @ ${fmt(ammCost)} ${quoteSymbol} (AMM)`
  }
</button>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <h2 className="text-lg font-semibold">
                    Price History <span className="ml-2 text-purple-400">{fmt(finalPrice)} {quoteSymbol}</span>


                  </h2>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={tradeHistory}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      onMouseMove={e => {
                        if (e.activeTooltipIndex !== undefined) setSelectedDataPoint(e.activeTooltipIndex);
                      }}
                      onMouseLeave={() => setSelectedDataPoint(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="time" tickFormatter={formatTime} stroke="#bbb" fontSize={10} tick={{ fontSize: 10 }} />
                      <YAxis stroke="#bbb" fontSize={10} tick={{ fontSize: 10 }} domain={['auto', 'auto']} width={40} />
                      <Tooltip
  content={({ active, payload, label }) => {
    if (
      active &&
      payload &&
      payload.length &&
      payload[0] &&
      typeof payload[0].value === "number"
    ) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs font-medium">{formatTime(label)}</p>
          <p className="text-xs text-purple-400">
            Price: {payload[0].value.toFixed(2)} {quoteSymbol}
          </p>
        </div>
      );
    }
    return null;
  }}
  cursor={{ stroke: '#8b5cf6', strokeWidth: 1 }}
/>

                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{
                          r: 6,
                          stroke: '#8b5cf6',
                          strokeWidth: 2,
                          fill: '#18181b'
                        }}
                      />
                      {selectedDataPoint !== null && (
                        <ReferenceLine
                          x={tradeHistory[selectedDataPoint]?.time}
                          stroke="#8b5cf6"
                          strokeDasharray="3 3"
                        />
                      )}
                      <Brush
                        dataKey="time"
                        height={20}
                        stroke="#8b5cf6"
                        startIndex={brushStartIndex}
                        onChange={data => {
                          if (data && data.startIndex !== undefined) setBrushStartIndex(data.startIndex);
                        }}
                        fill="#18181b"
                        fillOpacity={0.5}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Orders Section */}
              {activeMint && (
  <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
    <h2 className="text-xl font-semibold mb-6">
      Open Limit Orders {poolType === 'bundle' ? '(selected song)' : ''}
    </h2>
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <input
        value={newPrice}
        onChange={e => setNewPrice(e.target.value)}
        placeholder={`Price (${quoteSymbol})`}
        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
      />
      <button
        onClick={handleListOrder}
        className="py-2 px-6 bg-purple-600 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
      >
        List Order
      </button>
    </div>
    {orders.length === 0 ? (
      <div className="text-center py-8 text-gray-400">
        <p>No open orders</p>
      </div>
    ) : (
      <div className="space-y-3">
        {orders.map(o => {
          const mine  = publicKey!.equals(o.account.seller);
          const price = (o.account.price.toNumber() / (10 ** quoteDecimals)).toFixed(2);
          return (
            <div key={o.publicKey.toBase58()} className="bg-gray-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{price} {quoteSymbol}</span>
                  {mine && (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded-full">
                      Your Order
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">ID: ...{o.publicKey.toBase58().slice(-8)}</p>
              </div>
              {mine ? (
                <button
                  onClick={() => handleCancel(o)}
                  className="py-2 px-4 bg-red-600 rounded hover:bg-red-500 transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => handleFill(o)}
                  className="py-2 px-4 bg-green-600 rounded hover:bg-green-500 transition-colors"
                >
                  Buy
                </button>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

            </div>
          )}
        </div>
      )}
      {/* Sell Modal */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="font-bold text-lg">Sell NFT</h3>
              <button onClick={() => setShowSellModal(false)} className="p-2 hover:bg-gray-700 rounded-full">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p>Are you sure you want to sell your NFT to the AMM?</p>
              <div>
                {transactionStatus === 'processing' && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Loader2 className="animate-spin" /> Processing…
                  </div>
                )}
                {transactionStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 /> {transactionMessage}
                  </div>
                )}
                {transactionStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle /> {transactionMessage}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-800 p-4">
              <button
                onClick={confirmSell}
                disabled={transactionStatus === 'processing'}
                className="bg-red-600 px-6 py-2 rounded hover:bg-red-500 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Buy Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="font-bold text-lg">Buy NFT</h3>
              <button onClick={() => setShowBuyModal(false)} className="p-2 hover:bg-gray-700 rounded-full">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p>Are you sure you want to buy this NFT from the AMM?</p>
              <div>
                {transactionStatus === 'processing' && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Loader2 className="animate-spin" /> Processing…
                  </div>
                )}
                {transactionStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 /> {transactionMessage}
                  </div>
                )}
                {transactionStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle /> {transactionMessage}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-800 p-4">
              <button
                onClick={confirmBuy}
                disabled={transactionStatus === 'processing'}
                className="bg-green-600 px-6 py-2 rounded hover:bg-green-500 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Metadata Modal */}
      {showMetadata && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-lg w-full border border-purple-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="font-bold text-lg">NFT Metadata</h3>
              <button onClick={() => setShowMetadata(false)} className="p-2 hover:bg-gray-700 rounded-full">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-2">
              <div>
                <span className="text-gray-400 font-medium mr-2">Name:</span>
                <span className="font-mono">{mintNames[selectedMintIndex]}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium mr-2">Mint:</span>
                <span className="font-mono">{(poolType === 'single'
                  ? poolState?.nftMints[selectedMintIndex]
                  : bundleState?.mints[selectedMintIndex]
                )?.toBase58()}</span>
              </div>
              {/* Add more fields as needed */}
            </div>
            <div className="flex justify-end border-t border-gray-800 p-4">
              <button onClick={() => setShowMetadata(false)} className="bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Hidden audio tag */}
      <audio ref={audioRef} style={{ display: 'none' }} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}
