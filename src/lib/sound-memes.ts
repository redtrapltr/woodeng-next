import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
} from '@solana/spl-token';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program, Idl } from '@project-serum/anchor';
import { Metaplex } from '@metaplex-foundation/js';

import poolIdlJson   from '../../idl/my_sound_meme_pool.json';
import type { PoolType } from './sound-meme-types';


import {
  lockTokensAndMintNft  as coreMint,
  burnNftAndUnlockTokens as coreBurn,
  ensureLockerInitialized,
  getUserProtocolNfts    as coreGetUserNfts,
} from './sound-meme-helpers';


/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
export const WOODENG_DECIMALS = 9;
export const MEME_DECIMALS    = 0;

export const connection = new Connection(
  'https://api.devnet.solana.com',
  'confirmed',
);

export const metaplex = Metaplex.make(connection);

export const POOL_PROGRAM_ID = new PublicKey(
  '8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV',
);
export const WOODENG_MINT = new PublicKey(
  'CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad',
);
export const PROJECT_WALLET = new PublicKey(
  '34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb',
);
export const LOCKER_PROGRAM_ID = new PublicKey(
  'cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS',
);



/* ------------------------------------------------------------------ */
/*  Helpers FIRST                                                     */
/* ------------------------------------------------------------------ */
function getAnchorWallet(wallet: any) {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet not ready for Anchor.");
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions
  };
}

export function getConfigPda(memeMint: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from('config'), memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );
}

export function getLockerPda(
  memeMint: PublicKey,
  user: PublicKey,
  lockId: number | bigint,
) {
  

  // Make an 8-byte little-endian u64 without Buffer.writeBigUInt64LE
const u8 = new Uint8Array(8);
new DataView(u8.buffer).setBigUint64(0, BigInt(lockId), true);

// web3.js accepts Buffer|Uint8Array for seeds. If your version complains,
// wrap with Buffer.from(u8).
return PublicKey.findProgramAddress(
  [Buffer.from('locker'), memeMint.toBuffer(), user.toBuffer(), u8],
  LOCKER_PROGRAM_ID
);

}

/** 1️⃣ Create a mint whose *authority is a PDA* (locker) */
export async function createMintWithPdaAuthority(
  conn: Connection,
  wallet: WalletContextState,
  mintAuthority: PublicKey,
  signers: Keypair[] = [],
) {
  const mint     = signers[0] || Keypair.generate();
  const lamports = await conn.getMinimumBalanceForRentExemption(82);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey!,
      newAccountPubkey: mint.publicKey,
      space: 82,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, 0, mintAuthority, null),
  );

  tx.feePayer        = wallet.publicKey!;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.partialSign(mint);

  const signed = await wallet.signTransaction!(tx);
  const sig    = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(sig, 'confirmed');

  return { mint: mint.publicKey, mintKeypair: mint };
}

/** 2️⃣ Create ATA if it doesn’t exist (optionally w/out signing) */
export async function createAtaIfNotExists(
  conn: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  owner: PublicKey,
  sign = true,
) {
  const ata = await getAssociatedTokenAddress(mint, owner);
  if (await conn.getAccountInfo(ata)) return ata;

  const ix = createAssociatedTokenAccountInstruction(
    wallet.publicKey!,
    ata,
    owner,
    mint,
  );

  const tx = new Transaction().add(ix);
  tx.feePayer        = wallet.publicKey!;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;

  const signed = sign
    ? await wallet.signTransaction!(tx)
    : (await wallet.signAllTransactions!([tx]))[0];

  const sig = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(sig, 'confirmed');
  return ata;
}


/* ------------------------------------------------------------------ */
/*  Thin wrappers – call the shared helpers                           */
/* ------------------------------------------------------------------ */
export function mintSoundMeme(args: {
  pool: PoolType; wallet: WalletContextState; setStatus?: (m:string)=>void;
}) {
  return coreMint({ ...args });
}

export function burnSoundMeme(args: {
  pool: PoolType; lockId: number; mint: string;
  wallet: WalletContextState; setStatus?: (m:string)=>void;
}) {
  return coreBurn({
    pool   : args.pool,
    nftMint: new PublicKey(args.mint),
    lockId : args.lockId,
    wallet : args.wallet,
    setStatus: args.setStatus,
  });
}

