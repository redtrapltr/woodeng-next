//C:\Users\burgu\woodeng-next\app\sound-memes\SOUNDMEMESClient.tsx

'use client';


export const dynamic = 'force-dynamic'; 
import poolIdlJson from '../../idl/my_sound_meme_pool.json';
import lockerIdlJson from '../../idl/hybrid_meme_coin_nft_locker.json';
import { createSetAuthorityInstruction, AuthorityType } from '@solana/spl-token';
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN, Idl } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createInitializeMintInstruction } from "@solana/spl-token";
import {
  Play, Pause, Loader2, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertCircle, Info, X, Pickaxe
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush, Legend, ReferenceLine
} from 'recharts';



import type { WalletContextState } from "@solana/wallet-adapter-react";
import { Metaplex } from "@metaplex-foundation/js";
import {
  createMintWithPdaAuthority,
  createAtaIfNotExists,
  getLockerPda,
  createMintWithUserFunds
} from "@/lib/sound-memes";
import { useSearchParams } from "next/navigation";

export default function SoundMemesClient() {

type UserPoolNfts = Record<
  string,              // memeMint (base-58 string)
  Record<number, any>  // lockId   -> NFT object
>;

function assertWallet(wallet: WalletContextState): asserts wallet is WalletContextState & { publicKey: PublicKey } {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
}

// Anchor expects a Wallet object, not WalletContextState, so we create an adapter
function getAnchorWallet(wallet: WalletContextState): {
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>
} {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet not ready for Anchor.");
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions
  };
}

const poolIdl = poolIdlJson as Idl;
const lockerIdl = lockerIdlJson as Idl;




// -- Pinata Upload Helper --
async function pinFile(file: File) {
  const { jwt } = await fetch('/api/pinata-token')
    .then(r => {
      if (!r.ok) throw new Error('Could not fetch Pinata token');
      return r.json();
    });
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`Pinata JSON parse error—raw body:\n${text}`); }
  if (!res.ok) throw new Error(body.error || body.message || 'Pinata upload failed');
  return body.IpfsHash;
}



// Returns threshold for minting NFT (from pool/locker config)
function getMintThreshold(pool: PoolType): number {
  return pool.threshold ?? 10000;
}

const POOL_PROGRAM_ID = new PublicKey('8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV');
const LOCKER_PROGRAM_ID = new PublicKey('cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS');
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');
const PROJECT_WALLET = new PublicKey('34JBFxZnw7f6Ye9dsHpeLTnDjA1cU3HnJL1ABFVpjBMb');
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const metaplex = Metaplex.make(connection);
const WOODENG_DECIMALS = 9;
const MEME_DECIMALS = 0;




// ---------------------------------------------------------------------------
//  NEW — query lockers instead of crawling every NFT in the wallet
// ---------------------------------------------------------------------------
async function getUserProtocolNfts(
  owner: PublicKey,
  memeMints: PublicKey[]
): Promise<UserPoolNfts> {
  const byPool: UserPoolNfts = {};

    // ---- tiny read-only Anchor client --------------------------
  const dummyWallet  = { publicKey: owner } as any;
  const provider     = new AnchorProvider(connection, dummyWallet, {});
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  // 1. iterate only over the mints we were given
  for (const memeMint of memeMints) {
    const [counterPda] = await PublicKey.findProgramAddress(
      [Buffer.from("counter"), memeMint.toBuffer(), owner.toBuffer()],
      LOCKER_PROGRAM_ID
    );

        let counter: any;
    try { counter = await lockerProgram.account.lockCounter.fetch(counterPda); }
    catch { continue; }                     // no counter ⇒ user never minted here
    if (!counter || typeof counter.count === "undefined") continue;

        // 2. loop 0 … count-1 and fetch each locker directly
    for (let i = 0; i < Number(counter.count); i++) {
      const [lockerPda] = await getLockerPda(memeMint, owner, BigInt(i));
      try {
        const l = await lockerProgram.account.lockerState.fetch(lockerPda);
        (byPool[memeMint.toBase58()] ??= {})[Number(i)] = { mint: l.nftMint };
      } catch { /* locker i was never created – skip */ }
    }
  }
  return byPool;
}




async function getAta(owner: PublicKey, mint: PublicKey, isPdaOwner = false) {
  return getAssociatedTokenAddress(mint, owner, isPdaOwner);
}
async function getConfigPda(memeMint: PublicKey) {
  return await PublicKey.findProgramAddress([Buffer.from('config'), memeMint.toBuffer()], POOL_PROGRAM_ID);
}


// ─────────────────────────────────────────────────────────────────────────────
//  Did I already burn this NFT?  (returns true if the user still has ≥1 token)
// ─────────────────────────────────────────────────────────────────────────────
async function stillOwnsNft(
  mint: PublicKey,
  owner: PublicKey
): Promise<boolean> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (!info) return false;                  // ATA never existed
  const bal = await connection.getTokenAccountBalance(ata);
  return !!bal.value.uiAmount && bal.value.uiAmount > 0;
}


