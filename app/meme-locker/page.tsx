'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Connection, PublicKey, SystemProgram, Transaction, Keypair,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'


import {
  Program, AnchorProvider, BN, Idl,
} from '@project-serum/anchor'
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID, createInitializeMintInstruction, createMintToInstruction,
  createSetAuthorityInstruction, AuthorityType,
} from '@solana/spl-token'
import idlJson from '../../idl/hybrid_meme_coin_nft_locker.json'
import poolIdlJson from '../../idl/my_sound_meme_pool.json'
import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata';
import { findMetadataPda } from '@metaplex-foundation/js'
import { Siren as Fire, Info, Coins } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LiquidChargeButton } from "../../src/contexts/components/LiquidChargeButton"
import { useRouter } from 'next/navigation'



const PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS')
const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV')
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad')
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const BONDING_SUPPLY = 444_000_000;



// ──────────────────────────────────────────────────────────────
//  sendTx - helper: signs, sends, retries duplicate gracefully
// ──────────────────────────────────────────────────────────────
// AFTER  (accepts any signer-capable wallet)
// -----------------------------------------------------------
// 1⃣  Relax the helper-wallet interface
// -----------------------------------------------------------
type SignerWallet = {
  publicKey: PublicKey | null;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
};

export async function sendTx(
  connection: Connection,
  wallet: SignerWallet,
  tx: Transaction,
  extraSigners: Keypair[] = []
) {
  if (!wallet.publicKey) throw new Error('Wallet has no public key');

  /* 1️⃣  finalize the header BEFORE anyone signs */
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized');

  tx.feePayer        = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  /* 2️⃣  wallet signs */
  const signedByWallet =
    wallet.signTransaction
      ? await wallet.signTransaction(tx)
      : (await wallet.signAllTransactions!([tx]))[0];

  /* 3️⃣  extra keypairs (if any) sign AFTER the wallet */
  if (extraSigners.length) signedByWallet.partialSign(...extraSigners);

  /* 4️⃣  send + confirm */
  const sig = await connection.sendRawTransaction(
    signedByWallet.serialize(),
    { skipPreflight: false }
  );

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return sig;
}




const WOODENG_DECIMALS = 9;
const MEME_DECIMALS = 0;


type LockerResult = {
  memeName: string
  memeMint: PublicKey
  nftMint: PublicKey
  threshold: BN
  lockerPda: PublicKey
  [key: string]: any
} | null

type FileUploaderProps = {
  onUri?: (uri: string, fileType: string) => void
}

type StepModalProps = {
  open: boolean
  step: string
  onClose?: () => void
}

async function ensureAtaExists(
  owner: PublicKey,
  mint: PublicKey,
  payer: PublicKey,
  wallet: WalletContextState,        // 👈 add param
  isPdaOwner = false
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner, isPdaOwner)
  const info = await connection.getAccountInfo(ata)
  if (!info) {
    const ix = createAssociatedTokenAccountInstruction(
  payer, // payer
  ata,   // ata
  owner, // owner
  mint,  // mint
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
    const tx = new Transaction().add(ix)
    tx.feePayer = payer
    // AFTER   — pass the WalletContextState you already have
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
// the wallet that called ensureAtaExists signs the tx
  try {
    await sendTx(connection, wallet, tx)
  } catch (err: any) {
    // RPC may return “address already in use” if another tx made the ATA first.
    if (!/already in use/i.test(err?.message ?? '')) throw err
  }

    
  }
  return ata
}



async function getLockerPda(memeMint: PublicKey, nftMint: PublicKey): Promise<[PublicKey, number]> {
  return await PublicKey.findProgramAddress(
    [Buffer.from('locker'), memeMint.toBuffer(), nftMint.toBuffer()],
    PROGRAM_ID
  )
}
async function getConfigPda(memeMint: PublicKey) {
  return await PublicKey.findProgramAddress([Buffer.from('config'), memeMint.toBuffer()], POOL_PROGRAM_ID)
}
function getPoolMemeVaultPda(memeMint: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'), memeMint.toBuffer()], POOL_PROGRAM_ID)
}
function getPoolWoodengVaultPda(memeMint: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), memeMint.toBuffer()], POOL_PROGRAM_ID)
}

