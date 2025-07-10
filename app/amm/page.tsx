/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  PublicKey, Connection, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, clusterApiUrl
} from '@solana/web3.js';
import {
  getAccount, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import { AnchorProvider, Program, BN, Idl } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Brush
} from 'recharts';
import { Loader2, CheckCircle2, AlertCircle, Info, Play, Pause, X, Search, Coins, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import idl from '../../idl/idl.json';

const PROGRAM_ID = new PublicKey('FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS');
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');

const newOrderId = () => BigInt(Date.now() * 1_000 + Math.floor(Math.random() * 1_000));

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ');
}

interface OrderData {
  bump: number;
  seller: PublicKey;
  nftMint: PublicKey;
  price: BN;
  escrow: PublicKey;
}
interface OrderAccount { publicKey: PublicKey; account: OrderData }

export default function AMMPage() {
  const wallet = useWallet();
  const { publicKey, signTransaction, signAllTransactions } = wallet;

  // State
  const [program, setProgram] = useState<Program<Idl> | null>(null);
  const [searchInput, setSearchInput] = useState('');
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
  const [userWoodAta, setUserWoodAta] = useState<PublicKey | null>(null);
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

  // --- Utility
  const pushPrice = (p: number) =>
    setTradeHistory((h) => [...h, { time: new Date().toLocaleTimeString(), price: p }]);

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

  useEffect(() => {
    if (!publicKey) return;
    (async () => {
      const ata = await getAssociatedTokenAddress(WOODENG_MINT, publicKey);
      setUserWoodAta(ata);
    })();
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    const conn = new Connection(clusterApiUrl('devnet'));
    const provider = new AnchorProvider(conn, wallet as any, {});
    setProgram(new Program(idl as Idl, PROGRAM_ID, provider));
  }, [publicKey, signTransaction, signAllTransactions]);

  // --- Search Pool
  const handleSearchPool = async () => {
    setIsLoading(true);
    try {
      if (!program) return;
      let pk: PublicKey;
      try {
        pk = new PublicKey(searchInput.trim());
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

  // --- Fetch NFT metadata names + availability
  useEffect(() => {
    if (!(bundleState || poolState) || !program) return;
    const conn = program.provider.connection;
    const mx = Metaplex.make(conn).use(walletAdapterIdentity(wallet));

    // single or bundle mint(s)
    const mints = poolType === 'single'
      ? poolState?.nftMints || []
      : bundleState?.mints || [];

    Promise.all(mints.map(async (m: PublicKey) => {
      try {
        const nftModel = await mx.nfts().findByMint({ mintAddress: m });
        return {
          name: nftModel.name,
          img: nftModel.json?.image || nftModel.uri || null,
          audio: nftModel.json?.animation_url || null,
        };
      } catch {
        return {
          name: m.toBase58().slice(0, 8) + '…',
          img: null,
          audio: null,
        };
      }
    }))
      .then(metaArr => {
        setMintNames(metaArr.map(m => m.name));
        setMintImages(metaArr.map(m => m.img));
        setAudioUrl(metaArr[selectedMintIndex]?.audio || null);
      });

    // availability = reserve > 0
    if (poolType === 'bundle') {
      setAvailable(bundleState.nftReserves.map((r: BN) => r.toNumber() > 0));
    }
  }, [bundleState, poolState, program, wallet, selectedMintIndex, poolType]);

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
      if (!program || !poolPk || !poolSigner || !tokenVault || !userWoodAta || !publicKey) return;

      if (poolType === 'single') {
        const sellerAta = await ensureAta(
          program.provider.connection, publicKey, poolState.nftMints[0]
        );
        await program.methods.sellNft(new BN(0))
          .accounts({
            pool: poolPk,
            poolSigner,
            nftVault: nftVaults[0],
            tokenVault,
            userNftAta: sellerAta,
            userTokenAta: userWoodAta,
            user: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        setPoolState(await program.account.pool.fetch(poolPk));
        setTransactionStatus('success');
        setTransactionMessage('NFT sold successfully!');
      } else if (bundleState) {
        const idx = selectedMintIndex;
        const mint = bundleState.mints[idx] as PublicKey;
        const vaultPda = nftVaults[idx];
        const sellerAta = await ensureAta(
          program.provider.connection, publicKey, mint
        );
        await program.methods.sellBundleNft(new BN(0))
          .accounts({
            bundle: poolPk,
            bundleSigner: poolSigner,
            tokenVault,
            vault: vaultPda,
            mint,
            userNftAta: sellerAta,
            userTokenAta: userWoodAta,
            user: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        setBundleState(await program.account.bundleConfig.fetch(poolPk));
        setTransactionStatus('success');
        setTransactionMessage('NFT sold successfully!');
      }
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
      if (!program || !poolPk || !poolSigner || !tokenVault || !publicKey) return;
      const conn = program.provider.connection;
      const buyerTokenAta = await ensureAta(conn, publicKey, WOODENG_MINT);

      if (poolType === 'single') {
        const buyerNftAta = await ensureAta(conn, publicKey, poolState.nftMints[0]);
        const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
        const y0 = poolState.tokenReserve.toNumber() + poolState.vy.toNumber();
        const k = BigInt(x0) * BigInt(y0);
        const y1 = (k / BigInt(x0 - 1)) as bigint;
        const lam = Number(y1 - BigInt(y0));
        const maxIn = Math.ceil(lam * 1.03);

        await program.methods.buyNft(new BN(maxIn))
          .accounts({
            pool: poolPk,
            poolSigner,
            nftVault: nftVaults[0],
            tokenVault,
            userTokenAta: buyerTokenAta,
            userNftAta: buyerNftAta,
            user: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        setPoolState(await program.account.pool.fetch(poolPk));
        pushPrice(lam / 1e9);
        setTransactionStatus('success');
        setTransactionMessage('NFT purchased successfully!');
      } else if (bundleState) {
        const vx = bundleState.vx.toNumber();
        const vy = bundleState.vy.toNumber();
        let sumX = vx;
        bundleState.nftReserves.forEach((r: BN) => sumX += r.toNumber());
        const sumY = bundleState.tokenReserve.toNumber() + vy;
        const k = BigInt(sumX) * BigInt(sumY);
        const newY = k / BigInt(sumX - 1);
        const lam = Number(newY - BigInt(sumY));
        const maxIn = Math.ceil(lam * 1.03);

        const idx = selectedMintIndex;
        const mint = bundleState.mints[idx] as PublicKey;
        const vaultPda = nftVaults[idx];
        const buyerNftAta = await ensureAta(conn, publicKey, mint);

        await program.methods.buyBundleNft(new BN(maxIn))
          .accounts({
            bundle: poolPk,
            bundleSigner: poolSigner,
            tokenVault,
            vault: vaultPda,
            mint,
            userNftAta: buyerNftAta,
            userTokenAta: buyerTokenAta,
            user: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        setBundleState(await program.account.bundleConfig.fetch(poolPk));
        pushPrice(lam / 1e9);
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
    const priceLam = new BN((BigInt(newPrice) * BigInt(1e9)).toString());

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

    await program.methods.listOrder(new BN(id.toString()), priceLam)
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
    if (!program || !publicKey || poolType !== 'single') return;
    const info = await program.provider.connection.getAccountInfo(o.account.escrow);
    if (!info?.owner.equals(TOKEN_PROGRAM_ID)) {
      return fetchOrders();
    }
    const [escAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const buyerTokenAta = await getAssociatedTokenAddress(WOODENG_MINT, publicKey);
    const buyerNftAta = await ensureAta(program.provider.connection, publicKey, firstMint!);
    const sellerTokenAta = await getAssociatedTokenAddress(WOODENG_MINT, o.account.seller);

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
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    fetchOrders();
  };

  // --- Price + UI data
  const foreignOrders = orders.filter(o => !o.account.seller.equals(publicKey!));
  const bestAsk = foreignOrders.length
    ? foreignOrders.sort((a, b) => a.account.price.sub(b.account.price).toNumber())[0]
    : null;
  const bestAskPrice = bestAsk ? bestAsk.account.price.toNumber() / 1e9 : Infinity;
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
    ammCost = Number(y1 - BigInt(y0)) / 1e9;
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
                  onClick={handleSearchPool}
                  disabled={isLoading}
                  className="px-6 py-3 bg-purple-600 rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                  Load Pool
                </button>
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
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
                    {mintImages[selectedMintIndex] ? (
                      <img src={mintImages[selectedMintIndex]} alt={mintNames[selectedMintIndex]} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-500">No image</span>
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
                            <p className="text-xs text-gray-400">Pooled WOODENG</p>
                            <p className="font-medium">{(pooledWood / 1e9).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 9 })}</p>
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
                          className="flex-1 py-2 bg-red-600 rounded hover:bg-red-500 transition-colors"
                        >
                          Sell NFT to AMM
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
                              ? `Buy @ ${bestAskPrice.toFixed(2)} WOODENG (limit)`
                              : `Buy @ ${ammCost.toFixed(2)} WOODENG (AMM)`
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
                    Price History <span className="ml-2 text-purple-400">{finalPrice.toFixed(2)} WOODENG</span>
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
            Price: {payload[0].value.toFixed(2)} WOODENG
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
                      placeholder="Price (WOODENG)"
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
                        const price = (o.account.price.toNumber() / 1e9).toFixed(2);
                        return (
                          <div key={o.publicKey.toBase58()} className="bg-gray-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{price} WOODENG</span>
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