/* share the low-level helpers */
export { ensureLockerInitialized };
export const getUserProtocolNfts = coreGetUserNfts;


/* ------------------------------------------------------------------ */
/*  Pool list + metadata                                              */
/* ------------------------------------------------------------------ */
async function fetchSoundMemePoolsWithMetadataInner(
  program: Program,
): Promise<PoolType[]> {
  const configs = await program.account.soundMemeConfig.all();

  return Promise.all(
    configs.map(async (c: any) => {
      let meta     = {};
      let price    = 0;
      let reserves = { meme: 0, woodeng: 0 };

      try {
        const mintPk = new PublicKey(c.account.memeMint);

        /* 1️⃣ off-chain JSON */
        const nft = await metaplex.nfts().findByMint({ mintAddress: mintPk });
        meta = {
          imageUrl   : nft.json?.image || '',
          audioUrl   : nft.json?.animation_url || '',
          name       : nft.name  || '',
          description: nft.json?.description || '',
          symbol     : nft.symbol || '',
          attributes : nft.json?.attributes || [],
          category   :
            nft.json?.attributes?.find(
              (a: any) => a.trait_type === 'Category',
            )?.value || '',
        };

        /* 2️⃣ vault balances */
        const [memeVault] = await PublicKey.findProgramAddress(
          [Buffer.from('pool_meme_vault'), mintPk.toBuffer()],
          POOL_PROGRAM_ID,
        );
        const [woodVault] = await PublicKey.findProgramAddress(
          [Buffer.from('pool_woodeng_vault'), mintPk.toBuffer()],
          POOL_PROGRAM_ID,
        );

        const memeBal = await connection.getTokenAccountBalance(memeVault);
        const woodBal = await connection.getTokenAccountBalance(woodVault);

        reserves = {
          meme   : Number(memeBal.value.amount),
          woodeng: Number(woodBal.value.amount),
        };

        /* 3️⃣ spot price */
        price =
          reserves.meme && reserves.woodeng
            ? (reserves.woodeng / 10 ** WOODENG_DECIMALS) /
              (reserves.meme   / 10 ** MEME_DECIMALS)
            : 0;
      } catch (_) {
        /* ignore JSON / PDA errors */
      }

      return {
        pubkey: c.publicKey,
        ...c.account,
        ...meta,
        ammReserves: reserves,
        price,
      } as PoolType;
    }),
  );
}

/** Simple wrapper so pages don’t need Anchor knowledge */
export async function fetchSoundMemePoolsWithMetadata(): Promise<PoolType[]> {
  const provider = new AnchorProvider(
    connection,
    { publicKey: Keypair.generate().publicKey } as any, // dummy read-only wallet
    { preflightCommitment: 'confirmed' },
  );
  const program = new Program(poolIdlJson as Idl, POOL_PROGRAM_ID, provider);
  return fetchSoundMemePoolsWithMetadataInner(program);
}

/* ------------------------------------------------------------------ */
/*  AMM math helpers                                                  */
/* ------------------------------------------------------------------ */
export function getWoodengForMemeBuy(
  pool: { ammReserves: { meme: number; woodeng: number } },
  memeRawOut: number,
) {
  const { meme: x, woodeng: y } = pool.ammReserves;
  const Δy = memeRawOut;
  if (Δy <= 0 || Δy >= x) return NaN;
  let dx = Math.ceil((y * Δy) / (x - Δy));
  dx     = Math.ceil(dx / (1 - 0.003)); // 0.3 % fee
  return dx;
}

export function getWoodengForMemeSell(
  pool: { ammReserves: { meme: number; woodeng: number } },
  memeRawIn: number,
) {
  const { meme: x, woodeng: y } = pool.ammReserves;
  if (memeRawIn <= 0) return NaN;

  // fee on input (exact-in)
  const FEE = 0.003;
  const dxEff = Math.floor(memeRawIn * (1 - FEE));
  const dy = Math.floor((y * dxEff) / (x + dxEff));
  return Math.max(0, dy);
}


