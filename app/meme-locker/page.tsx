'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'


import {
  Connection, PublicKey, SystemProgram, Transaction, Keypair,
  SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, TransactionInstruction,
  SendTransactionError
} from '@solana/web3.js'

import {
  NATIVE_MINT,                 // wSOL mint (So1111…)
  createSyncNativeInstruction, // needed to wrap SOL
} from '@solana/spl-token'



 import { Program, AnchorProvider, BN } from '@project-serum/anchor'
 import type { Idl } from '@project-serum/anchor'
 

 import { useWallet } from '@solana/wallet-adapter-react'
import type { WalletContextState } from '@solana/wallet-adapter-react'



import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID, createInitializeMintInstruction, createMintToInstruction,
  createSetAuthorityInstruction, AuthorityType, createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token'
import idlJson from '../../idl/hybrid_meme_coin_nft_locker.json'
import poolIdlJson from '../../idl/my_sound_meme_pool.json'
import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata';
import { findMetadataPda } from '@metaplex-foundation/js'
import { Siren as Fire, Info, Coins, Volume2 } from 'lucide-react'
import { Globe, Send, Twitter } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LiquidChargeButton } from "../../src/contexts/components/LiquidChargeButton"
import { useRouter } from 'next/navigation'




// Mounts children directly under <body> so the modals are outside any <form>
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}



const PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS')
const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV')
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad')
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const BONDING_SUPPLY = 444_000_000;
const PROJECT_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PROJECT_WALLET ??
  '34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb' // <- your project fee wallet
);


const WSOL_MINT = NATIVE_MINT;       // So11111111111111111111111111111111111111112
const QUOTE_DECIMALS = 9;            // WOODENG and wSOL both use 9


// must mirror program constants
const CURVE_THRESHOLD = 44_000_000;                     // BONDING_CURVE_THRESHOLD
const TARGET_PRICE_LAMPORTS = 35 * 10 ** QUOTE_DECIMALS; // TARGET_PRICE_LAMPORTS
const BONDING_FEE_BPS = 100; // 1%





// ──────────────────────────────────────────────────────────────

// replace your SignerWallet with this:
type SignerWallet = {
  publicKey: PublicKey | null;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
};

// Top-level (NOT inside any function)
async function mineVanityKeypair(suffix: string, yieldEvery = 10_000): Promise<Keypair> {
  let tries = 0;
  for (;;) {
    const kp = Keypair.generate();
    if (kp.publicKey.toBase58().endsWith(suffix)) return kp;
    if (++tries % yieldEvery === 0) await new Promise(r => setTimeout(r, 0));
  }
}



// Legacy “single blob” sender (good enough; keeps code simple)
export async function sendIxsOnce(
  connection: Connection,
  wallet: SignerWallet,
  ixs: TransactionInstruction[],
  signers: Keypair[] = [],
  { skipPreflight = false }: { skipPreflight?: boolean } = {}
) {
  if (!wallet.publicKey) throw new Error('Wallet has no public key');







  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;
  if (signers.length) tx.partialSign(...signers);

  const signed =
    wallet.signTransaction
      ? await wallet.signTransaction(tx)
      : (await wallet.signAllTransactions!([tx]))[0];

  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}



async function pinJson(obj: any): Promise<string> {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const file = new File([blob], "metadata.json");
  // your pinFile already returns https://ipfs.io/ipfs/<cid>
  return await pinFile(file as any);
}


// --- helpers (top of file) ---
async function getCounterPda(memeMint: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from('counter'), memeMint.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}




// -------------------- BACK-COMPAT SHIM (OUTSIDE!) --------------------
export async function sendTx(
  connection: Connection,
  wallet: SignerWallet,
  tx: Transaction,
  extraSigners: Keypair[] = []
) {
  return sendIxsOnce(connection, wallet, tx.instructions, extraSigners);
}


const WOODENG_DECIMALS = 9;
const MEME_DECIMALS = 0;



// ─── media policy (3 min, compressed only) ───
const MAX_AUDIO_SECONDS = 180;                      // 3 minutes
const HARD_MAX_AUDIO_BYTES = 25 * 1024 * 1024;      // 25 MB
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',                 // .mp3
  'audio/mp4', 'audio/aac', 'audio/x-aac', // .m4a / .aac
  'audio/ogg',                  // .ogg
]);

// ipfs:// → local proxy for bandwidth control
const toStreamUrl = (uri: string) => {
  if (!uri) return '';

  // ipfs://CID[/path]  -> /ipfs/CID[/path]
  if (uri.startsWith('ipfs://')) return `/ipfs/${uri.slice(7)}`;

  // https(s)://.../ipfs/CID[/path]  -> /ipfs/CID[/path]
  const m = uri.match(/\/ipfs\/(.+)$/i);
  if (m) return `/ipfs/${m[1]}`;

  // bare CID -> /ipfs/CID
  if (/^[a-z0-9]{46,}$/i.test(uri)) return `/ipfs/${uri}`;

  return uri; // anything else, leave as-is
};

// get duration before upload (client-side)
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read audio metadata'));
    };
  });
}



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



async function ensureAtaExists(
  owner: PublicKey,
  mint: PublicKey,
  payer: PublicKey,
  wallet: WalletContextState,
  isPdaOwner = false
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner, isPdaOwner);
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  await sendTx(connection, wallet, tx); // idempotent => safe to always send
  return ata;
}



async function getLockerPda(counterPda: PublicKey, nftMint: PublicKey): Promise<[PublicKey, number]> {
  return await PublicKey.findProgramAddress(
    [Buffer.from('locker'), counterPda.toBuffer(), nftMint.toBuffer()],
    PROGRAM_ID
  );
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
  lockerPda: PublicKey
): Promise<string> {
  const setAuthorityIx = createSetAuthorityInstruction(
    nftMint,
    wallet.publicKey!,
    AuthorityType.MintTokens,
    lockerPda
  );
  const tx = new Transaction().add(setAuthorityIx);
  tx.feePayer = wallet.publicKey!;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return await sendTx(connection, wallet, tx);
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
  return `ipfs://${data.IpfsHash}`

}




// ───────── ATA (idempotent) builder: returns { ata, ix } — no send ─────────
async function ensureAtaIx(
  owner: PublicKey,
  mint: PublicKey,
  payer: PublicKey,
  isPdaOwner = false
): Promise<{ ata: PublicKey; ix: TransactionInstruction }> {
  const ata = await getAssociatedTokenAddress(mint, owner, isPdaOwner);
  // idempotent = safe to include even if ATA already exists
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { ata, ix };
}

// ───────── Mint creation builder: returns { mint, ixs, signers } — no send ─────────
async function buildCreateMintIx(
  payer: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  vanitySuffix?: string // e.g. "woo"
): Promise<{ mint: PublicKey; ixs: TransactionInstruction[]; signers: Keypair[] }> {
  // IMPORTANT: keep the await here
  const kp = vanitySuffix ? await mineVanityKeypair(vanitySuffix) : Keypair.generate();

  const lamports = await connection.getMinimumBalanceForRentExemption(82);
  const createIx = SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: kp.publicKey,
    lamports,
    space: 82,
    programId: TOKEN_PROGRAM_ID,
  });
  const initIx = createInitializeMintInstruction(kp.publicKey, decimals, mintAuthority, null, TOKEN_PROGRAM_ID);

  return { mint: kp.publicKey, ixs: [createIx, initIx], signers: [kp] };
}