async function setNftMintAuthorityToLocker(
  wallet: WalletContextState,
  nftMint: PublicKey,
  memeMint: PublicKey
): Promise<string> {
  const [lockerPda] = await getLockerPda(memeMint, nftMint)
  const setAuthorityIx = createSetAuthorityInstruction(
    nftMint,
    wallet.publicKey!,
    AuthorityType.MintTokens,
    lockerPda
  )
  const tx = new Transaction().add(setAuthorityIx)
  tx.feePayer = wallet.publicKey!
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  if (!wallet.signTransaction) throw new Error('Wallet does not support signTransaction')
  return await sendTx(connection, wallet, tx)
}

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
    body: form
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.message || 'Pinata upload failed')
  return `https://ipfs.io/ipfs/${data.IpfsHash}`
}

function FileUploader({ onUri }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    setError('')
    setUploading(true)
    try {
      const file = e.dataTransfer.files[0] as File
      if (!file) throw new Error('No file dropped!')
      if (!file.type.startsWith('audio/') && !file.type.startsWith('image/')) throw new Error('File must be audio or image')
      const uri = await pinFile(file)
      setFileUrl(uri)
      if (onUri) onUri(uri, file.type)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError(String(err))
    }
    setUploading(false)
  }, [onUri])

  const handleClick = () => inputRef.current?.click()
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setError('')
    setUploading(true)
    try {
      const file = e.target.files[0]
      if (!file.type.startsWith('audio/') && !file.type.startsWith('image/')) throw new Error('File must be audio or image')
      const uri = await pinFile(file)
      setFileUrl(uri)
      if (onUri) onUri(uri, file.type)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError(String(err))
    }
    setUploading(false)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        border: '2px dashed #FFC371',
        padding: 24,
        borderRadius: 8,
        background: dragOver ? '#FFC37133' : '#181920',
        color: 'white',
        marginBottom: 16,
        textAlign: 'center',
        cursor: 'pointer'
      }}>
      <input
        type="file"
        ref={inputRef}
        style={{ display: 'none' }}
        accept="audio/*,image/*"
        onChange={handleFileChange}
      />
      {uploading ? "Uploading..." : "Drop file here or click to select"}
      {fileUrl && (fileUrl.endsWith('.mp3') || fileUrl.includes('/audio')
        ? <audio controls src={fileUrl} style={{ width: "100%", marginTop: 12 }} />
        : <img src={fileUrl} alt="Uploaded" style={{ width: "100%", marginTop: 12 }} />)}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  )
}

async function createMintWithProvider(
  provider: AnchorProvider,
  decimals: number = 0,
  mintAuthority?: PublicKey
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate()
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(82)
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey!,
      newAccountPubkey: mintKeypair.publicKey,
      lamports,
      space: 82,
      programId: TOKEN_PROGRAM_ID
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      mintAuthority ?? provider.wallet.publicKey!,
      null,
      TOKEN_PROGRAM_ID
    )
  )
  tx.feePayer = provider.wallet.publicKey!
  tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
   // 👉 wallet signs first, then we add the mint keypair
 await sendTx(
   provider.connection,
   provider.wallet as WalletContextState,
   tx,
   [mintKeypair]           // ← extra signer goes here
 )
  return mintKeypair.publicKey
}

async function mintToWithProvider(
  provider: AnchorProvider,
  mint: PublicKey,
  destination: PublicKey,
  amount: number,
  mintAuthority?: PublicKey
): Promise<void> {
  const ix = createMintToInstruction(
    mint,
    destination,
    mintAuthority ?? provider.wallet.publicKey!,
    amount
  )
  const tx = new Transaction().add(ix)
  tx.feePayer = provider.wallet.publicKey!
  tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
  if (!provider.wallet.signTransaction) throw new Error('Wallet does not support signTransaction')
  await sendTx(provider.connection, provider.wallet, tx)
}

