/* app/list-nft/ListNFT.tsx
------------------------------------------------------------------- */
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter }       from 'next/navigation';

import { WalletMultiButton }          from '@solana/wallet-adapter-react-ui';
import { useWallet }                  from '@solana/wallet-adapter-react';

import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';

/* local helpers / types ----------------------------------------- */
import { cn }               from '@/lib/utils';
import { PROGRAM_ID }       from '@/lib/constants';
import { orderPdas }        from '@/lib/pda';
import type { NFT }         from '@/models/types';
import idl                  from '@/idl/idl.json';

/* anchor / solana ------------------------------------------------ */
import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction
} from '@solana/web3.js';

/* metaplex ------------------------------------------------------- */
import {
  Metaplex,
  walletAdapterIdentity
} from '@metaplex-foundation/js';

/* utils ---------------------------------------------------------- */
const resolveIpfs = (u: string) =>
  u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.replace('ipfs://', '')}` : u;

/* ───────────────── helpers: find existing order on-chain ──────── */
const ORDER_SELLER_OFFSET = 8 + 1 + 8;            // disc(8) + bump(1) + id(u64)
const ORDER_MINT_OFFSET   = ORDER_SELLER_OFFSET + 32;

type OrderRow = {
  publicKey: PublicKey;
  account: {
    id: any;                 // BN-like (order id)
    price: any;              // BN-like
    escrow: PublicKey;
    seller: PublicKey;
    nftMint: PublicKey;
  };
};




// ---- UI rows for the review table
type SeriesRow = {
  orderPk: PublicKey;
  mint: PublicKey;
  priceLam: number;
  escrow: PublicKey;
};

// tiny helpers
const lamToUi = (lam: number) => lam / 1e9;
const uiToLam = (ui: number) => Math.floor(ui * 1e9);
const short = (s: string) => (s.length <= 10 ? s : `${s.slice(0, 4)}…${s.slice(-4)}`);





// Safely fetch *only* Order accounts and skip anything that fails to decode
async function fetchOrdersSafely(program: Program<any>): Promise<OrderRow[]> {
  const conn = program.provider.connection;
  const raws = await conn.getProgramAccounts(program.programId); // all accounts of this program

  const out: OrderRow[] = [];
  for (const { pubkey, account } of raws) {
    try {
      // IMPORTANT: the string 'Order' must match the IDL account name exactly (your IDL uses "Order")
      const decoded = program.coder.accounts.decode('Order', account.data);
      out.push({ publicKey: pubkey, account: decoded } as unknown as OrderRow);
    } catch {
      // Not an Order account or legacy/short layout: skip
    }
  }
  return out;
}




// Ensure an ATA exists (idempotent)
function ixEnsureAta(payer: PublicKey, owner: PublicKey, mint: PublicKey, ata: PublicKey) {
  return createAssociatedTokenAccountIdempotentInstruction(
    payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

// Read token balance (returns 0 if account missing)
async function getAtaAmount(conn: Connection, ata: PublicKey): Promise<number> {
  try {
    const bal = await conn.getTokenAccountBalance(ata);
    return Number(bal.value.amount);
  } catch {
    return 0;
  }
}




// Keep only orders whose escrow account exists and holds 1 token
async function findActiveOrdersForMint(
  program: Program<any>,
  conn: Connection,
  seller: PublicKey,
  mint: PublicKey
): Promise<OrderRow[]> {
  const all = await fetchOrdersSafely(program); // <-- was program.account.order.all()

  const mine = all.filter(r => {
    const a = r.account as any;
    return (a.seller as PublicKey).equals(seller) &&
           (a.nftMint as PublicKey).equals(mint);
  });

  const active: OrderRow[] = [];
  for (const r of mine) {
    try {
      const bal = await conn.getTokenAccountBalance((r.account as any).escrow as PublicKey);
      if (Number(bal.value.amount) === 1) active.push(r);
    } catch {}
  }
  return active;
}





async function findActiveOrdersForSeries(
  program: Program<any>,
  conn: Connection,
  wallet: any,
  seller: PublicKey,
  baseUri: string
): Promise<OrderRow[]> {
  const all = await fetchOrdersSafely(program); // <-- was program.account.order.all()
  const sellerRows = all.filter(r => (r.account as any).seller.equals(seller));

  const mx = Metaplex.make(conn).use(walletAdapterIdentity(wallet));
  const active: OrderRow[] = [];
  await Promise.all(sellerRows.map(async (r) => {
    try {
      const md = await mx.nfts().findByMint({ mintAddress: (r.account as any).nftMint });
      if (md.uri !== baseUri) return;
      const bal = await conn.getTokenAccountBalance((r.account as any).escrow as PublicKey);
      if (Number(bal.value.amount) === 1) active.push(r);
    } catch {}
  }));
  return active;
}



// Find editions you OWN (not in escrow) in this series (same URI)
async function findOwnedMintsInSeries(
  conn: Connection,
  wallet: any,
  owner: PublicKey,
  baseUri: string,
  includeMint?: PublicKey              // << add
): Promise<PublicKey[]> {
  const mx = Metaplex.make(conn).use(walletAdapterIdentity(wallet));
  const out = new Map<string, PublicKey>();

  // normal path: scan owned NFTs/SFTs and keep only this series
  const all = await mx.nfts().findAllByOwner({ owner });
  for (const n of all) {
    try {
      if ((n as any).uri === baseUri) out.set((n as any).mintAddress.toBase58(), (n as any).mintAddress);
    } catch {/* ignore */}
  }

  // fallback: explicitly include the current mint if it matches the series
  if (includeMint) {
    try {
      const md = await mx.nfts().findByMint({ mintAddress: includeMint });
      if (md.uri === baseUri) out.set(includeMint.toBase58(), includeMint);
    } catch {/* ignore */}
  }

  return Array.from(out.values());
}


// tiny utility
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}



/* ----------------------------------------------------------------- */

export default function ListNFT() {
  /* Next router helpers */
  const params      = useParams();
  const nftId       = params.nftId as string | undefined;
  const router      = useRouter();

  /* Wallet */
  const wallet                  = useWallet();
  const { connected, publicKey} = wallet;

  /* UI state */
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nft,          setNft]          = useState<NFT | null>(null);
  const [price,        setPrice]        = useState('');
  const [tokenType]                   = useState<'woodeng' | 'sol'>('woodeng'); // WOODENG only
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);

  // anchor client (mainnet-ready)
const endpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC as string; // fallback

const conn      = new Connection(endpoint, 'confirmed');
const provider  = new AnchorProvider(conn, wallet as any, {
  commitment: 'confirmed',
  preflightCommitment: 'confirmed',
});
const program   = new Program(idl as any, PROGRAM_ID, provider);





  // REVIEW panel state
const [reviewOpen, setReviewOpen] = useState(false);
const [seriesRows, setSeriesRows] = useState<SeriesRow[]>([]);
const [selectedCancel, setSelectedCancel] = useState<Record<string, boolean>>({});
const [rowPriceEdits, setRowPriceEdits] = useState<Record<string, string>>({});



  const [applyToSeries, setApplyToSeries] = useState(false);
const [bulkTargetCount, setBulkTargetCount] = useState<number>(1);
const [baseUri, setBaseUri] = useState<string>(''); // on-chain URI of this series


const isReviewMode = applyToSeries && reviewOpen;


async function loadSeriesOrdersUi() {
  if (!publicKey || !baseUri) return;
  const act = await findActiveOrdersForSeries(program, conn, wallet, publicKey, baseUri);
  const rows: SeriesRow[] = act.map((r) => ({
    orderPk: r.publicKey,
    mint: (r.account as any).nftMint as PublicKey,
    priceLam: new BN((r.account as any).price).toNumber(),
    escrow: (r.account as any).escrow as PublicKey,
  }));
  setSeriesRows(rows);
  setSelectedCancel({});
  setRowPriceEdits({});
}



  /* ---------- loader: fetch NFT + any open order ---------------- */
  useEffect(() => {
    async function load() {
      if (!nftId)   { setError('No NFT id'); return; }
      if (!wallet.connected || !publicKey) return;

      try {
        setIsLoading(true); setError(null);

        const mx   = Metaplex.make(conn).use(walletAdapterIdentity(wallet));
        const mintPk  = new PublicKey(nftId);
        const onChain = await mx.nfts().findByMint({ mintAddress: mintPk });

        const metaUrl   = resolveIpfs(onChain.uri);
        setBaseUri(onChain.uri); // keep the original (ipfs://...) for equality checks

        const metaJson  = await (await fetch(metaUrl)).json();

        const existingRows = await findActiveOrdersForMint(program, conn, publicKey, mintPk);

const first = existingRows[0];
const existingPriceLam = first ? new BN((first.account as any).price).toNumber() : 0;


        const parsed: NFT = {
          id: nftId,
          title:       metaJson.name,
          description: metaJson.description ?? '',
          artist: {
            id: '0',
            username: metaJson.properties?.artist ?? '',
            email: '',
            type: 'user',
            walletAddress: publicKey.toString()
          },
          imageUrl: resolveIpfs(metaJson.image),
          audioUrl: metaJson.properties?.audio ? resolveIpfs(metaJson.properties.audio) : '',
          price: existingPriceLam / 1e9,
          metadata: metaJson,
          status: 'available',
          createdAt: new Date().toISOString(),
          hasPool: false,
          tokenType: 'woodeng',
          isListed: existingRows.length > 0,
        };

        setNft(parsed);
        if (first) setPrice((existingPriceLam / 1e9).toString());

      } catch (e: any) {
        console.error(e);
        setError('Could not load NFT metadata');
      } finally {
        setIsLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftId, wallet.connected, publicKey?.toBase58()]);

  /* ---------- submit: list or update (cancel + relist) ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!nft) return;
  if (!price || +price <= 0) { setError('Enter a valid price'); return; }
  if (!publicKey)            { setError('Wallet not connected'); return; }
  if (!nftId)                { setError('Missing NFT id');      return; }

  try {
    setIsSubmitting(true); setError(null);

    const mintPk     = new PublicKey(nftId);
    const userNftAta = await getAssociatedTokenAddress(mintPk, publicKey);

    // Ensure ATA for THIS mint (safe no-op if exists)
    {
      const createAtaIx = ixEnsureAta(publicKey, publicKey, mintPk, userNftAta);
      const tx = new Transaction().add(createAtaIx);
      try { await provider.sendAndConfirm(tx); } catch {}
    }

    const newPriceLam = new BN(Math.floor(+price * 1e9));


    // If review is open but user didn't choose anything, stop and explain.
if (applyToSeries && reviewOpen) {
  const anyCancel = Object.values(selectedCancel).some(Boolean);
  const anyRowEdit = Object.values(rowPriceEdits).some((v) => +v > 0);
  if (!anyCancel && !anyRowEdit) {
    setIsSubmitting(false);
    setError('Review mode is open. Select rows to cancel or set a per-row price, or close the table to use the target count option.');
    return;
  }
}


  
// ─────────────────────────────────────────────────────────────
// SERIES MODE (REVIEW OPEN): cancel checked + per-row price overrides
// ─────────────────────────────────────────────────────────────
if (applyToSeries && reviewOpen && baseUri) {
  // refresh active orders to avoid stale UI
  const active = await findActiveOrdersForSeries(program, conn, wallet, publicKey, baseUri);

  const allIxs: any[] = [];
  for (const r of active) {
    const key = r.publicKey.toBase58();

    if (selectedCancel[key]) {
      // cancel this listing
      const mint = (r.account as any).nftMint as PublicKey;
      const ata  = await getAssociatedTokenAddress(mint, publicKey);
      const ensureIx = ixEnsureAta(publicKey, publicKey, mint, ata);
      const [escAuth] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow_auth'), r.publicKey.toBuffer()],
        PROGRAM_ID
      );
      const cancelIx = await program.methods
        .cancelOrder()
        .accounts({
          order:           r.publicKey,
          escrowAuthority: escAuth,
          escrow:          (r.account as any).escrow as PublicKey,
          sellerNftAta:    ata,
          seller:          publicKey,
          tokenProgram:    TOKEN_PROGRAM_ID,
        })
        .instruction();
      allIxs.push(ensureIx, cancelIx);
    } else {
      // update price: per-row override or global
      const override = rowPriceEdits[key];
      const lam = override && +override > 0
        ? new BN(uiToLam(+override))
        : newPriceLam;

      const updIx = await program.methods
        .updateOrderPrice(lam)
        .accounts({ order: r.publicKey, seller: publicKey })
        .instruction();
      allIxs.push(updIx);
    }
  }

  if (allIxs.length > 0) {
    const chunks = chunkArray(allIxs, 8);
    for (const chunk of chunks) {
      const tx = new Transaction();
      chunk.forEach(ix => tx.add(ix));
      await provider.sendAndConfirm(tx);
    }
  }

  setSuccess(true);
  setTimeout(() => router.push(`/nft/${nftId}`), 1200);
  return;
}


// ─────────────────────────────────────────────────────────────
// SERIES MODE (target count): keep old behavior (SFT-aware)
// ─────────────────────────────────────────────────────────────
if (applyToSeries && !reviewOpen && baseUri) {
  // 1) active orders in this series (oldest first)
  let active = await findActiveOrdersForSeries(program, conn, wallet, publicKey, baseUri);
  active.sort((a, b) => {
    const aId = new BN((a.account as any).id);
    const bId = new BN((b.account as any).id);
    return aId.cmp(bId);
  });

  const target   = Math.max(0, Math.floor(bulkTargetCount || 0));
  const toKeep   = active.slice(0, Math.min(active.length, target));
  const toCancel = active.slice(target);
  const needMore = Math.max(0, target - toKeep.length);

  const updateIxs = await Promise.all(toKeep.map(async (o) =>
    program.methods
      .updateOrderPrice(newPriceLam)
      .accounts({ order: o.publicKey, seller: publicKey })
      .instruction()
  ));

  const cancelIxs: any[] = [];
  for (const o of toCancel) {
    const mint = (o.account as any).nftMint as PublicKey;
    const ata  = await getAssociatedTokenAddress(mint, publicKey);
    const ensureIx = ixEnsureAta(publicKey, publicKey, mint, ata);
    const [escAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow_auth'), o.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const ix = await program.methods
      .cancelOrder()
      .accounts({
        order:           o.publicKey,
        escrowAuthority: escAuth,
        escrow:          (o.account as any).escrow as PublicKey,
        sellerNftAta:    ata,
        seller:          publicKey,
        tokenProgram:    TOKEN_PROGRAM_ID,
      })
      .instruction();
    cancelIxs.push(ensureIx, ix);
  }

  // list more to reach target (SFT copies supported)
  const listIxs: any[] = [];
  if (needMore > 0) {
    const activeCountByMint = new Map<string, number>();
    for (const o of active) {
      const k = ((o.account as any).nftMint as PublicKey).toBase58();
      activeCountByMint.set(k, (activeCountByMint.get(k) || 0) + 1);
    }

    const ownedMints = await findOwnedMintsInSeries(conn, wallet, publicKey, baseUri, mintPk);

    let created = 0;
    for (const m of ownedMints) {
      if (created >= needMore) break;

      const ata = await getAssociatedTokenAddress(m, publicKey);
      const bal = await conn.getTokenAccountBalance(ata).catch(() => null);
      const owned = bal ? Number(bal.value.amount) : 0;

      const k = m.toBase58();
      const alreadyEscrowed = activeCountByMint.get(k) || 0;
      let free = Math.max(0, owned - alreadyEscrowed);

      while (free > 0 && created < needMore) {
        const ensureIx = ixEnsureAta(publicKey, publicKey, m, ata);

        const orderIdBig = BigInt(Date.now()) * 1_000n + BigInt(Math.floor(Math.random() * 1000));
        const { order, escrow, escAuth } = orderPdas(m, publicKey, orderIdBig);

        const creatorPk  = publicKey;
        const royaltyBps = 500;

        const ix = await program.methods
          .listOrder(new BN(orderIdBig.toString()), newPriceLam, creatorPk, royaltyBps)
          .accounts({
            nftMint: m,
            seller:  publicKey,
            order,
            escrow,
            escrowAuthority: escAuth,
            userNftAta: ata,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction();

        listIxs.push(ensureIx, ix);
        created += 1;
        free -= 1;
        activeCountByMint.set(k, (activeCountByMint.get(k) || 0) + 1);
      }
    }

    if (created < needMore) {
      setError(`Not enough free copies to reach ${target}. Added ${created} new listings.`);
    }
  }

  const allIxs = [...updateIxs, ...cancelIxs, ...listIxs];
  if (allIxs.length > 0) {
    const chunks = chunkArray(allIxs, 8);
    for (const chunk of chunks) {
      const tx = new Transaction();
      chunk.forEach(ix => tx.add(ix));
      await provider.sendAndConfirm(tx);
    }
  }

  setNft(prev => prev ? { ...prev, isListed: target > 0, price: +price } : prev);
  setSuccess(true);
  setTimeout(() => router.push(`/nft/${nftId}`), 1200);
  return;
}

    

    // ─────────────────────────────────────────────────────────────
    // PER-MINT MODE (current page only) — unchanged
    // ─────────────────────────────────────────────────────────────
    const opens = await findActiveOrdersForMint(program, conn, publicKey, mintPk);

    if (opens.length > 0) {
      // Batch update duplicates for THIS mint (one approval)
      const tx = new Transaction();
      for (const o of opens) {
        const ix = await program.methods
          .updateOrderPrice(newPriceLam)
          .accounts({ order: o.publicKey, seller: publicKey })
          .instruction();
        tx.add(ix);
      }
      await provider.sendAndConfirm(tx);

      setNft(prev => prev ? { ...prev, isListed: true, price: +price } : prev);
      setSuccess(true);
      setTimeout(() => router.push(`/nft/${nftId}`), 1200);
      return;
    }

    // No open order for THIS mint → list it (requires you hold it)
    const currentAmt = await getAtaAmount(conn, userNftAta);
    if (currentAmt === 0) throw new Error('No open listing found and the NFT is not in your wallet to list.');

    const orderIdBig = BigInt(Date.now()) * 1_000n; // micro-timestamp
    const { order, escrow, escAuth } = orderPdas(mintPk, publicKey, orderIdBig);

    const creatorPk  = publicKey;
    const royaltyBps = 500;

    await program.methods
      .listOrder(new BN(orderIdBig.toString()), newPriceLam, creatorPk, royaltyBps)
      .accounts({
        nftMint:         mintPk,
        seller:          publicKey,
        order,
        escrow,
        escrowAuthority: escAuth,
        userNftAta,
        tokenProgram:    TOKEN_PROGRAM_ID,
        systemProgram:   SystemProgram.programId,
        rent:            SYSVAR_RENT_PUBKEY
      })
      .rpc();

    setNft(prev => prev ? { ...prev, isListed: true, price: +price } : prev);
    setSuccess(true);
    setTimeout(() => router.push(`/nft/${nftId}`), 1500);

  } catch (err: any) {
    console.error(err);
    setError(err.message ?? 'Transaction failed');
  } finally {
    setIsSubmitting(false);
  }
};




  /* ---------- connect-wallet gate ------------------------------ */
  if (!connected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-bold">List your NFT</h1>
        <p className="text-muted-foreground max-w-md">
          Connect your wallet to continue
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  /* ---------- UI ----------------------------------------------- */
  return (
    <div className="max-w-2xl mx-auto py-8">
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to profile
      </button>

      <h1 className="text-3xl font-bold mb-2">{nft?.isListed ? 'Update Listing' : 'List NFT for sale'}</h1>
      <p className="text-muted-foreground mb-6">
        {nft?.isListed ? 'Change your listing price' : 'Set your price and publish the order'}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error && !nft ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> <p>{error}</p>
        </div>
      ) : nft ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* preview card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <img
              src={nft.imageUrl}
              alt={nft.title}
              className="w-full aspect-square object-cover"
            />
            <div className="p-4">
              <h2 className="font-semibold">{nft.title}</h2>
              <p className="text-sm text-muted-foreground">
                {nft.description}
              </p>
            </div>
          </div>

          {/* price */}
          <label className="block">
            <span className="text-sm font-medium">
              {nft.isListed ? 'New price (WOODENG)' : 'Listing price (WOODENG)'}
            </span>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              min="0.01"
              step="0.01"
              className="mt-1 w-full px-4 py-2 bg-background border border-border rounded-lg"
              required
            />
          </label>



         {/* series options */}
<div className="space-y-3 border border-border rounded-lg p-4">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={applyToSeries}
      onChange={(e) => setApplyToSeries(e.target.checked)}
    />
    <span>Check if you want to apply this price to more copies of this musical NFT</span>
  </label>

  {applyToSeries && (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">How many copies to have listed at this price</span>

        {/* small badge when review is open */}
        {isReviewMode && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Review mode active — Values in this mode are ignored
          </span>
        )}
      </div>

      <input
        type="number"
        min={0}
        value={bulkTargetCount}
        onChange={(e) => setBulkTargetCount(Math.max(0, Number(e.target.value || 0)))}
        className="mt-1 w-full px-4 py-2 bg-background border border-border rounded-lg disabled:opacity-60"
        disabled={isReviewMode}  // << disable when review table is open
      />
      <p className="text-xs text-muted-foreground mt-1">
        We’ll update the price on up to this many active listings, cancel extras, and list more
        copies  you own to reach the desired amount of copies you want at this price.
      </p>
      {isReviewMode && (
        <p className="text-xs mt-1 text-amber-400">
          Close the “Review current listed copies” table below to use the target count mode.
        </p>
      )}
    </label>
  )}
</div>




{/* review panel */}
{applyToSeries && (
  <div className="border border-border rounded-lg p-4 space-y-3">
    <button
      type="button"
      onClick={async () => {
        const next = !reviewOpen;
        setReviewOpen(next);
        if (next) await loadSeriesOrdersUi();
      }}
      className="px-3 py-2 bg-muted rounded hover:bg-muted/80"
    >
      {reviewOpen ? 'Hide current listed copies' : 'Review current listed copies'}
    </button>

    {reviewOpen && (
      <>
        <p className="text-xs text-muted-foreground">
  <span className="font-medium text-amber-400">Review mode:</span> the field and its values “How many copies to
  have listed” are <b>ignored</b> while this table is open. Check the boxes to <b>cancel</b> price updates  and/or set
  new prices.
</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-3">Cancel</th>
                <th className="py-2 pr-3">Mint</th>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Current Price</th>
                <th className="py-2 pr-3">New Price (optional)</th>
              </tr>
            </thead>
            <tbody>
              {seriesRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-muted-foreground">
                    No active listings in this series.
                  </td>
                </tr>
              ) : (
                seriesRows.map((row) => {
                  const k = row.orderPk.toBase58();
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={!!selectedCancel[k]}
                          onChange={(e) =>
                            setSelectedCancel((prev) => ({ ...prev, [k]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="py-2 pr-3 font-mono">{short(row.mint.toBase58())}</td>
                      <td className="py-2 pr-3 font-mono">{short(k)}</td>
                      <td className="py-2 pr-3">{lamToUi(row.priceLam)}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={rowPriceEdits[k] ?? ''}
                          onChange={(e) =>
                            setRowPriceEdits((prev) => ({ ...prev, [k]: e.target.value }))
                          }
                          className="w-36 px-2 py-1 bg-background border border-border rounded"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

    
      </>
    )}
  </div>
)}



          {/* banners */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 text-green-500 p-4 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> {nft.isListed ? 'Listing updated' : 'NFT listed'} – redirecting…
            </div>
          )}

          {/* buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="flex-1 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg text-primary-foreground flex items-center justify-center gap-2',
                isSubmitting ? 'bg-primary/70' : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                nft.isListed ? 'Update Listing' : 'List for Sale'
              )}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