async function buildLockerIxs(params: {
  provider: AnchorProvider;
  wallet: WalletContextState;
  memeMint: PublicKey;
  threshold: number;
  metaUri: string;
  memeName: string;
  memeSymbol: string;
}): Promise<{
  lockerPda: PublicKey;
  nftMint: PublicKey;
  ixs: TransactionInstruction[];
  signers: Keypair[];
}> {
  const { provider, wallet, memeMint, threshold, metaUri, memeName, memeSymbol } = params;
  const lockerProgram = new Program(idlJson as Idl, PROGRAM_ID, provider);

  // (a) Create the NFT mint (0 decimals) — returns ixs + signer
  const nftMintBuild = await buildCreateMintIx(wallet.publicKey!, 0, wallet.publicKey!);

  // (b) PDAs
  const [counterPda] = await getCounterPda(memeMint, wallet.publicKey!);
  const [lockerPda]  = await getLockerPda(counterPda, nftMintBuild.mint);

  // (c) Locker meme vault ATA (owned by PDA)
  const { ata: lockerMemeAta, ix: lockerMemeAtaIx } =
    await ensureAtaIx(lockerPda, memeMint, wallet.publicKey!, true);

  // (d) Program ixs
  const initCounterIx = await lockerProgram.methods
    .initializeCounter()
    .accounts({
      user: wallet.publicKey!,
      counter: counterPda,
      memeMint,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const initLockerIx = await lockerProgram.methods
    .initializeLocker(new BN(threshold), memeName, memeSymbol, metaUri)
    .accounts({
      user: wallet.publicKey!,
      counter: counterPda,
      locker: lockerPda,
      memeMint,
      nftMint: nftMintBuild.mint,
      lockerMemeAccount: lockerMemeAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  // (e) Hand NFT mint authority to the locker PDA (so it can mint on lock)
  const setAuthIx = createSetAuthorityInstruction(
    nftMintBuild.mint,
    wallet.publicKey!,
    AuthorityType.MintTokens,
    lockerPda
  );

  // Important ordering
  const ixs = [
    ...nftMintBuild.ixs, // create + init NFT mint
    lockerMemeAtaIx,     // locker vault
    initCounterIx,
    initLockerIx,        // creates locker
    setAuthIx,           // give mint authority to locker
  ];

  return { lockerPda, nftMint: nftMintBuild.mint, ixs, signers: nftMintBuild.signers };
}




function FileUploader({ onUri }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fileUrl, setFileUrl] = useState('');
  const [mime, setMime] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
  setError('');
  setUploading(true);
  try {
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');

    if (!isAudio && !isImage) {
      throw new Error('File must be audio or image');
    }

    if (isAudio) {
      if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
        throw new Error('Audio must be MP3, M4A/AAC, or OGG');
      }
      if (file.size > HARD_MAX_AUDIO_BYTES) {
        throw new Error(`Audio must be ≤ ${Math.floor(HARD_MAX_AUDIO_BYTES / 1024 / 1024)} MB`);
      }
      const secs = await getAudioDuration(file).catch(() => NaN);
      if (!isFinite(secs) || secs > MAX_AUDIO_SECONDS + 0.5) {
        throw new Error(`Audio must be ≤ ${Math.floor(MAX_AUDIO_SECONDS / 60)} minutes`);
      }
    } else if (isImage) {
      const ok = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type);
      if (!ok) throw new Error('Image must be PNG or JPG');
    }

    const uri = await pinFile(file);   // returns ipfs://CID
    setFileUrl(uri);
    setMime(file.type);
    onUri?.(uri, file.type);
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setUploading(false);
  }
};


  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors mb-4
        ${dragOver ? 'bg-[#FFC371]/20 border-[#FFC371]' : 'bg-[#181920] border-[#FFC371]'}
        p-4 sm:p-6`}
    >
      <input
  type="file"
  ref={inputRef}
  style={{ display: 'none' }}
  accept="image/png,image/jpeg,audio/mpeg,audio/mp4,audio/aac,audio/x-aac,audio/ogg"

             onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />

      {uploading ? "Uploading..." : "Drop file here or click to select"}

      {fileUrl && (
        mime.startsWith('audio/')
  ? <audio controls preload="none" src={toStreamUrl(fileUrl)} style={{ width: "100%", marginTop: 12 }} />
  : mime.startsWith('image/')
    ? <img src={toStreamUrl(fileUrl)} alt="Uploaded" style={{ width: "100%", marginTop: 12 }} />

            : <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 12 }}>{fileUrl}</a>
      )}

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </div>
  );
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

type TxStep = {
  open: boolean;
  step: number;      // 1-based
  total: number;     // total steps
  title: string;     // short "what you're approving"
  details?: string;  // optional longer blurb
};

function StepModal({
  open, step, total, title, details, onClose,
}: TxStep & { onClose?: () => void }) {
  if (!open) return null;
  const pct = Math.max(0, Math.min(100, Math.round((step / Math.max(1,total)) * 100)));

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="relative w-[min(92vw,420px)] rounded-xl bg-[#1b1c20] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-[#9aa1af]">Step {step} of {total}</div>
          <button className="text-[#9aa1af] hover:text-white" onClick={onClose}>✕</button>
        </div>

        <div className="w-full h-2 bg-[#262735] rounded overflow-hidden mb-4">
          <div className="h-full bg-[#ffc371]" style={{ width: `${pct}%` }} />
        </div>

        <div className="text-lg font-bold mb-1">{title}</div>
        {details && <div className="text-sm text-[#c9cbd6] whitespace-pre-line">{details}</div>}

        <div className="mt-4 text-xs text-[#8d95a5]">
          Keep this window open while you approve wallet prompts.
        </div>
      </div>
    </div>
  );
}


// ------- MAIN COMPONENT --------

export default function MemeLockerFactory() {


  
  const wallet = useWallet()
  // AFTER
const [txStep, setTxStep] = useState<TxStep>({ open: false, step: 0, total: 0, title: "" });

const showStep = (step: number, total: number, title: string, details?: string) =>
  setTxStep({ open: true, step, total, title, details });

const closeSteps = () => setTxStep(s => ({ ...s, open: false }));


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


    // ✅ socials (must live inside the component)
  const [xUrl, setXUrl] = useState("");
  const [tgUrl, setTgUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Pool Settings
  const [poolType, setPoolType] = useState<'bonding' | 'amm'>('bonding')

 const isAmm = poolType === 'amm';
const isBonding = !isAmm;

  const [quoteToken, setQuoteToken] = useState<'WOODENG' | 'SOL'>('WOODENG');
const QUOTE_MINT  = quoteToken === 'WOODENG' ? WOODENG_MINT : WSOL_MINT;
const quoteLabel  = quoteToken === 'WOODENG' ? 'WOODENG'     : 'SOL';


  
// Founder pre-buy (0..1 %) — only used for bonding
const [founderBuyPct, setFounderBuyPct] = useState<number>(0); // percent, max 1.00

// handy deriveds
const founderBuyTokens = Math.floor(BONDING_SUPPLY * (founderBuyPct / 100)); // MEME (0-decimals)
const fmt = (n: number) => n.toLocaleString();
  


  const [initialMemeLiquidity, setInitialMemeLiquidity] = useState(10000)
  const [initialQuoteLiquidity, setInitialQuoteLiquidity] = useState(10000)

    /* ── si on repasse sur Bonding on force la liq. meme à 0 ── */
useEffect(() => {
  if (isBonding) {
    setInitialMemeLiquidity(0);
    setInitialQuoteLiquidity(0);
  }
}, [poolType]);


useEffect(() => {
  if (isBonding) {
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

const navigatingRef = useRef(false)

// Swallow stray Enter key while the success modal is open
useEffect(() => {
  if (!tradeModal.open) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault()
  }
  window.addEventListener('keydown', onKey, { capture: true })
  return () => window.removeEventListener('keydown', onKey as any, true)
}, [tradeModal.open])



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








// ───────── Token metadata builder (mpl) — returns a single ix ─────────
function buildMetadataIx(
  payer: PublicKey,
  mint: PublicKey,
  uri: string,
  name: string,
  symbol: string
): TransactionInstruction {
  const mdPda = findMetadataPda(mint);
  return createCreateMetadataAccountV3Instruction(
    { metadata: mdPda, mint, mintAuthority: payer, payer, updateAuthority: payer },
    {
      createMetadataAccountArgsV3: {
        data: { name, symbol, uri, sellerFeeBasisPoints: 0, creators: null, collection: null, uses: null },
        isMutable: true,
        collectionDetails: null,
      },
    },
  );
}

// ───────── MintTo builder — returns a single ix ─────────
function buildMintToIx(
  mint: PublicKey,
  dest: PublicKey,
  authority: PublicKey,
  amount: number
): TransactionInstruction {
  return createMintToInstruction(mint, dest, authority, amount);
}

async function buildWrapSolIxs(
  payer: PublicKey,
  amountLamports: number
): Promise<{ ata: PublicKey; ixs: TransactionInstruction[] }> {
  // Create (idempotent) ATA for wSOL
  const ata = await getAssociatedTokenAddress(NATIVE_MINT, payer, false);
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer, ata, payer, NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  // Move SOL into the ATA, then sync as wSOL
  const fundIx = SystemProgram.transfer({ fromPubkey: payer, toPubkey: ata, lamports: amountLamports });
  const syncIx = createSyncNativeInstruction(ata);
  return { ata, ixs: [createAtaIx, fundIx, syncIx] };
}


/* ===== Bonding math: lamports needed to mint exactly `dx` tokens ===== */
/* ===== Bonding math: lamports needed to mint exactly `dx` tokens ===== */
function grossLamportsForExactOutTokens(
  desiredOut: number,          // dx (MEME, 0 decimals)
  p0Lamports: number,          // starting price (lamports / MEME)
  targetPriceLamports: number, // TARGET_PRICE_LAMPORTS
  threshold: number,           // CURVE_THRESHOLD (44,000,000)
  feeBps = 100,                // BONDING_FEE_BPS = 1%
  soldSoFar = 0                // x0; at init this is 0
) {
  if (desiredOut <= 0) return new BN(0);
  const k      = Math.log(targetPriceLamports / p0Lamports) / threshold;
  const pAtX0  = p0Lamports * Math.exp(k * soldSoFar);
  // lamports that must ARRIVE in the pool (after fee)
  const spentToPool = (pAtX0 / k) * Math.expm1(k * desiredOut);
  const feeFactor   = 1 - feeBps / 10_000; // 0.99
  const gross       = Math.ceil(spentToPool / feeFactor); // user sends this
  return new BN(gross);
}

function normalizeUrl(raw: string, type: 'website' | 'x' | 'telegram'): string {
  let s = (raw || "").trim();
  if (!s) return "";
  if (type === 'x') {
    if (s.startsWith('@')) s = s.slice(1);
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        if (u.hostname.includes('twitter.com')) u.hostname = 'x.com';
        return u.toString();
      } catch { return s; }
    }
    return `https://x.com/${s}`;
  }
  if (type === 'telegram') {
    if (s.startsWith('@')) s = s.slice(1);
    if (/^https?:\/\//i.test(s)) return s;
    return `https://t.me/${s}`;
  }
  // website
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}



  // ========== CREATION STEPS ==========
  // ──────────────────────────────────────────────────────────────
