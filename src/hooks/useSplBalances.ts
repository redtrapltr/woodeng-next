import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Hardcode WOODENG mint and decimals
export const WOODENG_MINT = new PublicKey("83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5");
export const WOODENG_DECIMALS = 9;

// Use this hook to get WOODENG + any meme balances (by SPL mint, not NFT)
export function useSplBalances(mints: PublicKey[]): {
  woodengBalance: number;
  memeBalances: number[];
  loading: boolean;
} {
  const { publicKey } = useWallet();
  const [woodengBalance, setWoodengBalance] = useState(0);
  const [memeBalances, setMemeBalances] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setWoodengBalance(0);
      setMemeBalances([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC as string);

    async function fetchSplBalance(mint: PublicKey, decimals: number): Promise<number> {
  if (!publicKey) return 0; // <--- add this guard!
  try {
    const ata = await getAssociatedTokenAddress(mint, publicKey, false, TOKEN_PROGRAM_ID);
    const info = await conn.getTokenAccountBalance(ata);
    return Number(info.value.amount) / 10 ** decimals;
  } catch {
    return 0;
  }
}


    (async () => {
      // Always fetch WOODENG
      const wood = await fetchSplBalance(WOODENG_MINT, WOODENG_DECIMALS);
      setWoodengBalance(wood);

      // Fetch other mints (meme tokens), assume decimals = 0 unless you have a per-token decimals map
      const memeResults = await Promise.all(
        mints.map(async (mint) => {
          if (mint.toBase58() === WOODENG_MINT.toBase58()) return wood;
          // Your meme tokens are 0 decimals (if not, change here)
          return fetchSplBalance(mint, 0);
        })
      );
      setMemeBalances(memeResults);
      setLoading(false);
    })();
  }, [publicKey, JSON.stringify(mints)]);

  return { woodengBalance, memeBalances, loading };
}
