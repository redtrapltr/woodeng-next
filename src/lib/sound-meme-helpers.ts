/* eslint-disable @typescript-eslint/consistent-type-imports */
import {
  AnchorProvider, Program, BN, Idl,
} from '@project-serum/anchor';
import {
  Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddress,
} from '@solana/spl-token';
import type { WalletContextState } from '@solana/wallet-adapter-react';

import lockerIdlJson from '../../idl/hybrid_meme_coin_nft_locker.json';
import {
  createMintWithPdaAuthority,
  createAtaIfNotExists,
  getLockerPda,
} from './sound-memes';
import type { PoolType } from './sound-meme-types';

/* ------------------------------------------------------------------ */
/*  Basic constants / small helpers                                   */
/* ------------------------------------------------------------------ */
const LOCKER_PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');
export const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const lockerIdl = lockerIdlJson as Idl;

function getAnchorWallet(wallet: WalletContextState) {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error('Wallet not ready for Anchor');
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };
}

async function getAta(owner: PublicKey, mint: PublicKey, isPdaOwner = false) {
  return getAssociatedTokenAddress(mint, owner, isPdaOwner);
}

/* ------------------------------------------------------------------ */
/*  stillOwnsNft – does the owner still hold ≥1 token of that mint?   */
/* ------------------------------------------------------------------ */

export async function stillOwnsNft(
  mint: PublicKey,
  owner: PublicKey,
): Promise<boolean> {
  const ata  = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (!info) return false;                           // ATA never existed
  const bal  = await connection.getTokenAccountBalance(ata);
  return !!bal.value.uiAmount && bal.value.uiAmount > 0;
}

async function pinFile(file: File) {
  const { jwt } = await fetch('/api/pinata-token').then((r) => r.json());
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || body.message || 'Pinata upload failed');
  return body.IpfsHash as string;
}

/* ------------------------------------------------------------------ */
/*  1.  ensureLockerInitialized                                       */
/* ------------------------------------------------------------------ */
export async function ensureLockerInitialized(
  pool: PoolType & { nftMint: PublicKey },
  wallet: WalletContextState,
) {
  const { memeMint, nftMint } = pool;
  const threshold   = pool.threshold ?? 10_000;
  const memeName    = pool.name   ?? 'Meme';
  const memeSymbol  = pool.symbol ?? 'MEME';
  const memeUri     = pool.imageUrl ?? '';

  const provider      = new AnchorProvider(connection, getAnchorWallet(wallet), {});
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  /* ---- counter PDA ------------------------------------------------ */
  const [counterPda] = await PublicKey.findProgramAddress(
    [Buffer.from('counter'), memeMint.toBuffer(), wallet.publicKey!.toBuffer()],
    LOCKER_PROGRAM_ID,
  );

  let lockId = 0;
  try {
    const c = await lockerProgram.account.lockCounter.fetch(counterPda);
    lockId  = Number(c.count);
  } catch {
    await lockerProgram.methods.initializeCounter().accounts({
      user: wallet.publicKey!,
      counter: counterPda,
      memeMint,
      systemProgram: SystemProgram.programId,
    }).rpc();
  }

  /* ---- locker PDA ------------------------------------------------- */
  const [lockerPda] = await getLockerPda(memeMint, wallet.publicKey!, BigInt(lockId));
  try {
    await lockerProgram.account.lockerState.fetch(lockerPda);
    return;                                     // already initialised
  } catch { /* fallthrough */ }

  const lockerMemeAccount = await getAta(lockerPda, memeMint, true);

  await lockerProgram.methods.initializeLocker(
    new BN(threshold),
    memeName,
    memeSymbol,
    memeUri,
  ).accounts({
    user: wallet.publicKey!,
    counter: counterPda,
    locker: lockerPda,
    memeMint,
    nftMint,
    lockerMemeAccount,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  }).rpc();
}

/* ------------------------------------------------------------------ */
/*  2.  lockTokensAndMintNft                                          */
/* ------------------------------------------------------------------ */
type MintedInfo = { mint: PublicKey; memeMint: string; lockId: number | bigint };

