/* app/nft/[mint]/page.tsx (or whatever your route is) */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Connection, PublicKey, clusterApiUrl, SystemProgram,
  SYSVAR_RENT_PUBKEY,            // (already there)
  Transaction,                   // ← NEW
} from '@solana/web3.js';

import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  AnchorProvider, Program, BorshCoder, Idl, BN,
} from '@project-serum/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,   // ← NEW
  ASSOCIATED_TOKEN_PROGRAM_ID,               // ← NEW
} from '@solana/spl-token';

import { Metaplex } from '@metaplex-foundation/js';

import {
  Loader2, Play, Pause, AlertCircle, X, Tag, Edit,
} from 'lucide-react';

import idl from '@/idl/idl.json';
import { PROGRAM_ID, WOODENG_MINT } from '@/lib/constants';
import { cn } from '@/lib/utils';

/* -------------------------------------------------- */
/* helpers                                            */
/* -------------------------------------------------- */
const gateways = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://nftstorage.link/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
];
const toHttp = (uri: string) => (uri.startsWith('ipfs://')
  ? gateways[0](uri.slice(7))
  : uri);

type FetchedNFT = {
  mint: PublicKey;
  name: string;
  artist: string;
  image: string;
  audio?: string;
  description?: string;
  collection?: string;
  style?: string;
  copies?: number;
  royalties?: number;
  metadata?: any;          // ← NEW
  year?: number | string;  // ← optional, if you store a year separately
 };


/* ---- resilient JSON fetch --------------------------------------- */
async function fetchNftData(
  conn: Connection,
  mintStr: string,
): Promise<FetchedNFT> {
  const mint = new PublicKey(mintStr);
  const mx   = Metaplex.make(conn);
  const nft  = await mx.nfts().findByMint({ mintAddress: mint });

  let meta: any = nft.json ?? null;
  if (!meta) {
    const cid = nft.uri.startsWith('ipfs://') ? nft.uri.slice(7) : '';
    for (let i = 0; i < 3 && !meta; i++) {
      try {
        const url = cid ? gateways[i](cid) : nft.uri;
        meta = await fetch(url).then(r => r.json());
      } catch {/* try next */}
    }
  }
  meta ||= {};

  return {
    mint,
    name:        nft.name,
    artist:      meta.properties?.artist ?? meta.artist ?? 'Unknown artist',
    image:       toHttp(meta.image ?? '') || '/blank.png',
    audio:       meta.properties?.audio ? toHttp(meta.properties.audio)
               : meta.animation_url      ? toHttp(meta.animation_url)
               : undefined,
    description: meta.description,
    collection:  meta.collection?.name,
    style:       meta.properties?.style,
    copies:      meta.properties?.copies,
    royalties:   nft.sellerFeeBasisPoints / 100,
    metadata:    meta,                 // ← NEW
    year:        meta.year,            // optional
  };
}

/* ---- find *any* open Order for this mint ------------------------ */
async function fetchOrderData(
  conn: Connection,
  mintPk: PublicKey,
) {
  // discriminator is 8; Order struct = 1+8+32+32+8+32 = 113 bytes
  const raw = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 8 + 113 }],
  });

  const coder = new BorshCoder(idl as Idl);
  for (const { pubkey, account } of raw) {
    try {
      const o: any = coder.accounts.decode('Order', account.data);
      if (!new PublicKey(o.nftMint).equals(mintPk)) continue;
      // ensure escrow still exists
      if (!(await conn.getAccountInfo(o.escrow))) continue;
      return {
        orderPda: pubkey,
        escrow:   o.escrow as PublicKey,
        seller:   o.seller as PublicKey,
        priceLamports: Number(o.price),
      };
    } catch {/* skip */}
  }
  return null;
}

