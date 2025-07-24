'use client';
import React, { useState } from 'react';
import type { PoolType } from '@/lib/sound-meme-types';
import { X } from 'lucide-react';

const WOODENG_DECIMALS = 9;
const MEME_DECIMALS = 0;

export function SellMemeModal({
  pool,
  open,
  onClose,
  onConfirm, // (memeRawIn: number, minWoodengOut: number) => Promise<void>
  transactionStatus,
  transactionMessage,
  memeBalance,
}: {
  pool: PoolType;
  open: boolean;
  onClose: () => void;
  onConfirm: (memeRawIn: number, minWoodengOut: number) => Promise<void>;
  transactionStatus: string;
  transactionMessage: string;
  memeBalance: number;
}) {
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);

  if (!open) return null;

  function getWoodengForMemeSell(pool: PoolType, memeRawIn: number): number {
    const x = Number(pool.ammReserves.meme);
    const y = Number(pool.ammReserves.woodeng);
    const Δx = Number(memeRawIn);
    if (Δx <= 0 || Δx >= x) return NaN;
    let dy = Math.floor((y * Δx) / (x + Δx));
    dy = Math.floor(dy * (1 - 0.003)); // fee
    return dy;
  }

  const memeRawIn = Number(amount) * 10 ** MEME_DECIMALS;
  const woodengOutRaw = getWoodengForMemeSell(pool, memeRawIn);
  const woodengOut = woodengOutRaw / 10 ** WOODENG_DECIMALS;

  let insufficientMeme = false;
  let slippageTooLow = false;
  let sellButtonDisabled = false;

  if (amount && !isNaN(woodengOut)) {
    insufficientMeme = Number(amount) > memeBalance;
    if (slippage <= 0) slippageTooLow = true;
    sellButtonDisabled = insufficientMeme || slippageTooLow;
  } else {
    sellButtonDisabled = true;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-card rounded-2xl max-w-xs w-full p-6 shadow-2xl flex flex-col items-center relative">
        <button className="absolute top-4 right-4" onClick={onClose}><X /></button>
        <h2 className="text-xl font-bold mb-2">Sell {pool.symbol}</h2>
        <img src={pool.imageUrl} className="w-24 h-24 rounded-xl mb-3" alt="meme" />
        <span className="text-[#c2c2c9] mb-3">{pool.name}</span>
        <div className="flex flex-col gap-2 w-full">
          <label>Amount to sell:</label>
          <input
            type="number"
            className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={1}
          />
          <span className="text-sm text-[#d7bb7a]">
            Receive: {isNaN(woodengOut) ? '0' : woodengOut.toFixed(5)} WOODENG
          </span>
          <span className="text-xs text-gray-500">
            Your NFT balance: {memeBalance}
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
        {insufficientMeme && (
          <div className="text-red-400 text-xs mt-1">Insufficient NFT balance.</div>
        )}
        {slippageTooLow && (
          <div className="text-red-400 text-xs mt-1">Increase slippage tolerance.</div>
        )}
        <button
          className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded"
          onClick={() => {
            // memeRawIn, minWoodengOut
            const minWoodengOut = Math.floor(
              woodengOut * (1 - slippage / 100) * 10 ** WOODENG_DECIMALS
            );
            onConfirm(memeRawIn, minWoodengOut);
          }}
          disabled={sellButtonDisabled || !amount || transactionStatus === 'processing'}
        >
          {transactionStatus === 'processing' ? 'Processing...' : 'Confirm Sell'}
        </button>
        {transactionStatus === 'success' && <div className="text-green-400 mt-2">{transactionMessage}</div>}
        {transactionStatus === 'error' && <div className="text-red-400 mt-2">{transactionMessage}</div>}
      </div>
    </div>
  );
}
