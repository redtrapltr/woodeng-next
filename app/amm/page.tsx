/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useEffect, useState } from 'react';
import {
  PublicKey,
  Connection,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import { AnchorProvider, Program, BN, Idl } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import idl from '../../idl/idl.json';

/* ─── deterministic-ish u64 for order ids ─────────────── */
const newOrderId = () =>
  BigInt(Date.now() * 1_000 + Math.floor(Math.random() * 1_000));

/* ─── PROGRAM IDs ───────────────────────────────────────── */
const PROGRAM_ID   = new PublicKey('FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS');
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');

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

  /* ─── state ──────────────────────────────────────────── */
  const [program,     setProgram]     = useState<Program<Idl> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [poolPk,      setPoolPk]      = useState<PublicKey | null>(null);
  const [poolType,    setPoolType]    = useState<'single'|'bundle'|null>(null);

  const [poolState,   setPoolState]   = useState<any | null>(null);
  const [bundleState, setBundleState] = useState<any | null>(null);

  const [poolSigner,  setPoolSigner]  = useState<PublicKey | null>(null);
  const [tokenVault,  setTokenVault]  = useState<PublicKey | null>(null);

  // track all NFT-vault PDAs for a bundle
  const [nftVaults,   setNftVaults]   = useState<PublicKey[]>([]);
  const [selectedMintIndex, setSelectedMintIndex] = useState(0);

  // names & availability
  const [mintNames, setMintNames]   = useState<string[]>([]);
  const [available, setAvailable]   = useState<boolean[]>([]);

  const [userWoodAta, setUserWoodAta] = useState<PublicKey | null>(null);
  const [orders,      setOrders]      = useState<OrderAccount[]>([]);

  const [tradeHistory, setTradeHistory] = useState<{ time: string; price: number }[]>([]);
  const [newPrice,      setNewPrice]    = useState('');

  /* ─── helper to push chart data ─────────────────────── */
  const pushPrice = (p: number) =>
    setTradeHistory((h) => [...h, { time: new Date().toLocaleTimeString(), price: p }]);

  /* ─── ensure ATA ────────────────────────────────────── */
  async function ensureAta(
    conn: Connection,
    owner: PublicKey,
    mint: PublicKey,
  ): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(mint, owner);
    try {
      await getAccount(conn, ata);
    } catch {
      const ix = createAssociatedTokenAccountInstruction(owner, ata, owner, mint);
      const tx = new Transaction().add(ix);
      tx.feePayer        = owner;
      tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
      const signed = await signTransaction!(tx);
      const sig    = await conn.sendRawTransaction(signed.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
    }
    return ata;
  }

  /* ─── wallet ATA for WOODENG ─────────────────────────── */
  useEffect(() => {
    if (!publicKey) return;
    (async () => {
      const ata = await getAssociatedTokenAddress(WOODENG_MINT, publicKey);
      setUserWoodAta(ata);
    })();
  }, [publicKey]);

  /* ─── Anchor program init ───────────────────────────── */
  useEffect(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    const conn     = new Connection(clusterApiUrl('devnet'));
    const provider = new AnchorProvider(conn, wallet as any, {});
    setProgram(new Program(idl as Idl, PROGRAM_ID, provider));
  }, [publicKey, signTransaction, signAllTransactions]);

  /* ─── Search + identify Single vs Bundle ────────────── */
  const handleSearchPool = async () => {
    if (!program) return;
    let pk: PublicKey;
    try {
      pk = new PublicKey(searchInput.trim());
    } catch {
      return alert('Invalid address');
    }
    const info = await program.provider.connection.getAccountInfo(pk);
    if (!info) return alert('Account not found on devnet');
    if (!info.owner.equals(PROGRAM_ID))
      return alert('Address exists but is not a Woodeng pool');

    // Try Single-mint pool
    try {
      await program.account.pool.fetch(pk);
      setPoolType('single');
      setPoolState(await program.account.pool.fetch(pk));
      setBundleState(null);
      setPoolPk(pk);
      setTradeHistory([]);
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
      return;
    } catch {}

    alert('Not a Woodeng pool');
  };

  /* ─── Derive PDAs ───────────────────────────────────── */
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

  /* ─── Fetch pool/bundle state ───────────────────────── */
  useEffect(() => {
    if (!program || !poolPk || !poolType) return;
    if (poolType === 'single') {
      program.account.pool.fetch(poolPk).then(p => setPoolState(p));
      setOrders([]);
    } else {
      program.account.bundleConfig.fetch(poolPk).then(b => setBundleState(b));
    }
  }, [program, poolPk, poolType]);

  /* ─── Fetch NFT metadata names + availability ───────── */
  useEffect(() => {
    if (!bundleState || !program) return;
    const conn = program.provider.connection;
    const mx   = Metaplex.make(conn).use(walletAdapterIdentity(wallet));

    // fetch on-chain name or short fallback
    Promise.all(bundleState.mints.map(async (m: PublicKey) => {
      try {
        const nftModel = await mx.nfts().findByMint({ mintAddress: m });
        return nftModel.name;
      } catch {
        return m.toBase58().slice(0,8) + '…';
      }
    }))
    .then(names => setMintNames(names));

    // availability = reserve > 0
    setAvailable(bundleState.nftReserves.map((r: BN) => r.toNumber() > 0));
  }, [bundleState, program, wallet]);

  /* ─── Fetch Limit Orders (single only) ───────────────── */
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

  /* ─── Handlers: Sell ────────────────────────────────── */
  const handleSell = async () => {
    if (!program || !poolPk || !poolSigner || !tokenVault || !userWoodAta || !publicKey) return;

    if (poolType === 'single') {
      const sellerAta = await ensureAta(
        program.provider.connection, publicKey, poolState.nftMints[0]
      );
      await program.methods.sellNft(new BN(0))
        .accounts({
          pool:         poolPk,
          poolSigner,
          nftVault:     nftVaults[0],
          tokenVault,
          userNftAta:   sellerAta,
          userTokenAta: userWoodAta,
          user:         publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      setPoolState(await program.account.pool.fetch(poolPk));

    } else if (bundleState) {
      const idx       = selectedMintIndex;
      const mint      = bundleState.mints[idx] as PublicKey;
      const vaultPda  = nftVaults[idx];
      const sellerAta = await ensureAta(
        program.provider.connection, publicKey, mint
      );
      await program.methods.sellBundleNft(new BN(0))
        .accounts({
          bundle:        poolPk,
          bundleSigner:  poolSigner,
          tokenVault,
          vault:         vaultPda,
          mint,
          userNftAta:    sellerAta,
          userTokenAta:  userWoodAta,
          user:          publicKey,
          tokenProgram:  TOKEN_PROGRAM_ID,
        })
        .rpc();
      setBundleState(await program.account.bundleConfig.fetch(poolPk));
    }
  };

  /* ─── Handlers: Buy ─────────────────────────────────── */
  const handleBuy = async () => {
    if (!program || !poolPk || !poolSigner || !tokenVault || !publicKey) return;
    const conn          = program.provider.connection;
    const buyerTokenAta = await ensureAta(conn, publicKey, WOODENG_MINT);

    if (poolType === 'single') {
      const buyerNftAta = await ensureAta(conn, publicKey, poolState.nftMints[0]);
      const x0 = poolState.nftReserves[0].toNumber() + poolState.vx.toNumber();
      const y0 = poolState.tokenReserve.toNumber()   + poolState.vy.toNumber();
      const k  = BigInt(x0) * BigInt(y0);
      const y1 = (k / BigInt(x0 - 1)) as bigint;
      const lam  = Number(y1 - BigInt(y0));
      const maxIn = Math.ceil(lam * 1.03);

      await program.methods.buyNft(new BN(maxIn))
        .accounts({
          pool:         poolPk,
          poolSigner,
          nftVault:     nftVaults[0],
          tokenVault,
          userTokenAta: buyerTokenAta,
          userNftAta:   buyerNftAta,
          user:         publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      setPoolState(await program.account.pool.fetch(poolPk));
      pushPrice(lam / 1e9);

    } else if (bundleState) {
      const vx = bundleState.vx.toNumber();
      const vy = bundleState.vy.toNumber();
      let sumX = vx;
      bundleState.nftReserves.forEach((r: BN) => sumX += r.toNumber());
      const sumY = bundleState.tokenReserve.toNumber() + vy;
      const k    = BigInt(sumX) * BigInt(sumY);
      const newY = k / BigInt(sumX - 1);
      const lam  = Number(newY - BigInt(sumY));
      const maxIn = Math.ceil(lam * 1.03);

      const idx         = selectedMintIndex;
      const mint        = bundleState.mints[idx] as PublicKey;
      const vaultPda    = nftVaults[idx];
      const buyerNftAta = await ensureAta(conn, publicKey, mint);

      await program.methods.buyBundleNft(new BN(maxIn))
        .accounts({
          bundle:        poolPk,
          bundleSigner:  poolSigner,
          tokenVault,
          vault:         vaultPda,
          mint,
          userNftAta:    buyerNftAta,
          userTokenAta:  buyerTokenAta,
          user:          publicKey,
          tokenProgram:  TOKEN_PROGRAM_ID,
        })
        .rpc();
      setBundleState(await program.account.bundleConfig.fetch(poolPk));
      pushPrice(lam / 1e9);
    }
  };

  /* ─── Limit Orders (single only) ───────────────────── */
  const firstMint = poolType === 'single' ? poolState?.nftMints[0] : null;
  const handleListOrder = async () => {
    if (!program || poolType!=='single' || !publicKey || !newPrice || !firstMint) return;
    const id       = newOrderId();
    const buf      = Buffer.alloc(8); buf.writeBigUInt64LE(id);
    const priceLam = new BN((BigInt(newPrice) * BigInt(1e9)).toString());

    const [orderPda]  = PublicKey.findProgramAddressSync(
      [Buffer.from('order'), firstMint.toBuffer(), publicKey.toBuffer(), buf],
      PROGRAM_ID
    );
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), orderPda.toBuffer()],
      PROGRAM_ID
    );
    const [escAuth]   = PublicKey.findProgramAddressSync(
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
        nftMint:         firstMint,
        seller:          publicKey,
        order:           orderPda,
        escrow:          escrowPda,
        escrowAuthority: escAuth,
        userNftAta:      sellerAta,
        tokenProgram:    TOKEN_PROGRAM_ID,
        systemProgram:   SystemProgram.programId,
        rent:            SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    setNewPrice('');
    fetchOrders();
  };

  const handleCancel = async (o: OrderAccount) => {
    if (!program||!publicKey||poolType!=='single') return;
    const [escAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const sellerAta = await getAssociatedTokenAddress(firstMint!, publicKey);

    await program.methods.cancelOrder()
      .accounts({
        order:           o.publicKey,
        escrow:          o.account.escrow,
        escrowAuthority: escAuth,
        seller:          publicKey,
        sellerNftAta:    sellerAta,
        tokenProgram:    TOKEN_PROGRAM_ID,
      })
      .rpc();

    fetchOrders();
  };

  const handleFill = async (o: OrderAccount) => {
    if (!program||!publicKey||poolType!=='single') return;
    const info = await program.provider.connection.getAccountInfo(o.account.escrow);
    if (!info?.owner.equals(TOKEN_PROGRAM_ID)) {
      return fetchOrders();
    }
    const [escAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const buyerTokenAta  = await getAssociatedTokenAddress(WOODENG_MINT, publicKey);
    const buyerNftAta    = await getAssociatedTokenAddress(firstMint!, publicKey);
    const sellerTokenAta = await getAssociatedTokenAddress(WOODENG_MINT, o.account.seller);

    await program.methods.fillOrder()
      .accounts({
        order:           o.publicKey,
        escrow:          o.account.escrow,
        escrowAuthority: escAuth,
        buyer:           publicKey,
        buyerTokenAta,
        buyerNftAta,
        seller:          o.account.seller,
        sellerTokenAta,
        tokenProgram:    TOKEN_PROGRAM_ID,
      })
      .rpc();

    fetchOrders();
  };

  /* ─── Price Chart + Quoting ─────────────────────────── */
  const foreignOrders = orders.filter(o => !o.account.seller.equals(publicKey!));
  const bestAsk       = foreignOrders.length
    ? foreignOrders.sort((a,b) => a.account.price.sub(b.account.price).toNumber())[0]
    : null;
  const bestAskPrice  = bestAsk ? bestAsk.account.price.toNumber()/1e9 : Infinity;

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
  if (poolType==='single' && pooledNfts>0 && poolState) {
    const x0 = pooledNfts + poolState.vx.toNumber();
    const y0 = pooledWood + poolState.vy.toNumber();
    const k  = BigInt(x0) * BigInt(y0);
    const y1 = (k / BigInt(x0 - 1)) as bigint;
    ammCost  = Number(y1 - BigInt(y0)) / 1e9;
  }
  const finalPrice     = Math.min(bestAskPrice, ammCost);
  const orderAvailable = foreignOrders.length > 0;

  useEffect(() => {
    const last = tradeHistory.at(-1)?.price ?? 0;
    if (Number.isFinite(finalPrice) && Math.abs(finalPrice - last) > 1e-9) {
      pushPrice(finalPrice);
    }
  }, [finalPrice]);

  /* ─── UI ─────────────────────────────────────────────── */
  const displayMint = poolType === 'single'
    ? poolState?.nftMints[0]
    : poolType === 'bundle'
      ? bundleState?.mints[selectedMintIndex]
      : null;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6 text-white">
      <h1 className="text-4xl font-bold text-center">Woodeng AMM + Orders</h1>

      {!publicKey ? (
        <p className="text-center">🔒 Connect your wallet.</p>
      ) : (
        <>
          {/* Search */}
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Paste pool address…"
              className="flex-1 p-2 bg-gray-800 rounded"
            />
            <button onClick={handleSearchPool}
                    className="px-4 bg-blue-600 rounded hover:bg-blue-500">
              Load
            </button>
          </div>

          {/* Pool Info */}
          {!poolPk ? null
            : !displayMint ? <p className="text-center text-gray-400">Loading…</p>
            : (
            <motion.div
              initial={{ opacity:0, y:-20 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.3 }}
              className="p-4 bg-gray-800 rounded space-y-2"
            >
              <p><strong>Pool:</strong> {poolPk.toBase58()}</p>
              <p><strong>Pooled NFTs:</strong> {pooledNfts}</p>
              <p>
                <strong>Pooled WOODENG:</strong>{' '}
                {(pooledWood/1e9).toLocaleString(undefined,{
                  minimumFractionDigits:2,
                  maximumFractionDigits:9
                })}
              </p>
              <p><strong>Virtual x/y:</strong> {(
                poolType==='single'
                  ? `${poolState.vx.toString()} / ${poolState.vy.toString()}`
                  : `${bundleState.vx.toString()} / ${bundleState.vy.toString()}`
              )}</p>
              <p><strong>Type:</strong> {poolType==='bundle'?'Bundle':'Single'}</p>
            </motion.div>
          )}

          {/* Bundle selector + legend */}
          {poolType==='bundle' && bundleState && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">available</span>
              </div>
              <select
                className="bg-gray-700 p-2 rounded flex-1"
                value={selectedMintIndex}
                onChange={e => setSelectedMintIndex(Number(e.target.value))}
              >
                {bundleState.mints.map((m: PublicKey, i: number) => (
                  <option
                    key={m.toBase58()}
                    value={i}
                    title={m.toBase58()}
                    style={{
                      backgroundColor: available[i]
                        ? 'rgba(72,187,120,0.35)'
                        : undefined,
                    }}
                  >
                    {mintNames[i] || m.toBase58().slice(0,8) + '…'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AMM Actions */}
          {displayMint && (
            <div className="flex gap-4">
              <button onClick={handleSell}
                      className="flex-1 py-2 bg-yellow-600 rounded hover:bg-yellow-500">
                Sell NFT
              </button>
              <button
                onClick={ orderAvailable && bestAskPrice < ammCost
                  ? () => handleFill(bestAsk!)
                  : handleBuy
                }
                disabled={!orderAvailable && pooledNfts===0}
                className={`flex-1 py-2 rounded ${
                  (!orderAvailable && pooledNfts===0)
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {!orderAvailable && pooledNfts===0
                  ? 'No NFTs to buy'
                  : orderAvailable && bestAskPrice<ammCost
                    ? `Buy @ ${bestAskPrice.toFixed(2)} (limit)`
                    : `Buy @ ${ammCost.toFixed(2)} (AMM)`
                }
              </button>
            </div>
          )}

          {/* Price Chart */}
          <hr className="border-gray-700" />
          <div className="mt-6">
            <h2 className="text-xl font-semibold">
              Current Price: {finalPrice.toFixed(2)} WOODENG
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={tradeHistory}>
                <XAxis dataKey="time" />
                <YAxis domain={['auto','auto']} />
                <Tooltip formatter={(v:number) => v.toFixed(2)+' WOODENG'} />
                <Line type="monotone" dataKey="price" dot={false} stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Limit Orders (single only) */}
          {poolType==='single' && (
            <>
              <hr className="border-gray-700" />
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Open Limit Orders</h2>
                <div className="flex gap-2">
                  <input
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="Price (WOODENG)"
                    className="flex-1 p-2 bg-gray-800 rounded"
                  />
                  <button onClick={handleListOrder}
                          className="py-2 px-4 bg-blue-600 rounded hover:bg-blue-500">
                    List
                  </button>
                </div>
                {orders.length===0 ? (
                  <p className="text-center text-gray-400">No open orders</p>
                ) : (
                  <div className="space-y-2">
                    {orders.map(o => {
                      const mine  = publicKey!.equals(o.account.seller);
                      const price = (o.account.price.toNumber()/1e9).toFixed(2);
                      return (
                        <div key={o.publicKey.toBase58()}
                             className="p-3 bg-gray-800 rounded flex justify-between items-center">
                          <div>
                            <p><strong>ID:</strong> …{o.publicKey.toBase58().slice(-8)}</p>
                            <p><strong>Price:</strong> {price} WOODENG</p>
                            <p><strong>Seller:</strong> {o.account.seller.toBase58()}</p>
                          </div>
                          {mine ? (
                            <button onClick={()=>handleCancel(o)}
                                    className="py-1 px-2 bg-red-600 rounded hover:bg-red-500">
                              Cancel
                            </button>
                          ) : (
                            <button onClick={()=>handleFill(o)}
                                    className="py-1 px-2 bg-green-600 rounded hover:bg-green-500">
                              Buy
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
