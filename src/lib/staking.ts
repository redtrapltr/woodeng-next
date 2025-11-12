// C:\Users\burgu\woodeng-next\src\lib\staking.ts

import { PublicKey, Connection, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { BN, AnchorProvider, Program } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';

import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

/* ────────────────────────────────────────────────────────────────────────────
   Program IDs & mints
──────────────────────────────────────────────────────────────────────────── */
export const WOODENG_STAKING_PROGRAM_ID = new PublicKey(
  'BFJU3f7PXgzcrYPD2MkQsjRko9wDTpEbyJTtLUzSyhFG'
);

export const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const WSOL_DECIMALS = 9;
const WSOL_FACTOR = BigInt(10) ** BigInt(WSOL_DECIMALS);

// Your WOODENG mint (unchanged)
export const WOODENG_MINT = new PublicKey('83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5');
export const WOODENG_DECIMALS = 9;

/* ────────────────────────────────────────────────────────────────────────────
   Seeds — MUST match the new on-chain program
──────────────────────────────────────────────────────────────────────────── */
const CONFIG_SEED = 'config';
const POS_SEED = 'pos';
const STAKE_V_SEED = 'stake_vault';
const REWARD_V_SEED = 'reward_vault';
const MODE_SEED = 'mode';
const REWARD_V_WSOL_SEED = 'reward_vault_wsol';
const MARKER_SEED = 'marker';

/* ────────────────────────────────────────────────────────────────────────────
   Math helpers
──────────────────────────────────────────────────────────────────────────── */
const PREC_BI = 1_000_000_000_000n; // 1e12
const SECS_PER_DAY_BI = 86_400n;
const toBI = (x: any) => BigInt(x?.toString?.() ?? x ?? 0);

const DECIMAL_FACTOR_BI = BigInt(10) ** BigInt(WOODENG_DECIMALS);
const U64_MAX = new BN('18446744073709551615');

function toRaw(ui: number | string | bigint): BN {
  const s = String(ui).trim();
  if (!s.includes('.')) {
    const lamports = BigInt(s) * DECIMAL_FACTOR_BI;
    return new BN(lamports.toString());
  }
  const [wholeStr, fracStrRaw] = s.split('.');
  const fracStr = (fracStrRaw ?? '').padEnd(WOODENG_DECIMALS, '0').slice(0, WOODENG_DECIMALS);
  const whole = BigInt(wholeStr || '0');
  const frac = BigInt(fracStr || '0');
  const lamports = whole * DECIMAL_FACTOR_BI + frac;
  return new BN(lamports.toString());
}
function toRawChecked(ui: number | string | bigint) {
  const bn = toRaw(ui);
  if (bn.gt(U64_MAX)) throw new Error('Amount too large for u64 (exceeds 2^64-1).');
  return bn;
}
const fromRaw = (raw: bigint) => Number(raw) / Number(DECIMAL_FACTOR_BI);

/* ────────────────────────────────────────────────────────────────────────────
   IDL
──────────────────────────────────────────────────────────────────────────── */
import woodengStakingIdl from '@/idl/woodeng_staking.json';

/* ────────────────────────────────────────────────────────────────────────────
   Public types
──────────────────────────────────────────────────────────────────────────── */
export type LockMonths = 3 | 6 | 12;
export type StakingMode = 'flexible' | 'lock';

export interface StakingPool {
  id: string;
  type: StakingMode;
  amount: number;
  lockPeriod?: LockMonths;
  yieldBonus?: number;
  startDate: string;
  endDate?: string;
  pendingRewards: { woodeng: number; sol: number };
  canClaim: boolean;
  canUnstake: boolean;
  penaltyAmount?: number;
}

export interface GlobalStats {
  totalStaked: number;
  totalStakers: number;
  circulatingSupply: number;
  stakedPercentage: number;
  totalRewardPool: { woodeng: number; sol: number; usd: number };
  apr: { flexible: number; lock3m: number; lock6m: number; lock12m: number };
}

/* ────────────────────────────────────────────────────────────────────────────
   Anchor helpers
──────────────────────────────────────────────────────────────────────────── */
export function getProvider(connection: Connection, wallet: any) {
  return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
}
export function getStakingProgram(provider: AnchorProvider) {
  return new Program(woodengStakingIdl as Idl, WOODENG_STAKING_PROGRAM_ID, provider);
}

/* ────────────────────────────────────────────────────────────────────────────
   PDA helpers (must match Rust program)
──────────────────────────────────────────────────────────────────────────── */
export function deriveConfigPda(woodengMint = WOODENG_MINT) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED), woodengMint.toBuffer()],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
}
export function deriveModePda(config: PublicKey, modeByte: 0 | 3 | 6 | 12) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MODE_SEED), config.toBuffer(), Buffer.from(Uint8Array.of(modeByte))],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
}
export function derivePositionPda(owner: PublicKey, config: PublicKey, modePda: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(POS_SEED), owner.toBuffer(), config.toBuffer(), modePda.toBuffer()],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
}