// ----- NFT LOCK/MINT LOGIC, FULLY FIXED -----
async function ensureLockerInitialized(pool: PoolType & { nftMint: PublicKey }, wallet: WalletContextState) {
  const memeMint = pool.memeMint;
  const nftMint = pool.nftMint;
  const threshold = pool.threshold ?? 10000;
  const meme_name = pool.name ?? "Meme";
  const meme_symbol = pool.symbol ?? "MEME";
  const meme_uri = pool.imageUrl ?? "";

  if (!wallet.publicKey) throw new Error("Wallet not connected");

  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
  const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

  // 1. Derive counter PDA
  const [counterPda] = await PublicKey.findProgramAddress(
    [Buffer.from('counter'), memeMint.toBuffer(), wallet.publicKey.toBuffer()],
    LOCKER_PROGRAM_ID
  );

  // 2. Get or create the counter
  let lockId: number | bigint = 0;
  let shouldInitCounter = false;
  const counterAccountInfo = await connection.getAccountInfo(counterPda);
  if (!counterAccountInfo) {
    shouldInitCounter = true;
  } else {
    try {
      const counterAccount = await lockerProgram.account.lockCounter.fetch(counterPda);
      lockId = typeof counterAccount.count === "number"
        ? counterAccount.count
        : Number(counterAccount.count);
    } catch (e) {
      throw new Error("Counter PDA exists but failed to deserialize. Try with a new wallet or new memeMint.");
    }
  }
  if (shouldInitCounter) {
    await lockerProgram.methods.initializeCounter()
      .accounts({
        user: wallet.publicKey,
        counter: counterPda,
        memeMint,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    // refetch lockId after initializing
    const counterAccount = await lockerProgram.account.lockCounter.fetch(counterPda);
    lockId = typeof counterAccount.count === "number"
      ? counterAccount.count
      : Number(counterAccount.count);
  }

  // 3. Derive lockerPda
  const [lockerPda] = await getLockerPda(memeMint, wallet.publicKey, lockId);

  // Compute lockerMemeAccount!
  const lockerMemeAccount = await getAta(lockerPda, memeMint, true);

  // Now you can use lockerPda for fetching/creating
  let isInitialized = false;
  try {
    await lockerProgram.account.lockerState.fetch(lockerPda);
    isInitialized = true;
  } catch (e) {
    isInitialized = false;
  }
  if (isInitialized) return;

  // Now call initializeLocker (AFTER counter is initialized)
  await lockerProgram.methods
    .initializeLocker(
      new BN(threshold),
      meme_name,
      meme_symbol,
      meme_uri,
    )
    .accounts({
      user: wallet.publicKey,
      counter: counterPda,
      locker: lockerPda,
      memeMint,
      nftMint,
      lockerMemeAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}


// add a tiny helper type
type MintedInfo = {
  mint: PublicKey;          // the new NFT mint
  memeMint: string;         // pool.memeMint.toBase58()
  lockId: number | bigint;
};

// ----- MINT LOGIC (USE THIS FOR NFT MINTING, CALL IN YOUR HANDLER) -----
async function lockTokens(
  pool: PoolType,
  setStatus: (msg: string) => void,
  wallet: WalletContextState,
  refresh: () => Promise<void>,
  onMintSuccess?: (info: MintedInfo) => void       // <— new
) {
  setStatus("Locking tokens & minting NFT...");
  try {
    if (!wallet.publicKey) throw new Error("Connect wallet");
    const memeMint = pool.memeMint;

    // 1. Generate Keypair for NFT mint
    const mintKeypair = Keypair.generate();
    const nftMint = mintKeypair.publicKey;

    // 2. Derive counter PDA and get lockId
    const [counterPda] = await PublicKey.findProgramAddress(
      [Buffer.from('counter'), memeMint.toBuffer(), wallet.publicKey.toBuffer()],
      LOCKER_PROGRAM_ID
    );
    const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
    const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

    let counterAccount;
    try {
      counterAccount = await lockerProgram.account.lockCounter.fetch(counterPda);
    } catch (e) {
      // Counter not created yet, create it
      await lockerProgram.methods.initializeCounter().accounts({
        user: wallet.publicKey,
        counter: counterPda,
        memeMint,
        systemProgram: SystemProgram.programId,
      }).rpc();
      counterAccount = await lockerProgram.account.lockCounter.fetch(counterPda);
    }
    const lockId = typeof counterAccount.count === "number"
      ? counterAccount.count
      : Number(counterAccount.count);

    // 3. Derive locker PDA using memeMint, user pubkey, lockId
    const [lockerPda] = await getLockerPda(memeMint, wallet.publicKey, lockId);

    // 4. Create the mint with lockerPda as authority
    await createMintWithPdaAuthority(connection, wallet, lockerPda, [mintKeypair]);

    // 5. Ensure user's meme ATA exists
    const userMemeAta = await createAtaIfNotExists(connection, wallet, memeMint, wallet.publicKey);

    // 6. Create user's NFT ATA for the new mint
    const userNftAccount = await createAtaIfNotExists(connection, wallet, nftMint, wallet.publicKey);

    // 7. Locker meme account (PDA-owned ATA for meme tokens)
    const lockerMemeAccount = await getAta(lockerPda, memeMint, true);

    // 8. Ensure locker is initialized for this new mint!
    await ensureLockerInitialized({
      ...pool,
      nftMint: nftMint,
    }, wallet);

    // 9. Upload image/audio to Pinata if needed
    let imageUrl = pool.imageUrl;
    let audioUrl = pool.audioUrl;
    if (pool.imageFile instanceof File) {
      const imageCID = await pinFile(pool.imageFile);
      imageUrl = `ipfs://${imageCID}`;
    }
    if (pool.audioFile instanceof File) {
      const audioCID = await pinFile(pool.audioFile);
      audioUrl = `ipfs://${audioCID}`;
    }

    // 10. Upload metadata.json to Pinata
    const metadata = {
      name: pool.name,
      symbol: pool.symbol,
      description: pool.description,
      image: imageUrl,
      animation_url: audioUrl,
      attributes: [
        ...(pool.attributes || []),
        { trait_type: "MemeMint", value: memeMint.toBase58() },
        { trait_type: "LockId", value: lockId.toString() }
      ],
      properties: {
        files: [
          { uri: imageUrl, type: "image/png" },
          { uri: audioUrl, type: "audio/mpeg" }
        ]
      }
    };
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
    const metadataFile = new File([metadataBlob], "metadata.json");
    const metaCID = await pinFile(metadataFile);
    const metadataUri =   `https://gateway.pinata.cloud/ipfs/${metaCID}`;
    // ----> ADD THIS:
console.log('Mint NFT Metadata:', metadata, 'URI:', metadataUri);
// <----

    // 11. Mint via on-chain contract
    await lockerProgram.methods.lockTokensAndMintNft(
      pool.name,
      pool.symbol,
      metadataUri
    ).accounts({
      user: wallet.publicKey,
      userMemeAccount: userMemeAta,
      locker: lockerPda,
      lockerMemeAccount,
      nftMint: nftMint,
      userNftAccount,
      metadata: (
        await PublicKey.findProgramAddress(
          [
            Buffer.from("metadata"),
            new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
            nftMint.toBuffer()
          ],
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
        )
      )[0],
      tokenMetadataProgram: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    }).rpc();

    setStatus("NFT minted!");
    onMintSuccess?.({
  mint: nftMint,               // <- pass it up
  memeMint: memeMint.toBase58(),
  lockId
});
await refresh(); // make new NFT visible after TX finality
  } catch (e: any) {
    setStatus("NFT mint failed: " + (e.message || e.toString()));
  }
}























type PoolType = {
  ammReserves: { meme: number; woodeng: number };
  memeMint: PublicKey;
  threshold?: number;
  userMemeBalance?: number;
  symbol?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  audioUrl?: string;
  price?: number;
    // add these fields:
  imageFile?: File;
  audioFile?: File;
  attributes?: any[]; // or more specific type
  // add any other fields your pool objects have
};

function getWoodengForMemeBuy(pool: { ammReserves: { meme: number, woodeng: number } }, memeRawOut: number): number {
  const x = Number(pool.ammReserves.meme);
  const y = Number(pool.ammReserves.woodeng);
  const Δy = Number(memeRawOut);
  if (Δy <= 0 || Δy >= x) return NaN;
  let dx = Math.ceil((y * Δy) / (x - Δy));
  dx = Math.ceil(dx / (1 - 0.003));
  return dx;
}



function getWoodengForMemeSell(pool: PoolType, memeRawIn: number): number {
  // Simple XYK AMM formula for selling meme token to get WOODENG out
  const x = Number(pool.ammReserves.meme);
  const y = Number(pool.ammReserves.woodeng);
  const Δx = Number(memeRawIn);
  if (Δx <= 0 || Δx >= x) return NaN;
  let dy = Math.floor((y * Δx) / (x + Δx));
  dy = Math.floor(dy * (1 - 0.003)); // fee
  return dy;
}

function userMemeTokens(pool: PoolType): number {
  // TODO: Replace with real logic that fetches user's MEME ATA balance for the pool's memeMint
  // For demo: return a fixed value or pull from fetched balances.
  return pool.userMemeBalance ?? 0; // <-- adjust as you wire real state!
}


function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, (current / total) * 100);

  return (
    <div className="w-full flex flex-col items-center space-y-1">
      {/* bar wrapper */}
      <div className="relative w-11/12 h-4 bg-[#2b2b37] rounded overflow-hidden">
        {/* fill */}
        <div
          className={`
            h-full bg-gradient-to-r from-[#b484ff] to-[#6c47e2]
            ${pct === 100 ? 'animate-pulse' : ''}
          `}
          style={{ width: `${pct}%` }}
        />
        {/* percentage label */}
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[#f0eaff]">
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* numbers */}
      <div className="w-11/12 flex justify-between text-[11px] leading-none text-[#d6d8ff]">
        <span>{current.toLocaleString()}</span>
        <span>{total.toLocaleString()} required</span>
      </div>
    </div>
  );
}




async function fetchUserMemeBalance(wallet: WalletContextState, memeMint: PublicKey): Promise<number> {
  if (!wallet?.publicKey) return 0;
  try {
    if (!wallet.publicKey) throw new Error("Connect your wallet first");
const ata = await getAssociatedTokenAddress(memeMint, wallet.publicKey!);
    const bal = await connection.getTokenAccountBalance(ata);
    return Number(bal.value.amount);
  } catch (e) {
    return 0; // No ATA, zero balance
  }
}


// ------ Fetch pools and calculate price from AMM reserves ------
async function fetchSoundMemePoolsWithMetadata(poolProgram: Program) {
  const configs = await poolProgram.account.soundMemeConfig.all();
  return await Promise.all(
    configs.map(async (c: any) => {
      let meta = {};
      let price = 0;
      let reserves = { meme: 0, woodeng: 0 };
      try {
        const mintPubkey = new PublicKey(c.account.memeMint);
        // 1. Get metadata
        const nft = await metaplex.nfts().findByMint({ mintAddress: mintPubkey });
        meta = {
          imageUrl: nft.json?.image || "",
          audioUrl: nft.json?.animation_url || "",
          name: nft.name || "",
          description: nft.json?.description || "",
          symbol: nft.symbol || "",
          attributes: nft.json?.attributes || [],
          category: nft.json?.attributes?.find((a: any) => a.trait_type === "Category")?.value || "",
        };
        // 2. Get config PDA
        const [configPda] = await getConfigPda(mintPubkey);

        // 3. Get reserves from on-chain vault PDAs
        const [poolMemeVault] = await PublicKey.findProgramAddress(
          [Buffer.from('pool_meme_vault'), mintPubkey.toBuffer()],
          POOL_PROGRAM_ID
        );
        const [poolWoodengVault] = await PublicKey.findProgramAddress(
          [Buffer.from('pool_woodeng_vault'), mintPubkey.toBuffer()],
          POOL_PROGRAM_ID
        );

        const memeAcct = await connection.getTokenAccountBalance(poolMemeVault);
        const woodengAcct = await connection.getTokenAccountBalance(poolWoodengVault);
        reserves = {
          meme: Number(memeAcct.value.amount),
          woodeng: Number(woodengAcct.value.amount)
        };
        // 4. AMM Price Calculation (XYK): price = reserve_woodeng / reserve_meme
        price = (reserves.meme > 0 && reserves.woodeng > 0)
        ? (reserves.woodeng / 10 ** WOODENG_DECIMALS) / (reserves.meme / 10 ** MEME_DECIMALS)
        : 1;

      } catch (e) { }
      return {
        pubkey: c.publicKey,
        ...c.account,
        ...meta,
        ammReserves: reserves,
        price: price,
      };
    })
  );
}

async function sellSoundMeme({
  pool,
  memeAmountIn,
  minWoodengOut,
  wallet
}: { pool: PoolType, memeAmountIn: number, minWoodengOut: number, wallet: any }) {
  if (!wallet.publicKey) throw new Error('Connect wallet first!');

  const [configPda] = await getConfigPda(pool.memeMint);
  if (!wallet.publicKey) throw new Error("Connect wallet first!");
const buyerMemeAta = await getAssociatedTokenAddress(pool.memeMint, wallet.publicKey!);
  const buyerWoodengAta = await getAssociatedTokenAddress(WOODENG_MINT, wallet.publicKey);
  const projectWalletAta = await getAssociatedTokenAddress(WOODENG_MINT, PROJECT_WALLET);

  // Ensure seller has ATAs
  const instructions = [];
  if (!(await connection.getAccountInfo(buyerMemeAta)))
    instructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, buyerMemeAta, wallet.publicKey, pool.memeMint));
  if (!(await connection.getAccountInfo(buyerWoodengAta)))
    instructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, buyerWoodengAta, wallet.publicKey, WOODENG_MINT));
  if (instructions.length > 0) {
    const ataTx = new Transaction().add(...instructions);
    ataTx.feePayer = wallet.publicKey;
    ataTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signed = await wallet.signTransaction!(ataTx);
    await connection.sendRawTransaction(signed.serialize());
  }



  const provider = new AnchorProvider(connection, getAnchorWallet(wallet),{ preflightCommitment: 'confirmed' });
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);

  const [poolMemeVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_meme_vault'), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID
  );
  const [poolWoodengVault] = await PublicKey.findProgramAddress(
    [Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID
  );
  const [userAntibot] = await PublicKey.findProgramAddress(
    [Buffer.from('user_antibot'), wallet.publicKey.toBuffer(), pool.memeMint.toBuffer()],
    POOL_PROGRAM_ID
  );

  const txSig = await poolProgram.methods
    .sell(new BN(memeAmountIn), new BN(minWoodengOut))
    .accounts({
  config: configPda,
  poolMemeVault,
  poolWoodengVault,
  buyer: wallet.publicKey,
  buyerMemeAta,
  buyerWoodengAta,
  userAntibot,
  projectWalletAta,
  lpFeeVault: projectWalletAta,
  tokenProgram: TOKEN_PROGRAM_ID,
})
    .rpc();
  return txSig;
}




