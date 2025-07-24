'use client';
import React from 'react';
import type { PoolType } from '@/lib/sound-meme-types';
import { X, Pickaxe } from 'lucide-react';

export function MintMemeModal({
  pool,
  open,
  onClose,
  onMint, // () => Promise<void>
  minting,
  status,
}: {
  pool: PoolType;
  open: boolean;
  onClose: () => void;
  onMint: () => Promise<void>;
  minting: boolean;
  status: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-card rounded-2xl max-w-xs w-full p-6 shadow-2xl flex flex-col items-center relative">
        <button className="absolute top-4 right-4" onClick={onClose}><X /></button>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Pickaxe className="w-5 h-5" /> Mint NFT</h2>
        <span className="text-[#c2c2c9] mb-3">{pool.name}</span>
        <div className="flex flex-col gap-2 w-full mb-2">
          <label>This will lock your tokens and mint a Sound Meme NFT!</label>
        </div>
        <button
          className="bg-[#ffc371] w-full mt-4 text-black font-bold py-2 rounded"
          onClick={onMint}
          disabled={minting}
        >
          {minting ? 'Minting...' : 'Mint'}
        </button>
        {status && <div className="mt-2">{status}</div>}
      </div>
    </div>
  );
}