/* ------------------------------------------------------------------ */
/*  Trade helpers (BUY / SELL)                                        */
/* ------------------------------------------------------------------ */
export async function buySoundMeme(opts: {
  pool: PoolType;
  amountWoodengIn: number; // raw 10^9
  minMemeOut:      number; // raw 10^0
  wallet:          WalletContextState;
}) {
  const { pool, amountWoodengIn, minMemeOut, wallet } = opts;
  if (!wallet.publicKey) throw new Error('Connect wallet first');

  const [configPda]          = await getConfigPda(pool.memeMint);
  const buyerMemeAta         = await getAssociatedTokenAddress(pool.memeMint, wallet.publicKey);
  const buyerWoodAta         = await getAssociatedTokenAddress(WOODENG_MINT   , wallet.publicKey);
  const projectWalletAta     = await getAssociatedTokenAddress(WOODENG_MINT   , PROJECT_WALLET);

  await createAtaIfNotExists(connection, wallet, pool.memeMint , wallet.publicKey, false);
  await createAtaIfNotExists(connection, wallet, WOODENG_MINT  , wallet.publicKey, false);

  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: 'confirmed' });
  const program  = new Program(poolIdlJson as Idl, POOL_PROGRAM_ID, provider);

  const [poolMemeVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_meme_vault'), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );
  const [poolWoodVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );
  const [userAntibot]   = await PublicKey.findProgramAddress(
    [Buffer.from('user_antibot'), wallet.publicKey.toBuffer(), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );

  return program.methods
    .buy(new BN(amountWoodengIn), new BN(minMemeOut))
    .accounts({
      config:            configPda,
      poolMemeVault,
      poolWoodengVault:  poolWoodVault,
      buyer:             wallet.publicKey,
      buyerMemeAta,
      buyerWoodengAta:   buyerWoodAta,
      userAntibot,
      projectWalletAta,
      lpFeeVault:        projectWalletAta,
      tokenProgram:      TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function sellSoundMeme(opts: {
  pool: PoolType;
  memeAmountIn:  number; // raw 10^0
  minWoodengOut: number; // raw 10^9
  wallet:        WalletContextState;
}) {
  const { pool, memeAmountIn, minWoodengOut, wallet } = opts;
  if (!wallet.publicKey) throw new Error('Connect wallet first');

  const [configPda]        = await getConfigPda(pool.memeMint);
  const sellerMemeAta      = await getAssociatedTokenAddress(pool.memeMint, wallet.publicKey);
  const sellerWoodAta      = await getAssociatedTokenAddress(WOODENG_MINT , wallet.publicKey);
  const projectWalletAta   = await getAssociatedTokenAddress(WOODENG_MINT , PROJECT_WALLET);

  await createAtaIfNotExists(connection, wallet, pool.memeMint , wallet.publicKey, false);
  await createAtaIfNotExists(connection, wallet, WOODENG_MINT  , wallet.publicKey, false);

  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: 'confirmed' });
  const program  = new Program(poolIdlJson as Idl, POOL_PROGRAM_ID, provider);

  const [poolMemeVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_meme_vault'), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );
  const [poolWoodVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );
  const [userAntibot]   = await PublicKey.findProgramAddress(
    [Buffer.from('user_antibot'), wallet.publicKey.toBuffer(), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID,
  );

  return program.methods
    .sell(new BN(memeAmountIn), new BN(minWoodengOut))
    .accounts({
      config:            configPda,
      poolMemeVault,
      poolWoodengVault:  poolWoodVault,
      buyer:             wallet.publicKey,
      buyerMemeAta:      sellerMemeAta,
      buyerWoodengAta:   sellerWoodAta,
      userAntibot,
      projectWalletAta,
      lpFeeVault:        projectWalletAta,
      tokenProgram:      TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/** 3️⃣ Normal user-funded mint helper (used by page.tsx) */
export async function createMintWithUserFunds(
  conn: Connection,
  wallet: WalletContextState,
  decimals = 0,
) {
  const mint     = Keypair.generate();
  const lamports = await conn.getMinimumBalanceForRentExemption(82);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey!,
      newAccountPubkey: mint.publicKey,
      space: 82,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      wallet.publicKey!,
      wallet.publicKey!,
    ),
  );

  tx.feePayer        = wallet.publicKey!;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.partialSign(mint);

  const signed = await wallet.signTransaction!(tx);
  const sig    = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(sig, 'confirmed');
  return mint.publicKey;
}



/* ------------------------------------------------------------------ */
/*  Barrel-export PoolType so other files can `import { PoolType }`    */
/* ------------------------------------------------------------------ */
export * from './sound-meme-types';
