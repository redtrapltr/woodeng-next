import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from './constants';

export function orderPdas(
  nftMint: PublicKey,
  seller:  PublicKey,
  orderId: bigint         // use same bigint strategy everywhere
) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(orderId);

  const [order]   = PublicKey.findProgramAddressSync(
    [Buffer.from('order'), nftMint.toBuffer(), seller.toBuffer(), buf],
    PROGRAM_ID
  );
  const [escrow]  = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), order.toBuffer()],
    PROGRAM_ID
  );
  const [escAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_auth'), order.toBuffer()],
    PROGRAM_ID
  );

  return { order, escrow, escAuth };
}
