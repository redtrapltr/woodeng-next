import { Program } from "@project-serum/anchor";
import lockerIdlJson from '../../idl/hybrid_meme_coin_nft_locker.json';

export async function lockTokensAndMintNft({ provider, lockerPda, user, userMemeAccount, lockerMemeAccount, nftMint, userNftAccount, tokenProgram }) {
  const lockerProgram = new Program(lockerIdlJson, lockerPda.programId, provider);
  return await lockerProgram.methods
    .lockTokensAndMintNft()
    .accounts({
      user,
      userMemeAccount,
      locker: lockerPda,
      lockerMemeAccount,
      nftMint,
      userNftAccount,
      tokenProgram,
    })
    .rpc();
}

export async function burnNftAndUnlockTokens({ provider, lockerPda, user, userMemeAccount, lockerMemeAccount, nftMint, userNftAccount, tokenProgram }) {
  const lockerProgram = new Program(lockerIdlJson, lockerPda.programId, provider);
  return await lockerProgram.methods
    .burnNftAndUnlockTokens()
    .accounts({
      user,
      userMemeAccount,
      locker: lockerPda,
      lockerMemeAccount,
      nftMint,
      userNftAccount,
      tokenProgram,
    })
    .rpc();
}
