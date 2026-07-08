import { Connection, PublicKey, Commitment } from '@solana/web3.js';

export type CachedTokenBalance = { uiAmount: number; amount: string; decimals: number } | null;

const solCache: Record<string, { value: number; ts: number }> = {};
const tokenCache: Record<string, { value: CachedTokenBalance; ts: number }> = {};
const CACHE_TTL = 10_000; // 10 seconds

export async function getCachedBalance(
  connection: Connection,
  pubkey: PublicKey,
  commitment: Commitment = 'confirmed'
): Promise<number> {
  const key = `${pubkey.toBase58()}:${commitment}`;
  const now = Date.now();
  const hit = solCache[key];
  if (hit && now - hit.ts < CACHE_TTL) {
    return hit.value;
  }
  const balance = await connection.getBalance(pubkey, commitment);
  solCache[key] = { value: balance, ts: now };
  return balance;
}

/** Returns null when the token account doesn't exist (vs. a zero-balance account). */
export async function getCachedTokenBalance(
  connection: Connection,
  ata: PublicKey,
  commitment: Commitment = 'confirmed'
): Promise<CachedTokenBalance> {
  const key = `${ata.toBase58()}:${commitment}`;
  const now = Date.now();
  const hit = tokenCache[key];
  if (hit && now - hit.ts < CACHE_TTL) {
    return hit.value;
  }
  let value: CachedTokenBalance;
  try {
    const bal = await connection.getTokenAccountBalance(ata, commitment);
    value = {
      uiAmount: bal.value.uiAmount ?? Number(bal.value.amount) / Math.pow(10, bal.value.decimals),
      amount: bal.value.amount,
      decimals: bal.value.decimals,
    };
  } catch {
    value = null;
  }
  tokenCache[key] = { value, ts: now };
  return value;
}

export function invalidateBalanceCache() {
  Object.keys(solCache).forEach(k => delete solCache[k]);
  Object.keys(tokenCache).forEach(k => delete tokenCache[k]);
}
