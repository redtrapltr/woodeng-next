// src/lib/useSoundMemeTrade.ts

import { useCallback, useState } from 'react';
import type { PoolType } from "@/lib/sound-memes";

// REAL ACTIONS — import all and re-export them for modal logic
import {
  buySoundMeme,
  sellSoundMeme,
  mintSoundMeme,
  burnSoundMeme,
  getWoodengForMemeBuy,
  getWoodengForMemeSell,
  WOODENG_DECIMALS,
  MEME_DECIMALS,
} from "@/lib/sound-memes";

import { useWallet } from "@solana/wallet-adapter-react";

// For legacy use in UI, keep the hook
export function useSoundMemeTrade() {
  const wallet = useWallet();
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);

  const buy = useCallback(async (
    pool: PoolType, uiMeme: number, slippage = 1
  ) => {
    const rawMemeOut = uiMeme * 10 ** MEME_DECIMALS;
    const rawWoodIn = getWoodengForMemeBuy(pool, rawMemeOut);
    const minOut = Math.floor(rawMemeOut * (1 - slippage / 100));

    try {
      setStatus({ ok: false, msg: "Processing buy…" });
      const sig = await buySoundMeme({
        pool,
        amountWoodengIn: rawWoodIn,
        minMemeOut: minOut,
        wallet,
      });
      setStatus({ ok: true, msg: `✅ bought ${uiMeme} ${pool.symbol} (${sig.slice(0, 8)}…)` });
    } catch (e: any) {
      setStatus({ ok: false, msg: `❌ ${e.message}` });
    }
  }, [wallet]);

  const sell = useCallback(async (
    pool: PoolType, uiMeme: number, slippage = 1
  ) => {
    const rawMemeIn = uiMeme * 10 ** MEME_DECIMALS;
    const rawWoodOut = getWoodengForMemeSell(pool, rawMemeIn);
    const minWoodOut = Math.floor(rawWoodOut * (1 - slippage / 100));

    try {
      setStatus({ ok: false, msg: "Processing sell…" });
      const sig = await sellSoundMeme({
        pool,
        memeAmountIn: rawMemeIn,
        minWoodengOut: minWoodOut,
        wallet,
      });
      setStatus({ ok: true, msg: `✅ sold ${uiMeme} ${pool.symbol} (${sig.slice(0, 8)}…)` });
    } catch (e: any) {
      setStatus({ ok: false, msg: `❌ ${e.message}` });
    }
  }, [wallet]);

  return {
    buy,                         // new API
    sell,
    buyMeme: buy,                // ← aliases for old code
    sellMeme: sell,
    status,
  };
}

// EXPORT THE RAW ACTIONS FOR MODALS/PROFILE PAGE
export { buySoundMeme } from './sound-memes';
export { sellSoundMeme } from './sound-memes';
export { mintSoundMeme } from './sound-memes';
export { burnSoundMeme } from './sound-memes';