async function handleCreateAll() {
  try {
    if (!wallet.connected || !wallet.publicKey) throw new Error("Connect your wallet first!");
    if (!memeName.trim() || !memeSymbol.trim() || !audioUri.trim()) throw new Error("Fill all meme details and upload audio!");
    if (!agreedTOS || !agreedOwn) throw new Error("You must accept the terms to proceed.");

    const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "confirmed" });
    const poolProgram = new Program(poolIdlJson as Idl, POOL_PROGRAM_ID, provider);


    // One persistent progress count for the whole flow
const totalSteps =
  2 + (isAmm ? 1 : (founderBuyPct > 0 ? 1 : 0));
// AMM: 3 (Upload → Create+Init → Seed Liquidity)
// Bonding w/o pre-buy: 2 (Upload → Create+Init)
// Bonding w/ pre-buy: 3 (Upload → Create+Init → Creator pre-buy)


    // 1) Off-chain uploads (unchanged)
    showStep(1, totalSteps, "Upload media & metadata", "Pinning cover + audio + metadata.json to IPFS…");


    const imgCid   = coverImageUri;
    const audioCid = audioUri;
    
    // normalize socials just-in-time
const xUrlN   = xUrl ? normalizeUrl(xUrl, 'x') : "";
const tgUrlN  = tgUrl ? normalizeUrl(tgUrl, 'telegram') : "";
const webUrlN = websiteUrl ? normalizeUrl(websiteUrl, 'website') : "";

// add socials + external_url to metadata (extra fields are fine)
const metaJson = {
  name: memeName,
  symbol: memeSymbol,
  description: memeDescription,
  image: imgCid,
  animation_url: audioCid,

  external_url: webUrlN || undefined,

  // 👇 store the NFT-mint threshold so the UI can read it
  extensions: {
    threshold: Number(threshold),      // << ADDED
    twitter:  xUrlN || undefined,
    telegram: tgUrlN || undefined,
    website:  webUrlN || undefined,
  },

  attributes: [
    { trait_type: "Category", value: "Sound Meme" },
    { trait_type: "Threshold", value: String(threshold) }, // << ADDED (nice for explorers)
    ...(webUrlN ? [{ trait_type: "Website",  value: webUrlN }] : []),
    ...(xUrlN    ? [{ trait_type: "X",        value: xUrlN    }] : []),
    ...(tgUrlN   ? [{ trait_type: "Telegram", value: tgUrlN   }] : []),
  ],
};



    const metaUri = await pinFile(new File([JSON.stringify(metaJson)], "metadata.json", { type:"application/json" }));

    // 2) Build on-chain instructions (we’ll sign ONCE)
    showStep(2, totalSteps, "Preparing on-chain creation", "Deriving PDAs, creating mints, ATAs & metadata…");



    // mints (vanity "woo" for MEME)