function StepModal({ open, step, onClose }: StepModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto">
      <div
        className="relative mx-4 w-full max-w-sm md:max-w-md lg:max-w-lg bg-[#1b1c20] rounded-xl shadow-lg p-8 flex flex-col items-center my-16"
        style={{ maxHeight: '90vh' }}
      >
        <span className="text-3xl mb-4">🚀</span>
        <p className="text-lg font-bold mb-4 text-center break-words">{step}</p>
        <button
          className="mt-2 text-sm px-4 py-2 rounded bg-[#fe9063] hover:bg-[#fd6e5a] text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ------- MAIN COMPONENT --------

export default function MemeLockerFactory() {
  const wallet = useWallet()
  const [stepModal, setStepModal] = useState<{ open: boolean, step: string }>({ open: false, step: "" })
  const [status, setStatus] = useState<string>("")
  const [searchAddress, setSearchAddress] = useState("")
  const [searchResult, setSearchResult] = useState<LockerResult>(null)

  // Meme details
  const [memeName, setMemeName] = useState("")
  const [memeSymbol, setMemeSymbol] = useState("")
  const [totalSupply, setTotalSupply] = useState(1_000_000)
  const [threshold, setThreshold] = useState(50000)
  const [memeDescription, setMemeDescription] = useState("")
  const [audioUri, setAudioUri] = useState("")
  const [fileType, setFileType] = useState("audio/mpeg")
  const [coverImageUri, setCoverImageUri] = useState("")

  // Pool Settings
  const [poolType, setPoolType] = useState<'bonding' | 'amm'>('bonding')
  


  const [initialMemeLiquidity, setInitialMemeLiquidity] = useState(10000)
  const [initialWoodengLiquidity, setInitialWoodengLiquidity] = useState(10000)

    /* ── si on repasse sur Bonding on force la liq. meme à 0 ── */
useEffect(() => {
  if (poolType === 'bonding') {
    setInitialMemeLiquidity(0);
    setInitialWoodengLiquidity(0);   // ← optional
  }
}, [poolType]);


useEffect(() => {
  if (poolType === 'bonding') {
    setTotalSupply(444_000_000);
  }
}, [poolType]);


  // Internals
  const [agreedTOS, setAgreedTOS] = useState(false)
  const [agreedOwn, setAgreedOwn] = useState(false)

  // success dialog
const [tradeModal, setTradeModal] = useState<{
  open: boolean
  memeMint?: PublicKey
  configPda?: PublicKey
}>(() => ({ open: false }))


const router = useRouter()


// ──────────────────────────────────────────────────────────────
//  Tiny helper – writes on-chain token-metadata for the MEME mint
// ──────────────────────────────────────────────────────────────
async function writeTokenMetadata(
  provider: AnchorProvider,
  mint: PublicKey,
  uri: string,
  name: string,
  symbol: string
) {
  const metadataPda = findMetadataPda(mint);

  const ix = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPda,
      mint,
      mintAuthority: provider.wallet.publicKey!,
      payer:         provider.wallet.publicKey!,
      updateAuthority: provider.wallet.publicKey!,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name,
          symbol,
          uri,
          sellerFeeBasisPoints: 0,
          creators:   null,
          collection: null,
          uses:       null,
        },
        isMutable: true,
        collectionDetails: null,   // ← required in mpl-token-metadata ≥1.10
      },
    },
  );

  await sendTx(
    provider.connection,
    provider.wallet as WalletContextState,
    new Transaction().add(ix)
  );
}




  // ========== CREATION STEPS ==========
  // ──────────────────────────────────────────────────────────────