// AFTER
export function deriveRewardsVaultWsolPda(config: PublicKey, wsolMint = WSOL_MINT) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(REWARD_V_WSOL_SEED), config.toBuffer(), wsolMint.toBuffer()],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
}

export function deriveVaultPdas(woodengMint = WOODENG_MINT) {
  const config = deriveConfigPda(woodengMint);
  const stakingVault = PublicKey.findProgramAddressSync(
    [Buffer.from(STAKE_V_SEED), woodengMint.toBuffer()],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
  const rewardsVault = PublicKey.findProgramAddressSync(
    [Buffer.from(REWARD_V_SEED), woodengMint.toBuffer()],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
  const rewardsVaultWsol = deriveRewardsVaultWsolPda(config, WSOL_MINT);
  return { config, stakingVault, rewardsVault, rewardsVaultWsol };
}


export function deriveMarkerPda(user: PublicKey, config: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MARKER_SEED), user.toBuffer(), config.toBuffer()],
    WOODENG_STAKING_PROGRAM_ID
  )[0];
}


/* ────────────────────────────────────────────────────────────────────────────
   UI helpers
──────────────────────────────────────────────────────────────────────────── */
export const modeToByte = (mode: StakingMode, lock?: LockMonths): number =>
  mode === 'flexible' ? 0 : (lock as number);
export const bonusFor = (months?: LockMonths) =>
  months === 3 ? 30 : months === 6 ? 80 : months === 12 ? 200 : 0;

function stakeModeByteFrom(mode: StakingMode, lock?: LockMonths): 0 | 3 | 6 | 12 {
  if (mode === 'flexible') return 0;
  if (lock === 3) return 3;
  if (lock === 6) return 6;
  return 12;
}

/* ────────────────────────────────────────────────────────────────────────────
   Balances
──────────────────────────────────────────────────────────────────────────── */
export async function getUserWoodengBalance(connection: Connection, owner: PublicKey) {
  const ata = getAssociatedTokenAddressSync(WOODENG_MINT, owner, true);
  const resp =
  (await connection.getTokenAccountBalance(ata, 'processed').catch(() => null)) ??
  (await connection.getTokenAccountBalance(ata, 'finalized').catch(() => null));

  return resp?.value?.uiAmount ?? 0;
}

