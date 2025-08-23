// app/amm/AMMClient.tsx
'use client';


import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PublicKey, Connection, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, clusterApiUrl
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
import { AnchorProvider, Program, BN, Idl } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Brush
} from 'recharts';
import { Loader2, CheckCircle2, AlertCircle, Info, Play, Pause, X, Search, Coins, ArrowUpRight } from 'lucide-react';
import idl from '../../idl/idl.json';



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
  const [poolState, setPoolState] = useState<any | null>(null);
  const [bundleState, setBundleState] = useState<any | null>(null);
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
 


  // --- Utility
  const pushPrice = (p: number) =>
    setTradeHistory((h) => [...h, { time: new Date().toLocaleTimeString(), price: p }]);





  



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
  setTradeHistory([]);
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

      let need = 0;
      if (poolType === 'single' && poolState) {
        const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
        const y0 = poolState.tokenReserve.toNumber() + poolState.vy.toNumber();
        const k  = BigInt(x0) * BigInt(y0);
        const y1 = k / BigInt(x0 + 1);                 // sell → x increases by 1
        need = Number(BigInt(y0) - y1);                // lamports (or quote base units)
      } else if (poolType === 'bundle' && bundleState) {
        let sumX = bundleState.vx.toNumber();
        bundleState.nftReserves.forEach((r: BN) => (sumX += r.toNumber()));
        const y0 = bundleState.tokenReserve.toNumber() + bundleState.vy.toNumber();
        const k  = BigInt(sumX) * BigInt(y0);
        const y1 = k / BigInt(sumX + 1);
        need = Number(BigInt(y0) - y1);
      }

      setPoolCanPay(need > 0 && vaultBal >= need);
    } catch {
      setPoolCanPay(false);
    }
  })();
}, [program, tokenVault, poolType, poolState, bundleState]);





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
      try {
        await program.account.pool.fetch(pk);
        setPoolType('single');
        setPoolState(await program.account.pool.fetch(pk));
        setBundleState(null);
        setPoolPk(pk);
        setTradeHistory([]);
        setRecentPools((prev) => {
          const base = pk.toBase58();
          if (prev.includes(base)) return prev;
          return [base, ...prev.slice(0, 4)];
        });
        setIsLoading(false);
        return;
      } catch {}

      // Try BundleConfig
      try {
        await program.account.bundleConfig.fetch(pk);
        setPoolType('bundle');
        setBundleState(await program.account.bundleConfig.fetch(pk));
        setPoolState(null);
        setPoolPk(pk);
        setTradeHistory([]);
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
      program.account.pool.fetch(poolPk).then(p => setPoolState(p));
      setOrders([]);
    } else {
      program.account.bundleConfig.fetch(poolPk).then(b => setBundleState(b));
    }
  }, [program, poolPk, poolType]);

  // --- Fetch NFT metadata names + availability (REPLACED)