// ---- MAIN COMPONENT ----

  const wallet = useWallet();
// 1️⃣ keep the state hook at the top of the component
const [userPoolNfts, setUserPoolNfts] = useState<UserPoolNfts>({});
const [nftsLoaded,   setNftsLoaded]   = useState(false);
const [pools, setPools] = useState<any[]>([]);
// one entry per memeMint base-58 string
const [ownedCounts, setOwnedCounts] = useState<Record<string, number>>({});

// ↕ somewhere around the other modal hooks
const [buyFilled, setBuyFilled] = useState<{
  open: boolean;
  symbol: string;
  amountMeme: number;      // UI units
  priceWoodeng: number;    // UI units
}>({ open: false, symbol: "", amountMeme: 0, priceWoodeng: 0 });

// ↕ right below const [buyFilled, …]
const [sellFilled, setSellFilled] = useState({
  open:false, symbol:"", amountMeme:0, priceWoodeng:0
});
const [mintFilled, setMintFilled] = useState({
  open:false, symbol:"", lockId:0
});
const [burnFilled, setBurnFilled] = useState({
  open:false, symbol:"", amountUnlocked:0
});




// 2️⃣ leave the callback clean
const refreshUserNfts = useCallback(async () => {
  if (!wallet.publicKey) {
    setUserPoolNfts({});
    setOwnedCounts({});
    setNftsLoaded(true);
    return;
  }

  try {
    // build the mint list from whatever pools are already in state
    const mints = pools.map(p => p.memeMint);
    const nfts  = await getUserProtocolNfts(wallet.publicKey, mints);
    setUserPoolNfts(nfts);

     /* ─── NEW: count only the NFTs that still exist ─── */
    const counts: Record<string, number> = {};
    await Promise.all(
      Object.entries(nfts).map(async ([mintStr, lockers]) => {
        const alive = await Promise.all(
          Object.values(lockers).map(async ({ mint }) =>
            (await stillOwnsNft(mint, wallet.publicKey!)) ? 1 : 0
          )
        );
        counts[mintStr] = alive.reduce<number>((sum, v) => sum + v, 0);
      })
    );
    setOwnedCounts(counts);          // <-- this drives “You own X”

  } finally {
    // even if getUserProtocolNfts throws we stop the loading state
    setNftsLoaded(true);
  }
}, [wallet.publicKey, pools]);





  const handleOpenSellModal = (pool: PoolType) => {
  setSelectedPool(pool);
  setModalTokensToSell('');
  setShowSellModal(true);
  setTransactionStatus('idle');
  setTransactionMessage('');
};

  const [showSellModal, setShowSellModal] = useState(false);
  const [modalTokensToSell, setModalTokensToSell] = useState('');
  const [slippage, setSlippage] = useState(1); // default 1%
  const [status, setStatus] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const [showDetail, setShowDetail] = useState(false);
  const [detailPool, setDetailPool] = useState<any | null>(null);

  const [selectedTimeRange, setSelectedTimeRange] = useState('24H');
  const [chartData, setChartData] = useState<any[]>([]);
  const [brushStartIndex, setBrushStartIndex] = useState(0);
  const [selectedDataPoint, setSelectedDataPoint] = useState<number | null>(null);

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<any | null>(null);
  const [modalTokensToBuy, setModalTokensToBuy] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('idle');
  const [transactionMessage, setTransactionMessage] = useState('');