/* ────────────────────────────────────────────────────────────────────────────
   Loaders
──────────────────────────────────────────────────────────────────────────── */
export async function loadUserStaking(
  connection: Connection,
  wallet: any,
  ownerPk: PublicKey
): Promise<StakingPool[]> {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config, rewardsVault } = deriveVaultPdas(WOODENG_MINT);

  // accRewardPerShare (WOODENG) preview including stream step
  let accPreview: bigint = 0n;
  // accRewardPerShareWsol (instant indexed)
  let accWsol: bigint = 0n;

  try {
    const cfg: any = await (program.account as any).config.fetch(config);
    accWsol = toBI(cfg.accRewardPerShareWsol ?? 0);

    const rv = await connection.getTokenAccountBalance(rewardsVault).catch(() => null);
    const rvLamports = rv?.value?.amount ? BigInt(rv.value.amount) : 0n;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));

    const totalShares = toBI(cfg.totalShares);
    let acc = toBI(cfg.accRewardPerShare);

    if (totalShares > 0n) {
      // absorb_external_topups
      let total = toBI(cfg.stream.total);
      let released = toBI(cfg.stream.released);
      let startTs = toBI(cfg.stream.startTs);
      let endTs = toBI(cfg.stream.endTs);
      let lastTs = toBI(cfg.stream.lastTs);

      const expectedRemaining = total > released ? total - released : 0n;
      if (rvLamports > expectedRemaining) {
        const delta = rvLamports - expectedRemaining;
        total += delta;
        startTs = nowSec;
        endTs = nowSec + BigInt(cfg.streamDays) * SECS_PER_DAY_BI;
        if (nowSec > lastTs) lastTs = nowSec;
      }

      // update_stream_to_now
      if (total !== 0n && lastTs !== 0n) {
        const t0 = lastTs > startTs ? lastTs : startTs;
        const t1 = nowSec < endTs ? nowSec : endTs;
        if (t1 > t0) {
          const span = (endTs - startTs) > 0n ? (endTs - startTs) : 1n;
          const newly = (total * (t1 - t0)) / span;
          const already = released;
          const capNew = already + newly <= total ? newly : total - already;
          if (capNew > 0n) {
            const addPerShare = (capNew * PREC_BI) / (totalShares > 0n ? totalShares : 1n);
            acc += addPerShare;
          }
        }
      }
    }
    accPreview = acc;
  } catch {
    accPreview = 0n;
    accWsol = 0n;
  }

  const modes: Array<{ mSeed: 0 | 3 | 6 | 12; type: StakingMode; lock?: LockMonths }> = [
    { mSeed: 0, type: 'flexible' },
    { mSeed: 3, type: 'lock', lock: 3 },
    { mSeed: 6, type: 'lock', lock: 6 },
    { mSeed: 12, type: 'lock', lock: 12 },
  ];

  const pools: StakingPool[] = [];
  for (const entry of modes) {
    const modePda = deriveModePda(config, entry.mSeed);
    const posPda = derivePositionPda(ownerPk, config, modePda);

    let pos: any | null = null;
    try { pos = await (program.account as any).position.fetch(posPda); } catch { continue; }
    if (!pos) continue;

    const amount = fromRaw(BigInt(pos.amount ?? 0));
    if (!amount || amount <= 0) continue;

    const startTs = Number(pos.startTs ?? 0);
    const unlockTs = Number(pos.unlockTs ?? 0);
    const sharesBI = toBI(pos.shares);

    // WOODENG pending (streamed)
    const debtWoodBI = toBI(pos.rewardDebt);
    const entitledWood = (sharesBI * accPreview) / PREC_BI;
    const pendingWoodL = entitledWood > debtWoodBI ? entitledWood - debtWoodBI : 0n;
    const pendingWoodeng = Number(pendingWoodL) / Number(DECIMAL_FACTOR_BI);

    // WSOL pending (instant indexed by pool)
    const debtWsolBI = toBI(pos.rewardDebtWsol ?? 0);
    const entitledWsol = (sharesBI * accWsol) / PREC_BI;
    const pendingWsolL = entitledWsol > debtWsolBI ? entitledWsol - debtWsolBI : 0n;
    const pendingSol = Number(pendingWsolL) / Number(WSOL_FACTOR);

    pools.push({
      id: posPda.toBase58(),
      type: entry.type,
      amount,
      lockPeriod: entry.lock as LockMonths | undefined,
      yieldBonus: entry.type === 'lock' ? bonusFor(entry.lock) : undefined,
      startDate: new Date(startTs * 1000).toISOString(),
      endDate: entry.type === 'lock' && unlockTs > 0 ? new Date(unlockTs * 1000).toISOString() : undefined,
      pendingRewards: { woodeng: pendingWoodeng, sol: pendingSol },
      canClaim: true,
      canUnstake: entry.type === 'flexible' || (entry.type === 'lock' && unlockTs * 1000 < Date.now()),
    });
  }

  return pools;
}