showStep(2, totalSteps, 'Mining vanity mint', 'Looking for a mint address ending with "woo"…');


const memeMintBuild = await buildCreateMintIx(
  wallet.publicKey,
  MEME_DECIMALS,
  wallet.publicKey,
  'woo' // ← vanity suffix
);

// sanity guard: abort if somehow not "woo"
const _memeMintB58 = memeMintBuild.mint.toBase58();
console.log('[MEME mint candidate]', _memeMintB58);
if (!_memeMintB58.endsWith('woo')) {
  throw new Error(`Vanity mint check failed. Got ${_memeMintB58}, expected to end with "woo".`);
}

// LP mint is normal (no vanity)
const lpMintBuild = await buildCreateMintIx(wallet.publicKey, 0, wallet.publicKey);


    // metadata for MEME
const mdIx = buildMetadataIx(wallet.publicKey, memeMintBuild.mint, metaUri, memeName, memeSymbol);

// placeholders for things we’ll send in Phase-2 (bonding)

let founderBuyIxPhase2: TransactionInstruction | null = null;
let userWoodAtaIxPhase2: TransactionInstruction | null = null;
let creatorMemeAtaIxPhase2: TransactionInstruction | null = null;


    // PDAs
    const [configPda]        = await getConfigPda(memeMintBuild.mint);
    const [poolMemeVault]    = await getPoolMemeVaultPda(memeMintBuild.mint);
    const [poolWoodengVault] = await getPoolWoodengVaultPda(memeMintBuild.mint);

    // fee vault (PROJECT_WALLET, WOODENG)
    const { ata: lpFeeVault, ix: lpFeeVaultIx } =
  await ensureAtaIx(PROJECT_WALLET, QUOTE_MINT, wallet.publicKey, false);


    // creator meme ATA (for AMM seeding)
    const { ata: creatorMemeAta, ix: creatorMemeAtaIx } =
      await ensureAtaIx(wallet.publicKey, memeMintBuild.mint, wallet.publicKey, false);

    // optional: user WOODENG / LP ATAs (for AMM)
    let userWoodAta: PublicKey;
let userWoodAtaIx: TransactionInstruction | null = null;
let wrapIxs: TransactionInstruction[] = [];

if (quoteToken === 'SOL') {
  // We'll decide the required amount below in each path and fill wrapIxs there
  // For now we only know the ATA address:
  userWoodAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey, false);
} else {
  // bonding: defer creating the ATA to Phase-2
  userWoodAta = await getAssociatedTokenAddress(QUOTE_MINT, wallet.publicKey, false);
  // userWoodAtaIx will be built (and sent) in Phase-2
}

    const { ata: userLpAta,   ix: userLpAtaIx } =
      await ensureAtaIx(wallet.publicKey, lpMintBuild.mint, wallet.publicKey, false);





      // --- Guard: make sure we have enough SOL to create any missing ATAs ---
const TOKEN_ACC_SIZE = 165; // SPL token account size
const tokenAccRent = await connection.getMinimumBalanceForRentExemption(TOKEN_ACC_SIZE);

const ataCandidates: PublicKey[] = [
  lpFeeVault,
  ...(isAmm ? [creatorMemeAta] : []),
  // userLpAta is created in Phase 2; no rent check here yet
];

// Check which of these ATAs are missing
const ataInfos = await Promise.all(ataCandidates.map(a => connection.getAccountInfo(a)));
const missingCount = ataInfos.filter(a => !a).length;

// Small headroom for fees
const FEE_PAD = 30_000; // ~0.00003 SOL
const needNow = missingCount * tokenAccRent + FEE_PAD;

const payerBal = await connection.getBalance(wallet.publicKey!);
if (payerBal < needNow) {
  const needSol = needNow / 1e9;
  const haveSol = payerBal / 1e9;
  throw new Error(
    `Not enough SOL to create token accounts. Need ~${needSol.toFixed(6)} SOL, you have ${haveSol.toFixed(6)} SOL. ` +
    `Each new token account costs ~${(tokenAccRent/1e9).toFixed(6)} SOL in rent.`
  );
}


    // price params
    const P1_UI = 35 / 44_000_000;
    const DEFAULT_P0_UI = Math.min(0.00000070, 0.95 * P1_UI);
    const p0Lamports = new BN(Math.floor(DEFAULT_P0_UI * 10 ** QUOTE_DECIMALS));


    // anchor ixs instead of .rpc
    const initIx = await poolProgram.methods
      .initializeSoundMemeAndPool(
        p0Lamports,
        isBonding,
        new BN(threshold),
      )
      .accounts({
        authority: wallet.publicKey,
        config: configPda,
        memeMint: memeMintBuild.mint,
        poolMemeVault,
        poolWoodengVault,
        lpMint: lpMintBuild.mint,
        woodengMint: QUOTE_MINT,
        lpFeeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    // compute budget (help avoid CU errors)
    const computeIxs = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: isBonding ? 400_000 : 600_000 }),
  ...(isAmm ? [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2_000 })] : []),
];







// ALWAYS write metadata before init (AMM and Bonding)
const ixsPhase1: TransactionInstruction[] = [
  ...computeIxs,
  ...memeMintBuild.ixs,
  ...lpMintBuild.ixs,
  lpFeeVaultIx,
  mdIx,                       // ← metadata BEFORE init
];

// AMM needs creator’s MEME ATA in Phase-1; Bonding can defer it
if (isAmm) {
  ixsPhase1.push(creatorMemeAtaIx);
} else {
  creatorMemeAtaIxPhase2 = creatorMemeAtaIx; // keep for later if you want
}



const signersPhase1 = [...memeMintBuild.signers, ...lpMintBuild.signers];

// Founder pre-buy (bonding)
const projectWalletAta = lpFeeVault;
const founderQty = founderBuyTokens;

if (isAmm) {
  if (totalSupply < initialMemeLiquidity) {
    throw new Error("Initial meme liquidity cannot exceed total supply");
  }
  const supplyToMint = totalSupply * 10 ** MEME_DECIMALS; // MEME_DECIMALS = 0
  ixsPhase1.push( // ✅ correct array in the happy path
    buildMintToIx(
      memeMintBuild.mint,
      creatorMemeAta,
      wallet.publicKey!,
      supplyToMint
    )
  );

  // NOTE: userLpAtaIx will be sent in Phase 2


  // 2) Fund quote (wrap SOL or ensure quote ATA)
    if (quoteToken === 'SOL') {
    // We will wrap SOL in Phase 2 right before addLiquidity
    userWoodAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
  } else {
    // We will create the WOODENG ATA idempotently in Phase 2
  }


}

// 3) Now initialize (takes mint authorities)
ixsPhase1.push(initIx);


