'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet'
import { Metaplex, walletAdapterIdentity, token } from '@metaplex-foundation/js'
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  clusterApiUrl,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'

import { Buffer } from 'buffer';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getMint,
} from '@solana/spl-token'

import { AnchorProvider, Program, BN } from '@project-serum/anchor'
import idl from '../../idl/idl.json'
import { CheckCircle2, AlertCircle, ArrowLeft, Plus, Minus, Coins, Info, Loader2, ArrowRight } from 'lucide-react'
import cn from 'classnames'
import MosaicPreview from '../components/MosaicPreview';


// -- CONSTANTS --
const PROGRAM_ID = new PublicKey('FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS')
const WOODENG_MINT = new PublicKey('83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5')
const WSOL_MINT = NATIVE_MINT;      // So11111111111111111111111111111111111111112




// -- HELPERS --
async function pinFile(file: File): Promise<string> {
  const { jwt } = await fetch('/api/pinata-token')
    .then(r => {
      if (!r.ok) throw new Error('Could not fetch Pinata token')
      return r.json() as Promise<{ jwt: string }>
    })
  const form = new FormData()
  form.append('file', file, file.name)
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch (err) {
    throw new Error(`Pinata JSON parse error—raw body:\n${text}`)
  }
  if (!res.ok) throw new Error(body.error || body.message || 'Pinata upload failed')
  return body.IpfsHash as string
}

async function ensureQuoteAtaAndMaybeWrap(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey,
  wallet: ReturnType<typeof useWallet>,
  lamportsToWrap: number = 0
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const ixs: TransactionInstruction[] = [];

  if (!(await conn.getAccountInfo(ata))) {
    ixs.push(createAssociatedTokenAccountInstruction(owner, ata, owner, mint));
  }

  if (mint.equals(WSOL_MINT) && lamportsToWrap > 0) {
    ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports: lamportsToWrap }));
    ixs.push(createSyncNativeInstruction(ata));
  }

  if (ixs.length) {
    const tx = new Transaction().add(...ixs);
    tx.feePayer = owner;
    tx.recentBlockhash = (await conn.getLatestBlockhash('finalized')).blockhash;
    const signed = await wallet.signTransaction!(tx);
    const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(sig, 'confirmed');
  }

  return ata;
}

// -- COMPONENTS --
function FileDrop({
  value, onChange, accept = '', label, required, previewType
}: {
  value: File | null, onChange: (file: File | null) => void, accept?: string, label?: string, required?: boolean, previewType?: 'audio' | 'image' | 'video'
}) {
  const [dragActive, setDragActive] = useState(false)
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 transition-colors relative cursor-pointer",
        dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/50",
      )}
      onDragOver={e => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={e => { e.preventDefault(); setDragActive(false) }}
      onDrop={e => {
        e.preventDefault()
        setDragActive(false)
        if (e.dataTransfer.files.length) onChange(e.dataTransfer.files[0])
      }}
      onClick={() => (document.getElementById(label + '_input') as HTMLInputElement)?.click()}
      style={{ minHeight: 100 }}
    >
      <input
        id={label + '_input'}
        type="file"
        accept={accept}
        required={required}
        style={{ display: 'none' }}
        onChange={e => onChange(e.target.files?.[0] || null)}
      />
      {!value && (
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl"><Plus /></span>
          <span className="text-sm text-muted-foreground">Drop file here or tap to select</span>
          {accept.includes('audio') && (
            <span className="text-xs text-muted-foreground">MP3, MP4, WAV, FLAC, AIFF (max 100MB)</span>
          )}
          {accept.includes('image') && (
            <span className="text-xs text-muted-foreground">JPG, PNG (max 50MB)</span>
          )}
        </div>
      )}
      {value && (
        <div className="w-full">
          <div className="flex justify-between items-center">
            <span className="truncate text-sm">{value.name}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null) }}
              className="text-destructive hover:bg-destructive/10 p-1 rounded-full ml-2"
            ><Minus className="w-4 h-4" /></button>
          </div>
          {previewType === 'image' && (
            <img src={URL.createObjectURL(value)} className="mt-2 w-full rounded-lg object-cover max-h-40" alt="preview" />
          )}
          {previewType === 'audio' && (
            <audio controls src={URL.createObjectURL(value)} className="mt-2 w-full" />
          )}
          {previewType === 'video' && (
            <video controls src={URL.createObjectURL(value)} className="mt-2 w-full max-h-40" />
          )}
        </div>
      )}
    </div>
  )
}

const mintSteps = [
  { title: 'Upload Files', description: 'Upload your artwork files in the required formats' },
  { title: 'NFT Details', description: 'Add title, description, and other metadata' },
  { title: 'Seed & Copies', description: 'Configure your Seed Pool' },
  { title: 'Preview', description: 'Review your NFT before minting' },
]

