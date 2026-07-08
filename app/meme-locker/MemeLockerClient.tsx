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
 

 import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useNetwork } from '../network-context'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet'



import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID, createInitializeMintInstruction, createMintToInstruction,
  createSetAuthorityInstruction, AuthorityType, createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token'
import idlJson from '../../idl/hybrid_meme_coin_nft_locker.json'
import lockerIdlV2Json from '../../idl/hybrid_meme_coin_nft_locker_v2.json'
import poolIdlJson from '../../idl/my_sound_meme_pool.json'
import poolIdlV2Json from '../../idl/my_sound_meme_pool_v2.json'




import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata';



import { Siren as Fire, Info, Coins, Volume2 } from 'lucide-react'
import { Globe, Send, Twitter } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { LiquidChargeButton } from "../../src/contexts/components/LiquidChargeButton"
import { useRouter } from 'next/navigation'




// Mounts children directly under <body> so the modals are outside any <form>
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}


// ── DEVNET TESTING ──────────────────────────────────────────────────────────
// Runtime toggle — controlled by UI switch, defaults to mainnet (v1)
// DO NOT hardcode to true/false — the toggle lives in the component state
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=6b56ae36-a263-4599-a807-43a5289701dc';
const MAINNET_RPC = (() => {
  const rpc = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOLANA_RPC && process.env.NEXT_PUBLIC_SOLANA_RPC.startsWith('http'))
    ? process.env.NEXT_PUBLIC_SOLANA_RPC
    : 'https://mainnet.helius-rpc.com/?api-key=6b56ae36-a263-4599-a807-43a5289701dc';
  return rpc;
})();

// ⚠️ LOCKER: deploy to devnet and paste the new program ID here
const LOCKER_PROGRAM_ID_DEVNET = new PublicKey('kqS1V5vUTtJC4bGqt2VhYy6Se2w1naUkS5t78Weprb4');
const LOCKER_PROGRAM_ID_MAINNET = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');

const POOL_PROGRAM_ID_DEVNET = new PublicKey('C1pGixxtxw1z8x7eGcG2kzs4ZWBkXKVLwPJsDjxWTsin');
const POOL_PROGRAM_ID_MAINNET = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');

// Devnet vs mainnet WOODENG mints
const WOODENG_MINT_DEVNET = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');
const WOODENG_MINT_MAINNET = new PublicKey('83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5');

// V21 has 4th arg (minAvgHoldDays). Set to false until you redeploy v21 on devnet.
// Once deployed: flip to true.
const V2_IS_V21 = true; // v21 is deployed on devnet with holderProfile + minAvgHoldDays

// Always mainnet V2 — toggle removed
function getClusterConfig() {
  return {
    connection: new Connection(MAINNET_RPC, { commitment: 'processed' }),
    programId: LOCKER_PROGRAM_ID_MAINNET,
    poolProgramId: POOL_PROGRAM_ID_DEVNET, // V2 placeholder — update after mainnet deploy
    woodengMint: WOODENG_MINT_MAINNET,
    stakingProgramId: STAKING_PROGRAM_ID_MAINNET,
    isV2: true,
    isV21: true,
  };
}

// Default connection for initial render (mainnet)
const USE_DEVNET = false; // kept for backward compat in non-toggle code paths

// These are now derived from the toggle — see getClusterConfig()
// Kept as defaults for code that runs outside the component
const PROGRAM_ID = LOCKER_PROGRAM_ID_MAINNET;
const POOL_PROGRAM_ID = POOL_PROGRAM_ID_MAINNET;

// Default mainnet WOODENG — overridden by cluster.woodengMint in component
const WOODENG_MINT = WOODENG_MINT_MAINNET;

// ── CONNECTION (default mainnet, overridden by toggle in component) ──
const connection = new Connection(MAINNET_RPC, { commitment: 'processed' });

const BONDING_SUPPLY = 444_000_000;


const STAKING_PROGRAM_ID_MAINNET = new PublicKey('BFJU3f7PXgzcrYPD2MkQsjRko9wDTpEbyJTtLUzSyhFG');
const STAKING_PROGRAM_ID_DEVNET = new PublicKey('9Q5BUszjz6HFNXXPWerjn1HM7sTvdXVaNqswJAzZC1s');
// Default for module-level code (mainnet)
const STAKING_PROGRAM_ID = STAKING_PROGRAM_ID_MAINNET;


const WSOL_MINT = NATIVE_MINT;       // So11111111111111111111111111111111111111112
const QUOTE_DECIMALS = 9;            // WOODENG and wSOL both use 9


// must mirror program constants
const CURVE_THRESHOLD = 44_000_000;                     // BONDING_CURVE_THRESHOLD
const L = 10 ** QUOTE_DECIMALS;               // 1e9

// Must mirror on-chain program constants:
const TARGET_PRICE_LAMPORTS_SOL      = 2_857;            // 0.000002857 SOL/MEME — ~40 SOL to graduate
const TARGET_PRICE_LAMPORTS_WOODENG  = 100_000_000;     // 0.1 WOODENG/MEME — matches Rust

function targetPriceFor(mint: PublicKey): number {
  return mint.equals(WSOL_MINT) ? TARGET_PRICE_LAMPORTS_SOL : TARGET_PRICE_LAMPORTS_WOODENG;
}

const BONDING_FEE_BPS = 150; // 1.5%


const METADATA_PREFIX = Buffer.from('metadata');
const EDITION_PREFIX  = Buffer.from('edition');

function findMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [METADATA_PREFIX, TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function findMasterEditionPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [METADATA_PREFIX, TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), EDITION_PREFIX],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}




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





// ✅ Single-blob sender: wallet signs FIRST, then extra signers
export async function sendIxsOnce(
  connection: Connection,
  wallet: SignerWallet,
  ixs: TransactionInstruction[],
  signers: Keypair[] = [],
  { skipPreflight = false }: { skipPreflight?: boolean } = {}
) {
  if (!wallet.publicKey) throw new Error('Wallet has no public key');

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized');

  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  let signedByWallet: Transaction;

  if (wallet.signTransaction) {
    signedByWallet = await wallet.signTransaction(tx);
  } else if (wallet.signAllTransactions) {
    signedByWallet = (await wallet.signAllTransactions([tx]))[0];
  } else {
    throw new Error("Wallet cannot sign transactions. Reconnect wallet.");
  }

  // ✅ extra signers AFTER wallet
  if (signers.length) signedByWallet.partialSign(...signers);

  const sig = await connection.sendRawTransaction(
    signedByWallet.serialize(),
    { skipPreflight }
  );

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return sig;
}

// back-compat shim
export async function sendTx(
  connection: Connection,
  wallet: SignerWallet,
  tx: Transaction,
  extraSigners: Keypair[] = []
) {
  return sendIxsOnce(connection, wallet, tx.instructions, extraSigners);
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


// Derive the next locker PDA for (memeMint, user). Initializes the counter only if missing.
async function ensureCounterAndNextLocker(
  provider: AnchorProvider,
  memeMint: PublicKey,
  user: PublicKey
): Promise<{
  counterPda: PublicKey;
  lockerPda: PublicKey;
  nextLockId: bigint;
  maybeInitCounterIx?: TransactionInstruction; // present only if counter needs init
}> {
  const program = new Program(idlJson as Idl, PROGRAM_ID, provider);

  // derive counter PDA
  const [counterPda] = await PublicKey.findProgramAddress(
    [Buffer.from('counter'), memeMint.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );

  // check if the counter exists
  let nextId = 0n;
  let maybeInitCounterIx: TransactionInstruction | undefined;

  const counterInfo = await provider.connection.getAccountInfo(counterPda);
  if (counterInfo) {
    const acc: any = await program.account.lockCounter.fetch(counterPda);
    nextId = BigInt(acc.count.toString()); // Anchor BN -> bigint
  } else {
    // build an ix to create counter (count=0)
    maybeInitCounterIx = await program.methods
      .initializeCounter()
      .accounts({
        user,
        counter: counterPda,
        memeMint,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    nextId = 0n;
  }

  // derive locker PDA using that nextId
  const le = new Uint8Array(8);
  new DataView(le.buffer).setBigUint64(0, nextId, true);
  const [lockerPda] = await PublicKey.findProgramAddress(
    [Buffer.from('locker'), memeMint.toBuffer(), user.toBuffer(), le],
    PROGRAM_ID
  );

  return { counterPda, lockerPda, nextLockId: nextId, maybeInitCounterIx };
}



// helpers to derive staking PDAs — accept mint + program ID for devnet vs mainnet
function findStakingConfigPda(woodengMint: PublicKey = WOODENG_MINT, stakingProgram: PublicKey = STAKING_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config'), woodengMint.toBuffer()],
    stakingProgram
  )[0];
}


function findStakingRewardsVaultPdaWood(woodengMint: PublicKey = WOODENG_MINT, stakingProgram: PublicKey = STAKING_PROGRAM_ID): PublicKey {
  // seeds: ["reward_vault", woodengMint]
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault'), woodengMint.toBuffer()],
    stakingProgram
  )[0];
}

function findStakingRewardsVaultPdaWsol(config: PublicKey): PublicKey {
  // The WSOL vault is an ATA owned by the config PDA, NOT a program PDA
  return getAssociatedTokenAddressSync(WSOL_MINT, config, true);
}


// near your other helpers in page.tsx
async function assertStakingReady(conn: Connection, woodengMint: PublicKey = WOODENG_MINT, isDevnet = false, stakingProgram: PublicKey = STAKING_PROGRAM_ID) {
  const cfg = findStakingConfigPda(woodengMint, stakingProgram);
  const wsolVault = findStakingRewardsVaultPdaWsol(cfg);
  const woodVault = findStakingRewardsVaultPdaWood(woodengMint, stakingProgram);
  const infos = await conn.getMultipleAccountsInfo([cfg, wsolVault, woodVault]);
  if (isDevnet) {
    // On devnet, staking might not be initialized — skip the check
    if (!infos[0]) { console.warn('[devnet] Staking not initialized — skipping staking fees'); return; }
  } else {
    if (!infos[0]) throw new Error('Staking not initialized: missing Config PDA');
    if (!infos[1]) throw new Error('Staking not initialized: missing WSOL rewards vault');
    if (!infos[2]) throw new Error('Staking not initialized: missing WOODENG rewards vault');
  }
}


const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
function makeUniqueMemoIx(tag: string) {
  const nonce = `${tag}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(nonce),
  });
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
// replace your current toStreamUrl with this safer version
const toStreamUrl = (uri: string) => {
  if (!uri) return '';
  // ipfs://CID[/path]  -> gateway
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  // https(s)://.../ipfs/CID[/path]  -> leave as-is
  if (/^https?:\/\//i.test(uri)) return uri;
  // bare CID -> gateway
  if (/^[a-zA-Z0-9]{46,}$/.test(uri)) return `https://ipfs.io/ipfs/${uri}`;
  return uri;
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
  isPdaOwner = false,
  connection: Connection
): Promise<PublicKey> {
  const tokenProgram = await getTokenProgramForMint(connection, mint);

  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    isPdaOwner,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const ix = createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata,
    owner,
    mint,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  tx.feePayer = payer;
  tx.recentBlockhash = blockhash;

  await sendTx(connection, wallet, tx);
  return ata;
}




function getLockerPda(memeMint: PublicKey, user: PublicKey, lockId: bigint | number) {
  const le = new Uint8Array(8);
  new DataView(le.buffer).setBigUint64(0, BigInt(lockId), true);
  return PublicKey.findProgramAddress(
    [Buffer.from('locker'), memeMint.toBuffer(), user.toBuffer(), le],
    PROGRAM_ID
  );
}



async function getConfigPda(memeMint: PublicKey, programId: PublicKey = POOL_PROGRAM_ID) {
  return await PublicKey.findProgramAddress([Buffer.from('config'), memeMint.toBuffer()], programId)
}
function getPoolMemeVaultPda(memeMint: PublicKey, programId: PublicKey = POOL_PROGRAM_ID): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress([Buffer.from('pool_meme_vault'), memeMint.toBuffer()], programId)
}
function getPoolWoodengVaultPda(memeMint: PublicKey, programId: PublicKey = POOL_PROGRAM_ID): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress([Buffer.from('pool_woodeng_vault'), memeMint.toBuffer()], programId)
}