export async function lockTokensAndMintNft(opts: {
  pool:          PoolType;
  wallet:        WalletContextState;
  setStatus?:    (m: string) => void;
  refresh?:      () => Promise<void>;
  onMintSuccess?: (info: MintedInfo) => void;
}) {
  const {
    pool, wallet, setStatus = () => {}, refresh = async () => {}, onMintSuccess,
  } = opts;
  const { memeMint } = pool;

  setStatus('Locking tokens & minting NFT…');

  /* ---- 0. pre-flight --------------------------------------------- */
  if (!wallet.publicKey) throw new Error('Connect wallet first');

  /* ---- 1. generate new mint -------------------------------------- */
  const mintKeypair = Keypair.generate();
  const nftMint     = mintKeypair.publicKey;

  /* ---- 2. counter / lock-id -------------------------------------- */
  const [counterPda] = await PublicKey.findProgramAddress(
    [Buffer.from('counter'), memeMint.toBuffer(), wallet.publicKey.toBuffer()],
    LOCKER_PROGRAM_ID,
  );
  const provider      = new AnchorProvider(connection, getAnchorWallet(wallet), {});
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  let counter;
  try {
    counter = await lockerProgram.account.lockCounter.fetch(counterPda);
  } catch {
    await lockerProgram.methods.initializeCounter().accounts({
      user: wallet.publicKey,
      counter: counterPda,
      memeMint,
      systemProgram: SystemProgram.programId,
    }).rpc();
    counter = await lockerProgram.account.lockCounter.fetch(counterPda);
  }
  const lockId = Number(counter.count);

  /* ---- 3. derive locker PDA -------------------------------------- */
  const [lockerPda] = await getLockerPda(memeMint, wallet.publicKey, lockId);

  /* ---- 4. create mint w/ PDA authority --------------------------- */
  await createMintWithPdaAuthority(connection, wallet, lockerPda, [mintKeypair]);

  /* ---- 5. make sure ATAs exist ----------------------------------- */
  const userMemeAta = await createAtaIfNotExists(connection, wallet, memeMint, wallet.publicKey);
  const userNftAta  = await createAtaIfNotExists(connection, wallet, nftMint , wallet.publicKey);
  const lockerMemeAta = await getAta(lockerPda, memeMint, true);

  /* ---- 6. init locker (if needed) -------------------------------- */
  await ensureLockerInitialized({ ...pool, nftMint }, wallet);

  /* ---- 7. off-chain metadata  ------------------------------------ */
  let imageUrl = pool.imageUrl ?? '';
  let audioUrl = pool.audioUrl ?? '';
  if (pool.imageFile instanceof File) imageUrl = `ipfs://${await pinFile(pool.imageFile)}`;
  if (pool.audioFile instanceof File) audioUrl = `ipfs://${await pinFile(pool.audioFile)}`;

  const metaJson = {
    name:        pool.name,
    symbol:      pool.symbol,
    description: pool.description,
    image:       imageUrl,
    animation_url: audioUrl,
    attributes: [
      ...(pool.attributes ?? []),
      { trait_type: 'MemeMint', value: memeMint.toBase58() },
      { trait_type: 'LockId' ,  value: String(lockId) },
    ],
  };
  const metaCid = await pinFile(
    new File([JSON.stringify(metaJson)], 'metadata.json', { type: 'application/json' }),
  );
  const metadataUri = `https://gateway.pinata.cloud/ipfs/${metaCid}`;

  /* ---- 8. PDA for Metaplex metadata ------------------------------ */
  const [metadataPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
      nftMint.toBuffer(),
    ],
    new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
  );

  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  /* ---- 9. on-chain call ----------------------------------------- */
  await lockerProgram.methods.lockTokensAndMintNft(
    pool.name, pool.symbol, metadataUri,
  ).accounts({
    user: wallet.publicKey,
    userMemeAccount: userMemeAta,
    locker: lockerPda,
    lockerMemeAccount: lockerMemeAta,
    nftMint,
    userNftAccount: userNftAta,
    metadata: metadataPda,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  }).signers([mintKeypair]).rpc();

  setStatus('NFT minted!');
  onMintSuccess?.({ mint: nftMint, memeMint: memeMint.toBase58(), lockId });
  await refresh();
}

/* ------------------------------------------------------------------ */
/*  3.  burnNftAndUnlockTokens                                        */
/* ------------------------------------------------------------------ */
export async function burnNftAndUnlockTokens(opts: {
  pool      : PoolType;
  nftMint   : PublicKey;
  lockId    : number | bigint;
  wallet    : WalletContextState;
  setStatus?: (m: string) => void;
  refresh?  : () => Promise<void>;
}) {
  const {
    pool, nftMint, lockId, wallet,
    setStatus = () => {}, refresh = async () => {},
  } = opts;

  setStatus('Burning NFT & unlocking tokens…');
  if (!wallet.publicKey) throw new Error('Connect wallet');

  const [lockerPda] = await getLockerPda(pool.memeMint, wallet.publicKey, lockId);

  const userMemeAta    = await getAta(wallet.publicKey, pool.memeMint);
  const lockerMemeAta  = await getAta(lockerPda,        pool.memeMint, true);
  const userNftAccount = await getAta(wallet.publicKey, nftMint);

  const provider      = new AnchorProvider(connection, getAnchorWallet(wallet), {});
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  await lockerProgram.methods.burnNftAndUnlockTokens().accounts({
    user: wallet.publicKey,
    userMemeAccount: userMemeAta,
    locker: lockerPda,
    lockerMemeAccount: lockerMemeAta,
    nftMint,
    userNftAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();

  setStatus('Tokens unlocked!');
  await refresh();
}

/* ------------------------------------------------------------------ */
/*  4.  getUserProtocolNfts                                           */
/* ------------------------------------------------------------------ */
export type UserPoolNfts = Record<
  string,                       // meme mint (base58)
  Record<number, { mint: PublicKey }> // lockId → NFT mint
>;

export async function getUserProtocolNfts(
  owner: PublicKey,
  memeMints: PublicKey[],
): Promise<UserPoolNfts> {
  const byPool: UserPoolNfts = {};
  const provider = new AnchorProvider(connection, { publicKey: owner } as any, {});
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  for (const memeMint of memeMints) {
    const [counterPda] = await PublicKey.findProgramAddress(
      [Buffer.from('counter'), memeMint.toBuffer(), owner.toBuffer()],
      LOCKER_PROGRAM_ID,
    );
    let counter: any;
    try {
      counter = await lockerProgram.account.lockCounter.fetch(counterPda);
    } catch { continue; }

    for (let i = 0; i < Number(counter.count ?? 0); i++) {
      const [lockerPda] = await getLockerPda(memeMint, owner, BigInt(i));
      try {
        const l = await lockerProgram.account.lockerState.fetch(lockerPda);
       (byPool[memeMint.toBase58()] ??= {})[i] = { mint: l.nftMint as PublicKey };
      } catch { /* hole in sequence */ }
    }
  }
  return byPool;
}
