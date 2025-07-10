// src/lib/sound-memes.ts
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";

// 1️⃣ Create mint with a PDA as authority
export async function createMintWithPdaAuthority(
  connection: Connection,
  wallet: WalletContextState,
  mintAuthority: PublicKey,
  signers: Keypair[] = []
) {
  const mint = signers[0] || Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(82);
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
      0, // decimals
      mintAuthority,
      null
    )
  );
  tx.feePayer = wallet.publicKey!;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(mint);
  if (!wallet.signTransaction) throw new Error("Wallet does not support signTransaction");
  const signed = await wallet.signTransaction(tx);
  const txid = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(txid, "confirmed");
  return { mint: mint.publicKey, mintKeypair: mint };
}

// 2️⃣ ATA helper
export async function createAtaIfNotExists(
  connection: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  owner: PublicKey,
  sign = true
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const ataInfo = await connection.getAccountInfo(ata);
  if (!ataInfo) {
    const ix = createAssociatedTokenAccountInstruction(
      wallet.publicKey!,
      ata,
      owner,
      mint
    );
    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey!;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signedTx = sign
      ? await wallet.signTransaction!(tx)
      : (await wallet.signAllTransactions!([tx]))[0];
    const txid = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(txid, "confirmed");
    return ata;
  }
  return ata;
}

// 3️⃣ Locker-PDA helper
export async function getLockerPda(
  memeMint: PublicKey,
  user: PublicKey,
  lockId: number | bigint
) {
  const lockIdBuf = Buffer.alloc(8);
  lockIdBuf.writeBigUInt64LE(BigInt(lockId));
  const LOCKER_PROGRAM_ID = new PublicKey("cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS");
  return PublicKey.findProgramAddress(
    [Buffer.from("locker"), memeMint.toBuffer(), user.toBuffer(), lockIdBuf],
    LOCKER_PROGRAM_ID
  );
}

// 4️⃣ “Normal” mint (user-funded) helper
export async function createMintWithUserFunds(
  connection: Connection,
  wallet: WalletContextState,
  decimals = 0
): Promise<PublicKey> {
  const mint = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(82);
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
      wallet.publicKey!
    )
  );
  tx.feePayer = wallet.publicKey!;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(mint);
  const signed = await wallet.signTransaction!(tx);
  const txid = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(txid, "confirmed");
  return mint.publicKey;
}