// === read live pool params so JS math matches the program ===
async function readPoolParams(
  poolProgram: Program,
  configPda: PublicKey,
  defaults: {
    p0Lamports: BN,
    targetPriceLamports: number,
    threshold: number,
    feeBps: number
  }
): Promise<{
  soldSoFar: number;        // tokens sold so far (x0)
  feeBps: number;           // effective fee in bps
  targetPriceLamports: number;
  threshold: number;
  p0Lamports: number;
}> {
  try {
    const cfg: any = await poolProgram.account.config.fetch(configPda);

    // adapt field names if your IDL differs
    const soldSoFar = Number((cfg.sold ?? cfg.soldSoFar ?? 0).toString?.() ?? cfg.sold ?? 0);
    const feeBps    = Number(cfg.feeBps ?? cfg.tradeFeeBps ?? defaults.feeBps);
    const target    = Number((cfg.targetPriceLamports ?? defaults.targetPriceLamports).toString?.() ?? cfg.targetPriceLamports ?? defaults.targetPriceLamports);
    const thr       = Number(cfg.threshold ?? cfg.curveThreshold ?? defaults.threshold);
    const p0        = Number((cfg.p0Lamports ?? defaults.p0Lamports).toString?.() ?? cfg.p0Lamports ?? defaults.p0Lamports);

    return {
      soldSoFar: isFinite(soldSoFar) ? soldSoFar : 0,
      feeBps:    isFinite(feeBps) ? feeBps : defaults.feeBps,
      targetPriceLamports: isFinite(target) ? target : defaults.targetPriceLamports,
      threshold: isFinite(thr) ? thr : defaults.threshold,
      p0Lamports: isFinite(p0) ? p0 : Number(defaults.p0Lamports.toString()),
    };
  } catch {
    return {
      soldSoFar: 0,
      feeBps: defaults.feeBps,
      targetPriceLamports: defaults.targetPriceLamports,
      threshold: defaults.threshold,
      p0Lamports: Number(defaults.p0Lamports.toString()),
    };
  }
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
async function getTokenProgramForMint(conn: Connection, mint: PublicKey) {
  const info = await conn.getAccountInfo(mint);

  // ✅ If the mint doesn't exist yet (because we're about to create it in the same tx),
  // assume it's a classic SPL Token mint.
  if (!info) return TOKEN_PROGRAM_ID;

  return info.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
}


async function ensureAtaIx(
  owner: PublicKey,
  mint: PublicKey,
  payer: PublicKey,
  isPdaOwner = false
): Promise<{ ata: PublicKey; ix: TransactionInstruction }> {
  // ✅ detect Tokenkeg vs Token-2022 based on mint owner
  const tokenProgram = await getTokenProgramForMint(connection, mint);

  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    isPdaOwner,
    tokenProgram,                 // ✅ important
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const ix = createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata,
    owner,
    mint,
    tokenProgram,                 // ✅ important
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return { ata, ix };
}


// ───────── Mint creation builder: returns { mint, ixs, signers } — no send ─────────
async function buildCreateMintIx(
  payer: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  vanitySuffix?: string, // e.g. "woo"
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): Promise<{ mint: PublicKey; ixs: TransactionInstruction[]; signers: Keypair[] }> {
  // IMPORTANT: keep the await here
  const kp = vanitySuffix ? await mineVanityKeypair(vanitySuffix) : Keypair.generate();

  const lamports = await connection.getMinimumBalanceForRentExemption(82);
  const createIx = SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: kp.publicKey,
    lamports,
    space: 82,
    programId: tokenProgramId,
  });
  const initIx = createInitializeMintInstruction(kp.publicKey, decimals, mintAuthority, null, tokenProgramId);

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
  programId: PublicKey;
  isV2: boolean;
}): Promise<{
  lockerPda: PublicKey;
  nftMint: PublicKey;
  ixs: TransactionInstruction[];
  signers: Keypair[];
}> {
  const { provider, wallet, memeMint, threshold, metaUri, memeName, memeSymbol, programId, isV2 } = params;
  const lockerProgram = new Program((isV2 ? lockerIdlV2Json : idlJson) as Idl, programId, provider);
  const user = wallet.publicKey!;

  console.log('[buildLockerIxs] ──────────────────────────────────────');
  console.log('[buildLockerIxs] PROGRAM_ID:', programId.toBase58());
  console.log('[buildLockerIxs] memeMint:', memeMint.toBase58());
  console.log('[buildLockerIxs] user:', user.toBase58());

  // (a) Create the NFT mint (0 decimals, classic SPL Token) — returns ixs + signer
  const nftMintBuild = await buildCreateMintIx(user, 0, user);
  console.log('[buildLockerIxs] nftMint:', nftMintBuild.mint.toBase58());

  // (b) Derive counter PDA and check if it exists
  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('counter'), memeMint.toBuffer(), user.toBuffer()],
    programId
  );

  let nextId = 0n;
  let maybeInitCounterIx: TransactionInstruction | undefined;

  const counterInfo = await provider.connection.getAccountInfo(counterPda);
  if (counterInfo) {
    const acc: any = await lockerProgram.account.lockCounter.fetch(counterPda);
    nextId = BigInt(acc.count.toString());
    console.log('[buildLockerIxs] counter EXISTS, count =', nextId.toString());
  } else {
    maybeInitCounterIx = await lockerProgram.methods
      .initializeCounter()
      .accounts({
        user,
        counter: counterPda,
        memeMint,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    nextId = 0n;
    console.log('[buildLockerIxs] counter DOES NOT EXIST, will init with count=0');
  }

  // (c) Derive locker PDA using nextId
  const lockIdBytes = new Uint8Array(8);
  new DataView(lockIdBytes.buffer).setBigUint64(0, nextId, true);

  const [lockerPda, lockerBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('locker'), memeMint.toBuffer(), user.toBuffer(), Buffer.from(lockIdBytes)],
    programId
  );

  console.log('[buildLockerIxs] lockId (u64 LE):', Array.from(lockIdBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
  console.log('[buildLockerIxs] lockerPda:', lockerPda.toBase58());
  console.log('[buildLockerIxs] lockerBump:', lockerBump);

  // (d) Locker meme vault ATA (owned by PDA)
  const { ata: lockerMemeAta, ix: lockerMemeAtaIx } =
    await ensureAtaIx(lockerPda, memeMint, user, true);

  // (e) Hand NFT mint authority to the locker PDA (classic SPL Token)
  const setAuthIx = createSetAuthorityInstruction(
    nftMintBuild.mint,
    user,
    AuthorityType.MintTokens,
    lockerPda,
  );

  // (f) Build initializeLocker instruction
  const initLockerIx = await lockerProgram.methods
    .initializeLocker(new BN(threshold), memeName, memeSymbol, metaUri)
    .accounts({
      user,
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

  // Log every account key in the instruction for debugging
  const expectedNames = [
    'user', 'counter', 'locker', 'memeMint', 'nftMint',
    'lockerMemeAccount', 'systemProgram', 'tokenProgram',
    'associatedTokenProgram', 'rent'
  ];
  console.log('[buildLockerIxs] initLockerIx account keys:');
  initLockerIx.keys.forEach((k, i) => {
    const label = expectedNames[i] || `extra[${i}]`;
    console.log(`  [${i}] ${label}: ${k.pubkey.toBase58()} (signer=${k.isSigner}, writable=${k.isWritable})`);
  });
  console.log('[buildLockerIxs] ──────────────────────────────────────');

  // Instruction ordering:
  const ixs = [
    ...nftMintBuild.ixs,             // create + init NFT mint (authority = wallet)
    lockerMemeAtaIx,                 // locker's meme vault ATA
    ...(maybeInitCounterIx ? [maybeInitCounterIx] : []),
    setAuthIx,                       // set mint authority to locker PDA
    initLockerIx,                    // then create locker
  ];

  return { lockerPda, nftMint: nftMintBuild.mint, ixs, signers: nftMintBuild.signers };
}


 

function FileUploader({ onUri }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fileUrl, setFileUrl] = useState('');
  const [mime, setMime] = useState('');
  const [duration, setDuration] = useState<number | null>(null);   // NEW
  const [fileName, setFileName] = useState('');                    // NEW
  const [fileSize, setFileSize] = useState<string>('');            // NEW
  const inputRef = React.useRef<HTMLInputElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null); // NEW


  const upload = async (file: File) => {
    setError('');
    setUploading(true);
    setDuration(null);
    try {
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');

      if (!isAudio && !isImage) throw new Error('File must be audio or image');

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
        setDuration(secs); // store for display
      } else if (isImage) {
        const ok = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type);
        if (!ok) throw new Error('Image must be PNG or JPG');
      }

      setFileName(file.name);
      setFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);

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

  // util to format mm:ss
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = Math.round(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
      className={[
        'rounded-xl border-2 border-dashed transition-colors mb-4 cursor-pointer',
        dragOver ? 'bg-[#FFC371]/20 border-[#FFC371]' : 'bg-[#181920] border-[#FFC371]',
        'p-4 sm:p-6'
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
    >
      <input
        type="file"
        ref={inputRef}
        style={{ display: 'none' }}
        accept="image/png,image/jpeg,audio/mpeg,audio/mp4,audio/aac,audio/x-aac,audio/ogg"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />

      {/* Header / call to action */}
      <div className="flex items-center justify-between">
        <div className="text-sm sm:text-base">
          {uploading ? 'Uploading…' : 'Drop file here or tap to select'}
        </div>

        {/* BIG "uploaded" pill for mobile */}
        {fileUrl && (
          <span className="ml-3 inline-flex items-center text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-[#ffc371] text-black">
            Uploaded ✓
          </span>
        )}
      </div>

      {/* Preview / details */}
      {fileUrl && (
        <div className="mt-3">
          {/* Big thumbnail or audio bar */}
          {mime.startsWith('audio/')
            ? (
              <>
                <audio
  key={fileUrl}                                 // force fresh load when src changes
  ref={audioRef}                                // NEW
  controls
  preload="metadata"                            // fetch duration without downloading audio
  src={toStreamUrl(fileUrl)}
  className="w-full rounded"
  onLoadedMetadata={() => {                     // iOS/Safari scrubber nudge
    const a = audioRef.current;
    if (!a) return;
    try {
      const was = a.currentTime || 0;
      // Move a hair forward then back to force duration/scrubber paint
      a.currentTime = Math.min(0.01, (a.duration || 0) > 0 ? 0.01 : 0);
      a.currentTime = was;
    } catch {}
  }}
/>

                <div className="mt-2 text-xs sm:text-sm text-[#c9cbd6]">
                  <div className="font-semibold">{fileName}</div>
                  <div>
                    Size: {fileSize}
                    
                  </div>             
                </div>
              </>
            ) : (
              <div className="relative mt-2">
                <img
                  src={toStreamUrl(fileUrl)}
                  alt="Uploaded"
                  className="w-full rounded-lg border border-[#2b2d35]"
                />
                {/* BIG ribbon so users can't miss it */}
                <div className="mt-2 text-xs sm:text-sm text-[#c9cbd6]">
                  <div className="font-semibold">{fileName}</div>
                  <div>Size: {fileSize}</div>
                </div>
              </div>
            )
          }
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
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

        <div className="mt-3 p-2 rounded-md bg-[#262735]">
  <div className="text-sm sm:text-base font-semibold leading-snug">
    ⚠️ Keep this window open while you approve wallet prompts.
  </div>
  <div className="text-[11px] sm:text-xs text-[#9aa1af] mt-1 leading-snug">
    Closing it may interrupt the transaction flow.
  </div>
</div>


      </div>
    </div>
  );
}


// ------- MAIN COMPONENT --------

export default function MemeLockerFactory() {


  
  const wallet = useWallet()
  const { publicKey: unifiedPublicKey, connected: unifiedConnected, signTransaction: unifiedSignTransaction } = useUnifiedWallet()
  const effectivePublicKey = wallet.publicKey ?? unifiedPublicKey
  const effectiveConnected = wallet.connected || unifiedConnected
  const { connection: walletAdapterConnection } = useConnection()

  const cluster = React.useMemo(() => getClusterConfig(), []);

  // Ensure wallet adapter stays on mainnet
  const { setEndpoint } = useNetwork();
  useEffect(() => {
    setEndpoint(MAINNET_RPC);
  }, [setEndpoint]);

  useEffect(() => {
    walletAdapterConnection.getGenesisHash().then(h => console.log('[GENESIS]', h)).catch(console.error)
  }, [walletAdapterConnection])

  // ── Holder whitelist (v2 only) ──
  const [minAvgHoldDays, setMinAvgHoldDays] = useState(0);

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
  const [totalSupply] = useState(444_000_000) // always 444M for culture memes
  const [threshold] = useState(44400) // fixed at 44,400 for SWL-444
  const [memeDescription, setMemeDescription] = useState("")
  const [audioUri, setAudioUri] = useState("")
  const [fileType, setFileType] = useState("audio/mpeg")
  const [coverImageUri, setCoverImageUri] = useState("")


  const [coverImageMime, setCoverImageMime] = useState<string>("");
const [audioMime, setAudioMime] = useState<string>("");



    // ✅ socials (must live inside the component)
  const [xUrl, setXUrl] = useState("");
  const [tgUrl, setTgUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // UI toggles
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [diamondGateOpen, setDiamondGateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // inside the component, near other hooks
const inFlight = useRef(false);
const [busy, setBusy] = useState(false); // for UI disable


  // Pool Settings
  const [poolType, setPoolType] = useState<'bonding' | 'amm'>('bonding')

 const isAmm = poolType === 'amm';
const isBonding = !isAmm;

  const [quoteToken, setQuoteToken] = useState<'WOODENG' | 'SOL'>('WOODENG');
const QUOTE_MINT  = quoteToken === 'WOODENG' ? cluster.woodengMint : WSOL_MINT;
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


// totalSupply is always 444M — no effect needed


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


// ── AMM: derived "creator keeps" helper ─────────────────────────────────────
const creatorKeeps = isAmm ? Math.max(0, totalSupply - initialMemeLiquidity) : 0;

const WIZARD_STEPS = [
  { num: 1, label: 'Identity & Media' },
  { num: 2, label: 'Economics' },
  { num: 3, label: 'Protection' },
  { num: 4, label: 'Launch' },
] as const;

const step1Valid = memeName.trim().length > 0 && memeSymbol.trim().length > 0 && audioUri.trim().length > 0;
const step2Valid = !isAmm || (initialMemeLiquidity > 0 && initialQuoteLiquidity > 0 && initialMemeLiquidity <= totalSupply);
const canAdvance = ([step1Valid, step2Valid, true, false] as const)[wizardStep - 1] ?? false;


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
    { metadata: mdPda, mint, mintAuthority: payer, payer, updateAuthority: payer, systemProgram: SystemProgram.programId, // ✅ add
    rent: SYSVAR_RENT_PUBKEY, },
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


// lamports user must SEND to get exactly `desiredOut` tokens on a log curve
function grossLamportsForExactOutTokens(
  desiredOut: number,          // MEME out (0 decimals)
  p0Lamports: number,          // starting price (lamports / MEME)
  targetPriceLamports: number, // lamports / MEME at threshold
  threshold: number,           // curve threshold (tokens)
  feeBps: number = 100,        // effective fee bps
  soldSoFar: number = 0        // x already sold before this buy
): BN {
  if (desiredOut <= 0) return new BN(0);

  // continuous log curve params
  const k = Math.log(targetPriceLamports / p0Lamports) / threshold;

  // local price at current sold
  const pAtX0 = p0Lamports * Math.exp(k * soldSoFar);

  // lamports that must ARRIVE in the pool (post-fee)
  const toPool = (pAtX0 / k) * Math.expm1(k * desiredOut);

  // convert to gross input before fees
  const feeFactor = 1 - feeBps / 10_000;
  const gross = Math.ceil(toPool / Math.max(1e-12, feeFactor)); // avoid div by 0

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
  // Use the cluster-specific connection (devnet or mainnet based on toggle)
  const conn = cluster.connection;
  try {
    if (inFlight.current) return;
inFlight.current = true;
setBusy(true);

    if (!effectiveConnected || !effectivePublicKey) throw new Error("Connect your wallet first!");
    if (!memeName.trim() || !memeSymbol.trim() || !audioUri.trim()) throw new Error("Fill all meme details and upload audio!");
    if (!agreedTOS || !agreedOwn) throw new Error("You must accept the terms to proceed.");

    // ── NETWORK MISMATCH GUARD ──────────────────────────────────────────────
    // walletAdapterConnection reflects Phantom's actual RPC endpoint (set via
    // ConnectionProvider). cluster.connection is our own devnet/mainnet RPC.
    // Check walletAdapterConnection so we detect when Phantom is still on mainnet.
    const DEVNET_GENESIS  = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
    try {
      const genesisHash = await walletAdapterConnection.getGenesisHash();
      if (genesisHash === DEVNET_GENESIS) {
        throw new Error(
          '🔴 Network mismatch! Phantom is on Devnet. Switch Phantom back to Mainnet in Settings.'
        );
      }
    } catch (e: any) {
      if (e.message?.startsWith('🔴')) throw e;
      // genesis check failed for unrelated reason — let it through
    }
    // ── END NETWORK MISMATCH GUARD ──────────────────────────────────────────

    // ── AMM guard: meme liquidity must not exceed total supply ──
    if (isAmm) {
      if (initialMemeLiquidity > totalSupply) {
        throw new Error(
          `Meme liquidity (${initialMemeLiquidity.toLocaleString()}) cannot exceed total supply (${totalSupply.toLocaleString()}). ` +
          `The pool gets ${initialMemeLiquidity.toLocaleString()} and you keep ${creatorKeeps.toLocaleString()}.`
        );
      }
      if (initialMemeLiquidity <= 0) {
        throw new Error("Set the amount of meme tokens to seed into the pool (Initial Meme Liquidity).");
      }
      if (initialQuoteLiquidity <= 0) {
        throw new Error(`Set the amount of ${quoteLabel} to seed into the pool.`);
      }
    }

    const pk = effectivePublicKey!;
    const effectiveWalletForProvider = {
      publicKey: pk,
      signTransaction: (wallet.signTransaction ?? unifiedSignTransaction) as any,
      signAllTransactions: (wallet.signAllTransactions ?? ((txs: any[]) => Promise.all(txs.map((tx: any) => (wallet.signTransaction ?? unifiedSignTransaction)(tx))))) as any,
      sendTransaction: wallet.sendTransaction,
    };
    const provider = new AnchorProvider(cluster.connection, effectiveWalletForProvider as any, { preflightCommitment: "confirmed" });
    // fees go to the creator (connected wallet)
const feeOwner = pk;

    const poolProgram = new Program((cluster.isV2 ? poolIdlV2Json : poolIdlJson) as Idl, cluster.poolProgramId, provider);


    // One persistent progress count for the whole flow
const totalSteps =
  3 + (isAmm ? 1 : (founderBuyPct > 0 ? 1 : 0));
// AMM: 4 (Upload → Create+Init → Seed Liquidity → Create Locker)
// Bonding w/o pre-buy: 3 (Upload → Create+Init → Create Locker)
// Bonding w/ pre-buy: 4 (Upload → Create+Init → Creator pre-buy → Create Locker)


    // 1) Off-chain uploads (unchanged)
    showStep(1, totalSteps, "Upload media & metadata", "Pinning cover + audio + metadata.json to IPFS…");


    const imgCid   = coverImageUri;
    const audioCid = audioUri;

    if (!/^ipfs:\/\//.test(audioCid)) {
  throw new Error("Audio is missing or not an ipfs:// URL");
}
if (!/^ipfs:\/\//.test(imgCid)) {
  throw new Error("Cover image is missing or not an ipfs:// URL");
}

    
    // normalize socials just-in-time
const xUrlN   = xUrl ? normalizeUrl(xUrl, 'x') : "";
const tgUrlN  = tgUrl ? normalizeUrl(tgUrl, 'telegram') : "";
const webUrlN = websiteUrl ? normalizeUrl(websiteUrl, 'website') : "";

const metaJson = {
  name: memeName,
  symbol: memeSymbol,
  description: memeDescription || "",
  image: imgCid,                 // ipfs://...
  animation_url: audioCid,       // ipfs://...
  external_url: webUrlN || undefined,
  extensions: {
    threshold: Number(threshold),
    twitter:  xUrlN || undefined,
    telegram: tgUrlN || undefined,
    website:  webUrlN || undefined,
  },
  attributes: [
    { trait_type: "Category", value: "Sound Meme" },
    { trait_type: "Threshold", value: String(threshold) },
  ],
  properties: {
    category: "audio",
    files: [
      { uri: imgCid,   type: coverImageMime || "image/png" },
      { uri: audioCid, type: audioMime      || "audio/mpeg" },
    ],
  },
};




function validateMeta(j: any) {
  if (!j.image || !j.animation_url) throw new Error("Missing image or animation_url");
  const files = j?.properties?.files || [];
  const okImg  = files.some((f:any) => /^image\//.test(f.type) && /^ipfs:\/\//.test(f.uri));
  const okAudi = files.some((f:any) => /^audio\//.test(f.type) && /^ipfs:\/\//.test(f.uri));
  if (!okImg || !okAudi) throw new Error("properties.files must include one image/* and one audio/* entry");
}
validateMeta(metaJson);



    const metaUri = await pinFile(new File([JSON.stringify(metaJson)], "metadata.json", { type:"application/json" }));

    // 2) Build on-chain instructions (we'll sign ONCE)
    showStep(2, totalSteps, "Preparing on-chain creation", "Deriving PDAs, creating mints, ATAs & metadata…");



    // mints (vanity "woo" for MEME)
showStep(2, totalSteps, 'Mining vanity mint', 'Looking for a mint address ending with "woo"…');


const memeMintBuild = await buildCreateMintIx(
  pk,
  MEME_DECIMALS,
  pk,
  'woo' // ← vanity suffix
);

// sanity guard: abort if somehow not "woo"
const _memeMintB58 = memeMintBuild.mint.toBase58();
console.log('[MEME mint candidate]', _memeMintB58);
if (!_memeMintB58.endsWith('woo')) {
  throw new Error(`Vanity mint check failed. Got ${_memeMintB58}, expected to end with "woo".`);
}

// LP mint is normal (no vanity)
const lpMintBuild = await buildCreateMintIx(pk, 0, pk);


    // metadata for MEME
const mdIx = buildMetadataIx(pk, memeMintBuild.mint, metaUri, memeName, memeSymbol);

// placeholders for things we'll send in Phase-2 (bonding)

let founderBuyIxPhase2: TransactionInstruction | null = null;
let userWoodAtaIxPhase2: TransactionInstruction | null = null;
let creatorMemeAtaIxPhase2: TransactionInstruction | null = null;


    // PDAs
    const [configPda]        = await getConfigPda(memeMintBuild.mint, cluster.poolProgramId);
    const [poolMemeVault]    = await getPoolMemeVaultPda(memeMintBuild.mint, cluster.poolProgramId);
    const [poolWoodengVault] = await getPoolWoodengVaultPda(memeMintBuild.mint, cluster.poolProgramId);

   



    // fee vault (PROJECT_WALLET, WOODENG)
    const { ata: lpFeeVault, ix: lpFeeVaultIx } =
  await ensureAtaIx(feeOwner, QUOTE_MINT, pk, false);



    // creator meme ATA (for AMM seeding)
    const { ata: creatorMemeAta, ix: creatorMemeAtaIx } =
      await ensureAtaIx(pk, memeMintBuild.mint, pk, false);

    // optional: user WOODENG / LP ATAs (for AMM)
    let userWoodAta: PublicKey;
let userWoodAtaIx: TransactionInstruction | null = null;
let wrapIxs: TransactionInstruction[] = [];

if (quoteToken === 'SOL') {
  // We'll decide the required amount below in each path and fill wrapIxs there
  // For now we only know the ATA address:
  userWoodAta = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
} else {
  // bonding: defer creating the ATA to Phase-2
  userWoodAta = await getAssociatedTokenAddress(QUOTE_MINT, pk, false);
  // userWoodAtaIx will be built (and sent) in Phase-2
}


const isWsolPair = QUOTE_MINT.equals(WSOL_MINT);
const stakingConfigPda = findStakingConfigPda(cluster.woodengMint, cluster.stakingProgramId);
const stakingRewardsVaultPda = isWsolPair
  ? findStakingRewardsVaultPdaWsol(stakingConfigPda)
  : findStakingRewardsVaultPdaWood(cluster.woodengMint, cluster.stakingProgramId);

    const { ata: userLpAta,   ix: userLpAtaIx } =
      await ensureAtaIx(pk, lpMintBuild.mint, pk, false);





      // --- Guard: make sure we have enough SOL to create any missing ATAs ---
const TOKEN_ACC_SIZE = 165; // SPL token account size
const tokenAccRent = await cluster.connection.getMinimumBalanceForRentExemption(TOKEN_ACC_SIZE);

const ataCandidates: PublicKey[] = [
  lpFeeVault,
  ...(isAmm ? [creatorMemeAta] : []),
];

const ataInfos = await Promise.all(ataCandidates.map(a => cluster.connection.getAccountInfo(a)));
const missingCount = ataInfos.filter(a => !a).length;

const FEE_PAD = 30_000;
const needNow = missingCount * tokenAccRent + FEE_PAD;

const payerBal = await cluster.connection.getBalance(pk);
if (payerBal < needNow) {
  const needSol = needNow / 1e9;
  const haveSol = payerBal / 1e9;
  throw new Error(
    `Not enough SOL to create token accounts. Need ~${needSol.toFixed(6)} SOL, you have ${haveSol.toFixed(6)} SOL. ` +
    `Each new token account costs ~${(tokenAccRent/1e9).toFixed(6)} SOL in rent.`
  );
}


    // price params — 15x range (pump.fun-like), using per-quote-mint target
    const P1_LAMPORTS = targetPriceFor(QUOTE_MINT);
    const P1_UI = P1_LAMPORTS / (10 ** QUOTE_DECIMALS);
    const DEFAULT_P0_UI = P1_UI / 15;
    const p0Lamports = new BN(Math.floor(DEFAULT_P0_UI * 10 ** QUOTE_DECIMALS));

    const poolInfo = await cluster.connection.getAccountInfo(cluster.poolProgramId);
console.log("POOL program exists?", !!poolInfo, "executable?", poolInfo?.executable);
if (!poolInfo?.executable) throw new Error("POOL_PROGRAM_ID is not executable on this cluster. Wrong cluster or not deployed.");



    // v21 (devnet after redeploy): pass min_avg_hold_days as 4th arg
    // v20 or v1: only 3 args
    const initIx = cluster.isV21
      ? await poolProgram.methods
          .initializeSoundMemeAndPool(p0Lamports, isBonding, new BN(threshold), minAvgHoldDays)
          .accounts({
            authority: pk,
            config: configPda,
            memeMint: memeMintBuild.mint,
            poolMemeVault,
            poolWoodengVault,
            lpMint: lpMintBuild.mint,
            woodengMint: QUOTE_MINT,
            projectWalletOwner: feeOwner,
            projectWalletAta: lpFeeVault,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction()
      : await poolProgram.methods
          .initializeSoundMemeAndPool(p0Lamports, isBonding, new BN(threshold))
          .accounts({
            authority: pk,
            config: configPda,
            memeMint: memeMintBuild.mint,
            poolMemeVault,
            poolWoodengVault,
            lpMint: lpMintBuild.mint,
            woodengMint: QUOTE_MINT,
            projectWalletOwner: feeOwner,
            projectWalletAta: lpFeeVault,
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
    makeUniqueMemoIx('create'),            // NEW: make tx unique
  ...computeIxs,
  ...memeMintBuild.ixs,
  ...lpMintBuild.ixs,
  lpFeeVaultIx,
  mdIx,                       // ← metadata BEFORE init
];

// AMM needs creator's MEME ATA in Phase-1; Bonding can defer it
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
    throw new Error(
      `Initial meme liquidity (${initialMemeLiquidity.toLocaleString()}) cannot exceed total supply (${totalSupply.toLocaleString()}). ` +
      `Reduce meme liquidity or increase total supply.`
    );
  }
  const supplyToMint = totalSupply * 10 ** MEME_DECIMALS; // MEME_DECIMALS = 0
  ixsPhase1.push( // ✅ correct array in the happy path
    buildMintToIx(
      memeMintBuild.mint,
      creatorMemeAta,
      pk,
      supplyToMint
    )
  );

  // NOTE: userLpAtaIx will be sent in Phase 2

  // Log the split so it's visible in console
  console.log(`[AMM] Total supply: ${totalSupply}, Pool gets: ${initialMemeLiquidity}, Creator keeps: ${creatorKeeps}`);

  // 2) Fund quote (wrap SOL or ensure quote ATA)
    if (quoteToken === 'SOL') {
    // We will wrap SOL in Phase 2 right before addLiquidity
    userWoodAta = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
  } else {
    // We will create the WOODENG ATA idempotently in Phase 2
  }


}

// 3) Now initialize (takes mint authorities)
ixsPhase1.push(initIx);


// Derive HolderProfile PDA (used in prebuy for both code paths)
const HOLDER_SEED_PREBUY = Buffer.from('holder');
const [holderProfilePrebuy] = PublicKey.findProgramAddressSync(
  [HOLDER_SEED_PREBUY, pk.toBuffer()],
  cluster.poolProgramId,
);

// 4) Pool-specific (bonding) — prepare for Phase-2 only
if (isBonding && founderQty > 0) {

  await assertStakingReady(conn, cluster.woodengMint, cluster.isV2, cluster.stakingProgramId); // ✅ prevent 0xbc4

  // read live pool params (fee, sold, curve) to quote accurately
  const live = await readPoolParams(poolProgram, configPda, {
  p0Lamports,
  targetPriceLamports: targetPriceFor(QUOTE_MINT),  // ✅ per-quote mint
  threshold: CURVE_THRESHOLD,
  feeBps: BONDING_FEE_BPS,
});


// ask for slightly less out (−1%) and overpay a bit (+2%) to defeat rounding
const exactTarget  = founderQty;
const pricedTarget = Math.max(1, Math.floor(exactTarget * 0.99));

// min_out is the conservative amount we accept
const founderMinOut = new BN(pricedTarget);

// compute gross lamports using **on-chain** params
const lamportsIn0 = grossLamportsForExactOutTokens(
  pricedTarget,
  live.p0Lamports,
  live.targetPriceLamports,
  live.threshold,
  live.feeBps,
  live.soldSoFar
);

// send a touch more to cover integer rounding inside the program
const lamportsInBN = lamportsIn0.muln(102).divn(100).addn(1);


  if (quoteToken === 'SOL') {
  const lamportsInNum = Number(lamportsInBN.toString());
  if (lamportsInNum > 0) {
    const FEE_PAD  = 30_000;
    const wsolAta  = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
    const wsolInfo = await conn.getAccountInfo(wsolAta);
    const rent     = wsolInfo ? 0 : await conn.getMinimumBalanceForRentExemption(165);
    const need     = lamportsInNum + rent + FEE_PAD;

    const bal = await conn.getBalance(pk);
    if (bal < need) {
      throw new Error(
        `Not enough SOL to wrap ${(lamportsInNum/1e9).toFixed(9)} SOL and pay ~${(rent/1e9).toFixed(6)} SOL rent + fees. ` +
        `Keep at least ${(need/1e9).toFixed(6)} SOL.`
      );
    }
    const w = await buildWrapSolIxs(pk, lamportsInNum);
    userWoodAta = w.ata;
    wrapIxs     = w.ixs;
  }
}
 else {

    // ensure WOODENG ATA idempotently (Phase-2)
    const res = await ensureAtaIx(pk, QUOTE_MINT, pk, false);
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
    buyer:            pk,
    buyerMemeAta:     creatorMemeAta,
    buyerWoodengAta:  userWoodAta,
    projectWalletAta: lpFeeVault,
    holderProfile:    holderProfilePrebuy,

    // 👇 REQUIRED by new Trade context
    stakingConfig:        stakingConfigPda,
    stakingRewardsVault:  stakingRewardsVaultPda,
    stakingProgram: cluster.stakingProgramId,

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
      user:            pk,
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
        ? [
            "• Create idempotent ATAs (creator + fee vault)",
            `• Mint ${totalSupply.toLocaleString()} tokens to your wallet`,
          ]
        : ["• Create idempotent ATAs (fee vault)"]),
    "• Initialize the pool (takes authorities)",
    isAmm
  ? `• Next step: seed ${initialMemeLiquidity.toLocaleString()} MEME + ${initialQuoteLiquidity.toLocaleString()} ${quoteLabel} into pool (you keep ${creatorKeeps.toLocaleString()} MEME)`
  : `• (Bonding) Optional creator pre-buy: ${founderBuyPct.toFixed(2)}%`,

  ].join("\n")
);




    try {
      await sendIxsOnce(cluster.connection, effectiveWalletForProvider, ixsPhase1, signersPhase1, { skipPreflight: false });


// keep modal open; next step will update it



// BONDING: optional creator pre-buy only (no locker)
if (isBonding) {
  if (founderBuyIxPhase2) {
    showStep(totalSteps === 3 ? 3 : 2, totalSteps,
      "Creator pre-buy",
      `Buying ~${founderBuyPct.toFixed(2)}% of supply before trading opens.`
    );

    // Init HolderProfile if missing or stale (< 48 bytes = old struct without firstBuyTs)
    const hpInfoPrebuy = await cluster.connection.getAccountInfo(holderProfilePrebuy);
    if (!hpInfoPrebuy || hpInfoPrebuy.data.length < 48) {
      const initHpIx = await poolProgram.methods
        .initHolderProfile()
        .accounts({
          buyer:         pk,
          holderProfile: holderProfilePrebuy,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      await sendIxsOnce(
        cluster.connection, effectiveWalletForProvider,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
          initHpIx,
        ],
        [],
        { skipPreflight: false }
      );
    }

    const phase2Bonding: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
      makeUniqueMemoIx('prebuy'),        // 👈 add this
      ...(creatorMemeAtaIxPhase2 ? [creatorMemeAtaIxPhase2] : []),
      ...(userWoodAtaIxPhase2 ? [userWoodAtaIxPhase2] : []),
      ...wrapIxs,
      founderBuyIxPhase2,
    ];

    await sendIxsOnce(cluster.connection, effectiveWalletForProvider, phase2Bonding, [], { skipPreflight: true });

  }

// ── Phase 3: Create Locker (bonding path) ────────────────────────────────
showStep(totalSteps, totalSteps, "Creating Sound NFT locker",
  "Setting up locker so fans can lock tokens → mint NFTs…"
);

const lockerBuild = await buildLockerIxs({
  provider,
  wallet: effectiveWalletForProvider,
  memeMint: memeMintBuild.mint,
  threshold,
  metaUri,
  memeName,
  memeSymbol,
  programId: cluster.programId,
  isV2: cluster.isV2,
});

await sendIxsOnce(
  cluster.connection, effectiveWalletForProvider,
  [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    makeUniqueMemoIx('init-locker'),
    ...lockerBuild.ixs,
  ],
  lockerBuild.signers,
  { skipPreflight: false }
);

closeSteps();
setTradeModal({ open: true, memeMint: memeMintBuild.mint, configPda });
setStatus("Sound Meme & Pool created!");
return; // wait for user to click the CTA

}



// AMM: Phase 2 = seed liquidity (then locker)
if (isAmm && addLiqIxPhase2) {
  // --- simplified preflight: only LP ATA + quote ATA rent ---
  {
    const rentAta = await conn.getMinimumBalanceForRentExemption(165);
    let need = 30_000; // fee pad
    const lpInfo = await conn.getAccountInfo(userLpAta);
    if (!lpInfo) need += rentAta;

    if (quoteToken === 'SOL') {
      const wAta = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
      const wInfo = await conn.getAccountInfo(wAta);
      if (!wInfo) need += rentAta;
    } else {
      const qAta = await getAssociatedTokenAddress(QUOTE_MINT, pk, false);
      const qInfo = await conn.getAccountInfo(qAta);
      if (!qInfo) need += rentAta;
    }

    const haveSol = await conn.getBalance(pk);
    if (haveSol < need) {
      throw new Error(`Not enough SOL for rent/fees (~${(need/1e9).toFixed(6)} SOL needed). Top up and retry.`);
    }
  }

  // Build tx
  const phase2Ixs: TransactionInstruction[] = [
      makeUniqueMemoIx('seed-liquidity'),    // NEW

    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
    userLpAtaIx, // idempotent create
  ];

  if (quoteToken === 'SOL') {
    const lamportsNeeded = Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS);
    if (lamportsNeeded > 0) {
      const w = await buildWrapSolIxs(pk, lamportsNeeded);
      userWoodAta = w.ata;
      phase2Ixs.push(...w.ixs);
    }
  } else {
    const res = await ensureAtaIx(pk, QUOTE_MINT, pk, false);
    userWoodAta = res.ata;
    phase2Ixs.push(res.ix);

    const bal = await conn.getTokenAccountBalance(userWoodAta).catch(() => null);
    const have = bal ? BigInt(bal.value.amount) : 0n;
    const need = BigInt(Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS));
    if (have < need) throw new Error(
      `Need ${initialQuoteLiquidity} ${quoteLabel} to seed the pool; current balance is ${(Number(have)/1e9).toFixed(6)}.`
    );
  }

  phase2Ixs.push(addLiqIxPhase2);

  // show "step 3/3" (Upload=1, Create=2, Seed=3)
  showStep(3, totalSteps, "Seed liquidity",
    `Depositing ${initialMemeLiquidity.toLocaleString()} ${memeSymbol} + ${initialQuoteLiquidity.toLocaleString()} ${quoteLabel} into the pool.\n` +
    `You will keep ${creatorKeeps.toLocaleString()} ${memeSymbol} in your wallet.`
  );
  await sendIxsOnce(cluster.connection, effectiveWalletForProvider, phase2Ixs, [], { skipPreflight: true });


  // ── Phase 3: Create Locker (AMM path) ────────────────────────────────────
  showStep(totalSteps, totalSteps, "Creating Sound NFT locker",
    "Setting up locker so fans can lock tokens → mint NFTs…"
  );

  const lockerBuildAmm = await buildLockerIxs({
    provider,
    wallet: effectiveWalletForProvider as any,
    memeMint: memeMintBuild.mint,
    threshold,
    metaUri,
    memeName,
    memeSymbol,
    programId: cluster.programId,
    isV2: cluster.isV2,
  });

  await sendIxsOnce(
    cluster.connection, effectiveWalletForProvider,
    [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      makeUniqueMemoIx('init-locker'),
      ...lockerBuildAmm.ixs,
    ],
    lockerBuildAmm.signers,
    { skipPreflight: false }
  );

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
    makeUniqueMemoIx('create-split'),      // NEW
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
    throw new Error(
      `Initial meme liquidity (${initialMemeLiquidity.toLocaleString()}) exceeds total supply (${totalSupply.toLocaleString()}).`
    );
  }
  const supplyToMint = totalSupply * 10 ** MEME_DECIMALS; // 0-decimals -> integer
  ixsP1.push(
    buildMintToIx(
      memeMintBuild.mint,
      creatorMemeAta,
      pk,
      supplyToMint
    ),
  );
  // LP ATA + quote funding will be sent in Phase 2
  if (quoteToken === 'SOL') {
    userWoodAta = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
  }


}

// Now init
ixsP1.push(initIx);

// Bonding founder buy in split phase
if (isBonding) {
  const exactTargetP1 = founderBuyTokens;
if (exactTargetP1 > 0) {
  await assertStakingReady(conn, cluster.woodengMint, cluster.isV2, cluster.stakingProgramId); // ✅ prevent 0xbc4
  const live = await readPoolParams(poolProgram, configPda, {
    p0Lamports,
    targetPriceLamports: targetPriceFor(QUOTE_MINT),

    threshold: CURVE_THRESHOLD,
    feeBps: BONDING_FEE_BPS,
  });

  const pricedTargetP1 = Math.max(1, Math.floor(exactTargetP1 * 0.99));
  const founderMinOutP1 = new BN(pricedTargetP1);

  const lamportsIn0P1 = grossLamportsForExactOutTokens(
    pricedTargetP1,
    live.p0Lamports,
    live.targetPriceLamports,
    live.threshold,
    live.feeBps,
    live.soldSoFar
  );

  const lamportsInP1 = lamportsIn0P1.muln(102).divn(100).addn(1);
  const lamportsInNum = Number(lamportsInP1.toString());
 


    if (quoteToken === 'SOL') {
  if (lamportsInNum > 0) {
    const FEE_PAD  = 30_000;
    const wsolAta  = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
    const wsolInfo = await conn.getAccountInfo(wsolAta);
    const rent     = wsolInfo ? 0 : await conn.getMinimumBalanceForRentExemption(165);
    const need     = lamportsInNum + rent + FEE_PAD;

    const bal = await conn.getBalance(pk);
    if (bal < need) {
      throw new Error(
        `Not enough SOL to wrap ${(lamportsInNum/1e9).toFixed(9)} SOL and pay ~${(rent/1e9).toFixed(6)} SOL rent + fees. ` +
        `Keep at least ${(need/1e9).toFixed(6)} SOL.`
      );
    }

    const w = await buildWrapSolIxs(pk, lamportsInNum);
    userWoodAta = w.ata;
    wrapIxs     = w.ixs; // send in Phase-2
  }
} else {
  const res = await ensureAtaIx(pk, QUOTE_MINT, pk, false);
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
    buyer:            pk,
    buyerMemeAta:     creatorMemeAta,
    buyerWoodengAta:  userWoodAta,
    projectWalletAta: lpFeeVault,
    

    // 👇 add these two
    stakingConfig:        stakingConfigPda,
    stakingRewardsVault:  stakingRewardsVaultPda,

    stakingProgram: cluster.stakingProgramId,
    

    tokenProgram:     TOKEN_PROGRAM_ID,
    systemProgram:    SystemProgram.programId,
  })
  .instruction();
  }
}



showStep(2, totalSteps, "Create mints + init",
  isAmm
    ? `Creates mints/metadata/ATAs and initializes the pool.\nMinting ${totalSupply.toLocaleString()} tokens. Liquidity seeding follows next.`
    : "Creates mints/metadata/ATAs and initializes the pool."
);



await sendIxsOnce(cluster.connection, effectiveWalletForProvider, ixsP1, signersPhase1, { skipPreflight: true });



// Bonding Phase-2 (metadata + ATAs + founder buy)
if (isBonding) {
  // Init HolderProfile if missing or stale before prebuy
  if (founderBuyIxPhase2) {
    const hpInfoSplit = await cluster.connection.getAccountInfo(holderProfilePrebuy);
    if (!hpInfoSplit || hpInfoSplit.data.length < 48) {
      const initHpIxSplit = await poolProgram.methods
        .initHolderProfile()
        .accounts({
          buyer:         pk,
          holderProfile: holderProfilePrebuy,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      await sendIxsOnce(
        cluster.connection, effectiveWalletForProvider,
        [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
          initHpIxSplit,
        ],
        [],
        { skipPreflight: false }
      );
    }
  }

  const phase2BondingSplit: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    makeUniqueMemoIx('prebuy'),        // 👈 add this
  ];
  if (creatorMemeAtaIxPhase2) phase2BondingSplit.push(creatorMemeAtaIxPhase2);
  if (userWoodAtaIxPhase2)    phase2BondingSplit.push(userWoodAtaIxPhase2);
  if (wrapIxs.length)         phase2BondingSplit.push(...wrapIxs);
  if (founderBuyIxPhase2)     phase2BondingSplit.push(founderBuyIxPhase2);

 showStep(totalSteps === 3 ? 3 : 2, totalSteps, "Creator pre-buy");
try {
  await sendIxsOnce(cluster.connection, effectiveWalletForProvider, phase2BondingSplit, [], { skipPreflight: true });

} catch (e: any) {
  const joined = (e?.logs ? (e.logs as string[]).join(" ") : "").toLowerCase();
  const benign =
    joined.includes("createidempotent") ||
    joined.includes("initializeimmutableowner") ||
    joined.includes("please upgrade to spl token 2022");
  if (!benign) throw e;
}


  // ✅ Phase 3: Create Locker (split bonding path)
  showStep(totalSteps, totalSteps, "Creating Sound NFT locker",
    "Setting up locker so fans can lock tokens → mint NFTs…"
  );

  const lockerBuildSplitB = await buildLockerIxs({
    provider,
    wallet: effectiveWalletForProvider as any,
    memeMint: memeMintBuild.mint,
    threshold,
    metaUri,
    memeName,
    memeSymbol,
    programId: cluster.programId,
    isV2: cluster.isV2,
  });

  await sendIxsOnce(
    cluster.connection, effectiveWalletForProvider,
    [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      makeUniqueMemoIx('init-locker'),
      ...lockerBuildSplitB.ixs,
    ],
    lockerBuildSplitB.signers,
    { skipPreflight: false }
  );

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
      user:            pk,
      userMemeAta:     creatorMemeAta,
      userWoodengAta:  userWoodAta,
      lpMint:          lpMintBuild.mint,
      userLpAta,
      tokenProgram:    TOKEN_PROGRAM_ID,
    })
    .instruction();

  // --- Phase-2 preflight (AMM, simplified: LP ATA + quote ATA only) ---
{
  const rentAta = await conn.getMinimumBalanceForRentExemption(165);
  let need = 30_000; // fee pad

  const lpInfo = await conn.getAccountInfo(userLpAta);
  if (!lpInfo) need += rentAta;

  if (quoteToken === 'SOL') {
    const wAta = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
    const wInfo = await conn.getAccountInfo(wAta);
    if (!wInfo) need += rentAta;
  } else {
    const qAta = await getAssociatedTokenAddress(QUOTE_MINT, pk, false);
    const qInfo = await conn.getAccountInfo(qAta);
    if (!qInfo) need += rentAta;
  }

  const haveSol = await conn.getBalance(pk);
  if (haveSol < need) {
    throw new Error(`Not enough SOL for rent/fees (~${(need/1e9).toFixed(6)} SOL needed). Top up and retry.`);
  }
}


  // (A) LIQUIDITY TX ONLY
  const phase2IxsSplit: TransactionInstruction[] = [
      makeUniqueMemoIx('seed-liquidity-2'),  // NEW

    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
  ];

  // Ensure user's LP ATA
  phase2IxsSplit.push(userLpAtaIx);

  // Ensure/fund quote side
  if (quoteToken === 'SOL') {
    const lamportsNeeded2 = Math.floor(initialQuoteLiquidity * 10 ** QUOTE_DECIMALS);
    if (lamportsNeeded2 > 0) {
      const FEE_PAD  = 30_000;
      const wsolAta  = await getAssociatedTokenAddress(NATIVE_MINT, pk, false);
      const wsolInfo = await conn.getAccountInfo(wsolAta);
      const rent     = wsolInfo ? 0 : await conn.getMinimumBalanceForRentExemption(165);
      const need     = lamportsNeeded2 + rent + FEE_PAD;

      const bal = await conn.getBalance(pk);
      if (bal < need) {
        throw new Error(
          `Not enough SOL to wrap ${(lamportsNeeded2/1e9).toFixed(9)} SOL and pay ~${(rent/1e9).toFixed(6)} SOL rent + fees. ` +
          `Keep at least ${(need/1e9).toFixed(6)} SOL.`
        );
      }

      const w2 = await buildWrapSolIxs(pk, lamportsNeeded2);
      userWoodAta = w2.ata;
      phase2IxsSplit.push(...w2.ixs);
    }
  } else {
    const res2 = await ensureAtaIx(pk, QUOTE_MINT, pk, false);
    userWoodAta = res2.ata;
    phase2IxsSplit.push(res2.ix);

    // Optional: assert WOODENG balance is enough
    const bal = await conn.getTokenAccountBalance(userWoodAta).catch(() => null);
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
    `Depositing ${initialMemeLiquidity.toLocaleString()} ${memeSymbol} + ${initialQuoteLiquidity.toLocaleString()} ${quoteLabel} into the pool.\n` +
    `You will keep ${creatorKeeps.toLocaleString()} ${memeSymbol} in your wallet.`
  );
  await sendIxsOnce(cluster.connection, effectiveWalletForProvider, phase2IxsSplit, [], { skipPreflight: true });




// ✅ Phase 3: Create Locker (split AMM path)
showStep(totalSteps, totalSteps, "Creating Sound NFT locker",
  "Setting up locker so fans can lock tokens → mint NFTs…"
);

const lockerBuildSplitA = await buildLockerIxs({
  provider,
  wallet: effectiveWalletForProvider,
  memeMint: memeMintBuild.mint,
  threshold,
  metaUri,
  memeName,
  memeSymbol,
  programId: cluster.programId,
  isV2: cluster.isV2,
});

await sendIxsOnce(
  cluster.connection, effectiveWalletForProvider,
  [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    makeUniqueMemoIx('init-locker'),
    ...lockerBuildSplitA.ixs,
  ],
  lockerBuildSplitA.signers,
  { skipPreflight: false }
);

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
          const rent = await conn.getMinimumBalanceForRentExemption(165);
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
} finally {
  inFlight.current = false;
  setBusy(false); // ✅ IMPORTANT: unlock UI + allow a second attempt
}




}



  // ====== SEARCH BAR LOGIC: fetch meme by address ======
  async function handleSearch() {
    setSearchResult(null)
    setStatus("Searching...")
    try {
      const addr = new PublicKey(searchAddress.trim())
      const provider = new AnchorProvider(cluster.connection, wallet as any, { preflightCommitment: "confirmed" })
      const program = new Program((cluster.isV2 ? lockerIdlV2Json : idlJson) as Idl, cluster.programId, provider)
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
  if (!effectivePublicKey || !locker) return;
  setStatus("Locking tokens & minting NFT...");
  try {
    const pk = effectivePublicKey!;
    const { memeMint, nftMint, lockerPda } = locker;
    const effectiveWallet = {
      publicKey: pk,
      signTransaction: (wallet.signTransaction ?? unifiedSignTransaction) as any,
      signAllTransactions: (wallet.signAllTransactions ?? ((txs: any[]) => Promise.all(txs.map((tx: any) => (wallet.signTransaction ?? unifiedSignTransaction)(tx))))) as any,
      sendTransaction: wallet.sendTransaction,
    };

    const userMemeToken    = await ensureAtaExists(pk, memeMint, pk, effectiveWallet as any, false, cluster.connection);
    const lockerMemeAccount= await ensureAtaExists(lockerPda, memeMint, pk, effectiveWallet as any, true,  cluster.connection);
    const userNftToken     = await ensureAtaExists(pk, nftMint, pk, effectiveWallet as any, false, cluster.connection);

    // 👇 required by IDL
    const metadata = findMetadataPda(nftMint);
    const edition  = findMasterEditionPda(nftMint); // 👈 add this

    const provider = new AnchorProvider(cluster.connection, effectiveWallet as any, { preflightCommitment: "confirmed" });
    const lockerProgram = new Program((cluster.isV2 ? lockerIdlV2Json : idlJson) as Idl, cluster.programId, provider);

    // use values already stored on the locker (your IDL has these fields)
    const name   = String(locker.memeName ?? "Sound Meme");
    const symbol = String(locker.memeSymbol ?? "SMEME");
    const uri    = String(locker.memeUri ?? ""); // if blank, pass your coin JSON

    const ix = await lockerProgram.methods
  .lockTokensAndMintNft(name, symbol, uri)
  .accounts({
    user: pk,
    locker: lockerPda,
    userMemeAccount: userMemeToken,
    lockerMemeAccount,
    nftMint,
    userNftAccount: userNftToken,
    metadata,
    edition,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .instruction();

console.log('[LockNFT] lockerProgram.programId:', lockerProgram.programId.toString());
console.log('[LockNFT] tokenMetadataProgram:', TOKEN_METADATA_PROGRAM_ID.toString());
await sendIxsOnce(cluster.connection, effectiveWallet, [ix], [], { skipPreflight: false });


    setStatus("Tokens locked and NFT minted!");
  } catch (e: unknown) {
    setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
  }
}

  async function burnNftAndUnlockTokens(locker: LockerResult) {
    if (!effectivePublicKey || !locker) return
    setStatus("Burning NFT and unlocking tokens...")
    try {
      const pk = effectivePublicKey!;
      const effectiveWallet = {
        publicKey: pk,
        signTransaction: (wallet.signTransaction ?? unifiedSignTransaction) as any,
        signAllTransactions: (wallet.signAllTransactions ?? ((txs: any[]) => Promise.all(txs.map((tx: any) => (wallet.signTransaction ?? unifiedSignTransaction)(tx))))) as any,
        sendTransaction: wallet.sendTransaction,
      };
      const memeMint = locker.memeMint
      const nftMint = locker.nftMint
      const lockerPda = locker.lockerPda
      const userMemeToken = await ensureAtaExists(pk, memeMint, pk, effectiveWallet as any, false, cluster.connection)
      const lockerMemeAccount = await ensureAtaExists(lockerPda, memeMint, pk, effectiveWallet as any, true, cluster.connection)
      const userNftToken = await ensureAtaExists(pk, nftMint, pk, effectiveWallet as any, false, cluster.connection)





      const provider = new AnchorProvider(cluster.connection, effectiveWallet as any, { preflightCommitment: "confirmed" })
      const program = new Program((cluster.isV2 ? lockerIdlV2Json : idlJson) as Idl, cluster.programId, provider)
      const ix = await program.methods
  .burnNftAndUnlockTokens()
  .accounts({
    user: pk,
    userMemeAccount: userMemeToken,
    locker: lockerPda,
    lockerMemeAccount: lockerMemeAccount,
    nftMint,
    userNftAccount: userNftToken,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .instruction();

await sendIxsOnce(cluster.connection, effectiveWallet, [ix], [], { skipPreflight: false });

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

        <h2 className="text-2xl font-bold mb-4">Culture Meme Created! 💎</h2>

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
          Trade your Culture Meme 🚀
        </button>
      </div>
    </div>
  )}
</ModalPortal>



      {/* Back to selection */}
      <div className="w-full max-w-2xl mx-auto mb-4">
        <Link href="/sound-memes" className="flex items-center gap-2 text-[#8d95a5] hover:text-[#4ECDC4] mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to memes
        </Link>
      </div>

      {/* Title & subtitle */}
      <div className="w-full max-w-2xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center mb-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent mb-1">
            Create Your Token
          </h1>
          <p className="mb-6 text-[#b5b5be]">
            Launch your SWL-444 token — bonding fairlaunch, gated, auto-graduating to Meteora 🚀
          </p>
        </div>
      </div>

      {/* ── WIZARD ── */}
      <div className="w-full max-w-2xl mx-auto space-y-5">

        {/* Progress Bar */}
        <div className="bg-[#13141b] rounded-2xl border border-[#1e1f2e] px-5 py-4">
          <div className="flex items-center">
            {WIZARD_STEPS.map((s, i) => {
              const completed = wizardStep > s.num;
              const active = wizardStep === s.num;
              return (
                <React.Fragment key={s.num}>
                  <button
                    type="button"
                    onClick={() => { if (completed) setWizardStep(s.num); }}
                    className={`flex flex-col items-center gap-1.5 ${completed ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        completed ? 'bg-[#4ECDC4] text-black shadow-[0_0_8px_rgba(78,205,196,0.4)]'
                          : active ? 'text-black shadow-[0_0_12px_rgba(255,195,113,0.5)]'
                          : 'bg-[#1e1f2e] text-[#3d4155]'
                      }`}
                      style={active ? { background: 'linear-gradient(135deg, #ffc371, #ff6b6b)' } : undefined}
                    >
                      {completed ? '✓' : s.num}
                    </div>
                    <span className={`text-[9px] font-semibold hidden sm:block tracking-wider ${active ? 'text-[#ffc371]' : completed ? 'text-[#4ECDC4]' : 'text-[#2a2d3a]'}`}>
                      {s.label.toUpperCase()}
                    </span>
                  </button>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div
                      className="flex-1 h-px mx-2 transition-all duration-500"
                      style={{ background: wizardStep > s.num ? '#4ECDC4' : '#1e1f2e' }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step card */}
        <div className="bg-gradient-to-r from-[#FF6B6B] via-[#4ECDC4] to-[#FFE66D] p-[2px] rounded-2xl">
          <div className="bg-[#0f1016] rounded-[18px] p-7 md:p-10">
            <form onSubmit={e => { e.preventDefault(); handleCreateAll(); }}>

              {/* ── Step 1: Identity & Media ── */}
              {wizardStep === 1 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #ffc371, #ff6b6b)' }}>🎭</div>
                    <div>
                      <h2 className="text-xl font-bold">Identity & Media</h2>
                      <p className="text-sm text-[#6b7084]">Name your token and upload its visuals and sound</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-[#d6daf6]">Token Name <span className="text-[#ff6b6b]">*</span></label>
                        <input
                          className="w-full bg-[#13141b] border border-[#282a31] rounded-xl px-4 py-3 text-white placeholder-[#3d4155] focus:outline-none focus:border-[#ffc371] transition"
                          placeholder="e.g. WoodSqueeze"
                          value={memeName}
                          onChange={e => setMemeName(e.target.value)}
                          maxLength={32}
                        />
                        <p className="text-[10px] text-[#3d4155] mt-1 text-right">{memeName.length}/32</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-[#d6daf6]">Ticker Symbol <span className="text-[#ff6b6b]">*</span></label>
                        <input
                          className="w-full bg-[#13141b] border border-[#282a31] rounded-xl px-4 py-3 text-white placeholder-[#3d4155] focus:outline-none focus:border-[#ffc371] transition font-mono tracking-widest uppercase"
                          placeholder="TICKER"
                          value={memeSymbol}
                          onChange={e => setMemeSymbol(e.target.value.toUpperCase())}
                          maxLength={10}
                        />
                        <p className="text-[10px] text-[#3d4155] mt-1 text-right">{memeSymbol.length}/10</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-[#d6daf6]">Description <span className="text-[#3d4155] font-normal">(optional)</span></label>
                        <textarea
                          className="w-full bg-[#13141b] border border-[#282a31] rounded-xl px-4 py-3 text-white placeholder-[#3d4155] focus:outline-none focus:border-[#ffc371] transition resize-none"
                          rows={3}
                          placeholder="What's the vibe of this token?"
                          value={memeDescription}
                          onChange={e => setMemeDescription(e.target.value)}
                          maxLength={500}
                        />
                        <p className="text-[10px] text-[#3d4155] mt-1 text-right">{memeDescription.length}/500</p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setSocialsOpen(o => !o)}
                          className="flex items-center gap-2 text-sm font-semibold text-[#6b7084] hover:text-white transition mb-2"
                        >
                          <span className="w-4 text-center">{socialsOpen ? '−' : '+'}</span>
                          Add socials
                          <span className="text-xs font-normal">(optional)</span>
                        </button>
                        {socialsOpen && (
                          <div className="space-y-2">
                            <div className="relative">
                              <Twitter className="absolute left-3 top-2.5 w-4 h-4 text-[#3d4155]" />
                              <input className="w-full bg-[#13141b] border border-[#282a31] rounded-xl pl-9 pr-3 py-2 text-white placeholder-[#3d4155] focus:outline-none focus:border-[#ffc371] transition" placeholder="@handle or https://x.com/…" value={xUrl} onChange={e => setXUrl(e.target.value)} />
                            </div>
                            <div className="relative">
                              <Send className="absolute left-3 top-2.5 w-4 h-4 text-[#3d4155]" />
                              <input className="w-full bg-[#13141b] border border-[#282a31] rounded-xl pl-9 pr-3 py-2 text-white placeholder-[#3d4155] focus:outline-none focus:border-[#ffc371] transition" placeholder="@channel or https://t.me/…" value={tgUrl} onChange={e => setTgUrl(e.target.value)} />
                            </div>
                            <div className="relative">
                              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-[#3d4155]" />
                              <input className="w-full bg-[#13141b] border border-[#282a31] rounded-xl pl-9 pr-3 py-2 text-white placeholder-[#3d4155] focus:outline-none focus:border-[#ffc371] transition" placeholder="myproject.xyz" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Live Preview */}
                    <div>
                      <p className="text-[9px] font-semibold text-[#3d4155] uppercase tracking-widest mb-2">Preview</p>
                      <div className="rounded-xl border border-[#282a31] bg-[#13141b] p-3">
                        <div className="aspect-square rounded-lg bg-[#1a1b22] flex items-center justify-center mb-2 overflow-hidden">
                          {coverImageUri
                            ? <img src={coverImageUri.replace('ipfs://', 'https://ipfs.io/ipfs/')} className="w-full h-full object-cover" alt="" />
                            : <span className="text-3xl opacity-20">🎵</span>
                          }
                        </div>
                        <div className="font-bold text-sm text-white truncate">{memeName || <span className="text-[#3d4155]">Token Name</span>}</div>
                        <div className="text-xs text-[#ffc371] font-mono mt-0.5">{memeSymbol || <span className="text-[#3d4155]">TICKER</span>}</div>
                        {memeDescription && <p className="text-[10px] text-[#6b7084] mt-1 line-clamp-2">{memeDescription}</p>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ffc371]/10 border border-[#ffc371]/20 text-[#ffc371] font-bold">444M</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold">SWL-444</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Media uploads */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-[#d6daf6]">Cover Image <span className="text-[#6b7084] font-normal">(optional)</span></label>
                    <FileUploader onUri={(uri, type) => { setCoverImageUri(uri); setCoverImageMime(type); }} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-[#d6daf6]">Audio File <span className="text-[#ff6b6b]">*</span></label>
                    <FileUploader onUri={(uri, type) => { setAudioUri(uri); setFileType(type); setAudioMime(type); }} />
                    <div className="mt-2 p-3 rounded-xl bg-[#13141b] border border-[#282a31] text-xs text-[#6b7084] flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0 text-[#4ECDC4]" />
                      Max 3 minutes · MP3 / M4A(AAC) / OGG · Max 25 MB
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(8,145,178,0.08))', borderColor: 'rgba(124,58,237,0.2)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl">✨</span>
                      <div>
                        <p className="text-sm font-semibold text-white">Living Meme</p>
                        <p className="text-xs text-[#6b7084] mt-1">Your token's metadata can be updated over time — swap the audio, refresh the artwork, evolve the story.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Economics ── */}
              {wizardStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #FFE66D, #f7b733)' }}>💰</div>
                    <div>
                      <h2 className="text-xl font-bold">Economics</h2>
                      <p className="text-sm text-[#6b7084]">Configure your token's market parameters</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-[#d6daf6]">Launch Currency</label>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { key: 'WOODENG' as const, title: 'WOODENG', blurb: 'Ecosystem token — better pool promotion' },
                        { key: 'SOL' as const, title: 'SOL', blurb: 'Auto-wrapped to wSOL under the hood' },
                      ]).map(opt => {
                        const active = quoteToken === opt.key;
                        return (
                          <button key={opt.key} type="button" onClick={() => setQuoteToken(opt.key)}
                            className={`text-left rounded-xl border p-4 transition ${active ? 'border-[#ffc371] bg-[#ffc371]/5' : 'border-[#282a31] bg-[#13141b] hover:bg-[#1a1b22]'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{opt.title}</span>
                              {active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffc371] text-black font-bold">✓</span>}
                            </div>
                            <p className="text-xs text-[#6b7084] mt-1">{opt.blurb}</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[#3d4155] mt-2">Traders will buy your token with <b className="text-[#6b7084]">{quoteLabel}</b></p>
                  </div>
                  {isBonding && (
                    <div className="p-4 rounded-xl bg-[#13141b] border border-[#282a31]">
                      <div className="flex items-center gap-2 mb-3">
                        <Volume2 className="w-4 h-4 text-[#FFE66D]" />
                        <span className="font-semibold text-sm text-[#d6daf6]">Creator Pre-Buy</span>
                        <span className="text-xs text-[#3d4155] ml-1">max 1%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="range" min={0} max={1} step={0.01} value={founderBuyPct}
                          onChange={e => setFounderBuyPct(Math.max(0, Math.min(1, Number(e.target.value))))}
                          className="w-full accent-[#ffc371]"
                        />
                        <span className="w-14 text-right tabular-nums text-sm font-mono font-bold text-[#ffc371]">{founderBuyPct.toFixed(2)}%</span>
                      </div>
                      <p className="text-xs text-[#6b7084] mt-2">You'll pre-buy <b className="text-white">{fmt(founderBuyTokens)}</b> tokens at launch</p>
                      <p className="text-xs text-[#3d4155] mt-1">Pool graduates at ~1.4M {quoteLabel} market cap</p>
                    </div>
                  )}
                  {isAmm && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-1.5 text-[#d6daf6]">Meme tokens → Pool</label>
                          <input type="number" value={initialMemeLiquidity}
                            onChange={e => setInitialMemeLiquidity(Number(e.target.value) || 0)}
                            className="w-full bg-[#13141b] border border-[#282a31] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#ffc371] transition"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1.5 text-[#d6daf6]">{quoteLabel} → Pool</label>
                          <input type="number" value={initialQuoteLiquidity}
                            onChange={e => setInitialQuoteLiquidity(Number(e.target.value) || 0)}
                            className="w-full bg-[#13141b] border border-[#282a31] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#ffc371] transition"
                          />
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#13141b] border border-[#282a31] text-sm">
                        <div className="font-semibold mb-2 text-[#ffc371]">Token Distribution</div>
                        <div className="space-y-1">
                          <div className="flex justify-between"><span className="text-[#6b7084]">Total supply</span><span className="font-mono">{totalSupply.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-[#6b7084]">→ Pool</span><span className="font-mono">{initialMemeLiquidity.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-[#6b7084]">→ You keep</span><span className={`font-mono ${creatorKeeps < 0 ? 'text-red-400' : 'text-[#4ECDC4]'}`}>{creatorKeeps.toLocaleString()}</span></div>
                        </div>
                        {creatorKeeps < 0 && <div className="mt-2 text-xs text-red-400">⚠️ Pool liquidity exceeds total supply — reduce meme liquidity amount</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Protection ── */}
              {wizardStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)' }}>💎</div>
                    <div>
                      <h2 className="text-xl font-bold">Protection</h2>
                      <p className="text-sm text-[#6b7084]">Gate your token to diamond-hand holders</p>
                    </div>
                  </div>
                  {!diamondGateOpen && (
                    <button type="button" onClick={() => setDiamondGateOpen(true)}
                      className="w-full flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-all hover:scale-[1.01]"
                      style={{ background: 'linear-gradient(135deg, #1a0a2e, #0d0d18)', border: '1px solid rgba(124,58,237,0.35)', boxShadow: '0 0 16px rgba(124,58,237,0.1)' }}
                    >
                      <span className="text-2xl">💎</span>
                      <div className="flex-1">
                        <div className="font-bold text-white">Enable Diamond-Hand Gate</div>
                        <div className="text-xs text-[#6b7084] mt-0.5">Currently OFF — open to everyone. Click to gate your meme.</div>
                      </div>
                      <svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    </button>
                  )}
                  {diamondGateOpen && (
                    <div className="rounded-xl p-[2px]" style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)' }}>
                      <div className="rounded-[10px] bg-[#0f1016] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💎</span>
                          <span className="font-bold text-white">Diamond Gate Active</span>
                          <button type="button" onClick={() => { setDiamondGateOpen(false); setMinAvgHoldDays(0); }}
                            className="ml-auto text-xs text-[#6b7084] hover:text-white transition px-3 py-1 rounded-lg bg-[#1a1b22] border border-[#282a31]"
                          >✕ Remove</button>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min={0} max={444} step={1} value={minAvgHoldDays}
                            onChange={e => setMinAvgHoldDays(Number(e.target.value))}
                            className="w-full accent-purple-400"
                          />
                          <div className="w-20 text-right tabular-nums font-mono text-sm font-bold text-purple-300 shrink-0">
                            {minAvgHoldDays === 0 ? '🧻 Open' : `${minAvgHoldDays}d`}
                          </div>
                        </div>
                        {(() => {
                          const tiers = [
                            { min: 0, emoji: '🧻', label: 'Open' }, { min: 1, emoji: '🐀', label: 'Jeet' },
                            { min: 3, emoji: '💩', label: 'Poor Fag' }, { min: 7, emoji: '🌀', label: 'Stinky Swinger' },
                            { min: 14, emoji: '💎', label: 'Normie' }, { min: 30, emoji: '🚀', label: 'Ascender' },
                            { min: 90, emoji: '👑', label: 'Chad' }, { min: 180, emoji: '🌌', label: 'PSL God' },
                            { min: 360, emoji: '⚡', label: '444' },
                          ];
                          const d = minAvgHoldDays;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {tiers.map((t, ti) => {
                                const active = d >= t.min && (tiers[ti+1] ? d < tiers[ti+1].min : true);
                                return (
                                  <button key={t.min} type="button" onClick={() => setMinAvgHoldDays(t.min)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded transition ${active ? 'bg-purple-500/30 text-purple-200 font-bold' : 'bg-[#1e1f2e] text-[#3d4155] hover:text-[#9aa1af]'}`}
                                    title={`${t.label} (${t.min}d+)`}
                                  >{t.emoji} {t.min}d</button>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <p className="text-xs text-[#6b7084]">
                          {minAvgHoldDays === 0 ? 'Open to everyone — no restriction.' : `Only wallets with ${minAvgHoldDays}+ day avg hold can buy during bonding.`}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {[
                      { icon: '🛡️', text: `Only wallets with avg hold time ≥ ${minAvgHoldDays || 'X'} days can buy during bonding` },
                      { icon: '🤖', text: 'Prevents sniper bots and rewards loyal holders' },
                      { icon: '🏁', text: 'Gate only applies during bonding — after graduation anyone can trade' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#13141b] border border-[#1e1f2e] text-sm">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <span className="text-[#6b7084]">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 4: Review & Launch ── */}
              {wizardStep === 4 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #FF6B6B, #ffc371)' }}>🚀</div>
                    <div>
                      <h2 className="text-xl font-bold">Review & Launch</h2>
                      <p className="text-sm text-[#6b7084]">Confirm everything looks right then launch</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#13141b] border border-[#282a31] p-4">
                      <p className="text-[9px] font-semibold text-[#3d4155] uppercase tracking-widest mb-3">Token</p>
                      {coverImageUri && (
                        <img src={coverImageUri.replace('ipfs://', 'https://ipfs.io/ipfs/')} className="w-14 h-14 rounded-lg object-cover mb-3" alt="cover" />
                      )}
                      <div className="font-bold text-white">{memeName || <span className="text-red-400 text-sm">Name missing</span>}</div>
                      <div className="text-sm text-[#ffc371] font-mono mt-0.5">{memeSymbol || <span className="text-red-400">Symbol missing</span>}</div>
                      {memeDescription && <p className="text-xs text-[#6b7084] mt-2 line-clamp-2">{memeDescription}</p>}
                    </div>
                    <div className="rounded-xl bg-[#13141b] border border-[#282a31] p-4">
                      <p className="text-[9px] font-semibold text-[#3d4155] uppercase tracking-widest mb-3">Parameters</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-[#6b7084]">Quote</span><span className="font-bold">{quoteLabel}</span></div>
                        <div className="flex justify-between"><span className="text-[#6b7084]">Pool type</span><span className="font-bold capitalize">{poolType}</span></div>
                        {isBonding && founderBuyPct > 0 && <div className="flex justify-between"><span className="text-[#6b7084]">Pre-buy</span><span className="font-mono">{founderBuyPct.toFixed(2)}%</span></div>}
                        {diamondGateOpen && minAvgHoldDays > 0 && <div className="flex justify-between"><span className="text-[#6b7084]">Diamond Gate</span><span className="font-mono text-purple-300">{minAvgHoldDays}d</span></div>}
                        <div className="flex justify-between"><span className="text-[#6b7084]">Supply</span><span className="font-mono">444M</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#13141b] border border-[#282a31]">
                    <p className="text-[9px] font-semibold text-[#3d4155] uppercase tracking-widest mb-2">Fees</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-[#6b7084]">Buy fee</span><span>1.5%</span></div>
                      <div className="flex justify-between"><span className="text-[#6b7084]">Early sell penalty</span><span>10%</span></div>
                      <div className="flex justify-between"><span className="text-[#6b7084]">After AMM flip</span><span>0.3%</span></div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className={`flex-1 flex items-center gap-2 p-3 rounded-xl text-xs border ${coverImageUri ? 'border-[#4ECDC4]/20 bg-[#4ECDC4]/5 text-[#4ECDC4]' : 'border-[#282a31] bg-[#13141b] text-[#3d4155]'}`}>
                      <span>{coverImageUri ? '✓' : '○'}</span><span>Cover {coverImageUri ? 'ready' : 'none'}</span>
                    </div>
                    <div className={`flex-1 flex items-center gap-2 p-3 rounded-xl text-xs border ${audioUri ? 'border-[#4ECDC4]/20 bg-[#4ECDC4]/5 text-[#4ECDC4]' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
                      <span>{audioUri ? '✓' : '!'}</span><span>Audio {audioUri ? 'ready' : 'missing'}</span>
                    </div>
                  </div>
                  <div className="space-y-3 pt-1">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" checked={agreedOwn} onChange={e => setAgreedOwn(e.target.checked)} className="accent-[#4ECDC4] mt-0.5 shrink-0" />
                      <span className="text-sm text-[#6b7084] group-hover:text-[#9aa1af] transition">I confirm that I own this sound or have permission to upload it</span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" checked={agreedTOS} onChange={e => setAgreedTOS(e.target.checked)} className="accent-[#4ECDC4] mt-0.5 shrink-0" />
                      <span className="text-sm text-[#6b7084] group-hover:text-[#9aa1af] transition">I agree to the{" "}
                        <Link href="/terms" className="underline text-[#4ECDC4]" onClick={e => e.stopPropagation()}>Terms of Service</Link>
                      </span>
                    </label>
                  </div>
                  <LiquidChargeButton type="submit" disabled={!agreedOwn || !agreedTOS || busy || !audioUri} className="w-full text-lg py-5">
                    Launch Token 🚀
                  </LiquidChargeButton>
                </div>
              )}

              {/* ── Navigation ── */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1e1f2e]">
                <button
                  type="button"
                  onClick={() => setWizardStep(s => Math.max(1, s - 1))}
                  disabled={wizardStep === 1}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#282a31] text-[#6b7084] hover:text-white hover:border-[#3a3d4a] transition disabled:opacity-20 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(s => s + 1)}
                    disabled={!canAdvance}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition"
                    style={{ background: canAdvance ? 'linear-gradient(135deg, #ffc371, #ff6b6b)' : '#1e1f2e', color: canAdvance ? 'black' : '#3d4155', cursor: canAdvance ? 'pointer' : 'not-allowed' }}
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div />
                )}
              </div>

            </form>
          </div>
        </div>


      </div>
    </div>
  )
}