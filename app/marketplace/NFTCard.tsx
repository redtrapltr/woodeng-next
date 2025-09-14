'use client';

import React, { useEffect, useRef } from 'react';
import { Play, Pause, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';

import type { NFT } from '@/types/nft';                 // <— global NFT type
import { cn } from '@/lib/utils';
import { Web3Image, useAudio } from '@/contexts/components/Web3Media';

/* tiny helpers ---------------------------------------------------- */


const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-black/60 text-white">
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/*  Card component (shared: marketplace & profile)                    */
/* ------------------------------------------------------------------ */
export function NFTCard({
  nft,
  view,
  onOpen,
  userPubkey,
}: {
  nft: NFT;
  view: 'grid' | 'list';
  onOpen: (n: NFT) => void;
  userPubkey?: string;
}) {
  const { playing, play, stop } = useAudio(nft.audioUrl);
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  // 🔇 Stop audio when the route/section actually changes (without touching mount/unmount)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      try { stop(); } catch {}
      prevPathRef.current = pathname;
    }
  }, [pathname, stop]);

  const isOwner =
    nft.seller && userPubkey
      ? nft.seller.toLowerCase() === userPubkey.toLowerCase()
      : false;

  const buttonLabel =
    nft.hasPool
      ? 'View Pool'
      : nft.status === 'listed'
      ? isOwner
        ? 'Update Listing'
        : 'Buy Listing'
      : 'Buy Now';

  return (
    <div
      onClick={() => {
        // Stop audio before navigating via card click
        try { stop(); } catch {}
        onOpen(nft);
      }}
      className={cn(
        'group bg-card border border-border rounded-lg hover:border-primary/50 transition',
        view === 'list' && 'flex',
      )}
    >
      {/* -------- cover -------- */}
      <div
        className={cn(
          'relative',
          view === 'grid' ? 'aspect-square' : 'aspect-square sm:w-44',
        )}
      >
        <Web3Image
          src={nft.imageUrl}
          alt={nft.title}
          className="object-cover w-full h-full bg-muted"
        />

        {nft.audioUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // don’t navigate when clicking the overlay
              playing ? stop() : play();
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <Pause className="w-7 h-7 text-white" />
            ) : (
              <Play className="w-7 h-7 text-white" />
            )}
          </button>
        )}

        {/* badges */}
        <div className="absolute top-1 right-1 flex flex-wrap gap-1">
          {nft.hasPool && <Badge>Pool</Badge>}
          <Badge>{nft.type === 'bundle' ? 'Bundle' : 'Single'}</Badge>
          <Badge>{nft.tokenType.toUpperCase()}</Badge>
          {nft.status === 'listed' && <Badge>For Sale</Badge>}
        </div>
      </div>

      {/* -------- info -------- */}
      <div
        className={cn(
          'p-4 flex flex-col flex-1',
          view === 'list' && 'min-w-0',
        )}
      >
        <div className="flex justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{nft.title}</h3>
            <span className="text-xs text-muted-foreground">
              {nft.metadata.artist}
              {nft.collection.verified && (
                <Sparkles className="inline w-3 h-3 ml-1 text-primary" />
              )}
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-primary font-medium text-sm">
              {nft.price[nft.tokenType]} {nft.tokenType.toUpperCase()}
            </div>
            <div className="text-[10px] text-muted-foreground">≈ ${nft.price.usd}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2 text-[11px]">
  {!!nft.metadata.genre && nft.metadata.genre !== 'N/A' && (
    <span className="bg-muted px-1.5 rounded">{nft.metadata.genre}</span>
  )}
  {!!nft.metadata.style && nft.metadata.style !== 'N/A' && (
    <span className="bg-muted px-1.5 rounded">{nft.metadata.style}</span>
  )}
</div>


        <div className="mt-auto pt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Stop audio before navigating via CTA
              try { stop(); } catch {}
              onOpen(nft);
            }}
            className="w-full py-2 text-xs rounded text-white
             bg-primary hover:bg-primary/90
             disabled:bg-muted disabled:cursor-not-allowed"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