type Track = {
  cover: File | null
  video: File | null
  audio: { mp3: File | null }
  metadata: {
    artist: string
    songName: string
    albumName: string
    style: string
    year: string
    trackNumber: string
    description: string
    collection: string
  }
  copies: number
  trackImage?: File | null // for bundles
}

const blankTrack: Track = {
  cover: null,
  video: null,
  audio: { mp3: null },
  copies: 1,
  metadata: {
    artist: '',
    songName: '',
    albumName: '',
    style: '',
    year: '',
    trackNumber: '',
    description: '',
    collection: '',
  },
}

export default function UploadYourMusic() {
  const wallet = useWallet()
  const { publicKey: unifiedPublicKey, connected: unifiedConnected, sendTransaction: unifiedSendTransaction, signTransaction: unifiedSignTransaction } = useUnifiedWallet();
  const effectivePublicKey = (wallet.connected && wallet.publicKey) ? wallet.publicKey : unifiedPublicKey;
  const effectiveConnected = wallet.connected || unifiedConnected;
  const effectiveSendTx = (wallet.connected && wallet.sendTransaction) ? wallet.sendTransaction : unifiedSendTransaction;
  const effectiveSignTx = (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction;
  const publicKey = effectivePublicKey;
  const connected = effectiveConnected;

  // wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [isBundle, setIsBundle] = useState(false)
  const [numTracks, setNumTracks] = useState(1)
  const [tracks, setTracks] = useState<Track[]>([{ ...blankTrack }])
  const [skipDeposit, setSkipDeposit] = useState(false)
  const [depositWoodeng, setDepositWoodeng] = useState('0')
  const [tokenType, setTokenType] = useState<'woodeng' | 'sol'>('woodeng')
  const [copies, setCopies] = useState('1')
  const [royalties, setRoyalties] = useState('5')
  const [ammFeePct, setAmmFeePct] = useState('0');   // AMM fee (%) for pooled trades
const [listingPrice, setListingPrice] = useState('0');   // Fixed price when Skip Deposit = listing

  const [minting, setMinting] = useState(false)
  const [mintedAddrs, setMintedAddrs] = useState<string[]>([])
  const [poolAddr, setPoolAddr] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [albumMeta, setAlbumMeta] = useState({ albumName: '', year: '' })



  // ADD: build object URLs for the hero preview
const heroImages = React.useMemo(() => {
  const files = isBundle
    ? tracks.map(t => t.trackImage || t.cover).filter(Boolean)
    : [tracks[0]?.cover].filter(Boolean);
  return files.map(f => URL.createObjectURL(f as File));
}, [tracks, isBundle]);

// cleanup object URLs to avoid memory leaks
React.useEffect(() => {
  return () => {
    heroImages.forEach(u => { try { URL.revokeObjectURL(u) } catch {} });
  };
}, [heroImages]);


  // Checkbox terms
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false)

  // success pop-up
  const [successModal, setSuccessModal] = useState<{ open: boolean; pool?: string }>(() => ({ open: false }))

  // Stepper logic
  const next = () => setCurrentStep(s => Math.min(s + 1, 3))
  const prev = () => setCurrentStep(s => Math.max(s - 1, 0))

  // Track management
  const updateTrack = (i: number, data: Partial<Track>) =>
    setTracks(ts => {
      const copy = [...ts]
      copy[i] = { ...copy[i], ...data }
      return copy
    })
  const updateMeta = (i: number, k: keyof Track['metadata'], v: string) =>
    updateTrack(i, { metadata: { ...tracks[i].metadata, [k]: v } })

  const addTrack = () => {
  if (tracks.length >= 20) return
  setTracks([...tracks, { ...blankTrack }])
}


  const removeTrack = (i: number) => {
    if (tracks.length > 1) setTracks(tracks.filter((_, idx) => idx !== i))
  }

  // --- Main Mint Logic ---
  async function mintNFT() {
    setFormError(null)
    if (!connected || !publicKey) {
      setFormError('Please connect your wallet')
      return
    }

    const anchorWalletEff = {
      ...wallet,
      publicKey: effectivePublicKey,
      connected: effectiveConnected,
      signTransaction: ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : effectiveSignTx) as any,
      signAllTransactions: ((wallet.connected && wallet.signAllTransactions) ? wallet.signAllTransactions : ((txs: any[]) => Promise.all(txs.map((tx: any) => ((wallet.connected && wallet.signTransaction) ? wallet.signTransaction : effectiveSignTx)(tx))))) as any,
    };

    const missingFile = tracks.some(t => {
      const hasImage = isBundle ? !!t.trackImage : !!t.cover;
      return !hasImage || !t.audio?.mp3;
    })
    if (missingFile) {
      setFormError('Each track needs an image and audio file')
      return;
    }
    if (!ownershipConfirmed || !termsAccepted) {
      setFormError('Please accept the terms and confirm ownership')
      return
    }
    setMinting(true)
    setMintedAddrs([])
    setPoolAddr(null)


    function toRaw(amountUi: string, decimals: number): number {
  const v = parseFloat(amountUi || '0') || 0;
  if (v <= 0) throw new Error('Listing price must be > 0');
  return Math.round(v * 10 ** decimals);
}


    try {
      // Normalize initial deposit based on the chosen mint's decimals (wSOL=9, WOODENG may differ)
      const tokenMint = (tokenType === 'sol') ? WSOL_MINT : WOODENG_MINT;
      const tmpConn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string, 'confirmed');
      const mintInfo = await getMint(tmpConn, tokenMint);
      const decimals = mintInfo.decimals;

      const uiAmount = parseFloat(depositWoodeng || '0') || 0;
      const depositRawBn = new BN(Math.round(uiAmount * 10 ** decimals).toString());
      const depositRaw = depositRawBn.toNumber();

      if (!skipDeposit && depositRaw <= 0) {
        throw new Error('Initial deposit must be > 0');
      }

      // Pools in your UI have no royalties; keep 0. (Change if you want pool fees.)
      const poolRoyaltyBps = Math.round((parseFloat(ammFeePct || '0') || 0) * 100);


      // 1) Pin raw assets & metadata
      const uris: string[] = []
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i]
        const coverFile = isBundle ? t.trackImage : t.cover
        if (!coverFile) throw new Error(`Missing cover/track image for track ${i + 1}`)
        const coverCid = await pinFile(coverFile)
        const imageURI = `ipfs://${coverCid}`

        let videoURI = ''
