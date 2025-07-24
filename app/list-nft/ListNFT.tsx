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
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

/* metaplex ------------------------------------------------------- */
import {
  Metaplex,
  walletAdapterIdentity
} from '@metaplex-foundation/js';

/* utils ---------------------------------------------------------- */
const resolveIpfs = (u: string) =>
  u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.replace('ipfs://', '')}` : u;

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

  /* ---------- loader: fetch real on-chain NFT ------------------- */
  useEffect(() => {
    async function load() {
      if (!nftId)   { setError('No NFT id');         return; }
      if (!wallet.connected) return;

      try {
        setIsLoading(true); setError(null);

        /* 1 ─ Metaplex connection */
        const mx   = Metaplex
          .make(new Connection(clusterApiUrl('devnet')))
          .use(walletAdapterIdentity(wallet));

        /* 2 ─ fetch the NFT account */
        const mintPk  = new PublicKey(nftId);
        const onChain = await mx.nfts().findByMint({ mintAddress: mintPk });

        /* 3 ─ load off-chain JSON */
        const metaUrl   = resolveIpfs(onChain.uri);
        const metaJson  = await (await fetch(metaUrl)).json();

        /* 4 ─ map into your local type */
        const parsed: NFT = {
          id: nftId,
          title:       metaJson.name,
          description: metaJson.description ?? '',
          artist: {
            id: '0',
            username: metaJson.properties?.artist ?? '',
            email: '',
            type: 'user',
            walletAddress: publicKey?.toString() ?? ''
          },
          imageUrl: resolveIpfs(metaJson.image),
          audioUrl: metaJson.properties?.audio
                      ? resolveIpfs(metaJson.properties.audio)
                      : '',
          price: 0,
          metadata: metaJson,
          status: 'available',
          createdAt: new Date().toISOString(),
          hasPool: false,
          tokenType: 'woodeng',
          isListed: false
        };

        setNft(parsed);
      } catch (e: any) {
        console.error(e);
        setError('Could not load NFT metadata');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [nftId, wallet]);   // rerun when wallet reconnects

  /* ---------- submit: list-order -------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nft)            return;
    if (!price || +price <= 0) { setError('Enter a valid price'); return; }
    if (!publicKey)            { setError('Wallet not connected'); return; }
    if (!nftId)                { setError('Missing NFT id');      return; }

    try {
      setIsSubmitting(true); setError(null);

      /* 1 ─ Anchor wiring */
      const conn     = new Connection(clusterApiUrl('devnet'));
      const provider = new AnchorProvider(conn, wallet as any, {});
      const program  = new Program(idl as any, PROGRAM_ID, provider);

      /* 2 ─ PDAs & helpers */
      const mintPk   = new PublicKey(nftId);
      const orderId  = BigInt(Date.now()) * 1_000n; // micro-ts
      const { order, escrow, escAuth } = orderPdas(mintPk, publicKey, orderId);

      const userNftAta = await getAssociatedTokenAddress(mintPk, publicKey);
      const priceLam   = new BN(Math.floor(+price * 1e9)); // WOODENG → lamports

      /* 3 ─ transact */
      await program.methods
        .listOrder(new BN(orderId.toString()), priceLam)
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

      /* 4 ─ UI success */
      setNft(prev => prev ? { ...prev, isListed: true, price: +price } : prev);
      setSuccess(true);
      setTimeout(() => router.push(`/nft/${nftId}`), 2000);

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

      <h1 className="text-3xl font-bold mb-2">List NFT for sale</h1>
      <p className="text-muted-foreground mb-6">
        Set your price and publish the order
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
              Listing price (WOODENG)
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
              <CheckCircle2 className="w-5 h-5" /> NFT listed – redirecting…
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
                'List for sale'
              )}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