useEffect(() => {
  (async () => {
    if (!(bundleState || poolState) || !program) return;
    const conn = program.provider.connection;
    const mx = Metaplex.make(conn).use(walletAdapterIdentity(wallet));

    // single or bundle mint(s)
    const mints: PublicKey[] = poolType === 'single'
      ? (poolState?.nftMints || [])
      : (bundleState?.mints || []);

    const metaArr = await Promise.all(
      mints.map(async (m: PublicKey) => {
        try {
          const nft = await mx.nfts().findByMint({ mintAddress: m });
          // Prefer Metaplex-hydrated JSON; otherwise fetch nft.uri ourselves.
          const j = nft.json ?? (await safeJson(nft.uri));
          const img = toHttp(j?.image) ?? null;               // <-- HTTP url for <img>
          const audio = toHttp(j?.animation_url) ?? null;     // <-- HTTP url for audio
          return { name: nft.name, img, audio };
        } catch {
          return { name: m.toBase58().slice(0, 8) + '…', img: null, audio: null };
        }
      })
    );

    setMintNames(metaArr.map((m) => m.name));
    setMintImages(metaArr.map((m) => m.img || ''));
    setAudioUrl(metaArr[selectedMintIndex]?.audio || null);

    // availability = reserve > 0
    if (poolType === 'bundle') {
      setAvailable(bundleState!.nftReserves.map((r: BN) => r.toNumber() > 0));
    }
  })();
}, [bundleState, poolState, program, wallet, selectedMintIndex, poolType]);








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



  // --- Fetch Limit Orders (single only)
  const fetchOrders = async () => {
    if (poolType !== 'single' || !program || !poolState) return;
    const OFF = 8 + 1 + 8 + 32;
    const raw = await program.account.order.all([{
      memcmp: { offset: OFF, bytes: poolState.nftMints[0].toBase58() },
    }]);
    const alive: OrderAccount[] = [];
    for (const o of raw as any as OrderAccount[]) {
      const info = await program.provider.connection.getAccountInfo(o.account.escrow);
      if (info?.owner.equals(TOKEN_PROGRAM_ID)) alive.push(o);
    }
    setOrders(alive);
  };
  useEffect(() => {
    if (poolState && poolType === 'single') fetchOrders();
  }, [poolState]);

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

    // 1) Compute expected payout (lamports/base units) and read vault balance
    let need = 0;
    if (poolType === 'single' && poolState) {
      const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
      const y0 = poolState.tokenReserve.toNumber() + poolState.vy.toNumber();
      const k  = BigInt(x0) * BigInt(y0);
      const y1 = k / BigInt(x0 + 1);            // sell → x increases by 1
      need = Number(BigInt(y0) - y1);
    } else if (poolType === 'bundle' && bundleState) {
      let sumX = bundleState.vx.toNumber();
      bundleState.nftReserves.forEach((r: BN) => (sumX += r.toNumber()));
      const y0 = bundleState.tokenReserve.toNumber() + bundleState.vy.toNumber();
      const k  = BigInt(sumX) * BigInt(y0);
      const y1 = k / BigInt(sumX + 1);
      need = Number(BigInt(y0) - y1);
    }

    const vaultAcc = await getAccount(conn, tokenVault);
    const vaultBal = Number(vaultAcc.amount);
    if (need <= 0 || vaultBal < need) {
      setTransactionStatus('error');
      setTransactionMessage(
        `Pool only has ${(vaultBal / (10 ** quoteDecimals)).toFixed(6)} ${quoteSymbol},` +
        ` needs ${(need / (10 ** quoteDecimals)).toFixed(6)} for this sale.`
      );
      return;
    }

    // 2) Ensure destination token ATAs
    const userTokenAta = await ensureQuoteAtaAndMaybeWrap(conn, publicKey, quoteMint, wallet, 0);
    const creator = poolType === 'single' ? poolState!.creator : bundleState!.creator;
    const creatorTokenAta = await ensureAtaFor(conn, publicKey, creator, quoteMint!);

    if (poolType === 'single') {
      const sellerAta = await ensureAta(conn, publicKey, poolState!.nftMints[0]);
      await program.methods.sellNft(new BN(0))
        .accounts({
          pool: poolPk,
          poolSigner,
          nftVault: nftVaults[0],
          tokenVault,
          userNftAta: sellerAta,
          userTokenAta,
          creatorTokenAta,
          user: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      setPoolState(await program.account.pool.fetch(poolPk));
    } else {
      const idx = selectedMintIndex;
      const mint = bundleState!.mints[idx] as PublicKey;
      const vaultPda = nftVaults[idx];
      const sellerAta = await ensureAta(conn, publicKey, mint);
      await program.methods.sellBundleNft(new BN(0))
        .accounts({
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
        })
        .rpc();
      setBundleState(await program.account.bundleConfig.fetch(poolPk));
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


      await program.methods.buyNft(new BN(maxIn))
        .accounts({
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

      setPoolState(await program.account.pool.fetch(poolPk));
      pushPrice(lam / (10 ** quoteDecimals));
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

      await program.methods.buyBundleNft(new BN(maxIn))
        .accounts({
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

      setBundleState(await program.account.bundleConfig.fetch(poolPk));
      pushPrice(lam / (10 ** quoteDecimals));
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
  const firstMint = poolType === 'single' ? poolState?.nftMints[0] : null;
  const handleListOrder = async () => {
    if (!program || poolType !== 'single' || !publicKey || !newPrice || !firstMint) return;
    const id = newOrderId();
    const buf = Buffer.alloc(8); buf.writeBigUInt64LE(id);
  


    // price in *base units* of the quote mint
   const uiPrice = parseFloat(newPrice || '0') || 0;
   const priceRaw = new BN(Math.round(uiPrice * (10 ** quoteDecimals)).toString());


    const [orderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('order'), firstMint.toBuffer(), publicKey.toBuffer(), buf],
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

    const sellerAta = await ensureAta(
      program.provider.connection,
      publicKey,
      firstMint
    );

    // Simple default: reuse the pool’s configured creator & royalty_bps.
const creator: PublicKey =
  poolType === 'single' ? poolState.creator : bundleState.creator;
const royaltyBps: number =
  poolType === 'single' ? poolState.royaltyBps : bundleState.royaltyBps;


    await program.methods
  .listOrder(new BN(id.toString()), priceRaw, creator, royaltyBps)
  .accounts({
    nftMint: firstMint,
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
    fetchOrders();
  };

  const handleCancel = async (o: OrderAccount) => {
    if (!program || !publicKey || poolType !== 'single') return;
    const [escAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const sellerAta = await getAssociatedTokenAddress(firstMint!, publicKey);

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

    fetchOrders();
  };

  const handleFill = async (o: OrderAccount) => {
  if (!program || !publicKey || poolType !== 'single' || !quoteMint) return;

  const sellerTokenAta = await ensureAtaFor(
  program.provider.connection,
  publicKey,          // payer = you
  o.account.seller,   // owner = seller
  quoteMint
);

  const info = await program.provider.connection.getAccountInfo(o.account.escrow);
  if (!info?.owner.equals(TOKEN_PROGRAM_ID)) {
    return fetchOrders();
  }

  const [escAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // prepare ATAs
  const buyerNftAta = await ensureAta(program.provider.connection, publicKey, firstMint!);

  // If quote is SOL, wrap exactly the order price; otherwise just ensure ATA exists
  const buyerTokenAta = await ensureQuoteAtaAndMaybeWrap(
    program.provider.connection,
    publicKey,
    quoteMint,
    wallet,
    quoteMint.equals(WSOL_MINT) ? o.account.price.toNumber() : 0
  );

  const creatorTokenAta = await ensureAtaFor(
  program.provider.connection,
  publicKey,              // payer
  o.account.creator,      // owner = order’s creator
  quoteMint
);




  await program.methods.fillOrder()
    .accounts({
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

  // Optional: reclaim rent if wSOL ATA is now empty
  if (quoteMint.equals(WSOL_MINT)) {
    try {
      const closeTx = new anchor.web3.Transaction().add(
        createCloseAccountInstruction(buyerTokenAta, publicKey, publicKey)
      );
      closeTx.feePayer = publicKey;
      closeTx.recentBlockhash = (await program.provider.connection.getLatestBlockhash('finalized')).blockhash;
      const signed = await wallet.signTransaction!(closeTx);
      const sig = await program.provider.connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await program.provider.connection.confirmTransaction(sig, 'confirmed');
    } catch { /* ok if not empty */ }
  }

  fetchOrders();
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
  if (poolType === 'single' && pooledNfts > 0 && poolState) {
    const x0 = pooledNfts + poolState.vx.toNumber();
    const y0 = pooledWood + poolState.vy.toNumber();
    const k = BigInt(x0) * BigInt(y0);
    const y1 = (k / BigInt(x0 - 1)) as bigint;
    ammCost = Number(y1 - BigInt(y0)) / (10 ** quoteDecimals);
  }
  const finalPrice = Math.min(bestAskPrice, ammCost);
  const orderAvailable = foreignOrders.length > 0;

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
    return time;
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
                        <button
  onClick={handleSell}
  disabled={!poolCanPay}
  className={cn(
    "flex-1 py-2 rounded transition-colors",
    poolCanPay ? "bg-red-600 hover:bg-red-500" : "bg-gray-600 cursor-not-allowed"
  )}
>
  {poolCanPay ? "Sell NFT to AMM" : `Pool out of ${quoteSymbol}`}
</button>

                        <button
                          onClick={orderAvailable && bestAskPrice < ammCost ? () => handleFill(bestAsk!) : handleBuy}
                          disabled={!orderAvailable && pooledNfts === 0}
                          className={cn(
                            "flex-1 py-2 rounded",
                            (!orderAvailable && pooledNfts === 0)
                              ? 'bg-gray-600 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-500'
                          )}
                        >
                          {!orderAvailable && pooledNfts === 0
  ? 'No NFTs to buy'
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
              {poolType === 'single' && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-6">Open Limit Orders</h2>
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
                        const mine = publicKey!.equals(o.account.seller);
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
