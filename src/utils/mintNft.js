import {
  Keypair, PublicKey, SystemProgram, Transaction,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createMintToInstruction, createSetAuthorityInstruction, AuthorityType,
} from "@solana/spl-token";
import { Metaplex } from '@metaplex-foundation/js';

export async function createNftMint(connection, payer, mintAuthority, decimals = 0) {
  const mintKeypair = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(82);

  const tx = new Transaction()
    .add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        lamports,
        space: 82,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        mintAuthority,
        null,
        TOKEN_PROGRAM_ID
      )
    );
  tx.feePayer = payer.publicKey;
  tx.partialSign(mintKeypair);
  // Return both tx and keypair to be signed and sent by dApp
  return { tx, mintKeypair };
}

export async function setMintAuthority(connection, payer, mint, newAuthority) {
  const ix = createSetAuthorityInstruction(
    mint,
    payer.publicKey,
    AuthorityType.MintTokens,
    newAuthority
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  return tx;
}

export async function mintNftToUser(connection, payer, mint, userAta, amount = 1) {
  const ix = createMintToInstruction(
    mint,
    userAta,
    payer.publicKey,
    amount
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  return tx;
}

// Optionally add: createMetadata for the NFT using Metaplex JS
