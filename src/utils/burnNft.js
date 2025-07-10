import { Transaction } from "@solana/web3.js";
import { createBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export async function burnNft(connection, payer, mint, userAta) {
  const ix = createBurnInstruction(
    userAta,
    mint,
    payer.publicKey,
    1
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  return tx;
}
// You would typically call the Anchor "burnNftAndUnlockTokens" after this, or instead, call only your contract method and let it do everything
