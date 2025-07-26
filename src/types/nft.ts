/* ------------------------------------------------------------------ *
 *  Single source-of-truth for an NFT object used everywhere
 * ------------------------------------------------------------------ */
import type { ReactNode } from 'react';
import type { PoolType }  from '@/lib/sound-meme-types';

/** UI-friendly representation of any NFT in the app */
export type NFT = {
  /* ───── basic ids ───── */
  id:        string;     // “primary key” (usually the SPL-mint base-58)
  mint?:     string;     // SPL mint (32-byte base-58)
  poolPda?:  string;     // raw PDA as base-58 (legacy – can be dropped)
  userLockers?: { lockId: number; mint: string ; balance: 0 | 1 }[];



  /* ───── visuals ─────── */
  title:     string;
  imageUrl:  string;
  audioUrl:  string;

  /* ───── pricing ─────── */
  price:  { sol: number; woodeng: number; usd: number };
  status: 'available' | 'sold' | 'auction' | 'listed';

  /** Wallet publicKey du vendeur pour les listings directs */
  seller?: string;                // ← ajout

  /* ───── filters  ─────── */
  type:      'single' | 'bundle';   // single NFT vs bundle-vault
  tokenType: 'woodeng' | 'sol';     // quote currency
  nftType:   'music'   | 'soundmeme';
  hasPool:   boolean;               // true if AMM pool exists

  /* ───── misc ─────────── */
  popularity: number;               // arbitrary score for “trending”
  createdAt:  string;               // ISO date
  collection: {
    name:       string;
    verified:   boolean;
    floorPrice: number;
    volume24h:  number;
  };
  metadata: {
    artist:     string;
    genre:      string;
    duration:   number;            // seconds
    style?:     string;
    collection?:string;
    royalties?: number;            // %
  };

  /* ───── optional detail ─ */
  tracks?: {
    title: string;
    duration: number;
    audioUrl: string;
  }[];
  lastTransactions?: {
    date:  string;
    price: number;
    type:  'sale' | 'bid';
  }[];

    /* ───── helper fields  ── */
  creators?:        string[];   // 0-index = primary creator
  updateAuthority?: string;     // fallback for authority-based “created”
  lockerId?:        number;     // NEW – Sound-Meme locker number

  /* ----------------------------------------------------------------
   *  NEW — fields consumed by ProfilePage & NFTCard
   * ---------------------------------------------------------------- */
  /** For Sound-Memes we keep the full pool object;  
      for Music-NFTs this is either the pool PDA *string* or `undefined`. */
  pool?: PoolType | string;

  /** Row of custom action-buttons injected by the parent list view. */
  extraActions?: ReactNode;

  /** Secondary-market listing info for music NFTs (Magic Eden, etc.) */
  listing?: any;

  /** Optional click handler injected by parent components. */
  onClick?: () => void;


};
