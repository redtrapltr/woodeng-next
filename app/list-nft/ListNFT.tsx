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
import { NFT }              from '@/models/types';
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
    price: any;              // BN-like
    escrow: PublicKey;
    seller: PublicKey;
    nftMint: PublicKey;
  };
};

async function findOpenOrder(
  program: Program<any>,
  seller: PublicKey,
  mint: PublicKey
): Promise<OrderRow | null> {
  const rows = await program.account.order.all([
    { memcmp: { offset: ORDER_SELLER_OFFSET, bytes: seller.toBase58() } },
    { memcmp: { offset: ORDER_MINT_OFFSET,   bytes: mint.toBase58() } },
  ]) as unknown as OrderRow[];
  return rows[0] ?? null;
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

  /* anchor client */
  const conn     = new Connection(clusterApiUrl('devnet'));
  const provider = new AnchorProvider(conn, wallet as any, {});
  const program  = new Program(idl as any, PROGRAM_ID, provider);

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
        const metaJson  = await (await fetch(metaUrl)).json();

        const existing = await findOpenOrder(program, publicKey, mintPk);
        const existingPriceLam = existing ? new BN((existing.account as any).price).toNumber() : 0;

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
          isListed: !!existing,
        };

        setNft(parsed);
        if (existing) setPrice((existingPriceLam / 1e9).toString());
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
    if (!nft)            return;
    if (!price || +price <= 0) { setError('Enter a valid price'); return; }
    if (!publicKey)            { setError('Wallet not connected'); return; }
    if (!nftId)                { setError('Missing NFT id');      return; }

    try {
      setIsSubmitting(true); setError(null);

      const mintPk       = new PublicKey(nftId);
      const userNftAta   = await getAssociatedTokenAddress(mintPk, publicKey);

      // 0) Make sure seller ATA exists (for both cancel & relist)
      {
        const createAtaIx = ixEnsureAta(publicKey, publicKey, mintPk, userNftAta);
        const tx = new Transaction().add(createAtaIx);
        // send quietly; if it already exists this is a no-op
        try { await provider.sendAndConfirm(tx); } catch {}
      }

      const newPriceLam = new BN(Math.floor(+price * 1e9));

      // 1) Check if NFT already in wallet; if not, try cancel existing order
      let amount = await getAtaAmount(conn, userNftAta);
      if (amount === 0) {
        const existing = await findOpenOrder(program, publicKey, mintPk);
        if (!existing) {
          throw new Error('NFT is not in your wallet and no open order was found to cancel. Refresh or check you are using the same wallet you listed with.');
        }

        // Cancel: build a tx with (ensure ATA) + cancel instruction
        const [escAuthOld] = PublicKey.findProgramAddressSync(
          [Buffer.from('escrow_auth'), existing.publicKey.toBuffer()],
          PROGRAM_ID
        );
        const cancelIx = await program.methods
          .cancelOrder()
          .accounts({
            order:           existing.publicKey,
            escrowAuthority: escAuthOld,
            escrow:          (existing.account as any).escrow as PublicKey,
            sellerNftAta:    userNftAta,
            seller:          publicKey,
            tokenProgram:    TOKEN_PROGRAM_ID,
          })
          .instruction();

        const tx = new Transaction().add(cancelIx);
        await provider.sendAndConfirm(tx);

        // Wait until the NFT returns (simple poll)
        for (let i = 0; i < 6; i++) { // ~3s total
          await new Promise(r => setTimeout(r, 500));
          amount = await getAtaAmount(conn, userNftAta);
          if (amount > 0) break;
        }
        if (amount === 0) throw new Error('Cancel succeeded but NFT not detected in your wallet yet. Try again in a few seconds.');
      }

      // 2) (Re)list with a fresh orderId
      const orderIdBig        = BigInt(Date.now()) * 1_000n; // micro-timestamp
      const { order, escrow, escAuth } = orderPdas(mintPk, publicKey, orderIdBig);

      const creatorPk  = publicKey; // or derive from metadata
      const royaltyBps = 500;       // 5%

      await program.methods
        .listOrder(
          new BN(orderIdBig.toString()),
          newPriceLam,
          creatorPk,
          royaltyBps
        )
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

      /* UI success */
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