export async function loadGlobalStats(connection: Connection, wallet: any): Promise<GlobalStats> {
  try {
    const provider = getProvider(connection, wallet);
    const program = getStakingProgram(provider);
    const { config, rewardsVault, rewardsVaultWsol } = deriveVaultPdas(WOODENG_MINT);

    const [rvWood, rvWsol] = await Promise.all([
      connection.getTokenAccountBalance(rewardsVault).catch(() => null),
      connection.getTokenAccountBalance(rewardsVaultWsol).catch(() => null),
    ]);
    const rewardWoodeng = rvWood?.value?.uiAmount || 0;
    const rewardSol = rvWsol?.value?.uiAmount || 0;

    const cfg: any = await (program.account as any).config.fetch(config);
    const totalSharesBI = toBI((cfg as any).totalShares ?? 0n);
    const totalStakedApprox = Number(totalSharesBI) / 1e9; // (rough; shares != tokens but fine for a stat)

    const circulatingSupply = 999_850_595;
    const stakedPct = Math.min(100, Math.round((totalStakedApprox / circulatingSupply) * 100));

    return {
      totalStaked: Number(totalStakedApprox.toFixed(2)),
      totalStakers: 0,
      circulatingSupply,
      stakedPercentage: stakedPct,
      totalRewardPool: { woodeng: rewardWoodeng, sol: rewardSol, usd: Math.round((rewardWoodeng + rewardSol) * 0.35) },
      apr: { flexible: 8.5, lock3m: 11.1, lock6m: 15.3, lock12m: 25.5 },
    };
  } catch {
    return {
      totalStaked: 0,
      totalStakers: 0,
      circulatingSupply: 999_850_595,
      stakedPercentage: 0,
      totalRewardPool: { woodeng: 0, sol: 0, usd: 0 },
      apr: { flexible: 0, lock3m: 0, lock6m: 0, lock12m: 0 },
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Tx utils
──────────────────────────────────────────────────────────────────────────── */
async function maybeCreateAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  const info = await connection.getAccountInfo(ata);
  if (info) return { ata, ix: null as any };
  const ix = createAssociatedTokenAccountInstruction(
    payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { ata, ix };
}

async function sendBuilder(_connection: Connection, _wallet: any, _feePayer: PublicKey, builder: any) {
  try {
    const sig = await builder.rpc({ commitment: 'confirmed', skipPreflight: false });
    return sig;
  } catch (e: any) {
    const logs: string[] = e?.logs || e?.value?.logs || [];
    if (logs.length) throw new Error(`RPC_FAILED\n${logs.join('\n')}`);
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Initialization helpers (new flow)
──────────────────────────────────────────────────────────────────────────── */

export async function initModesIfNeeded(connection: Connection, wallet: any) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config } = deriveVaultPdas(WOODENG_MINT);
  const authority = provider.wallet.publicKey;

  const mode0 = deriveModePda(config, 0);
  const mode3 = deriveModePda(config, 3);
  const mode6 = deriveModePda(config, 6);
  const mode12 = deriveModePda(config, 12);

  const [a0, a3, a6, a12] = await Promise.all([
    connection.getAccountInfo(mode0),
    connection.getAccountInfo(mode3),
    connection.getAccountInfo(mode6),
    connection.getAccountInfo(mode12),
  ]);
  if (a0 && a3 && a6 && a12) return 'modes-already-initialized';

  const builder = program.methods
    .initModes()
    .accounts({
      config,
      authority,
      mode0, mode3, mode6, mode12,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    });
  return sendBuilder(connection, wallet, authority, builder);
}

/**
 * Idempotent setup:
 *  - if config missing → call `initializeConfig` (creates config + stake/reward WOODENG vaults)
 *  - always ensure four Mode PDAs (0/3/6/12)
 *  - ensure WSOL rewards vault via `initWsolVaultIfNeeded`
 */
export async function initializeIfNeeded(
  connection: Connection,
  wallet: any,
  flexiblePenaltyBps = 1000,
  minFlexDays = 30,
  streamDays = 14
) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config, stakingVault, rewardsVault, rewardsVaultWsol } = deriveVaultPdas(WOODENG_MINT);
  const authority = provider.wallet.publicKey;

  const configInfo = await connection.getAccountInfo(config);

  if (!configInfo) {
    // Brand new init: initializeConfig
    const builder = program.methods
      .initializeConfig(flexiblePenaltyBps, minFlexDays, streamDays)
      .accounts({
        authority,
        woodengMint: WOODENG_MINT,
        config,
        stakingVault,
        rewardsVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      });

    await sendBuilder(connection, wallet, authority, builder);
  }

  // Ensure Modes
  await initModesIfNeeded(connection, wallet);

  // Ensure WSOL rewards vault
  {
    const wsolVaultInfo = await connection.getAccountInfo(rewardsVaultWsol);
    if (!wsolVaultInfo) {
      const builder = program.methods
        .initWsolVaultIfNeeded()
        .accounts({
          config,
          authority,
          wsolMint: WSOL_MINT,
          rewardsVaultWsol,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        });
      await sendBuilder(connection, wallet, authority, builder);
    }
  }

  return 'ok';
}

/* ────────────────────────────────────────────────────────────────────────────
   User actions
──────────────────────────────────────────────────────────────────────────── */
async function openPositionIfMissing(
  connection: Connection,
  wallet: any,
  ownerPk: PublicKey,
  modeByte: 0 | 3 | 6 | 12
) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config } = deriveVaultPdas(WOODENG_MINT);
  const modePda = deriveModePda(config, modeByte);
  const position = derivePositionPda(ownerPk, config, modePda);

  try { await (program.account as any).position.fetch(position); return 'exists'; } catch {}

  const builder = program.methods
    .openPosition()
    .accounts({
      user: ownerPk,
      config,
      woodengMint: WOODENG_MINT,
      mode: modePda,
      position,
      systemProgram: SystemProgram.programId,
    });
  return sendBuilder(connection, wallet, ownerPk, builder);
}