// 4) Pool-specific (bonding) — prepare for Phase-2 only
if (isBonding && founderQty > 0) {
  // Price for one token less to avoid float→floor off-by-one at 1.00%
  const exactTarget  = founderQty;               // e.g. 4_440_000 at 1.00%
  const pricedTarget = Math.max(1, exactTarget - 1);

  // min_out guards against accidental overfill / price drift
  const founderMinOut = new BN(pricedTarget);

  // compute exact gross lamports (pre-fee) required for that output
  const lamportsInBN = grossLamportsForExactOutTokens(
    pricedTarget,
    Number(p0Lamports.toString()),
    TARGET_PRICE_LAMPORTS,
    CURVE_THRESHOLD,
    BONDING_FEE_BPS,
    /* soldSoFar */ 0
  );

  if (quoteToken === 'SOL') {
  const lamportsInNum = Number(lamportsInBN.toString());
  if (lamportsInNum > 0) {
    const FEE_PAD  = 30_000;
    const wsolAta  = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
    const wsolInfo = await connection.getAccountInfo(wsolAta);
    const rent     = wsolInfo ? 0 : await connection.getMinimumBalanceForRentExemption(165);
    const need     = lamportsInNum + rent + FEE_PAD;

    const bal = await connection.getBalance(wallet.publicKey!);
    if (bal < need) {
      throw new Error(
        `Not enough SOL to wrap ${(lamportsInNum/1e9).toFixed(9)} SOL and pay ~${(rent/1e9).toFixed(6)} SOL rent + fees. ` +
        `Keep at least ${(need/1e9).toFixed(6)} SOL.`
      );
    }
    const w = await buildWrapSolIxs(wallet.publicKey!, lamportsInNum);
    userWoodAta = w.ata;
    wrapIxs     = w.ixs;
  }
}
 else {

    // ensure WOODENG ATA idempotently (Phase-2)
    const res = await ensureAtaIx(wallet.publicKey!, QUOTE_MINT, wallet.publicKey!, false);
    userWoodAta        = res.ata;
    userWoodAtaIxPhase2 = res.ix;
  }

  founderBuyIxPhase2 = await poolProgram.methods
    .buy(lamportsInBN, founderMinOut)
    .accounts({
      config:           configPda,
      memeMint:         memeMintBuild.mint,
      poolMemeVault,
      poolWoodengVault,
      buyer:            wallet.publicKey!,
      buyerMemeAta:     creatorMemeAta,
      buyerWoodengAta:  userWoodAta,
      projectWalletAta: lpFeeVault,   // ok to be same address as lpFeeVault
      lpFeeVault,
      tokenProgram:     TOKEN_PROGRAM_ID,
      systemProgram:    SystemProgram.programId,
    })
    .instruction();
}




let addLiqIxPhase2: TransactionInstruction | null = null;
if (isAmm) {
  addLiqIxPhase2 = await poolProgram.methods
    .addLiquidity(
      new BN(initialMemeLiquidity * 10 ** MEME_DECIMALS),
      new BN(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS),
    )
    .accounts({
      config:          configPda,
      poolMemeVault,
      poolWoodengVault,
      user:            wallet.publicKey!,
      userMemeAta:     creatorMemeAta,
      userWoodengAta:  userWoodAta,
      lpMint:          lpMintBuild.mint,
      userLpAta,
      tokenProgram:    TOKEN_PROGRAM_ID,
    })
    .instruction();
  // DO NOT push here; we'll send in Phase 2
}







    // 3) ONE signature attempt (bonding = always one; amm = usually one)
    showStep(
  2, totalSteps,
  "Create + Init",
  [
    "This approval will:",
    "• Create MEME + LP mints",
    "• Write token metadata",
    ...(isAmm
        ? ["• Create idempotent ATAs (creator + fee vault)"]
        : ["• Create idempotent ATAs (fee vault)"]),
    "• Initialize the pool (takes authorities)",
    isAmm
  ? "• (AMM) Liquidity will follow as the next approval"
  : `• (Bonding) Optional creator pre-buy: ${founderBuyPct.toFixed(2)}%`,

  ].join("\n")
);




    try {
      await sendIxsOnce(connection, wallet, ixsPhase1, signersPhase1);
// keep modal open; next step will update it



// BONDING: optional creator pre-buy only (no locker)
if (isBonding) {
  if (founderBuyIxPhase2) {
    showStep(totalSteps === 3 ? 3 : 2, totalSteps,
      "Creator pre-buy",
      `Buying ~${founderBuyPct.toFixed(2)}% of supply before trading opens.`
    );

    const phase2Bonding: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
      ...(creatorMemeAtaIxPhase2 ? [creatorMemeAtaIxPhase2] : []),
      ...(userWoodAtaIxPhase2 ? [userWoodAtaIxPhase2] : []),
      ...wrapIxs,
      founderBuyIxPhase2,
    ];

    await sendIxsOnce(connection, wallet, phase2Bonding);
  }
closeSteps();
setTradeModal({ open: true, memeMint: memeMintBuild.mint, configPda });
setStatus("Sound Meme & Pool created!");
return; // wait for user to click the CTA

}



// AMM: Phase 2 = seed liquidity (no locker)
if (isAmm && addLiqIxPhase2) {
  // --- simplified preflight: only LP ATA + quote ATA rent ---
  {
    const rentAta = await connection.getMinimumBalanceForRentExemption(165);
    let need = 30_000; // fee pad
    const lpInfo = await connection.getAccountInfo(userLpAta);
    if (!lpInfo) need += rentAta;

    if (quoteToken === 'SOL') {
      const wAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
      const wInfo = await connection.getAccountInfo(wAta);
      if (!wInfo) need += rentAta;
    } else {
      const qAta = await getAssociatedTokenAddress(QUOTE_MINT, wallet.publicKey!, false);
      const qInfo = await connection.getAccountInfo(qAta);
      if (!qInfo) need += rentAta;
    }

    const haveSol = await connection.getBalance(wallet.publicKey!);
    if (haveSol < need) {
      throw new Error(`Not enough SOL for rent/fees (~${(need/1e9).toFixed(6)} SOL needed). Top up and retry.`);
    }
  }

  // Build tx
  const phase2Ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
    userLpAtaIx, // idempotent create
  ];

  if (quoteToken === 'SOL') {
    const lamportsNeeded = Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS);
    if (lamportsNeeded > 0) {
      const w = await buildWrapSolIxs(wallet.publicKey!, lamportsNeeded);
      userWoodAta = w.ata;
      phase2Ixs.push(...w.ixs);
    }
  } else {
    const res = await ensureAtaIx(wallet.publicKey!, QUOTE_MINT, wallet.publicKey!, false);
    userWoodAta = res.ata;
    phase2Ixs.push(res.ix);

    const bal = await connection.getTokenAccountBalance(userWoodAta).catch(() => null);
    const have = bal ? BigInt(bal.value.amount) : 0n;
    const need = BigInt(Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS));
    if (have < need) throw new Error(
      `Need ${initialQuoteLiquidity} ${quoteLabel} to seed the pool; current balance is ${(Number(have)/1e9).toFixed(6)}.`
    );
  }

  phase2Ixs.push(addLiqIxPhase2);

  // show “step 3/3” (Upload=1, Create=2, Seed=3)
  showStep(3, totalSteps, "Seed liquidity",
    `Deposit ${initialMemeLiquidity} ${memeSymbol} + ${initialQuoteLiquidity} ${quoteLabel} into the pool.`
  );
  await sendIxsOnce(connection, wallet, phase2Ixs);

  closeSteps();
