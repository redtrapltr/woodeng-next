'use client';
import React, { useState } from 'react';
import type { PoolType } from '@/lib/sound-meme-types';
import { X } from 'lucide-react';

const WOODENG_DECIMALS = 9;
const MEME_DECIMALS = 0;

export function BuyMemeModal({
  pool,
  open,
  onClose,
  onConfirm, // (woodengRawIn: number, memeRawOut: number) => Promise<void>
  transactionStatus,
  transactionMessage,
  woodengBalance,
}: {
  pool: PoolType;
  open: boolean;
  onClose: () => void;
  onConfirm: (woodengRawIn: number, memeRawOut: number) => Promise<void>;
  transactionStatus: string;
  transactionMessage: string;
  woodengBalance: number;
}) {
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [inputError, setInputError] = useState('');

  if (!open) return null;

  function getWoodengForMemeBuy(pool: PoolType, memeRawOut: number): number {
    const x = Number(pool.ammReserves.meme);
    const y = Number(pool.ammReserves.woodeng);
    const Δy = Number(memeRawOut);
    if (Δy <= 0 || Δy >= x) return NaN;
    let dx = Math.ceil((y * Δy) / (x - Δy));
    dx = Math.ceil(dx / (1 - 0.003));
    return dx;
  }

  // Calculated values
  const memeRawOut = Number(amount) * 10 ** MEME_DECIMALS;
  const woodengNeededRaw = getWoodengForMemeBuy(pool, memeRawOut);
  const woodengNeeded = woodengNeededRaw / 10 ** WOODENG_DECIMALS;

  // Validation
  let insufficientBalance = false;
  let slippageTooLow = false;
  let buyButtonDisabled = false;

  if (amount && !isNaN(woodengNeeded)) {
    insufficientBalance = woodengNeeded > woodengBalance;
    // Slippage check: if slippage tolerance is too low, tx would fail
    // Here: user sets minMemeOut = amount * (1 - slippage%)
    // So, if slippage < ~0.01, user can't buy, AMM will revert
    if (slippage <= 0) slippageTooLow = true;
    buyButtonDisabled = insufficientBalance || slippageTooLow;
  } else {
    buyButtonDisabled = true;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-card rounded-2xl max-w-xs w-full p-6 shadow-2xl flex flex-col items-center relative">
        <button className="absolute top-4 right-4" onClick={onClose}><X /></button>
        <h2 className="text-xl font-bold mb-2">Buy {pool.symbol}</h2>
        <img src={pool.imageUrl} className="w-24 h-24 rounded-xl mb-3" alt="meme" />
        <span className="text-[#c2c2c9] mb-3">{pool.name}</span>
        <div className="flex flex-col gap-2 w-full">
          <label>Amount to buy:</label>
          <input
            type="number"
            className="px-3 py-2 rounded bg-[#23232e] border border-[#31313d] w-full"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={1}
          />
          <span className="text-sm text-[#d7bb7a]">
            Total: {isNaN(woodengNeeded) ? '0' : woodengNeeded.toFixed(5)} WOODENG
          </span>
          <span className="text-xs text-gray-500">
            Your WOODENG balance: {woodengBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
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
        {insufficientBalance && (
          <div className="text-red-400 text-xs mt-1">Insufficient WOODENG balance.</div>
        )}
        {slippageTooLow && (
          <div className="text-red-400 text-xs mt-1">Increase slippage tolerance.</div>
        )}
        <button
          className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded"
          onClick={() => {
            // woodengRawIn, memeRawOut
            onConfirm(Math.floor(woodengNeeded * 1e9), memeRawOut);
          }}
          disabled={buyButtonDisabled || !amount || transactionStatus === 'processing'}
        >
          {transactionStatus === 'processing' ? 'Processing...' : 'Confirm Buy'}
        </button>
        {transactionStatus === 'success' && <div className="text-green-400 mt-2">{transactionMessage}</div>}
        {transactionStatus === 'error' && <div className="text-red-400 mt-2">{transactionMessage}</div>}
      </div>
    </div>
  );
}
