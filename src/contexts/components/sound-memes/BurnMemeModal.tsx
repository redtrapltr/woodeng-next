'use client';
import React from 'react';
import type { PoolType } from '@/lib/sound-meme-types';
import { X, Flame } from 'lucide-react';

type LockerInfo = { lockId: number; mint: string };

export function BurnMemeModal({
  pool,
  userLockers,
  open,
  onClose,
  onBurn, // (lockId: number, mint: string) => Promise<void>
  burning,
  status,
}: {
  pool: PoolType;
  userLockers: LockerInfo[];
  open: boolean;
  onClose: () => void;
  onBurn: (lockId: number, mint: string) => Promise<void>;
  burning: boolean;
  status: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm relative">
        <button className="absolute top-4 right-4" onClick={onClose}><X /></button>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-red-500" /> Select NFT to Burn
        </h2>
        <div className="flex flex-col gap-3">
          {userLockers.length === 0 && (
            <div className="text-red-400 text-sm">No NFTs found for this pool.</div>
          )}
          {userLockers.map(({ lockId, mint }) => (
            <button
              key={lockId}
              className="flex items-center gap-3 p-3 bg-[#181920] rounded-xl hover:bg-[#291a22]"
              onClick={() => onBurn(lockId, mint)}
              disabled={burning}
            >
              <div className="w-10 h-10 rounded bg-[#2b2b37] flex items-center justify-center text-xs">
                #{lockId}
              </div>
              <div className="break-all text-xs text-[#adadff]">{mint}</div>
            </button>
          ))}
        </div>
        {status && <div className="mt-2 text-yellow-400">{status}</div>}
      </div>
    </div>
  );
}