setTradeModal({ open: true, memeMint: memeMintBuild.mint, configPda });
setStatus("Sound Meme & Pool created!");
return; // wait for user to click the CTA

}








    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const tooBig = msg.includes('transaction too large') || msg.includes('account input limit') || msg.includes('max');
      if (!(isAmm && tooBig)) {

        throw err; // bonding should never need split; non-size errors bubble
      }
    }

  // In the split path, also ensure metadata happens before init
let ixsP1: TransactionInstruction[] = [
  ...computeIxs,
  ...memeMintBuild.ixs,
  ...lpMintBuild.ixs,
  lpFeeVaultIx,
  mdIx,                       // ← metadata BEFORE init here too
];

if (isAmm) {
  ixsP1.push(creatorMemeAtaIx);
} else {
  creatorMemeAtaIxPhase2 = creatorMemeAtaIx;
}



if (isAmm) {
  if (totalSupply < initialMemeLiquidity) {
    throw new Error("Initial meme liquidity cannot exceed total supply");
  }
  const supplyToMint = totalSupply * 10 ** MEME_DECIMALS; // 0-decimals -> integer
  ixsP1.push(
    buildMintToIx(
      memeMintBuild.mint,
      creatorMemeAta,
      wallet.publicKey!,
      supplyToMint
    ),
  );
  // LP ATA + quote funding will be sent in Phase 2
  if (quoteToken === 'SOL') {
    userWoodAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
  }


}

// Now init
ixsP1.push(initIx);

// Bonding founder buy in split phase
if (isBonding) {
  const exactTargetP1  = founderBuyTokens;
  if (exactTargetP1 > 0) {
    const pricedTargetP1  = Math.max(1, exactTargetP1 - 1);

    const founderMinOutP1 = new BN(pricedTargetP1);
    const lamportsInP1    = grossLamportsForExactOutTokens(
      pricedTargetP1,
      Number(p0Lamports.toString()),
      TARGET_PRICE_LAMPORTS,
      CURVE_THRESHOLD,
      100,
      0
    );
    const lamportsInNum   = Number(lamportsInP1.toString());

    if (quoteToken === 'SOL') {
  if (lamportsInNum > 0) {
    const FEE_PAD  = 30_000;
    const wsolAta  = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
    const wsolInfo = await connection.getAccountInfo(wsolAta);
    const rent     = wsolInfo ? 0 : await connection.getMinimumBalanceForRentExemption(165);
    const need     = lamportsInNum + rent + FEE_PAD;

    const bal = await connection.getBalance(wallet.publicKey!);
    if (bal < need) {
      throw new Error(
        `Not enough SOL to wrap ${(lamportsInNum/1e9).toFixed(9)} SOL and pay ~${(rent/1e9).toFixed(6)} SOL rent + fees. ` +
        `Keep at least ${(need/1e9).toFixed(6)} SOL.`
      );
    }

    const w = await buildWrapSolIxs(wallet.publicKey!, lamportsInNum);
    userWoodAta = w.ata;
    wrapIxs     = w.ixs; // send in Phase-2
  }
} else {
  const res = await ensureAtaIx(wallet.publicKey!, QUOTE_MINT, wallet.publicKey!, false);
  userWoodAta        = res.ata;
  userWoodAtaIxPhase2 = res.ix; // send in Phase-2
}


    founderBuyIxPhase2 = await poolProgram.methods
      .buy(lamportsInP1, founderMinOutP1)
      .accounts({
        config:           configPda,
        memeMint:         memeMintBuild.mint,
        poolMemeVault,
        poolWoodengVault,
        buyer:            wallet.publicKey!,
        buyerMemeAta:     creatorMemeAta,
        buyerWoodengAta:  userWoodAta,
        projectWalletAta: lpFeeVault,
        lpFeeVault,
        tokenProgram:     TOKEN_PROGRAM_ID,
        systemProgram:    SystemProgram.programId,
      })
      .instruction();
  }
}



showStep(2, totalSteps, "Create mints + init",
  isAmm
    ? "Creates mints/metadata/ATAs and initializes the pool. Liquidity will follow."
    : "Creates mints/metadata/ATAs and initializes the pool."
);



await sendIxsOnce(connection, wallet, ixsP1, signersPhase1);


// Bonding Phase-2 (metadata + ATAs + founder buy)
if (isBonding) {
  const phase2BondingSplit: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
  ];
  if (creatorMemeAtaIxPhase2) phase2BondingSplit.push(creatorMemeAtaIxPhase2);
  if (userWoodAtaIxPhase2)    phase2BondingSplit.push(userWoodAtaIxPhase2);
  if (wrapIxs.length)         phase2BondingSplit.push(...wrapIxs);
  if (founderBuyIxPhase2)     phase2BondingSplit.push(founderBuyIxPhase2);

 showStep(totalSteps === 3 ? 3 : 2, totalSteps, "Creator pre-buy");
try {
  await sendIxsOnce(connection, wallet, phase2BondingSplit);
} catch (e: any) {
  const joined = (e?.logs ? (e.logs as string[]).join(" ") : "").toLowerCase();
  const benign =
    joined.includes("createidempotent") ||
    joined.includes("initializeimmutableowner") ||
    joined.includes("please upgrade to spl token 2022");
  if (!benign) throw e;
}


  // ✅ Redirect after success
  closeSteps();
setTradeModal({ open: true, memeMint: memeMintBuild.mint, configPda });
setStatus("Sound Meme & Pool created!");
return; // wait for user to click the CTA

}