export async function stake(
  connection: Connection,
  wallet: any,
  ownerPk: PublicKey,
  amount: number,
  mode: StakingMode,
  lock?: LockMonths
) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config, stakingVault, rewardsVault, rewardsVaultWsol } = deriveVaultPdas(WOODENG_MINT);

  if (!wallet?.publicKey || !wallet.publicKey.equals(ownerPk)) {
    throw new Error('wallet.publicKey must equal ownerPk');
  }
  if (mode === 'lock' && ![3, 6, 12].includes(lock as any)) {
    throw new Error('Lock period missing or invalid. Expected 3 | 6 | 12.');
  }

  const cfgOnchain: any = await (program.account as any).config.fetch(config);
  if (!new PublicKey(cfgOnchain.woodengMint).equals(WOODENG_MINT)) {
    throw new Error('WOODENG_MINT mismatch with on-chain config');
  }

  const stakeMode = stakeModeByteFrom(mode, lock);
  const amountArg = toRawChecked(amount);
  const modePda = deriveModePda(config, stakeMode);
  const position = derivePositionPda(ownerPk, config, modePda);

  // NEW: derive marker PDA
  const marker = deriveMarkerPda(ownerPk, config);

  await openPositionIfMissing(connection, wallet, ownerPk, stakeMode);

  const { ata: userAta, ix: createAtaIx } =
    await maybeCreateAtaIx(connection, ownerPk, ownerPk, WOODENG_MINT);

  let builder = program.methods
    .stake(amountArg)
    .accounts({
      user: ownerPk,
      config,
      woodengMint: WOODENG_MINT,
      mode: modePda,
      position,
      stakingVault,
      rewardsVault,   // read-only for absorb
      rewardsVaultWsol,      // ← ADD THIS (WSOL, read-only for absorb)
      userAta,

      // NEW: pass marker as required by the program
      marker,

      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    });

  if (createAtaIx) builder = builder.preInstructions([createAtaIx]);
  return await sendBuilder(connection, wallet, ownerPk, builder);
}


export async function unstake(
  connection: Connection,
  wallet: any,
  ownerPk: PublicKey,
  amount: number,
  pool: StakingPool
) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config, stakingVault, rewardsVault, rewardsVaultWsol } = deriveVaultPdas(WOODENG_MINT);

  const seedByte = pool.type === 'flexible' ? 0 : pool.lockPeriod === 3 ? 3 : pool.lockPeriod === 6 ? 6 : 12;
  const modePda = deriveModePda(config, seedByte as 0 | 3 | 6 | 12);
  const position = derivePositionPda(ownerPk, config, modePda);

  const { ata: userAta, ix: createUserWoodeng } = await maybeCreateAtaIx(connection, ownerPk, ownerPk, WOODENG_MINT);
  const { ata: userWsolAta, ix: createUserWsol } = await maybeCreateAtaIx(connection, ownerPk, ownerPk, WSOL_MINT);

  let builder = program.methods
    .unstake(toRaw(amount))
    .accounts({
      user: ownerPk,
      config,
      mode: modePda,
      position,
      stakingVault,
      rewardsVault,      // WOODENG
      rewardsVaultWsol,  // WSOL
      userAta,           // WOODENG
      userWsolAta,       // WSOL
      tokenProgram: TOKEN_PROGRAM_ID,
    });

  const pres: any[] = [];
  if (createUserWoodeng) pres.push(createUserWoodeng);
  if (createUserWsol) pres.push(createUserWsol);
  if (pres.length) builder = builder.preInstructions(pres);

  return sendBuilder(connection, wallet, ownerPk, builder);
}