if (t.video) {
  const videoCid = await pinFile(t.video)
  videoURI = `ipfs://${videoCid}`
}

let audioURI = ''
if (t.audio.mp3) {
  const audioCid = await pinFile(t.audio.mp3)
  audioURI = `ipfs://${audioCid}`
}

// Standard: put AUDIO in animation_url so indexers see it's playable music
// (If you also have a video, keep it in properties.files)
const files: Array<{ uri: string; type?: string }> = []
if (audioURI) files.push({ uri: audioURI, type: 'audio/mpeg' })
if (videoURI) files.push({ uri: videoURI, type: 'video/mp4' })

const yearToUse = isBundle ? (albumMeta.year || t.metadata.year) : t.metadata.year

const meta: any = {
  name: t.metadata.songName,
  symbol: 'MUSIC',
  description: t.metadata.description,
  image: imageURI,
  animation_url: audioURI || undefined,   // 👈 ALWAYS set audio here when present
  properties: {
    category: 'audio',                    // 👈 helps some indexers
    files,                                // 👈 include files array
    ...t.metadata,
    year: yearToUse,
  },
}


        const blob = new Blob([JSON.stringify(meta)], { type: 'application/json' })
        const fileJson = new File([blob], `meta-${i}.json`, { type: 'application/json' })
        const metaCid = await pinFile(fileJson)
        uris.push(`ipfs://${metaCid}`)
      }

      // 2) Mint via Metaplex
      const mx = Metaplex.make(new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string, 'finalized')).use(walletAdapterIdentity(anchorWalletEff as any))
      const nCopies = Math.max(1, parseInt(copies, 10))
      const minted: PublicKey[] = []

      if (isBundle) {
  // ONE mint per track (SFT), with `copies` supply
  for (let i = 0; i < uris.length; i++) {
    const { sft } = await mx.nfts().createSft({
      uri: uris[i],
      name: tracks[i].metadata.songName,
      symbol: 'MUSIC',
      sellerFeeBasisPoints: skipDeposit ? Math.round((parseFloat(royalties || '0') || 0) * 100) : 0,
      creators: [{ address: publicKey, share: 100 }],
      decimals: 0,
      tokenOwner: publicKey,
      tokenAmount: token(nCopies, 0),  // mint `copies` to you
    })
    minted.push(sft.address)
  }
} else {
  const { sft } = await mx.nfts().createSft({
    uri: uris[0],
    name: tracks[0].metadata.songName,
    symbol: 'MUSIC',
    sellerFeeBasisPoints: 0,
    creators: [{ address: publicKey, share: 100 }],
    decimals: 0,
    tokenOwner: publicKey,
    tokenAmount: token(1, 0),
  })
  minted.push(sft.address)
  const extra = Math.max(0, nCopies - 1)
  if (extra > 0) {
    const ata = await ensureQuoteAtaAndMaybeWrap(mx.connection, publicKey, sft.address, anchorWalletEff as any, 0);
    await mx.tokens().mint({
      mintAddress: sft.address,
      amount: token(extra, 0),
      toToken: ata,
    })
  }
}


      setMintedAddrs(minted.map(pk => pk.toBase58()))

      if (skipDeposit) {
        // Auto-list freshly minted NFT(s)
const conn3 = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string, 'confirmed');
const provider3 = new AnchorProvider(conn3, anchorWalletEff as any, {});
const prog3 = new Program(idl as any, PROGRAM_ID, provider3);

