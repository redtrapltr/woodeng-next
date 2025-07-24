// src/lib/sound-meme-types.ts
import { PublicKey } from '@solana/web3.js';

export type PoolType = {
  pubkey:          PublicKey;                          // PDA of the pool-config
  memeMint:        PublicKey;
  ammReserves:     { meme: number; woodeng: number };
  price:           number;                             // WOODENG per meme
  userMemeBalance: number;                             // caller’s token bal
  name?:           string;
  symbol?:         string;
  description?:    string;
  imageUrl?:       string;
  audioUrl?:       string;
  threshold?:      number;
  attributes?:     any[];
  imageFile?: File;
  audioFile?: File;
};