export async function claim(connection: Connection, wallet: any, ownerPk: PublicKey, pool?: StakingPool) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config, rewardsVault, rewardsVaultWsol } = deriveVaultPdas(WOODENG_MINT);

  const { ata: userAta, ix: createUserWoodeng } = await maybeCreateAtaIx(connection, ownerPk, ownerPk, WOODENG_MINT);
  const { ata: userWsolAta, ix: createUserWsol } = await maybeCreateAtaIx(connection, ownerPk, ownerPk, WSOL_MINT);

  const modeSeeds: Array<0 | 3 | 6 | 12> = pool
    ? [pool.type === 'flexible' ? 0 : (pool.lockPeriod as 3 | 6 | 12)]
    : [0, 3, 6, 12];

  const ixs: any[] = [];
  if (createUserWoodeng) ixs.push(createUserWoodeng);
  if (createUserWsol) ixs.push(createUserWsol);

  for (const m of modeSeeds) {
    const modePda = deriveModePda(config, m);
    const position = derivePositionPda(ownerPk, config, modePda);
    try { await (program.account as any).position.fetch(position); } catch { continue; }

    const b = program.methods
      .claim()
      .accounts({
        user: ownerPk,
        config,
        mode: modePda,
        position,
        rewardsVault,      // WOODENG
        rewardsVaultWsol,  // WSOL
        userWsolAta,       // WSOL
        userAta,           // WOODENG
        tokenProgram: TOKEN_PROGRAM_ID,
      });
    ixs.push(await b.instruction());
  }

  if (!ixs.length) return 'no-positions-to-claim';

const tx = new Transaction().add(...ixs);
tx.feePayer = ownerPk; // optional but nice-to-have

return await (program.provider as AnchorProvider).sendAndConfirm(tx, [], {
  commitment: 'confirmed',
});

}

/* ────────────────────────────────────────────────────────────────────────────
   Admin: deposit WOODENG to rewards_vault (restart stream)
──────────────────────────────────────────────────────────────────────────── */
export async function depositRewards(connection: Connection, wallet: any, amountUi: number) {
  const provider = getProvider(connection, wallet);
  const program = getStakingProgram(provider);
  const { config, rewardsVault } = deriveVaultPdas(WOODENG_MINT);
  const authority = provider.wallet.publicKey;

  const { ata: payerRewardsSrc, ix } = await maybeCreateAtaIx(connection, authority, authority, WOODENG_MINT);

  let builder = program.methods
    .depositRewards(toRaw(amountUi))
    .accounts({
      config,
      authority,
      woodengMint: WOODENG_MINT,
      rewardsVault,
      payerRewardsSrc,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

  if (ix) builder = builder.preInstructions([ix]);
  return sendBuilder(connection, wallet, authority, builder);
}



// Update penalty, min days, stream days, or weights on-chain
export async function setParams(
  connection: Connection,
  wallet: any,
  opts: {
    flexiblePenaltyBps?: number;   // 1000 = 10%
    minFlexDays?: number;          // e.g., 30
    streamDays?: number;           // optional
    weights?: { flex: number; m3: number; m6: number; m12: number }; // optional
  }
) {
  const provider = getProvider(connection, wallet);
  const program  = getStakingProgram(provider);
  const { config } = deriveVaultPdas(WOODENG_MINT);
  const authority = provider.wallet.publicKey;

  const fp = (typeof opts.flexiblePenaltyBps === 'number') ? opts.flexiblePenaltyBps : null;
  const md = (typeof opts.minFlexDays        === 'number') ? opts.minFlexDays        : null;
  const sd = (typeof opts.streamDays         === 'number') ? opts.streamDays         : null;
  const wt = (opts.weights) ? opts.weights : null;

  const builder = program.methods
    .setParams(fp, md, sd, wt)
    .accounts({ config, authority });

  return builder.rpc({ commitment: 'confirmed' });
}