// Phase 2 (AMM only): (A) liquidity tx, then (B) locker tx
if (isAmm) {
  const addLiqIx2 = await poolProgram.methods
    .addLiquidity(
      new BN(initialMemeLiquidity * 10 ** MEME_DECIMALS),
      new BN(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS),
    )
    .accounts({
      config:          configPda,
      poolMemeVault,
      poolWoodengVault,
      user:            wallet.publicKey!,
      userMemeAta:     creatorMemeAta,
      userWoodengAta:  userWoodAta,
      lpMint:          lpMintBuild.mint,
      userLpAta,
      tokenProgram:    TOKEN_PROGRAM_ID,
    })
    .instruction();

  // --- Phase-2 preflight (AMM, simplified: LP ATA + quote ATA only) ---
{
  const rentAta = await connection.getMinimumBalanceForRentExemption(165);
  let need = 30_000; // fee pad

  const lpInfo = await connection.getAccountInfo(userLpAta);
  if (!lpInfo) need += rentAta;

  if (quoteToken === 'SOL') {
    const wAta = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
    const wInfo = await connection.getAccountInfo(wAta);
    if (!wInfo) need += rentAta;
  } else {
    const qAta = await getAssociatedTokenAddress(QUOTE_MINT, wallet.publicKey!, false);
    const qInfo = await connection.getAccountInfo(qAta);
    if (!qInfo) need += rentAta;
  }

  const haveSol = await connection.getBalance(wallet.publicKey!);
  if (haveSol < need) {
    throw new Error(`Not enough SOL for rent/fees (~${(need/1e9).toFixed(6)} SOL needed). Top up and retry.`);
  }
}


  // (A) LIQUIDITY TX ONLY
  const phase2IxsSplit: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
  ];

  // Ensure user's LP ATA
  phase2IxsSplit.push(userLpAtaIx);

  // Ensure/fund quote side
  if (quoteToken === 'SOL') {
    const lamportsNeeded2 = Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS);
    if (lamportsNeeded2 > 0) {
      const FEE_PAD  = 30_000;
      const wsolAta  = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey!, false);
      const wsolInfo = await connection.getAccountInfo(wsolAta);
      const rent     = wsolInfo ? 0 : await connection.getMinimumBalanceForRentExemption(165);
      const need     = lamportsNeeded2 + rent + FEE_PAD;

      const bal = await connection.getBalance(wallet.publicKey!);
      if (bal < need) {
        throw new Error(
          `Not enough SOL to wrap ${(lamportsNeeded2/1e9).toFixed(9)} SOL and pay ~${(rent/1e9).toFixed(6)} SOL rent + fees. ` +
          `Keep at least ${(need/1e9).toFixed(6)} SOL.`
        );
      }

      const w2 = await buildWrapSolIxs(wallet.publicKey!, lamportsNeeded2);
      userWoodAta = w2.ata;
      phase2IxsSplit.push(...w2.ixs);
    }
  } else {
    const res2 = await ensureAtaIx(wallet.publicKey!, QUOTE_MINT, wallet.publicKey!, false);
    userWoodAta = res2.ata;
    phase2IxsSplit.push(res2.ix);

    // Optional: assert WOODENG balance is enough
    const bal = await connection.getTokenAccountBalance(userWoodAta).catch(() => null);
    const have = bal ? BigInt(bal.value.amount) : 0n;
    const need = BigInt(Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS));
    if (have < need) {
      throw new Error(
        `Need ${initialQuoteLiquidity} WOODENG to seed the pool; your WOODENG ATA has ${(Number(have)/1e9).toFixed(6)}.`
      );
    }
  }

  // Add liquidity (tx A)
  phase2IxsSplit.push(addLiqIx2);

  // Send (A)
  showStep(3, totalSteps, "Seed liquidity",
    `Deposit ${initialMemeLiquidity} ${memeSymbol} + ${initialQuoteLiquidity} ${quoteLabel} into the pool.`);
  await sendIxsOnce(connection, wallet, phase2IxsSplit);



// ✅ Redirect immediately
closeSteps();
setTradeModal({ open: true, memeMint: memeMintBuild.mint, configPda });
setStatus("Sound Meme & Pool created!");
return; // wait for user to click the CTA


}