const [burnModal, setBurnModal] = useState<{
  pool: PoolType | null;
  nfts: { lockId: number; mint: PublicKey }[];
  open: boolean;
}>({ pool: null, nfts: [], open: false });

  const searchParams   = useSearchParams();
  const deepLinkedMint = searchParams.get("mint");

  // 👇 REPLACE this whole arrow-function definition
const handleMintNft = (pool: PoolType) =>
  lockTokens(pool, setStatus, wallet, refreshUserNfts, (minted) =>  {
    setUserPoolNfts(prev => {
      setMintFilled({
        open:true,
        symbol: pool.symbol ?? '',
        lockId:Number(minted.lockId)
      });
      refreshUserNfts();
      const key  = minted.memeMint;
      return {
        ...prev,
        [key]: {
          ...(prev[key] ?? {}),
          [Number(minted.lockId)]: {
            mint: minted.mint,
            json: {
              attributes: [
                { trait_type: 'MemeMint', value: key },
                { trait_type: 'LockId',   value: String(minted.lockId) }
              ]
            }
          }
        }
      };
    });
    refreshUserNfts(); // Call this separately, not as part of setUserPoolNfts!
  });





  useEffect(() => {
  if (!wallet.connected) return;
  const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
  const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);
  fetchSoundMemePoolsWithMetadata(poolProgram)
    .then(async fetchedPools => {
      // Fetch user meme balances for each pool
      const balances = await Promise.all(
        fetchedPools.map(pool => fetchUserMemeBalance(wallet, pool.memeMint))
      );
      setPools(fetchedPools.map((pool, i) => ({
        ...pool,
        userMemeBalance: balances[i]
      })));
    })
    .catch((e) => setStatus("Failed to load pools: " + e));
}, [wallet.connected]);



