// app/api/uploadMetadata/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import idl from '../../../idl/idl.json';

// PROGRAM IDs (same as before)
const PROGRAM_ID   = new PublicKey('FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS');
const WOODENG_MINT = new PublicKey('CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad');

export async function POST(req: NextRequest) {
  try {
    const { mintedAddrs, depositWoodeng, isBundle } = await req.json();
    if (!mintedAddrs || !Array.isArray(mintedAddrs)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // 1) Set up Anchor provider & Program
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    // You cannot sign from an API route—if you want to do on‐chain pool creation, 
    // either the user must sign client‐side OR you need to keep the user's key on a server, which is insecure.
    // For simplicity, here we just echo back success + minted addresses.

    // If you WANT the serverless function to create the AMM pool on‐chain, you need:
    //   • a server‐side keypair (not recommended to expose private key)
    //   • anchor Provider with that keypair as wallet
    //   • then call program.methods.createPool(...) etc.
    //
    // Instead, most people do pool creation client‐side (like you originally did).
    // So the API route can simply return success.

    return NextResponse.json({
      success: true,
      poolAddress: mintedAddrs[0] || null, // just a placeholder, or generate pool on the client
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message || err.toString() }, { status: 500 });
  }
}