//  FULL replacement for handleCreateAll()
// ──────────────────────────────────────────────────────────────
async function handleCreateAll() {
  try {
    // ---------- sanity checks ----------
    if (!wallet.connected || !wallet.publicKey)
      throw new Error("Connect your wallet first!");
    if (!memeName.trim() || !memeSymbol.trim() || !audioUri.trim())
      throw new Error("Fill all meme details and upload audio!");
    if (!agreedTOS || !agreedOwn)
      throw new Error("You must accept the terms to proceed.");

    const provider    = new AnchorProvider(connection, wallet as any,
                                           { preflightCommitment: "confirmed" });
    const poolProgram = new Program(poolIdlJson as Idl,
                                    POOL_PROGRAM_ID, provider);

    // ---------- STEP 1 – upload cover ----------
    setStepModal({ open:true, step:"Step 1/7: Uploading cover image…" });
    const imgCid = coverImageUri
      ? coverImageUri                                // already uploaded
      : await pinFile(new File([], "cover.png"));    // (should never trip)

    // ---------- STEP 2 – upload audio ----------
    setStepModal({ open:true, step:"Step 2/7: Uploading audio…" });
    const audioCid = audioUri;                       // FileUploader did this

    // ---------- STEP 3 – upload metadata.json ----------
    setStepModal({ open:true, step:"Step 3/7: Uploading metadata…" });
    const metaJson = {
      name: memeName,
      symbol: memeSymbol,
      description: memeDescription,
      image: imgCid,
      animation_url: audioCid,
      attributes: [{ trait_type:"Category", value:"Sound Meme" }],
    };
    const metaUri = await pinFile(
      new File([JSON.stringify(metaJson)],
               "metadata.json", { type:"application/json" })
    );

    // ---------- STEP 4 – create MEME mint ----------
    setStepModal({ open:true, step:"Step 4/7: Creating MEME mint…" });
    const memeMintKey = await createMintWithProvider(provider, 0,
                                                     wallet.publicKey);

    // ---------- STEP 5 – write token-metadata account ----------
    setStepModal({ open:true, step:"Step 5/7: Writing token metadata…" });
    await writeTokenMetadata(provider, memeMintKey,
                             metaUri, memeName, memeSymbol);

    // ---------- STEP 5½ – pre-mint tokens if AMM ----------
    const creatorMemeAta = await ensureAtaExists(
      wallet.publicKey, memeMintKey, wallet.publicKey, wallet, false);
    if (poolType === 'amm') {
      await mintToWithProvider(provider, memeMintKey, creatorMemeAta,
        initialMemeLiquidity * 10 ** MEME_DECIMALS, wallet.publicKey);
    }

    // ---------- STEP 6 – initialise pool ----------
setStepModal({ open:true, step:"Step 6/7: Initialising pool…" });

/** ▼▼▼ NEW ▼▼▼  **/
const VTOKENS_RAW = totalSupply * 10 ** MEME_DECIMALS;  // 444 000 000 for fair-launch
const vtokens     = new BN(VTOKENS_RAW);                // virtual MEME reserve

const P0_UI       = 0.0000009;           // 0.0000005 WOODENG (=  500 lamports)
const p0Lamports  = new BN(Math.floor(P0_UI * 10 ** WOODENG_DECIMALS));

const vwoodeng    = poolType === 'bonding'
  ? vtokens.mul(p0Lamports)                             // bonding needs both reserves
  : new BN(0);
/** ▲▲▲ NEW ▲▲▲  **/

const [configPda]        = await getConfigPda(memeMintKey);
const [poolMemeVault]    = await getPoolMemeVaultPda(memeMintKey);
const [poolWoodengVault] = await getPoolWoodengVaultPda(memeMintKey);
const lpMintKey          = await createMintWithProvider(provider, 0, configPda);


     await poolProgram.methods
  .initializeSoundMemeAndPool(
    vtokens,         // ❶ NEW – virtual MEME reserve
    vwoodeng,        // ❷ virtual WOODENG reserve (lamports)
    poolType === 'bonding',
    new BN(threshold),
  )
      .accounts({
        authority:     wallet.publicKey,
        config:        configPda,
        memeMint:      memeMintKey,
        poolMemeVault,
        poolWoodengVault,
        lpMint:        lpMintKey,
        woodengMint:   WOODENG_MINT,
        tokenProgram:  TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent:          SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // ---------- STEP 7 – add initial liquidity (AMM only) ----------
    if (poolType === 'amm') {
      setStepModal({ open:true, step:"Step 7/7: Adding initial liquidity…" });

      const userWoodengAta = await ensureAtaExists(
        wallet.publicKey, WOODENG_MINT, wallet.publicKey, wallet, false);
      const userLpAta = await ensureAtaExists(
        wallet.publicKey, lpMintKey, wallet.publicKey, wallet, false);

      await poolProgram.methods
        .addLiquidity(
          new BN(initialMemeLiquidity    * 10 ** MEME_DECIMALS),
          new BN(initialWoodengLiquidity * 10 ** WOODENG_DECIMALS),
        )
        .accounts({
          config:          configPda,
          poolMemeVault,
          poolWoodengVault,
          user:            wallet.publicKey,
          userMemeAta:     creatorMemeAta,
          userWoodengAta,
          lpMint:          lpMintKey,
          userLpAta,
          tokenProgram:    TOKEN_PROGRAM_ID,
        })
        .rpc();
    }

    // ---------- finished ----------
    setStepModal({ open:false, step:"" });
    setTradeModal({ open:true, memeMint:memeMintKey, configPda });
    setStatus("Sound Meme & Pool created!");
  } catch (e: any) {
    setStepModal({ open:true, step:"❌ Error: " + (e.message ?? e) });
    setStatus("Error: " + (e.message ?? e));
  }
}


  // ====== SEARCH BAR LOGIC: fetch meme by address ======
  async function handleSearch() {
    setSearchResult(null)
    setStatus("Searching...")
    try {
      const addr = new PublicKey(searchAddress.trim())
      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "confirmed" })
      const program = new Program(idlJson as Idl, PROGRAM_ID, provider)
      const locker = await program.account.lockerState.fetch(addr)
      setSearchResult({
        memeName: locker.memeName as string,
        memeMint: locker.memeMint as PublicKey,
        nftMint: locker.nftMint as PublicKey,
        threshold: locker.threshold as BN,
        lockerPda: addr,
        ...locker
      })
      setStatus("")
    } catch (e: unknown) {
      setStatus("Not found or invalid address.")
      setSearchResult(null)
    }
  }

  // ====== LOCK & MINT and BURN & UNLOCK ======
  async function lockTokensForMeme(locker: LockerResult) {
    if (!wallet.publicKey || !locker) return
    setStatus("Locking tokens & minting NFT...")
    try {
      const memeMint = locker.memeMint
      const nftMint = locker.nftMint
      const lockerPda = locker.lockerPda
      const userMemeToken = await ensureAtaExists(wallet.publicKey, memeMint, wallet.publicKey,wallet, false)
      const lockerMemeAccount = await ensureAtaExists(lockerPda, memeMint, wallet.publicKey,wallet, true)
      const userNftToken = await ensureAtaExists(wallet.publicKey, nftMint, wallet.publicKey,wallet, false)

      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "confirmed" })
      const program = new Program(idlJson as Idl, PROGRAM_ID, provider)
      await program.methods
        .lockTokensAndMintNft()
        .accounts({
          user: wallet.publicKey,
          userMemeAccount: userMemeToken,
          locker: lockerPda,
          lockerMemeAccount: lockerMemeAccount,
          nftMint,
          userNftAccount: userNftToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
      setStatus("Tokens locked and NFT minted!")
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function burnNftAndUnlockTokens(locker: LockerResult) {
    if (!wallet.publicKey || !locker) return
    setStatus("Burning NFT and unlocking tokens...")
    try {
      const memeMint = locker.memeMint
      const nftMint = locker.nftMint
      const lockerPda = locker.lockerPda
      const userMemeToken = await ensureAtaExists(wallet.publicKey, memeMint, wallet.publicKey,wallet, false)
      const lockerMemeAccount = await ensureAtaExists(lockerPda, memeMint, wallet.publicKey,wallet, true)
      const userNftToken = await ensureAtaExists(wallet.publicKey, nftMint, wallet.publicKey,wallet, false)

      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "confirmed" })
      const program = new Program(idlJson as Idl, PROGRAM_ID, provider)
      await program.methods
        .burnNftAndUnlockTokens()
        .accounts({
          user: wallet.publicKey,
          userMemeAccount: userMemeToken,
          locker: lockerPda,
          lockerMemeAccount: lockerMemeAccount,
          nftMint,
          userNftAccount: userNftToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
      setStatus("NFT burned and tokens unlocked!")
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)))
    }
  }

  // =========== UI ===========

  return (
    <div className="bg-[#181920] text-white min-h-screen py-12 px-2 flex flex-col items-center">
      <StepModal open={stepModal.open} step={stepModal.step} onClose={() => setStepModal({ open: false, step: "" })} />
      {tradeModal.open && tradeModal.memeMint && (
  <div
    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
    onClick={() => setTradeModal({ open: false })}
  >
    <div
      className="relative bg-[#1b1c20] rounded-xl p-8 w-full max-w-sm text-center"
      onClick={e => e.stopPropagation()}   // block inner clicks
    >
      <button
        className="absolute top-4 right-4"
        onClick={() => setTradeModal({ open: false })}
      >
        ✕
      </button>

      <h2 className="text-2xl font-bold mb-4">Sound Meme Created!</h2>

      <p className="break-all text-sm bg-[#23252b] rounded p-3 mb-6">
        {tradeModal.memeMint.toBase58()}
      </p>

      <button
        className="w-full py-3 rounded bg-[#ffc371] text-black font-bold hover:bg-[#ffb24d]"
        onClick={async () => {
  setTradeModal({ open: false });
  // make sure this is client-side
  if (typeof window !== 'object') return;
  await router.push(`/sound-memes?mint=${tradeModal.memeMint!.toBase58()}`);
  window.scrollTo(0, 0);
}}

      >
        Trade your Sound Meme
      </button>
    </div>
  </div>
)}


      {/* Back to selection */}
      <div className="w-full max-w-2xl mx-auto mb-4">
        <Link href="/create" className="flex items-center gap-2 text-[#8d95a5] hover:text-[#4ECDC4] mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to selection
        </Link>
      </div>

      {/* Title & subtitle */}
      <div className="w-full max-w-2xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center mb-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent mb-1">
            Create Sound Meme
          </h1>
          <p className="mb-6 text-[#b5b5be]">
            Create your SPL404 sound meme NFT with liquidity pool 🚀
          </p>
        </div>
        <div className="mb-4 md:mb-0 flex justify-end">
          <WalletMultiButton />
        </div>
      </div>

      {/* Form container with rainbow border only, no outer black */}
      <div className="w-full max-w-2xl mx-auto space-y-8">

        <div className="bg-gradient-to-r from-[#FF6B6B] via-[#4ECDC4] to-[#FFE66D] p-[2.5px] rounded-2xl">
          <div className="bg-[#181920] rounded-[18px] p-8 md:p-12">
            <form onSubmit={e => { e.preventDefault(); handleCreateAll() }} className="space-y-8">

              {/* Meme Details Card */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <Fire className="w-5 h-5 text-[#FF6B6B]" />
                  <h2 className="text-xl font-semibold">Meme Details</h2>
                </div>
                <div className="mb-4">
                  <label className="block mb-1 font-medium">Name</label>
                  <input className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2 mb-3" value={memeName} onChange={e => setMemeName(e.target.value)} maxLength={32} />
                  <label className="block mb-1 font-medium">Ticker</label>
                  <input className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2 mb-3" value={memeSymbol} onChange={e => setMemeSymbol(e.target.value)} maxLength={10} />
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-1 font-medium">Total Supply</label>
                      <input
  type="number"
  className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2"
  value={totalSupply}
  onChange={e => setTotalSupply(Number(e.target.value) || 0)}
  disabled={poolType === 'bonding'}
/>
<span className="text-xs text-[#aaa]">
  {poolType === 'bonding'
    ? 'Fixed at 444,000,000 for bonding fairlaunch'
    : 'Set the supply for your meme coin'}
</span>

                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Threshold (for NFT Mint)</label>
                      <input type="number" className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2" value={threshold} onChange={e => setThreshold(Number(e.target.value) || 0)} />
                      <span className="text-xs text-[#aaa]">Number of tokens required to mint the NFT</span>
                    </div>
                  </div>
                  <label className="block mt-4 mb-1 font-medium">Description</label>
                  <textarea className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2 mb-2" value={memeDescription} onChange={e => setMemeDescription(e.target.value)} maxLength={256} />
                </div>
                <div>
                  <label className="block mb-1 font-bold">Cover Image</label>
                  <span className="text-sm">Image (PNG/JPG, optional but recommended)</span>
                  <FileUploader onUri={(uri, type) => setCoverImageUri(uri)} />
                  {coverImageUri && <img src={coverImageUri} className="w-full my-2" alt="Meme Cover" />}
                  <label className="block mb-1 font-bold">Media File</label>
                  <span className="text-sm">Audio *</span>
                  <FileUploader onUri={(uri, type) => { setAudioUri(uri); setFileType(type) }} />
                  {audioUri && <audio controls src={audioUri} className="w-full my-2" />}
                  <div className="text-xs text-[#aaa] flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" />
                    Maximum duration: 30 seconds. Supported: MP3, MP4, WAV, FLAC, AIFF (max 100MB)
                  </div>
                </div>
              </div>

              {/* Pool Settings */}
              <div>
                <div className="flex items-center gap-3 mb-4 mt-10">
                  <Coins className="w-5 h-5 text-[#FFE66D]" />
                  <h2 className="text-xl font-semibold">Pool Settings</h2>
                </div>
                <div className="flex gap-6 mb-3">
                  <label>
                    <input type="radio" checked={poolType === 'bonding'} onChange={() => setPoolType('bonding')} />
                    <span className="ml-1">Bonding (Fairlaunch)</span>
                  </label>
                  <label>
                    <input type="radio" checked={poolType === 'amm'} onChange={() => setPoolType('amm')} />
                    <span className="ml-1">AMM (XYK)</span>
                  </label>
                </div>
               {/* ─────────── Liquidity inputs ─────────── */}
{poolType === 'amm' && (
  <div className="grid grid-cols-2 gap-6">
    {/* Initial meme tokens */}
    <div>
      <label className="block mb-1 font-medium">Initial Meme Liquidity</label>
      <input
        type="number"
        value={initialMemeLiquidity}
        onChange={e => setInitialMemeLiquidity(Number(e.target.value) || 0)}
        className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2"
      />
      <span className="text-xs text-[#aaa]">
        Amount of meme tokens for pool
      </span>
    </div>

    {/* Initial WOODENG */}
    <div>
      <label className="block mb-1 font-medium">Initial WOODENG Liquidity</label>
      <input
        type="number"
        value={initialWoodengLiquidity}
        onChange={e => setInitialWoodengLiquidity(Number(e.target.value) || 0)}
        className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2"
      />
      <span className="text-xs text-[#aaa]">
        Amount of WOODENG for pool
      </span>
    </div>
  </div>
)}



              </div>

              {/* Terms Card */}
              <div className="flex flex-col gap-3 mt-10">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={agreedOwn} onChange={e => setAgreedOwn(e.target.checked)} className="accent-[#4ECDC4]" />
                  I confirm that I own this sound or have permission to upload it
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={agreedTOS} onChange={e => setAgreedTOS(e.target.checked)} className="accent-[#4ECDC4]" />
                  I agree to the <span className="underline text-[#4ECDC4] cursor-pointer">Terms of Service</span>
                </label>
              </div>

              <LiquidChargeButton
                type="submit"
                disabled={!agreedOwn || !agreedTOS}
              >
                Create Sound Meme & Pool <span className="ml-2">🌊<span className="ml-1">🔔</span></span>
              </LiquidChargeButton>
            </form>
          </div>
        </div>

        {/* --- Search Section --- */}
        <div className="bg-gradient-to-r from-[#FF6B6B] via-[#4ECDC4] to-[#FFE66D] p-[2.5px] rounded-2xl">
          <div className="bg-[#181920] rounded-[14px] p-8">
            <h2 className="text-xl font-semibold mb-3">🔍 Find & Interact with a Meme Locker</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Paste Locker PDA"
                value={searchAddress}
                onChange={e => setSearchAddress(e.target.value)}
                className="flex-1 px-3 py-2 rounded bg-[#1b1c20] border border-[#36373c] text-white"
              />
              <button onClick={handleSearch} className="px-4 py-2 rounded bg-[#ffc371] text-black font-bold">Search</button>
            </div>
            {searchResult && (
              <div className="border border-[#ffd700] rounded p-5 bg-[#222327] mb-4">
                <div className="mb-2 font-bold">Meme Name: {searchResult.memeName || 'Unknown'}</div>
                <div className="mb-2">Meme Mint: <span className="break-all">{typeof searchResult.memeMint?.toBase58 === 'function' ? searchResult.memeMint.toBase58() : String(searchResult.memeMint)}</span></div>
                <div className="mb-2">NFT Mint: <span className="break-all">{typeof searchResult.nftMint?.toBase58 === 'function' ? searchResult.nftMint.toBase58() : String(searchResult.nftMint)}</span></div>
                <div className="mb-2">Threshold: {searchResult.threshold?.toString?.() ?? String(searchResult.threshold)}</div>
                <div className="mb-2">Locker PDA: <span className="break-all">{typeof searchResult.lockerPda?.toBase58 === 'function' ? searchResult.lockerPda.toBase58() : String(searchResult.lockerPda)}</span></div>
                <div className="flex gap-3 mt-4">
                  <button className="bg-[#ffd700] text-black font-bold px-4 py-2 rounded" onClick={() => lockTokensForMeme(searchResult)}>
                    Lock tokens & Mint NFT
                  </button>
                  <button className="bg-[#fd6e5a] text-white font-bold px-4 py-2 rounded" onClick={() => burnNftAndUnlockTokens(searchResult)}>
                    Burn NFT & Unlock tokens
                  </button>
                </div>
              </div>
            )}
            {status && <div className="text-center mt-2">{status}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
