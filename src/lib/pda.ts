// src/lib/pda.ts
import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { PROGRAM_ID } from './constants';

// Make an 8-byte little-endian buffer from a number/bigint/BN
function u64LE(n: bigint | number | BN): Buffer {
  const bn = BN.isBN(n) ? n : new BN(n.toString());
  return bn.toArrayLike(Buffer, 'le', 8);
}

export function orderPdas(
  nftMint: PublicKey,
  seller:  PublicKey,
  orderId: bigint | number | BN
) {
  const orderIdLe = u64LE(orderId);

  const [order] = PublicKey.findProgramAddressSync(
    [Buffer.from('order'), nftMint.toBuffer(), seller.toBuffer(), orderIdLe],
    PROGRAM_ID
  );

  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), order.toBuffer()],
    PROGRAM_ID
  );

  const [escAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), order.toBuffer()],
    PROGRAM_ID
  );

  return { order, escrow, escAuth };
}