// Finalize (both split-path variants)
} catch (e: any) {
  let friendly = '';
  let extra = '';
  try {
    if (e instanceof SendTransactionError) {
      const logs = await e.getLogs(connection);
      if (logs?.length) {
        extra = '\n' + logs.join('\n');
        const low = logs.join(' ').toLowerCase();
        if (low.includes('createidempotent') && low.includes('insufficient lamports')) {
          const rent = await connection.getMinimumBalanceForRentExemption(165);
          friendly = `Not enough SOL to create a token account (~${(rent/1e9).toFixed(6)} SOL per new account). Top up a little SOL and retry.\n\n`;
        }
      }
    } else if (e?.logs) {
      extra = '\n' + (e.logs as string[]).join('\n');
    }
  } catch {}

  const msg = (e?.message ?? String(e));
  const full = friendly ? (friendly + msg + extra) : (msg + extra);

  showStep(1, 1, "❌ Error", full);
  setStatus(`Error: ${msg}`);
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
  if (!wallet.publicKey || !locker) return;
  setStatus("Locking tokens & minting NFT...");
  try {
    const { memeMint, nftMint, lockerPda } = locker;

    const userMemeToken    = await ensureAtaExists(wallet.publicKey, memeMint, wallet.publicKey, wallet, false);
    const lockerMemeAccount= await ensureAtaExists(lockerPda,       memeMint, wallet.publicKey, wallet, true);
    const userNftToken     = await ensureAtaExists(wallet.publicKey, nftMint, wallet.publicKey, wallet, false);

    // 👇 required by IDL
    const metadata = findMetadataPda(nftMint);

    const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "confirmed" });
    const program  = new Program(idlJson as Idl, PROGRAM_ID, provider);

    // use values already stored on the locker (your IDL has these fields)
    const name   = String(locker.memeName ?? "Sound Meme");
    const symbol = String(locker.memeSymbol ?? "SMEME");
    const uri    = String(locker.memeUri ?? ""); // if blank, pass your coin JSON

    await program.methods
      .lockTokensAndMintNft(name, symbol, uri)
      .accounts({
        user: wallet.publicKey,
        locker: lockerPda,
        userMemeAccount: userMemeToken,
        lockerMemeAccount,
        nftMint,
        userNftAccount: userNftToken,
        metadata,                               // 👈 required
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID, // 👈 required
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    setStatus("Tokens locked and NFT minted!");
  } catch (e: unknown) {
    setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
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
    <div className="bg-[#181920] text-white min-h-screen pt-[92px] sm:pt-[108px] pb-8 sm:pb-12 px-4 sm:px-6 flex flex-col items-center">
      <ModalPortal>
  <StepModal
    open={txStep.open}
    step={txStep.step}
    total={txStep.total}
    title={txStep.title}
    details={txStep.details}
    onClose={() => setTxStep(s => ({ ...s, open: false }))}
  />

  {tradeModal.open && tradeModal.memeMint && (
    <div
  className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4 pt-[max(env(safe-area-inset-top),1rem)]"
  onClick={() => setTradeModal({ open: false })}
>

      <div
        className="relative bg-[#1b1c20] rounded-xl p-6 sm:p-8 w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"                 // <-- make it explicit
          className="absolute top-4 right-4"
          autoFocus                     // <-- focus here, not the CTA
          onClick={() => setTradeModal({ open: false })}
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-4">Sound Meme Created!</h2>

        <p className="break-all text-sm bg-[#23252b] rounded p-3 mb-6">
          {tradeModal.memeMint.toBase58()}
        </p>

        <button
          type="button"                // <-- IMPORTANT: prevent implicit submit
          className="w-full py-3 rounded bg-[#ffc371] text-black font-bold hover:bg-[#ffb24d]"
          onClick={() => {
            if (navigatingRef.current) return
            navigatingRef.current = true
            setTradeModal({ open: false })
            router.push(`/sound-memes?mint=${tradeModal.memeMint!.toBase58()}&buy=1`)
            window.scrollTo(0, 0)
          }}
        >
          Trade your Sound Meme
        </button>
      </div>
    </div>
  )}
</ModalPortal>



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
  <WalletMultiButton className="w-full sm:w-auto" />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block mb-1 font-medium">Total Supply</label>
                      <input
  type="number"
  className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2"
  value={totalSupply}
  onChange={e => setTotalSupply(Number(e.target.value) || 0)}
  disabled={isBonding}
/>
<span className="text-xs text-[#aaa]">
  {isBonding
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


                    {/* Socials (optional) */}
<div className="mt-4">
  <label className="block mb-2 font-bold">
    Socials <span className="text-xs font-normal text-[#9aa1af]">(optional)</span>
  </label>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {/* X / Twitter */}
    <div className="relative">
      <div className="absolute left-3 top-2.5">
        <Twitter className="w-4 h-4 text-[#b5b5be]" />
      </div>
      <input
        className="w-full bg-[#181920] border border-[#282a31] rounded pl-9 pr-3 py-2"
        placeholder="@handle or https://x.com/handle"
        value={xUrl}
        onChange={(e) => setXUrl(e.target.value)}
      />
    </div>

    {/* Telegram */}
    <div className="relative">
      <div className="absolute left-3 top-2.5">
        <Send className="w-4 h-4 text-[#b5b5be]" />
      </div>
      <input
        className="w-full bg-[#181920] border border-[#282a31] rounded pl-9 pr-3 py-2"
        placeholder="@channel or https://t.me/channel"
        value={tgUrl}
        onChange={(e) => setTgUrl(e.target.value)}
      />
    </div>

    {/* Website */}
    <div className="relative">
      <div className="absolute left-3 top-2.5">
        <Globe className="w-4 h-4 text-[#b5b5be]" />
      </div>
      <input
        className="w-full bg-[#181920] border border-[#282a31] rounded pl-9 pr-3 py-2"
        placeholder="myproject.xyz or https://…"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
      />
    </div>
  </div>

  {/* tiny helper */}
  <p className="text-[11px] text-[#8d95a5] mt-2">
    Tips: Enter a <b>@handle</b> (X / Telegram) or paste a URL. We will automatically format the links.
  </p>
</div>

                </div>
                <div>
                  <label className="block mb-1 font-bold">Cover Image</label>
                  <span className="text-sm">Image (PNG/JPG, optional but recommended)</span>
                  <FileUploader onUri={(uri, type) => setCoverImageUri(uri)} />


                  <label className="block mb-1 font-bold">Media File</label>
                  <span className="text-sm">Audio *</span>
                  <FileUploader onUri={(uri, type) => { setAudioUri(uri); setFileType(type) }} />


                  <div className="text-xs text-[#aaa] flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" />
                    Maximum duration: 3 minutes. Formats: MP3 / M4A(AAC) / OGG (max 25 MB)

                  </div>
                </div>
              </div>

              {/* Pool Settings */}
              <div>
                <div className="flex items-center gap-3 mb-4 mt-10">
                  <Coins className="w-5 h-5 text-[#FFE66D]" />
                  <h2 className="text-xl font-semibold">Pool Settings</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mb-3">
                  <label>
                    <input type="radio" checked={isBonding} onChange={() => setPoolType('bonding')} />
                    <span className="ml-1">Bonding (Fairlaunch)</span>
                  </label>
                  <label>
                    <input type="radio" checked={isAmm} onChange={() => setPoolType('amm')} />
                    <span className="ml-1">AMM (You add the liquidity)</span>
                  </label>
                </div>

                {/* Launch currency (card picker) */}
<div className="mb-4">
  <div className="flex items-center justify-between mb-2">
    <span className="font-medium">Launch currency</span>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {[
      {
        key: 'WOODENG' as const,
        title: 'WOODENG',
        blurb: 'Use the ecosystem token for a better promotion of the trading pool of your sound meme.',
      },
      {
        key: 'SOL' as const,
        title: 'SOL',
        blurb: 'Fund with SOL — we auto-wrap to wSOL under the hood.',
      },
    ].map((opt) => {
      const active = quoteToken === opt.key;
      return (
        <button
          key={opt.key}
          type="button"
          onClick={() => setQuoteToken(opt.key)}
          className={[
            'text-left rounded-xl border p-4 bg-[#1a1b22] hover:bg-[#1f2128] transition',
            active ? 'border-[#ffc371] ring-2 ring-[#ffc371]/30' : 'border-[#2b2d35]'
          ].join(' ')}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{opt.title}</span>
            {active && (
              <span className="text-[10px] px-2 py-1 rounded bg-[#ffc371] text-black">
                Selected
              </span>
            )}
          </div>
          <p className="text-xs text-[#9aa1af] mt-1">{opt.blurb}</p>
        </button>
      );
    })}
  </div>

  <p className="text-[11px] text-[#8d95a5] mt-2">
    This sets the currency paired with your meme at launch. Traders will buy your token with <b>{quoteLabel}</b>.
  </p>
</div>




                {/* ⬇️ PASTE THIS BLOCK RIGHT HERE ⬇️ */}
  {isBonding && (
    <div className="mt-4 p-4 rounded-lg bg-[#1a1b22] border border-[#2b2d35]">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="w-4 h-4 text-[#FFE66D]" />
        <span className="font-medium">Creator pre-buy (max 1%)</span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={1}
          step={/* 0.01% steps */ 0.01}
          value={founderBuyPct}
          onChange={(e) => {
            const v = Math.max(0, Math.min(1, Number(e.target.value)));
            setFounderBuyPct(v);
          }}
          className="w-full accent-[#ffc371]"
        />
        <div className="w-16 text-right tabular-nums">
          {founderBuyPct.toFixed(2)}%
        </div>
      </div>

      <div className="mt-2 text-xs text-[#9aa1af]">
        You’ll pre-buy <b>{fmt(founderBuyTokens)}</b> MEME (≈ {founderBuyPct.toFixed(2)}% of 444,000,000).
      </div>
    </div>
  )}
  

               {/* ─────────── Liquidity inputs ─────────── */}
{poolType === 'amm' && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
      <label className="block mb-1 font-medium">
  Initial {quoteLabel} Liquidity
</label>
<input
  type="number"
  value={initialQuoteLiquidity}
  onChange={e => setInitialQuoteLiquidity(Number(e.target.value) || 0)}
  className="w-full bg-[#181920] border border-[#282a31] rounded px-3 py-2"
/>
<span className="text-xs text-[#aaa]">
  Amount of {quoteLabel} for pool
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
  <input
    type="checkbox"
    checked={agreedTOS}
    onChange={e => setAgreedTOS(e.target.checked)}
    className="accent-[#4ECDC4]"
  />
  I agree to the{" "}
  <Link
    href="/terms"
    className="underline text-[#4ECDC4]"
    onClick={(e) => {
      // prevent the label from toggling the checkbox when clicking the link
      e.stopPropagation();
    }}
  >
    Terms of Service
  </Link>
</label>

              </div>

              <LiquidChargeButton
  type="submit"
  disabled={!agreedOwn || !agreedTOS}
  className="w-full"
>
  Create Sound Meme & Pool <span className="ml-2">🌊<span className="ml-1">🔔</span></span>
</LiquidChargeButton>


            </form>
          </div>
        </div>

       
      </div>
    </div>
  )
}