const quoteMint = (tokenType === 'sol') ? WSOL_MINT : WOODENG_MINT;
const quoteMintInfo = await getMint(conn3, quoteMint);
const quoteDecimals = quoteMintInfo.decimals;

const rawPrice = toRaw(listingPrice, quoteDecimals);

const orderRoyaltyBps = Math.round((parseFloat(royalties || '0') || 0) * 100);

for (let i = 0; i < minted.length; i++) {
  const mintAddr = minted[i];
  const nftAta = await getAssociatedTokenAddress(new PublicKey(mintAddr), publicKey!);

  const orderIdBn = new BN(Date.now()).add(new BN(i));

  const [orderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('order'), new PublicKey(mintAddr).toBuffer(), publicKey!.toBuffer(), Buffer.from(orderIdBn.toArray('le', 8))],
    PROGRAM_ID
  );
  const [escrowAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), orderPda.toBuffer()],
    PROGRAM_ID
  );
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), orderPda.toBuffer()],
    PROGRAM_ID
  );

  const sellerTokenAta = await getAssociatedTokenAddress(quoteMint, publicKey!);
  const creatorTokenAta = await getAssociatedTokenAddress(quoteMint, publicKey!);

  const preIxsList: TransactionInstruction[] = [];
  const stSeller = await conn3.getAccountInfo(sellerTokenAta);
  if (!stSeller) preIxsList.push(createAssociatedTokenAccountInstruction(publicKey!, sellerTokenAta, publicKey!, quoteMint));
  const stCreator = await conn3.getAccountInfo(creatorTokenAta);
  if (!stCreator) preIxsList.push(createAssociatedTokenAccountInstruction(publicKey!, creatorTokenAta, publicKey!, quoteMint));

  await prog3.methods
    .listOrder(orderIdBn, new BN(rawPrice), publicKey!, orderRoyaltyBps)
    .accounts({
      order: orderPda,
      escrowAuthority: escrowAuth,
      escrow: escrowPda,
      seller: publicKey!,
      userNftAta: nftAta,
      nftMint: new PublicKey(mintAddr),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .preInstructions(preIxsList)
    .rpc();
}



        setSuccessModal({ open: true })
      }

      // 3) create & seed AMM pool on-chain via Anchor
      if (!skipDeposit) {
        const conn2 = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string, 'confirmed')
        const provider2 = new AnchorProvider(conn2, anchorWalletEff as any, {})
        const prog2 = new Program(idl as any, PROGRAM_ID, provider2)

        const depLam = new BN(depositRaw);

        if (isBundle) {
          const bundleIdBn = new BN(Date.now())
          const idBuf = Buffer.from(bundleIdBn.toArray('le', 8))
          const [bundlePda, bundleBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('bundle_config'), publicKey!.toBuffer(), idBuf],
            PROGRAM_ID
          )
          const [bundleSigner] = PublicKey.findProgramAddressSync(
            [Buffer.from('bundle_signer'), bundlePda.toBuffer()],
            PROGRAM_ID
          )
          const tokenVaultPda = PublicKey.findProgramAddressSync(
            [Buffer.from('bundle_token_vault'), bundlePda.toBuffer()],
            PROGRAM_ID
          )[0]

          const tokenMint = (tokenType === 'sol') ? WSOL_MINT : WOODENG_MINT;
          const payerTokenAta = await getAssociatedTokenAddress(tokenMint, publicKey!);

          const preIxs: TransactionInstruction[] = [];
          const ataInfo = await conn2.getAccountInfo(payerTokenAta);
          if (!ataInfo) {
            preIxs.push(createAssociatedTokenAccountInstruction(publicKey!, payerTokenAta, publicKey!, tokenMint));
          }
          if (tokenType === 'sol' && depositRaw > 0) {
            preIxs.push(SystemProgram.transfer({ fromPubkey: publicKey!, toPubkey: payerTokenAta, lamports: depositRaw }));
            preIxs.push(createSyncNativeInstruction(payerTokenAta));
          }

          const postIxs: TransactionInstruction[] = [];
          if (tokenType === 'sol') {
            postIxs.push(createCloseAccountInstruction(payerTokenAta, publicKey!, publicKey!));
          }

          const initSig = await prog2.methods
  .initializeBundle(
    bundleIdBn,
    new BN(1),
    new BN(0),
    depLam,
    poolRoyaltyBps
  )
  .accounts({
    bundle: bundlePda,
    bundleSigner,
    tokenVault: tokenVaultPda,
    payerTokenAta,
    tokenMint,
    payer: publicKey!,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .preInstructions(preIxs)
  .postInstructions(postIxs)
  .rpc();

await conn2.confirmTransaction(initSig, 'finalized');  // ✅ finalized before continuing


          for (let i = 0; i < minted.length; i++) {
  const mint = minted[i]
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('nft_vault'), bundlePda.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  )
  await prog2.methods.addToBundle()
    .accounts({
      bundle: bundlePda,
      authority: publicKey!,
      bundleSigner,
      vault: vaultPda,
      mint,
      payer: publicKey!,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc()
}

          setPoolAddr(bundlePda.toBase58())
          setSuccessModal({ open: true, pool: bundlePda.toBase58() })

        } else {
          const poolKP = Keypair.generate()
          const [poolSigner] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault'), poolKP.publicKey.toBuffer()],
            PROGRAM_ID
          )
          const [nftVault] = PublicKey.findProgramAddressSync(
            [Buffer.from('nft_vault'), poolKP.publicKey.toBuffer(), Uint8Array.of(0)],
            PROGRAM_ID
          )
          const [tokenVault] = PublicKey.findProgramAddressSync(
            [Buffer.from('token_vault'), poolKP.publicKey.toBuffer()],
            PROGRAM_ID
          )

          const tokenMint = (tokenType === 'sol') ? WSOL_MINT : WOODENG_MINT;
          const payerTokenAta = await getAssociatedTokenAddress(tokenMint, publicKey!);

          const preIxs: TransactionInstruction[] = [];
          const ataInfo = await conn2.getAccountInfo(payerTokenAta);
          if (!ataInfo) {
            preIxs.push(createAssociatedTokenAccountInstruction(publicKey!, payerTokenAta, publicKey!, tokenMint));
          }
          if (tokenType === 'sol' && depositRaw > 0) {
            preIxs.push(SystemProgram.transfer({ fromPubkey: publicKey!, toPubkey: payerTokenAta, lamports: depositRaw }));
            preIxs.push(createSyncNativeInstruction(payerTokenAta));
          }

          const postIxs: TransactionInstruction[] = [];
          if (tokenType === 'sol') {
            postIxs.push(createCloseAccountInstruction(payerTokenAta, publicKey!, publicKey!));
          }

          const sig = await prog2.methods
  .createPool(
    new BN(1),
    new BN(0),
    depLam,
    publicKey!,
    poolRoyaltyBps
  )
  .accounts({
    pool: poolKP.publicKey,
    poolSigner,
    nftVault,
    tokenVault,
    payerTokenAta,
    nftMint: minted[0],
    tokenMint,
    payer: publicKey!,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([poolKP])
  .preInstructions(preIxs)
  .postInstructions(postIxs)
  .rpc();

await conn2.confirmTransaction(sig, 'finalized');      // ✅ wait until finalized

setPoolAddr(poolKP.publicKey.toBase58())
setSuccessModal({ open: true, pool: poolKP.publicKey.toBase58() })

        }
      }
    } catch (err: any) {
      console.error('❌ mintNFT error:', err)
      setFormError(err instanceof Error ? err.message : JSON.stringify(err, null, 2))
    } finally {
      setMinting(false)
    }
  }

  // -- MAIN UI --
  if (!connected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Create Your NFT</h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-lg mx-auto">
            Connect your wallet to start minting your unique music NFT
          </p>
        </div>
        <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !px-6 !py-2.5 sm:!px-8 sm:!py-3 !text-base sm:!text-lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* ─── Success pop-up ─── */}
      {successModal.open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSuccessModal({ open: false })}
        >
          <div
            className="relative bg-[#1b1c20] rounded-xl p-6 sm:p-8 w-full max-w-sm text-center mx-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-4 text-xl"
              onClick={() => setSuccessModal({ open: false })}
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="text-2xl font-bold mb-4">Musical&nbsp;NFT created!</h2>

            {successModal.pool && (
              <p className="break-all text-xs bg-[#23252b] rounded p-3 mb-6">
                {successModal.pool}
              </p>
            )}

            <div className="space-y-3">
              {skipDeposit ? (
                <Link
                  href={`/list-nft/${mintedAddrs[0]}`}
                  className="block w-full py-3 rounded bg-[#ffc371] text-black font-bold hover:bg-[#ffb24d] text-center"
                  onClick={() => setSuccessModal({ open: false })}
                >
                  List for Sale
                </Link>
              ) : (
                <Link
                  href={`/amm?addr=${successModal.pool}`}
                  className="block w-full py-3 rounded bg-[#ffc371] text-black font-bold hover:bg-[#ffb24d] text-center"
                  onClick={() => setSuccessModal({ open: false })}
                >
                  Go to your pool
                </Link>
              )}

              <button
                className="w-full py-3 rounded bg-muted text-muted-foreground hover:bg-muted/80"
                onClick={() => {
                  setCurrentStep(0)
                  setTracks([{ ...blankTrack }])
                  setAlbumMeta({ albumName: '', year: '' })
                  setMintedAddrs([])
                  setPoolAddr(null)
                  setSuccessModal({ open: false })
                  setOwnershipConfirmed(false)
                  setTermsAccepted(false)
                }}
              >
                Mint another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Back to Selection --- */}
      <Link href="/create" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to selection
      </Link>

      {/* --- Header --- */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Create Musical NFT</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create your unique music NFT with liquidity pool</p>
        </div>

        {/* --- Step Progression --- */}
        {/* Mobile: compact progress */}
        <div className="md:hidden mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Step {currentStep + 1} of {mintSteps.length}</p>
            <span className="text-sm text-muted-foreground">{mintSteps[currentStep].title}</span>
          </div>
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(currentStep / (mintSteps.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop: detailed stepper */}
        <div className="hidden md:block mb-12">
          <div className="flex items-center justify-between relative">
            {mintSteps.map((step, index) => (
              <div
                key={index}
                className="flex flex-col items-center relative z-10 w-1/4 transition-colors duration-300"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 transition-colors duration-300",
                    index === currentStep
                      ? "border-primary bg-primary text-primary-foreground"
                      : index < currentStep
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground bg-background text-muted-foreground"
                  )}
                >
                  {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : <span>{index + 1}</span>}
                </div>
                <div className="text-center">
                  <p className={cn("font-medium", index === currentStep ? "text-primary" : "text-muted-foreground")}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
            <div className="absolute top-5 left-0 right-0 h-[2px] bg-muted z-0">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(currentStep / (mintSteps.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* --- Step Content --- */}
        <div className="space-y-8">
          {/* STEP 1: Upload Files */}
          <div className={currentStep !== 0 ? 'hidden' : ''}>
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={isBundle}
                    onChange={() => {
                      const nxt = !isBundle
                      setIsBundle(nxt)
                      setNumTracks(nxt ? 2 : 1)
                      setTracks(Array(nxt ? 2 : 1).fill(null).map(() => ({ ...blankTrack })))
                    }}
                    id="isBundle"
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  Create Album Bundle
                </label>

                {isBundle && (
                  <button
                    type="button"
                    onClick={addTrack}
                    className="py-2 px-4 border-2 border-dashed border-border hover:border-primary rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Track
                  </button>
                )}
              </div>

              {tracks.map((track, i) => (
                <div key={i} className="border border-border rounded-lg p-4 space-y-4 mb-6 relative">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Track {i + 1}</h3>
                    {isBundle && tracks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrack(i)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-foreground">Image</label>
                      <FileDrop
                        label={`track_${i}_image`}
                        value={isBundle ? track.trackImage || null : track.cover}
                        onChange={file => isBundle ? updateTrack(i, { trackImage: file }) : updateTrack(i, { cover: file })}
                        accept="image/*"
                        required
                        previewType="image"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-foreground">Audio</label>
                      <FileDrop
                        label={`track_${i}_audio`}
                        value={track.audio.mp3}
                        onChange={file => updateTrack(i, { audio: { mp3: file } })}
                        accept="audio/mp3,audio/mpeg,audio/wav"
                        required
                        previewType="audio"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 2: NFT Details */}
<div className={currentStep !== 1 ? 'hidden' : ''}>
  <div className="space-y-4">
    {tracks.map((track, i) => (
      <div key={i} className="bg-muted/50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Track {i + 1}</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Song Name</label>
            <input
              type="text"
              value={track.metadata.songName}
              onChange={e => updateMeta(i, 'songName', e.target.value)}
              className="w-full px-4 py-2 bg-[#181926] text-white border border-[#24273a] rounded-lg focus:outline-none focus:border-[#cba6f7]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Artist Name</label>
            <input
              type="text"
              value={track.metadata.artist}
              onChange={e => updateMeta(i, 'artist', e.target.value)}
              className="w-full px-4 py-2 bg-[#181926] text-white border border-[#24273a] rounded-lg focus:outline-none focus:border-[#cba6f7]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Style</label>
            <input
              type="text"
              value={track.metadata.style}
              onChange={e => updateMeta(i, 'style', e.target.value)}
              className="w-full px-4 py-2 bg-[#181926] text-white border border-[#24273a] rounded-lg focus:outline-none focus:border-[#cba6f7]"
              placeholder="e.g. Electronic, Hip Hop, Jazz"
              required
            />
          </div>

          {/* ✅ Release Year — maintenant toujours visible */}
          <div>
            <label className="block text-sm font-medium mb-1">Release Year</label>
            <input
              type="number"
              value={isBundle ? albumMeta.year : track.metadata.year}
              onChange={e => {
                const v = e.target.value;
                if (isBundle) setAlbumMeta({ ...albumMeta, year: v });
                else updateMeta(i, 'year', v);
              }}
              className="w-full px-4 py-2 bg-[#181926] text-white border border-[#24273a] rounded-lg focus:outline-none focus:border-[#cba6f7]"
              placeholder="2024"
              required
            />
          </div>

          {/* Champ Collection: seulement en single */}
          {!isBundle && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Collection</label>
              <input
                type="text"
                value={track.metadata.collection}
                onChange={e => updateMeta(i, 'collection', e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-lg focus:border-primary text-sm"
                placeholder="Enter collection name"
              />
            </div>
          )}

          {/* Champs Album (uniquement bundle) */}
          {isBundle && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Album Name</label>
                <input
                  type="text"
                  value={albumMeta.albumName}
                  onChange={e => setAlbumMeta({ ...albumMeta, albumName: e.target.value })}
                  className="w-full px-4 py-2 bg-[#181926] text-white border border-[#24273a] rounded-lg focus:outline-none focus:border-[#cba6f7]"
                  required
                />
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={track.metadata.description}
            onChange={e => updateMeta(i, 'description', e.target.value)}
            rows={2}
            className="w-full px-3 py-1.5 bg-card border rounded-lg transition-colors resize-none text-sm"
            required
          />
        </div>
      </div>
    ))}
  </div>
</div>


          {/* STEP 3: Seed & Copies */}
          <div className={currentStep !== 2 ? 'hidden' : ''}>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Number of Copies</h3>
                <div className="bg-muted/50 rounded-lg p-4">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={copies}
                    onChange={e => setCopies(e.target.value)}
                    className="w-full px-4 py-2 bg-card border rounded-lg transition-colors"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">NFT Copies</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-medium">Pool Token</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="woodeng"
                      checked={tokenType === 'woodeng'}
                      onChange={() => setTokenType('woodeng')}
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-primary" />
                      <span>WOODENG</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="sol"
                      checked={tokenType === 'sol'}
                      onChange={() => setTokenType('sol')}
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-[#14F195]" />
                      <span>SOL</span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select the token you want to use for your liquidity pool
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Initial Deposit ({tokenType.toUpperCase()})
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={depositWoodeng}
                  onChange={e => setDepositWoodeng(e.target.value)}
                  disabled={skipDeposit}
                  className={cn(
                    "w-full px-4 py-2 bg-card border rounded-lg transition-colors",
                    skipDeposit && "opacity-50"
                  )}
                />
              </div>

              {!skipDeposit && (
  <div>
    <label className="block text-sm font-medium mb-2">
      AMM Trade Fee (%) <span className="text-xs text-muted-foreground">(split 70% creator / 30% stakers)</span>
    </label>
    <input
      type="number"
      min="0"
      max="15"
      step="0.1"
      value={ammFeePct}
      onChange={e => setAmmFeePct(e.target.value)}
      className="w-full px-4 py-2 bg-card border rounded-lg transition-colors"
    />
    <p className="mt-1 text-xs text-muted-foreground">
      Applied to each AMM trade in your pool/bundle.
    </p>
  </div>
)}


              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDeposit}
                  onChange={e => setSkipDeposit(e.target.checked)}
                  id="skipDeposit"
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <label htmlFor="skipDeposit" className="text-sm font-medium">
                  Skip Deposit
                </label>
              </div>

              {skipDeposit && (
  <div className="mt-4">
    <label className="block text-sm font-medium mb-2">
      Listing Price ({tokenType.toUpperCase()})
    </label>
    <input
      type="number"
      min="0"
      step="0.000001"
      value={listingPrice}
      onChange={e => setListingPrice(e.target.value)}
      className="w-full px-4 py-2 bg-card border rounded-lg transition-colors"
    />
  </div>
)}


              {skipDeposit && (
                <div>
                  <label className="block text-sm font-medium mb-2">Royalties (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="0.1"
                    value={royalties}
                    onChange={e => setRoyalties(e.target.value)}
                    className="w-full px-4 py-2 bg-card border rounded-lg transition-colors"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Set royalties up to 15% for secondary sales</p>
                </div>
              )}

              {!skipDeposit && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="w-4 h-4 text-primary" />
                    <p>
                      NFTs minted with a pool do not have royalties. The pool provides liquidity and trading opportunities instead.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 4: Preview & Mint */}
<div className={currentStep !== 3 ? 'hidden' : ''}>
  <div className="bg-card border border-border rounded-lg p-6">
    <h3 className="text-xl font-semibold mb-6">Preview Your NFT</h3>
    <div className="space-y-8">

      {/* ✅ Mosaïque seulement si bundle ET plus d'un track */}
      {isBundle && tracks.length > 1 && (
        <MosaicPreview
          images={heroImages}
          aspect="video"
          overlay={{ title: albumMeta.albumName || 'Album', subtitle: albumMeta.year || '' }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tracks.map((track, index) => (
          <div key={index} className="bg-muted/50 rounded-lg overflow-hidden">
            <div className="aspect-square relative">
              {/* ✅ En bundle, on enlève l’image cover par track */}
              {!isBundle && ( (track.cover) && (
                <img
                  src={URL.createObjectURL(track.cover as File)}
                  alt={`Track ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ))}
            </div>

            <div className="p-4">
              <h4 className="font-semibold mb-1">{track.metadata.songName}</h4>
              <p className="text-sm text-muted-foreground mb-2">{track.metadata.artist}</p>

             <div className="mt-1 flex items-baseline gap-2 text-sm leading-none">
  {/* style en violet */}
  <span className="text-primary">{track.metadata.style || '-'}</span>

  {/* séparateurs discrets */}
  <span className="opacity-50">•</span>

  {/* copies (même typo) */}
  <span className="tabular-nums">
    {Number(copies)} {Number(copies) === 1 ? 'copy' : 'copies'}
  </span>

  <span className="opacity-50">•</span>

  {/* année (même typo) */}
  <span className="tabular-nums">
    {isBundle ? (albumMeta.year || '-') : (track.metadata.year || '-')}
  </span>
</div>



              {track.metadata.description && (
                <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {track.metadata.description}
                </div>
              )}
              {track.metadata.collection && !isBundle && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Collection: </span>
                  <span className="font-medium">{track.metadata.collection}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Pool Token</h4>
                  <div className="flex items-center gap-2">
                    <Coins className={cn("w-5 h-5", tokenType === 'woodeng' ? "text-primary" : "text-[#14F195]")} />
                    <p className="text-xl font-semibold">{tokenType === 'woodeng' ? 'WOODENG' : 'SOL'}</p>
                  </div>
                </div>

                {!skipDeposit && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Initial Deposit</h4>
                    <p className="text-xl font-semibold">{depositWoodeng} {tokenType === 'woodeng' ? 'WOODENG' : 'SOL'}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      NFTs minted with a pool do not have royalties. The pool provides liquidity and trading opportunities instead.
                    </p>
                  </div>
                )}
                {skipDeposit && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Royalties</h4>
                    <p className="text-xl font-semibold">{royalties}%</p>
                  </div>
                )}

                <div className="space-y-4 border-t border-border pt-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ownershipConfirmed}
                      onChange={e => setOwnershipConfirmed(e.target.checked)}
                      id="ownershipConfirmed"
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">
                      I confirm that I own this music/these tracks or have permission to upload them
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                      id="termsAccepted"
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">
                      I agree to the <a href="/terms" className="text-primary hover:underline" target="_blank">Terms of Service</a>
                    </span>
                  </label>
                </div>

                {mintedAddrs.length > 0 && (
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="w-5 h-5" />
                      <p className="font-medium">Successfully Minted:</p>
                      <ul className="text-xs break-all">
                        {mintedAddrs.map(a => <li key={a}>{a}</li>)}
                      </ul>
                    </div>
                    {poolAddr && (
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <p className="font-medium">New AMM pool: {poolAddr}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- Error Message --- */}
        {formError && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 mt-6">
            <AlertCircle className="w-5 h-5" />
            <p>{formError}</p>
          </div>
        )}

        {/* --- Stepper Navigation + Mint Button --- */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center mt-8">
          <button
            type="button"
            onClick={prev}
            className={cn(
              "px-5 py-2 rounded-lg transition-colors self-start sm:self-auto",
              currentStep === 0 ? "opacity-0 pointer-events-none" : "bg-muted hover:bg-muted/80"
            )}
          >
            Previous
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={next}
              className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={mintNFT}
              disabled={minting || !termsAccepted || !ownershipConfirmed}
              className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ minWidth: 200 }}
            >
              {minting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  {skipDeposit ? 'Create' : `Create & Seed ${tokenType === 'woodeng' ? 'WOODENG' : 'SOL'} Pool`}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
