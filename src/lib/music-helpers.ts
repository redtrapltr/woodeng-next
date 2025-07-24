// src/lib/music-helpers.ts
import { PublicKey } from '@solana/web3.js';
import { Connection, clusterApiUrl } from '@solana/web3.js';
const connection = new Connection(clusterApiUrl('devnet'),'confirmed');


// quick test – replace with your real PDAs
export const MUSIC_PROGRAM_ID      = new PublicKey('Mus1c1111111111111111111111111111111111111');
export const MARKET_LISTING_PROGRAM= new PublicKey('List11111111111111111111111111111111111111');

export async function hasPool(mint: PublicKey): Promise<{ok:boolean, pda?:string}> {
  // ↓ swap to real PDA derivation
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mint.toBuffer()],
    MUSIC_PROGRAM_ID,
  );
  const info = await connection.getAccountInfo(pda);
  return { ok: !!info, pda: info ? pda.toBase58() : undefined };
}

export async function hasDirectListing(mint: PublicKey): Promise<boolean> {
  // …hit ME, Hadeswap, etc.  For demo always false
  return false;
}
