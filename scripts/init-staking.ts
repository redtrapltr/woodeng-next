// scripts/init-staking.ts
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import type { Idl } from '@project-serum/anchor';
import idl from '../idl/woodeng_staking.json'; // ← fixed path

const RPC = process.env.RPC_URL ?? 'process.env.NEXT_PUBLIC_SOLANA_RPC as string';
const STAKING_PROGRAM_ID = new PublicKey('BFJU3f7PXgzcrYPD2MkQsjRko9wDTpEbyJTtLUzSyhFG');

// <- fill these
const WOODENG_MINT = new PublicKey('83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5');
const WSOL_MINT    = new PublicKey('So11111111111111111111111111111111111111112');

// Load your admin keypair
function loadKeypair(path = process.env.DEPLOYER_KEYPAIR!) {
  const fs = require('fs');
  const s = fs.readFileSync(path, 'utf8');
  const arr = Uint8Array.from(JSON.parse(s));
  return Keypair.fromSecretKey(arr);
}


async function initForMint(provider: AnchorProvider, woodengMint: PublicKey) {
  const program = new Program(idl as Idl, STAKING_PROGRAM_ID, provider);

  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), woodengMint.toBuffer()],
    STAKING_PROGRAM_ID
  );

  // If already exists, skip
  const acc = await provider.connection.getAccountInfo(config);
  if (acc) {
    console.log(`config already exists for ${woodengMint.toBase58()} -> ${config.toBase58()}`);
    return;
  }

  const tx = await program.methods
    .initialize(
      500,   // flexible_penalty_bps (5%)
      7,     // min_flex_days
      14,    // stream_days
    )
    .accounts({
      authority: provider.wallet.publicKey,
      woodengMint,
      wsolMint: WSOL_MINT, // must be the canonical WSOL
      // vaults + modes are derived inside Anchor using your account constraints
      systemProgram: SystemProgram.programId,
      tokenProgram: (await import('@solana/spl-token')).TOKEN_PROGRAM_ID,
      rent: (await import('@solana/web3.js')).SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  console.log(`initialized staking for ${woodengMint.toBase58()} in tx ${tx}`);

  // Optional: init_modes (idempotent) in case you ever re-run
  try {
    await program.methods
      .initModes()
      .accounts({
        config,
        authority: provider.wallet.publicKey,
      })
      .rpc();
    console.log('init_modes ok');
  } catch (e) {
    console.log('init_modes skipped/ok:', (e as any)?.message ?? e);
  }
}

(async () => {
  const kp = loadKeypair();
  const conn = new Connection(RPC, 'confirmed');
  const provider = new AnchorProvider(conn, { publicKey: kp.publicKey, signTransaction: async (tx:any)=>{tx.partialSign(kp);return tx;}, signAllTransactions: async (txs:any[])=>{txs.forEach(t=>t.partialSign(kp));return txs;} } as any, { preflightCommitment: 'confirmed' });

  // 1) WOODENG-keyed config (for WOODENG pairs)
  await initForMint(provider, WOODENG_MINT);
  // 2) WSOL-keyed config (for SOL pairs; REQUIRED)
  await initForMint(provider, WSOL_MINT);

  console.log('done');
})();