/* -------------------------------------------------- */
/* component                                          */
/* -------------------------------------------------- */
export default function NFTDetailPage() {
  const { mint } = useParams<{ mint: string }>();
  const router   = useRouter();
  const wallet   = useWallet();

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [nft,   setNft]   = useState<FetchedNFT | null>(null);
  const [order, setOrder] = useState<{
    orderPda: PublicKey;
    escrow: PublicKey;
    seller: PublicKey;
    priceLamports: number;
  } | null>(null);

  /* audio preview */
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const togglePlay = () => {
    if (!nft?.audio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(nft.audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    playing ? audioRef.current.pause() : audioRef.current.play();
    setPlaying(!playing);
  };

  /* ------ initial load ------------------------------------------- */
  useEffect(() => {
    if (!wallet.connected || !mint) return;

    (async () => {
      try {
        setLoading(true);
        const conn   = new Connection(clusterApiUrl('devnet'));
        const nftRes = await fetchNftData(conn, mint);
        setNft(nftRes);

        const ordRes = await fetchOrderData(conn, nftRes.mint);
        setOrder(ordRes);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load NFT');
      } finally { setLoading(false); }
    })();
  }, [wallet.connected, mint]);

  /* ------ helpers ------------------------------------------------ */
  const iAmOwner = order && wallet.publicKey?.equals(order.seller);
  const priceWdg = order ? order.priceLamports / 1e9 : 0;

  /* ------ actions ------------------------------------------------ */
  const listNft = () => router.push(`/list-nft/${mint}`);

  const cancelListing = async () => {
    if (!order || !wallet.publicKey) return;
    try {
      setLoading(true);
      const conn     = new Connection(clusterApiUrl('devnet'));
      const provider = new AnchorProvider(conn, wallet as any, {});
      const program  = new Program(idl as any, PROGRAM_ID, provider);

      await program.methods
        .cancelOrder()
        .accounts({
          order:            order.orderPda,
          escrowAuthority:  PublicKey.findProgramAddressSync(
            [Buffer.from('escrow_auth'), order.orderPda.toBuffer()],
            PROGRAM_ID,
          )[0],
          escrow:           order.escrow,
          seller:           wallet.publicKey,
          sellerNftAta:     await getAssociatedTokenAddress(nft!.mint, wallet.publicKey),
          tokenProgram:     TOKEN_PROGRAM_ID,
        })
        .rpc();
      setOrder(null);
    } catch (e: any) { setError(e.message ?? 'Cancel failed'); }
    finally        { setLoading(false); }
  };

  const buyNft = async () => {
  if (!order || !wallet.publicKey || !nft) return;

  try {
    setLoading(true);

    const conn     = new Connection(clusterApiUrl('devnet'));
    const provider = new AnchorProvider(conn, wallet as any, {});
    const program  = new Program(idl as any, PROGRAM_ID, provider);

    /* PDA / ATA derivations */
    const buyerNftAta   = await getAssociatedTokenAddress(
      nft.mint,
      wallet.publicKey,
      /* allow off curve */ false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const sellerWdgAta  = await getAssociatedTokenAddress(WOODENG_MINT, order.seller);
    const buyerWdgAta   = await getAssociatedTokenAddress(WOODENG_MINT, wallet.publicKey);
    const escrowAuthPda = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow_auth'), order.orderPda.toBuffer()],
      PROGRAM_ID,
    )[0];

   /* ---------- 1. make sure the buyer’s NFT ATA exists --------------- */
const ataInfo = await conn.getAccountInfo(buyerNftAta);

if (!ataInfo) {
  const createIx = createAssociatedTokenAccountInstruction(
    wallet.publicKey,        // payer
    buyerNftAta,             // ata to create
    wallet.publicKey,        // owner
    nft.mint,                // mint
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // send and *wait for finalisation* before moving on
  const tx   = new Transaction().add(createIx);
  const sig  = await provider.sendAndConfirm(
    tx,
    [],                       // no extra signers
    { commitment: 'finalized' }
  );

  // extra safety – loop until RPC shows the account initialised
  // (usually unnecessary, but avoids edge cases on dev-net)
  while (!(await conn.getAccountInfo(buyerNftAta, 'confirmed'))) {
    await new Promise(r => setTimeout(r, 400));  // 0.4 s
  }
}


    /* ---------- 2. fill the order ---------------------------------- */
    await program.methods
      .fillOrder()
      .accounts({
        order:            order.orderPda,
        escrowAuthority:  escrowAuthPda,
        escrow:           order.escrow,
        buyer:            wallet.publicKey,
        buyerTokenAta:    buyerWdgAta,
        sellerTokenAta:   sellerWdgAta,
        buyerNftAta:      buyerNftAta,
        seller:           order.seller,
        tokenProgram:     TOKEN_PROGRAM_ID,
      })
      .rpc();

    setOrder(null);                     // refresh UI
  } catch (e: any) {
    setError(e.message ?? 'Buy failed');
  } finally {
    setLoading(false);
  }
};


  /* -------------------------------------------------- */
  /* render                                             */
  /* -------------------------------------------------- */
  if (!wallet.connected) {
    return (
      <Centered>
        <p className="text-xl mb-4">Connect your wallet to view the NFT</p>
        <WalletMultiButton />
      </Centered>
    );
  }

  if (loading) return <Centered><Loader2 className="w-10 h-10 animate-spin" /></Centered>;
  if (error || !nft)
    return (
      <Centered>
        <AlertCircle className="w-6 h-6 text-destructive" />
        <p className="ml-2">{error ?? 'NFT not found'}</p>
      </Centered>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Music NFT Details</h1>

      {/* card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden grid md:grid-cols-3 gap-6 p-6">
        {/* cover */}
        <div className="relative">
          <img src={nft.image} alt={nft.name}
               className="rounded-lg object-cover w-full aspect-square" />
          {nft.audio && (
            <button onClick={togglePlay}
                    className="absolute top-4 right-4 p-3 bg-primary rounded-full text-white">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          )}
          {order && (
            <span className="absolute top-4 left-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Listed&nbsp;for&nbsp;sale
            </span>
          )}
        </div>

        {/* info */}
        <div className="md:col-span-2 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{nft.name}</h2>
            <p className="text-muted-foreground">{nft.artist}</p>
            {nft.description && <p className="mt-4 text-sm">{nft.description}</p>}

            {/* extra metadata as badges */}
<div className="flex flex-wrap gap-2 mt-4">
  {nft.style && (
    <span className="bg-green-600/10 text-green-400 text-[11px] px-2 py-0.5 rounded-full">
      {nft.style}
    </span>
  )}
  {nft.royalties !== undefined && (
    <span className="bg-green-600/10 text-green-400 text-[11px] px-2 py-0.5 rounded-full">
      {nft.royalties}% royalties
    </span>
  )}
</div>


            {/* summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mt-6">
              <SummaryCard
                label="NFT ID"
                /* full address ▸ line-wrap if needed */
                  value={`${nft.mint.toBase58().slice(0, 4)}…${nft.mint.toBase58().slice(-4)}`}
                  full={nft.mint.toBase58()}
              />
              {order && (
                <SummaryCard
                  label="Listing Price"
                  value={`${priceWdg.toFixed(2)} WOODENG`}
                  helper="Listed by owner"
                />
              )}
              <SummaryCard
                label="Available Copies"
                value={nft.copies ?? 1}
                helper="Limited edition"
              />
              <SummaryCard
                label="NFT Status"
                value={order ? 'Listed' : 'Unlisted'}
                helper={order ? 'Available for purchase' : 'Owner only'}
              />
            </div>
          </div>

          {/* buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {order ? (
              iAmOwner ? (
                <>
                  <Btn onClick={cancelListing} tone="destructive">
                    <X className="w-5 h-5" /> Cancel Listing
                  </Btn>
                  <Btn onClick={listNft}>
                    <Edit className="w-5 h-5" /> Update Listing
                  </Btn>
                </>
              ) : (
                <Btn onClick={buyNft} tone="success">
                  Buy @ {priceWdg.toFixed(2)} WOODENG
                </Btn>
              )
            ) : (
              <Btn onClick={listNft}><Tag className="w-5 h-5" /> List for Sale</Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/* tiny helpers                                       */
/* -------------------------------------------------- */
const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[60vh] flex items-center justify-center">{children}</div>
);

const SummaryCard: React.FC<{
  label: string;
  value: string | number; // what you display
  full?: string;          // full text to copy (optional)
  helper?: string;
  long?: boolean;
}> = ({ label, value, full, helper, long }) => (
  <div className="relative bg-muted/50 border border-border rounded-lg p-4">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p
      /* smaller font + wrap long strings */
      className={cn(
        long ? 'text-sm break-all' : 'text-lg',
        'font-medium mt-1'
      )}
    >
      {value}
    </p>
    {helper && (
      <p className="text-[11px] mt-1 text-muted-foreground">{helper}</p>
    )}

        {/* copy-to-clipboard button – only when `full` is provided */}
    {full && (
       <button
   onClick={() => navigator.clipboard.writeText(full)}
   title="Copy full ID"
   /* push ~2 px closer to the edges & shrink SVG */
   className="absolute top-1.5 right-1 text-muted-foreground hover:text-primary transition"
 >
   <svg
     xmlns="http://www.w3.org/2000/svg"
     width="12" height="12" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
   >
     <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
     <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
   </svg>
 </button>
    )}
  </div>
);

const Btn: React.FC<{
  onClick: () => void; children: React.ReactNode;
  tone?: 'primary' | 'destructive' | 'success';
}> = ({ onClick, children, tone = 'primary' }) => {
  const toneCls = {
    primary:     'bg-primary hover:bg-primary/90 text-primary-foreground',
    destructive: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
    success:     'bg-green-500 hover:bg-green-600 text-white',
  }[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors',
        toneCls,
      )}
    >
      {children}
    </button>
  );
};