// place just after the other useEffect hooks
useEffect(() => {
  // don't run until we know which meme mints to query
  if (!wallet.publicKey || pools.length === 0) return;

  setNftsLoaded(false);          // show spinner only while fetching
  refreshUserNfts();             // will set nftsLoaded → true when done
}, [wallet.publicKey, pools, refreshUserNfts]);

  // --------------------------------------------
  //  auto-open the Buy modal when we deep-link
  // --------------------------------------------
  const buyAutoOpened = useRef(false);

  useEffect(() => {
    if (buyAutoOpened.current) return;            // already opened once
    if (!deepLinkedMint || pools.length === 0) return;

    const pool = pools.find(p => p.memeMint.toBase58() === deepLinkedMint);
    if (pool) {
      handleOpenBuyModal(pool);
      buyAutoOpened.current = true;
    }
  }, [deepLinkedMint, pools]);                     // ← deps


  const playDemo = (id: string, url?: string) => {
    if (!url) return;
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const el = new Audio(url);
    audioRef.current = el;
    setPlaying(id);
    el.onended = () => setPlaying(null);
    el.play();
  };

  // --- Buy Logic for Modal ---
  async function buySoundMeme({
  pool,
  amountWoodengIn,
  minMemeOut,
  wallet,
}: { pool: PoolType, amountWoodengIn: number, minMemeOut: number, wallet: any }) {
    if (!wallet.publicKey) throw new Error('Connect wallet first!');

    const [configPda] = await getConfigPda(pool.memeMint);
    if (!wallet.publicKey) throw new Error("Connect wallet first!");
const buyerMemeAta = await getAssociatedTokenAddress(pool.memeMint, wallet.publicKey);
    const buyerWoodengAta = await getAssociatedTokenAddress(WOODENG_MINT, wallet.publicKey);
    const projectWalletAta = await getAssociatedTokenAddress(WOODENG_MINT, PROJECT_WALLET);




    // Ensure buyer has ATAs
    const instructions = [];
    if (!(await connection.getAccountInfo(buyerMemeAta)))
      instructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, buyerMemeAta, wallet.publicKey, pool.memeMint));
    if (!(await connection.getAccountInfo(buyerWoodengAta)))
      instructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, buyerWoodengAta, wallet.publicKey, WOODENG_MINT));
    if (instructions.length > 0) {
      const ataTx = new Transaction().add(...instructions);
      ataTx.feePayer = wallet.publicKey;
      ataTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await wallet.signTransaction!(ataTx);
      await connection.sendRawTransaction(signed.serialize());
    }

    // Anchor setup
    const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: 'confirmed' });
    const poolProgram = new Program(poolIdl, POOL_PROGRAM_ID, provider);

    // *** Use PDAs for pool vaults ***
    const [poolMemeVault] = await PublicKey.findProgramAddress(
      [Buffer.from('pool_meme_vault'), pool.memeMint.toBuffer()],
      POOL_PROGRAM_ID
    );
    const [poolWoodengVault] = await PublicKey.findProgramAddress(
      [Buffer.from('pool_woodeng_vault'), pool.memeMint.toBuffer()],
      POOL_PROGRAM_ID
    );
    const [userAntibot] = await PublicKey.findProgramAddress(
      [Buffer.from('user_antibot'), wallet.publicKey.toBuffer(), pool.memeMint.toBuffer()],
      POOL_PROGRAM_ID
    );

    const txSig = await poolProgram.methods
      .buy(new BN(amountWoodengIn), new BN(minMemeOut))
      .accounts({
        config: configPda,
        poolMemeVault,
        poolWoodengVault,
        buyer: wallet.publicKey,
        buyerMemeAta,
        buyerWoodengAta,
        userAntibot,
        projectWalletAta,
        lpFeeVault: projectWalletAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    return txSig;
  }

  const handleOpenBuyModal = (pool: any) => {
    setSelectedPool(pool);
    setModalTokensToBuy('');
    setShowBuyModal(true);
    setTransactionStatus('idle');
    setTransactionMessage('');
  };

  const handleConfirmBuy = async () => {
    const woodengRawNeeded = getWoodengForMemeBuy(selectedPool, Number(modalTokensToBuy) * 10**MEME_DECIMALS);
const woodengUiNeeded = woodengRawNeeded / 10**WOODENG_DECIMALS;
const spotPrice = Number(selectedPool.price);
const avgPrice = woodengUiNeeded / Number(modalTokensToBuy);
const priceImpact = ((avgPrice - spotPrice) / spotPrice) * 100;

// Calculate minMemeOut for slippage protection
const minMemeOut = Math.floor(Number(modalTokensToBuy) * (1 - slippage/100)) * 10**MEME_DECIMALS;

if (priceImpact > slippage) {
  setTransactionStatus('error');
  setTransactionMessage('Price impact exceeds slippage tolerance.');
  return;
}

    setTransactionStatus('processing');
    setTransactionMessage('Processing transaction...');
    try {
      if (!wallet.publicKey) throw new Error('Please connect your wallet!');
      if (!selectedPool || !modalTokensToBuy) throw new Error('Select amount to buy');
      const amountWoodengIn = getWoodengForMemeBuy(selectedPool, Number(modalTokensToBuy) * 10 ** MEME_DECIMALS);
      const tx = await buySoundMeme({ pool: selectedPool, amountWoodengIn, minMemeOut, wallet });

      setTransactionStatus('success');
setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);
setShowBuyModal(false);                 // close the buy form

// >>> open filled-order pop-up <<<
setBuyFilled({
  open: true,
  symbol: selectedPool.symbol,
  amountMeme: Number(modalTokensToBuy),
  priceWoodeng: woodengUiNeeded,        // we computed this a few lines above
});

    } catch (e: any) {
      setTransactionStatus('error');
      setTransactionMessage('Error: ' + (e.message || 'Unknown error'));
    }
  };

  const handleConfirmSell = async () => {
  const memeRawIn = Number(modalTokensToSell) * 10 ** MEME_DECIMALS;
  const woodengRawOut = getWoodengForMemeSell(selectedPool, memeRawIn);
  const woodengUiOut = woodengRawOut / 10 ** WOODENG_DECIMALS;
  const spotPrice = Number(selectedPool.price);
  const avgPrice = memeRawIn > 0 ? (woodengUiOut / Number(modalTokensToSell)) : 0;
  const priceImpact = spotPrice > 0 ? ((spotPrice - avgPrice) / spotPrice) * 100 : 0;

  // Calculate minWoodengOut for slippage protection
  const minWoodengOut = Math.floor(woodengRawOut * (1 - slippage / 100));

  if (priceImpact > slippage) {
    setTransactionStatus('error');
    setTransactionMessage('Price impact exceeds slippage tolerance.');
    return;
  }

  setTransactionStatus('processing');
  setTransactionMessage('Processing transaction...');
  try {
    if (!wallet.publicKey) throw new Error('Please connect your wallet!');
    if (!selectedPool || !modalTokensToSell) throw new Error('Select amount to sell');
    const memeAmountIn = memeRawIn;
    const tx = await sellSoundMeme({ pool: selectedPool, memeAmountIn, minWoodengOut, wallet });

    setTransactionStatus('success');
    setTransactionMessage(`Success! Tx: ${tx.slice(0, 8)}...`);
    setShowSellModal(false);
    setSellFilled({
  open:true,
  symbol:selectedPool.symbol,
  amountMeme:Number(modalTokensToSell),
  priceWoodeng:woodengUiOut
});
  } catch (e: any) {
    setTransactionStatus('error');
    setTransactionMessage('Error: ' + (e.message || 'Unknown error'));
  }
};


 



