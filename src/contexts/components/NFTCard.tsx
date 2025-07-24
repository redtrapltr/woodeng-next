'use client';
import React from 'react';
import { Pause, Play } from 'lucide-react';
import { NFT } from '@/types/nft';
import { cn } from '@/lib/utils';
import { Web3Image, useAudio } from '@/contexts/components/Web3Media';


function liveCount(lockers: {balance?: number}[]) {
  return lockers.filter(l => l.balance === 1).length;
}


/**
 * NFTCard – re-usable NFT Card for Music & Sound Meme NFTs
 * @param nft - NFT object
 * @param className - for custom styling
 * @param extraActions - React nodes for Buy/Sell/List/Burn buttons
 * @param onClick - handler for card click
 */



export const NFTCard: React.FC<
  NFT & {
    className?: string;
    extraActions?: React.ReactNode;
    onClick?: () => void;
  }
> = (nft) => {
  const { playing, play, stop } = useAudio(nft.audioUrl);

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg relative shadow hover:shadow-lg transition cursor-pointer group',
        nft.className
      )}
      onClick={nft.onClick}
      tabIndex={0}
      role="button"
    >
      {/* Media */}
      <div className="relative aspect-square rounded-t-lg overflow-hidden">
        <Web3Image
          src={nft.imageUrl}
          alt={nft.title}
          className="w-full h-full object-cover group-hover:brightness-95"
        />

        {/* Audio controls */}
        {nft.audioUrl && (
          <button
            type="button"
            tabIndex={-1}
            onClick={e => {
              e.stopPropagation();
              playing ? stop() : play();
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white" />}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-1">
        <h3 className="font-semibold leading-snug">{nft.title}</h3>
        <p className="text-xs text-muted-foreground">{nft.metadata?.artist || 'Unknown Artist'}</p>

        {/* Show number owned for Sound Memes */}
        {nft.nftType === 'soundmeme' && Array.isArray(nft.userLockers) && (
          <div className="text-xs opacity-60 mt-1">You own {liveCount(nft.userLockers)}</div>
        )}

        {/* Optional: Mint debug for devs */}
        {/* {nft.nftType === 'soundmeme' && nft.userLockers?.length > 0 && (
          <ul className="text-[10px] opacity-40">{nft.userLockers.map((l: any) => (
            <li key={l.mint}>{l.mint.slice(0, 4)}…{l.mint.slice(-4)}</li>
          ))}</ul>
        )} */}
      </div>

      {/* Actions: Buy/Sell/List/Burn */}
      {nft.extraActions && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">{nft.extraActions}</div>
      )}
    </div>
  );
};