async function unlockTokens(
  pool: any,
  nftMint: PublicKey,
  lockId: number | bigint,
  refresh: () => Promise<void>           // 👈 NEW
) {
  setStatus("Burning NFT & unlocking tokens...");
  try {
    if (!wallet.publicKey) throw new Error("Connect wallet");
    if (!nftMint) {
      setStatus("No NFT to burn for this pool!");
      return;
    }

    // 1. Derive locker PDA using memeMint, user, lockId
    const [lockerPda] = await getLockerPda(pool.memeMint, wallet.publicKey!, BigInt(lockId));

    // 2. All the account PDAs
    const userMemeAta = await getAta(wallet.publicKey, pool.memeMint);
    const lockerMemeAccount = await getAta(lockerPda, pool.memeMint, true);
    const userNftAccount = await getAta(wallet.publicKey, nftMint);
    const info = await connection.getAccountInfo(userNftAccount);
if (!info) {
  setStatus("That NFT account was never created – are you sure you minted from this wallet?");
  return;
}
    const amount = (await connection.getTokenAccountBalance(userNftAccount))
               .value.uiAmount;
if (!amount) {
  setStatus("This NFT is already burnt (balance = 0).");
  await refresh();          // flush stale local state
  return;
}

    // 3. Anchor provider and program
    const provider = new AnchorProvider(connection, getAnchorWallet(wallet), { preflightCommitment: "confirmed" });
    const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

    // 4. Call the burn
    await lockerProgram.methods.burnNftAndUnlockTokens().accounts({
      user: wallet.publicKey,
      userMemeAccount: userMemeAta,
      locker: lockerPda,
      lockerMemeAccount,
      nftMint,
      userNftAccount,
      tokenProgram: TOKEN_PROGRAM_ID
    }).rpc();

    setStatus("Tokens unlocked!");
    await refreshUserNfts();
  } catch (e: any) {
    setStatus("Unlock failed: " + (e.message || e.toString()));
  }
}



  

  // --- Chart logic (dummy, unchanged) ---
  const generateChartData = useCallback(() => {
    const now = new Date();
    const data = [];
    let interval, points;
    switch (selectedTimeRange) {
      case '1s': interval = 100; points = 10; break;
      case '1m': interval = 6 * 1000; points = 10; break;
      case '5m': interval = 30 * 1000; points = 10; break;
      case '30m': interval = 3 * 60 * 1000; points = 10; break;
      case '1H': interval = 6 * 60 * 1000; points = 10; break;
      case '24H': interval = 144 * 60 * 1000; points = 10; break;
      case '7D': interval = 16.8 * 60 * 60 * 1000; points = 10; break;
      case '30D': interval = 3 * 24 * 60 * 60 * 1000; points = 10; break;
      case '1Y': interval = 36.5 * 24 * 60 * 60 * 1000; points = 10; break;
      case 'ALL': interval = 73 * 24 * 60 * 60 * 1000; points = 10; break;
      default: interval = 144 * 60 * 1000; points = 10;
    }
    for (let i = points - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * interval));
      const basePrice = 150;
      const variance = Math.random() * 20 - 10;
      data.push({
        time: time.toISOString(),
        price: +(basePrice + variance).toFixed(2),
        volume: Math.floor(Math.random() * 100)
      });
    }
    return data;
  }, [selectedTimeRange]);
  useEffect(() => {
    setChartData(generateChartData());
    setBrushStartIndex(0);
  }, [selectedTimeRange, generateChartData]);

  const formatTime = (time: string) => {
    const date = new Date(time);
    switch (selectedTimeRange) {
      case '1s':
      case '1m':
      case '5m':
      case '30m':
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      case '1H':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      case '24H':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '7D':
      case '30D':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case '1Y':
      case 'ALL':
        return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleString();
    }
  };

  return (
  <div className="min-h-screen bg-[#181920] text-white p-8">
    {/* Header */}
    <h1 className="text-3xl font-bold mb-8">Sound Meme Pools</h1>

    {/* Status Banner */}
    {status && (
      <div className="mb-4 flex items-center gap-2 text-yellow-400">
        {status.includes('Processing') && <Loader2 className="animate-spin w-5 h-5" />}
        {status.includes('successful') && <CheckCircle2 className="w-5 h-5" />}
        {status.includes('failed') && <AlertCircle className="w-5 h-5" />}
        <span>{status}</span>
      </div>
    )}

    {/* Card Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {pools.map((pool, i) => {
        // User NFT count for this pool
       const userNftCount = ownedCounts[pool.memeMint.toBase58()] ?? 0;
        return (
          <div
            key={pool.pubkey.toBase58()}
            className="group bg-[#22232a] border border-[#33334a] rounded-2xl shadow-xl overflow-hidden hover:scale-105 transition-all cursor-pointer flex flex-col"
            onClick={() => { setDetailPool(pool); setShowDetail(true); }}
          >
            {/* IMAGE + Overlay */}
            <div className="relative aspect-square w-full">
              <img
                src={pool.imageUrl || "https://placehold.co/400x400?text=No+Image"}
                alt={pool.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-2">
                <div className="flex justify-end space-x-2">
                  <span className="bg-purple-700/80 text-xs px-2 py-0.5 rounded-full text-white">SPL404 NFT</span>
                  {pool.category && (
                    <span className="bg-blue-700/80 text-xs px-2 py-0.5 rounded-full text-white">{pool.category}</span>
                  )}
                </div>
                {/* Play Button Overlay */}
                <button
                  className="self-center mb-2 bg-black/70 p-3 rounded-full hover:bg-black/80 transition"
                  onClick={e => { e.stopPropagation(); playDemo(pool.pubkey.toBase58(), pool.audioUrl); }}
                >
                  {playing === pool.pubkey.toBase58() ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white" />
                  )}
                </button>
              </div>
            </div>
            {/* Main Card Info */}
            <div className="flex flex-col flex-1 p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-xl truncate">{pool.name || "No Name"}</h2>
                <span className="text-xs text-[#adadff] font-semibold">
                  24h Vol: {pool.volume24h?.toLocaleString()} WOODENG
                </span>
              </div>
              <div className="text-[#c2c2c9] text-sm truncate">{pool.description || "No description"}</div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[#ffc371] font-bold text-lg">{pool.price?.toFixed(5)} WOODENG</span>
                <span className="text-xs bg-[#2b323c] px-2 py-1 rounded">{pool.symbol || "MEME"}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs">Liquidity:</span>
                <span className="text-xs text-[#d3d3d3]">
                  {(pool.ammReserves?.woodeng / 10 ** WOODENG_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 })} WOODENG /
                  {(pool.ammReserves?.meme / 10 ** MEME_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 })} MEME
                </span>
              </div>
              {/* ─────────── Action buttons ─────────── */}
<div className="grid grid-cols-2 gap-2 mt-4 text-sm font-semibold">

  {/* ► BUY ------------------------------------------------------- */}
  <button
    className="h-10 rounded bg-[#907aff] text-white hover:bg-[#37ad71] transition"
    onClick={e => { e.stopPropagation(); handleOpenBuyModal(pool); }}
  >
    Buy
  </button>

  {/* ► SELL ------------------------------------------------------ */}
  <button
    className="h-10 rounded bg-[#ff5656] text-white hover:bg-[#f8d648] transition"
    onClick={e => { e.stopPropagation(); handleOpenSellModal(pool); }}
  >
    Sell
  </button>

  {/* ► MINT NFT -------------------------------------------------- */}
  <button
    className="h-10 rounded bg-[#907aff] text-white hover:bg-[#a593ff] transition disabled:opacity-40 flex items-center justify-center gap-1"
    disabled={userMemeTokens(pool) < getMintThreshold(pool)}
    onClick={e => { e.stopPropagation(); handleMintNft(pool); }}
  >
    <Pickaxe className="w-4 h-4" />
    Mint&nbsp;NFT
  </button>

  {/* ► BURN NFT -------------------------------------------------- */}
  <button
     className="h-10 rounded bg-[#ff5656] text-white hover:bg-[#ff7373] transition flex items-center justify-center gap-1 disabled:opacity-40"
    disabled={!nftsLoaded}
    title="Burn your NFT to unlock tokens"
    onClick={async e => {
      e.stopPropagation();
      if (!nftsLoaded || !wallet.publicKey) return;

      // ① raw list from lockers
      const lockDict = userPoolNfts[pool.memeMint.toBase58()] ?? {};
      const maybeNfts = Object.entries(lockDict).map(([lockId, data]) => ({
        lockId: Number(lockId),
        mint:   new PublicKey(data.mint),
      }));

      // ② keep only NFTs still owned
      const ownedNfts = (
        await Promise.all(
          maybeNfts.map(async n =>
            (await stillOwnsNft(n.mint, wallet.publicKey!)) ? n : null
          )
        )
      ).filter(Boolean) as { lockId: number; mint: PublicKey }[];

      if (ownedNfts.length === 0) {
        setStatus("Looks like you’ve already burned every NFT for this meme.");
        return;
      }

      // ③ open modal with filtered list
      setBurnModal({ pool, nfts: ownedNfts, open: true });
    }}
  >
    {!nftsLoaded ? (
      <Loader2 className="animate-spin w-4 h-4" />
    ) : (
      <>
        <span role="img" aria-label="burn">🔥</span>
        Burn&nbsp;NFT
        {userNftCount > 1 && (
          <span className="ml-1 text-xs">({userNftCount})</span>
        )}
      </>
    )}
  </button>

</div>
              </div>
              <div className="mt-2">
                <ProgressBar current={userMemeTokens(pool)} total={getMintThreshold(pool)} />
                {userMemeTokens(pool) < getMintThreshold(pool) && (
  <div className="w-11/12 mx-auto mt-1 text-[11px] text-center text-[#f8c286]">
    Need {getMintThreshold(pool) - userMemeTokens(pool)} more tokens to mint NFT
  </div>
                )}
              </div>
            </div>
        );
      })}
    </div>

    {/* BUY MODAL */}
    {showBuyModal && selectedPool && (
  <div
    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
    onClick={() => setShowBuyModal(false)}          // 👈 overlay click
  >
    <div
      className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl
                 flex flex-col items-center relative"
      onClick={e => e.stopPropagation()}            // 👈 block inner clicks
    >
      <button
        className="absolute top-4 right-4"          // now inside the dialog
        onClick={() => setShowBuyModal(false)}
      >
        <X />
      </button>
          <h2 className="text-xl font-bold mb-2">Buy {selectedPool.symbol}</h2>
          <img src={selectedPool.imageUrl} className="w-24 h-24 rounded-xl mb-3" alt="meme" />
          <span className="text-[#c2c2c9] mb-3">{selectedPool.name}</span>
          <div className="flex flex-col gap-2 w-full">
            <label>Amount to buy:</label>
            <input
              type="number"
              className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
              placeholder="0"
              value={modalTokensToBuy}
              onChange={e => setModalTokensToBuy(e.target.value)}
              min={1}
            />
            <span className="text-sm text-[#d7bb7a]">
              Total: {(getWoodengForMemeBuy(selectedPool, Number(modalTokensToBuy)) / 10 ** WOODENG_DECIMALS).toFixed(5)} WOODENG
            </span>
          </div>
          <div className="flex flex-col gap-2 w-full mt-2">
            <label>Slippage tolerance (%)</label>
            <input
              type="number"
              className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
              value={slippage}
              onChange={e => setSlippage(Number(e.target.value))}
              min={0.1}
              max={50}
            />
          </div>
          <button
            className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded"
            onClick={handleConfirmBuy}
            disabled={!modalTokensToBuy || transactionStatus === 'processing'}
          >
            {transactionStatus === 'processing' ? 'Processing...' : 'Confirm Buy'}
          </button>
          {transactionStatus === 'success' && <div className="text-green-400 mt-2">{transactionMessage}</div>}
          {transactionStatus === 'error' && <div className="text-red-400 mt-2">{transactionMessage}</div>}
        </div>
      </div>
    )}

    {/* SELL MODAL */}
    {showSellModal && selectedPool && (
  <div
    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
    onClick={() => setShowSellModal(false)}          // 👈 overlay click
  >
    <div
      className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl
                 flex flex-col items-center relative"
      onClick={e => e.stopPropagation()}            // 👈 block inner clicks
    >
      <button
        className="absolute top-4 right-4"          // now inside the dialog
        onClick={() => setShowSellModal(false)}
      >
        <X />
      </button>
          <h2 className="text-xl font-bold mb-2">Sell {selectedPool.symbol}</h2>
          <img src={selectedPool.imageUrl} className="w-24 h-24 rounded-xl mb-3" alt="meme" />
          <span className="text-[#c2c2c9] mb-3">{selectedPool.name}</span>
          <div className="flex flex-col gap-2 w-full">
            <label>Amount to sell:</label>
            <input
              type="number"
              className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
              placeholder="0"
              value={modalTokensToSell}
              onChange={e => setModalTokensToSell(e.target.value)}
              min={1}
            />
            <span className="text-sm text-[#d7bb7a]">
              Receive: {(getWoodengForMemeSell(selectedPool, Number(modalTokensToSell)) / 10 ** WOODENG_DECIMALS).toFixed(5)} WOODENG
            </span>
          </div>
          <div className="flex flex-col gap-2 w-full mt-2">
            <label>Slippage tolerance (%)</label>
            <input
              type="number"
              className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
              value={slippage}
              onChange={e => setSlippage(Number(e.target.value))}
              min={0.1}
              max={50}
            />
          </div>
          <button
            className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded"
            onClick={handleConfirmSell}
            disabled={!modalTokensToSell || transactionStatus === 'processing'}
          >
            {transactionStatus === 'processing' ? 'Processing...' : 'Confirm Sell'}
          </button>
          {transactionStatus === 'success' && <div className="text-green-400 mt-2">{transactionMessage}</div>}
          {transactionStatus === 'error' && <div className="text-red-400 mt-2">{transactionMessage}</div>}
        </div>
      </div>
    )}

    {/* BUY-FILLED MODAL */}
{buyFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button
        className="absolute top-5 right-5"
        onClick={() => setBuyFilled(b => ({ ...b, open: false }))}
      >
        <X />
      </button>

      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Purchase confirmed!</h2>

      <p className="text-[#c2c2c9] mb-4">
        You bought&nbsp;
        <span className="font-semibold">{buyFilled.amountMeme}</span>&nbsp;
        {buyFilled.symbol}&nbsp;for&nbsp;
        <span className="font-semibold">
          {buyFilled.priceWoodeng.toFixed(5)} WOODENG
        </span>.
      </p>

      <button
        onClick={() => setBuyFilled(b => ({ ...b, open: false }))}
        className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
      >
        Close
      </button>
    </div>
  </div>
)}


{sellFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button className="absolute top-5 right-5" onClick={() => setSellFilled(s => ({...s,open:false}))}><X/></button>
      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4"/>
      <h2 className="text-xl font-bold mb-2">Sale confirmed!</h2>
      <p className="text-[#c2c2c9] mb-4">
        You sold&nbsp;
        <span className="font-semibold">{sellFilled.amountMeme}</span>&nbsp;
        {sellFilled.symbol}&nbsp;for&nbsp;
        <span className="font-semibold">
          {sellFilled.priceWoodeng.toFixed(5)} WOODENG
        </span>.
      </p>
      <button className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
              onClick={() => setSellFilled(s => ({...s,open:false}))}>
        Close
      </button>
    </div>
  </div>
)}

{mintFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button
        className="absolute top-5 right-5"
        onClick={() => setMintFilled(m => ({ ...m, open: false }))}>
        <X />
      </button>

      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">NFT minted!</h2>

      <p className="text-[#c2c2c9] mb-4">
        Your&nbsp;
        <span className="font-semibold">{mintFilled.symbol}</span>
        &nbsp;locker&nbsp;#
        <span className="font-semibold">{mintFilled.lockId}</span>
        &nbsp;is now live.
      </p>

      <button
        className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
        onClick={() => setMintFilled(m => ({ ...m, open: false }))}>
        Close
      </button>
    </div>
  </div>
)}


{burnFilled.open && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
    <div className="bg-[#181920] rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center relative">
      <button
        className="absolute top-5 right-5"
        onClick={() => setBurnFilled(b => ({ ...b, open: false }))}>
        <X />
      </button>

      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Tokens unlocked!</h2>

      <p className="text-[#c2c2c9] mb-4">
        You burned an&nbsp;
        <span className="font-semibold">{burnFilled.symbol}</span>
        &nbsp;NFT and received&nbsp;
        <span className="font-semibold">
          {burnFilled.amountUnlocked.toLocaleString()}
        </span>
        &nbsp;{burnFilled.symbol} back.
      </p>

      <button
        className="bg-[#ffc371] w-full py-2 rounded text-black font-bold"
        onClick={() => setBurnFilled(b => ({ ...b, open: false }))}>
        Close
      </button>
    </div>
  </div>
)}





    {/* BURN MODAL */}
{burnModal.open && burnModal.pool && (
  <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
    <div className="bg-[#23232e] rounded-2xl p-6 w-full max-w-sm relative">
      <button
        className="absolute top-4 right-4"
        onClick={() => setBurnModal(m => ({ ...m, open: false }))}>
        <X />
      </button>

      <h2 className="text-xl font-bold mb-4">Select NFT to Burn</h2>

      <div className="flex flex-col gap-3">
        {burnModal.nfts.map(({ lockId, mint }) => (
          <button
            key={lockId}
            className="flex items-center gap-3 p-3 bg-[#181920] rounded-xl hover:bg-[#291a22]"
            onClick={async () => {
              // close picker
              setBurnModal(m => ({ ...m, open: false }));
              // burn & unlock
              await unlockTokens(
                burnModal.pool!,
                mint,
                lockId,
                refreshUserNfts
              );
              // show toast
              setBurnFilled({
                open: true,
                symbol: burnModal.pool!.symbol ?? '',
                amountUnlocked: getMintThreshold(burnModal.pool!)
              });
            }}>
            <div className="w-10 h-10 rounded bg-[#2b2b37] flex items-center justify-center text-xs">
              #{lockId}
            </div>
            <div className="break-all text-xs text-[#adadff]">{mint.toBase58()}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
)}


    {/* Pool Detail Modal */}
    {showDetail && detailPool && (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[#23232e] p-6 rounded-2xl max-w-lg w-full relative">
          <button className="absolute top-4 right-4" onClick={() => setShowDetail(false)}><X /></button>
          <div className="flex items-center gap-5 mb-4">
            <img src={detailPool.imageUrl} alt={detailPool.name} className="w-20 h-20 rounded-xl" />
            <div>
              <h2 className="text-2xl font-bold mb-1">{detailPool.name}</h2>
              <div className="text-sm text-[#aab]">{detailPool.description}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[#ffc371] font-bold">{detailPool.price?.toFixed(5)} WOODENG</span>
                <span className="bg-[#2b323c] text-xs px-2 py-1 rounded">{detailPool.symbol}</span>
              </div>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span>Reserves:</span>
                <span className="text-[#f7f7b2]">
                  {(detailPool.ammReserves?.woodeng / 10 ** WOODENG_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 })} WOODENG
                </span>
                <span>/</span>
                <span className="text-[#f8b2f7]">
                  {(detailPool.ammReserves?.meme / 10 ** MEME_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 })} {detailPool.symbol}
                </span>
              </div>
            </div>
          </div>
          <div>
            <div className="flex gap-2 mt-4 mb-2">
              {["1s", "1m", "5m", "30m", "1H", "24H", "7D", "30D", "1Y", "ALL"].map(range => (
                <button
                  key={range}
                  className={`text-xs px-2 py-1 rounded ${selectedTimeRange === range ? "bg-[#ffc371] text-black" : "bg-[#262635] text-white"}`}
                  onClick={() => setSelectedTimeRange(range)}
                >{range}</button>
              ))}
            </div>
            <div className="w-full h-40 bg-[#141419] rounded-xl">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#23232e" />
                  <XAxis dataKey="time" tickFormatter={formatTime} hide />
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload && payload.length ?
                        <div className="bg-[#23232e] rounded px-3 py-2">
                          <div className="font-bold">{payload[0].payload.price} WOODENG</div>
                          <div className="text-xs">{formatTime(payload[0].payload.time)}</div>
                        </div>
                        : null
                    }
                  />
                  <Line type="monotone" dataKey="price" stroke="#ffc371" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
)}
