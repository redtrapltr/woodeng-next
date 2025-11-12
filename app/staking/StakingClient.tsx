'use client';

import React, {
  useEffect, useMemo, useState, useTransition, useDeferredValue, useCallback, startTransition,
} from 'react';

import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Coins,
  Lock,
  Unlock,
  TrendingUp,
  Gift,
  Info,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Music2,
  Volume2,
  Target,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  initializeIfNeeded,
  deriveConfigPda,
  getProvider,
  getStakingProgram,
  deriveModePda,
} from '@/lib/staking';

import { PublicKey, Connection } from '@solana/web3.js';
import { useWoodengBalanceLive } from '@/hooks/useWoodengBalanceLive';

import { WOODENG_MINT } from '@/lib/staking';


import {
  loadUserStaking,
  loadGlobalStats,
  stake as stakeTx,
  unstake as unstakeTx,
  claim as claimTx,
  getUserWoodengBalance,
  depositRewards,
  setParams, // ← ADDED
} from '@/lib/staking';



/* ───────────────────────── types ───────────────────────── */

type LockMonths = 3 | 6 | 12;

type StakingMode = 'flexible' | 'lock';

interface StakingPool {
  id: string;
  type: StakingMode;
  amount: number;
  lockPeriod?: LockMonths; // months
  yieldBonus?: number;     // percentage
  startDate: string;
  endDate?: string;
  pendingRewards: {
    woodeng: number;
    sol: number;
  };
  canClaim: boolean;
  canUnstake: boolean;
  penaltyAmount?: number;
}

interface GlobalStats {
  totalStaked: number;
  totalStakers: number;
  circulatingSupply: number;
  stakedPercentage: number;
  totalRewardPool: {
    woodeng: number;
    sol: number;
    usd: number;
  };
  apr: {
    flexible: number;
    lock3m: number;
    lock6m: number;
    lock12m: number;
  };
}

/* ───────────────────── dynamic wallet ui ───────────────────── */
// avoids SSR issues in /app router
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

/* ─────────────── program ids & seeds (frontend) ───────────────
   You can keep these here or move into a central constants file.
   Make sure they match your on-chain programs.
*/

export const SOUND_MEME_POOL_PROGRAM_ID = '8YCde6Jm1Xz8FDiYS3R4AksgNVPEmrjNvkmdMnugEzrV';



/* ───────────────────────── helpers ───────────────────────── */

const getYieldBonus = (months: number) => (months === 3 ? 30 : months === 6 ? 80 : months === 12 ? 200 : 0);

const getRemainingTime = (endDate: string) => {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return '✓ Unlocked';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
};


// `amount` is already principal from loadUserStaking
const principalOf = (p: StakingPool) => p.amount;
;





// Safely convert BN | number | string | undefined to a JS number
const toNum = (v: any, fallback = 0): number => {
  if (v == null) return fallback;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  // BN or object with toString
  try {
    const n = Number(v.toString());
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};



/* ─────────────────────── main component ─────────────────────── */

export default function StakingClient() {
  const wallet = useWallet();
const { connected, publicKey } = wallet;

    const owner = publicKey?.toBase58() || '';
  // 🔒 Force the staking page to the same cluster as the header
  const connection = useMemo(
    () => new Connection(
  (process.env.NEXT_PUBLIC_SOLANA_RPC as string) || 'https://api.mainnet-beta.solana.com',
  'confirmed'
),

    []
  );


  const [missingModes, setMissingModes] = useState<boolean>(false);
const [configAuthority, setConfigAuthority] = useState<string>('');

useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const cfg = deriveConfigPda();
      const cfgInfo = await connection.getAccountInfo(cfg);
      if (!cfgInfo) { setMissingModes(false); return; }

      // fetch config to display authority (optional but helpful)
      try {
        const provider = getProvider(connection, wallet);
        const program  = getStakingProgram(provider);
        const cfgAcc: any = await (program.account as any).config.fetch(cfg);
        if (alive) setConfigAuthority(new PublicKey(cfgAcc.authority).toBase58());
      } catch {}

      // probe the 4 mode PDAs
      const mode0 = deriveModePda(cfg, 0);
      const mode3 = deriveModePda(cfg, 3);
      const mode6 = deriveModePda(cfg, 6);
      const mode12 = deriveModePda(cfg, 12);

      const [a0, a3, a6, a12] = await Promise.all([
        connection.getAccountInfo(mode0),
        connection.getAccountInfo(mode3),
        connection.getAccountInfo(mode6),
        connection.getAccountInfo(mode12),
      ]);

      if (alive) setMissingModes(!(a0 && a3 && a6 && a12));
    } catch {
      if (alive) setMissingModes(false);
    }
  })();
  return () => { alive = false; };
}, [connection, wallet]);

// DEBUG: dump on-chain staking config once (helps verify penalty/min days)
useEffect(() => {
  (async () => {
    try {
      const provider = getProvider(connection, wallet);
      const program  = getStakingProgram(provider);
      const cfgPda   = deriveConfigPda();

      const cfg: any = await (program.account as any).config.fetch(cfgPda);

      console.log('[WOODENG][Config]', {
        pda: cfgPda.toBase58(),
        authority: new PublicKey(cfg.authority).toBase58(),
        woodengMint: new PublicKey(cfg.woodengMint).toBase58(),
        stakingVault: new PublicKey(cfg.stakingVault).toBase58(),
        rewardsVault: new PublicKey(cfg.rewardsVault).toBase58(),
        rewardsVaultWsol: new PublicKey(cfg.rewardsVaultWsol).toBase58(),
        // 👇 key penalty settings to verify
        flexible_penalty_bps: cfg.flexiblePenaltyBps,
        min_flex_days:        cfg.minFlexDays,
        stream_days:          cfg.streamDays,
        // extras (handy for sanity checks)
        weights:              cfg.weights,
        accRewardPerShare:    (cfg.accRewardPerShare ?? cfg.acc_reward_per_share)?.toString?.(),
        accRewardPerShareWsol:(cfg.accRewardPerShareWsol ?? cfg.acc_reward_per_share_wsol)?.toString?.(),
        totalShares:          (cfg.totalShares ?? cfg.total_shares)?.toString?.(),
        wsol_index_checkpoint:cfg.wsolIndexCheckpoint ?? cfg.wsol_index_checkpoint,
        stream:               cfg.stream,
        total_stakers:        Number(cfg.totalStakers ?? 0),
      });
    } catch (e) {
      console.warn('[WOODENG][Config] fetch failed:', e);
    }
  })();
}, [connection, wallet]);



  const [isPending] = useTransition(); // matches your marketplace style
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [transactionMessage, setTransactionMessage] = useState('');

  const [topupAmount, setTopupAmount] = useState('0.10'); // default 0.10 WOODENG


const userBalance = useWoodengBalanceLive(connection, publicKey, WOODENG_MINT);


 
  const [stakingPools, setStakingPools] = useState<StakingPool[]>([]);
 


  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalStaked: 0,
    totalStakers: 0,
    circulatingSupply: 0,
    stakedPercentage: 0,
    totalRewardPool: { woodeng: 0, sol: 0, usd: 0 },
    apr: { flexible: 0, lock3m: 0, lock6m: 0, lock12m: 0 },
  });


  const [globalPrincipalStaked, setGlobalPrincipalStaked] = useState<number | null>(null);

useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const provider = getProvider(connection, wallet);
      const program  = getStakingProgram(provider);
      const cfgPda   = deriveConfigPda();

      // fetch config to get the staking_vault pubkey
      const cfg: any = await (program.account as any).config.fetch(cfgPda);
      const stakingVaultPk = new PublicKey(
        (cfg.stakingVault ?? cfg.staking_vault) as string
      );

      // read SPL balance of the staking vault → true principal staked
      const bal = await connection.getTokenAccountBalance(stakingVaultPk);

      let principal = 0;
      if (bal?.value) {
        principal =
          bal.value.uiAmount ??
          (bal.value.uiAmountString ? Number(bal.value.uiAmountString) : undefined) ??
          (bal.value.amount && bal.value.decimals != null
            ? Number(bal.value.amount) / Math.pow(10, bal.value.decimals)
            : 0);
      }

      if (alive) {
        setGlobalPrincipalStaked(Number.isFinite(principal) ? principal : 0);
      }
    } catch (e) {
      console.warn('[WOODENG] Failed to read staking vault balance', e);
      if (alive) setGlobalPrincipalStaked(0);
    }
  })();
  return () => {
    alive = false;
  };
}, [connection, wallet]);


const stakedPctLocal = useMemo(() => {
  if (globalPrincipalStaked != null && globalStats.circulatingSupply > 0) {
    return (globalPrincipalStaked / globalStats.circulatingSupply) * 100;
  }
  return globalStats.stakedPercentage; // fallback if something fails
}, [globalPrincipalStaked, globalStats.circulatingSupply, globalStats.stakedPercentage]);



  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [stakingMode, setStakingMode] = useState<StakingMode>('flexible');
  const [lockPeriod, setLockPeriod] = useState<LockMonths>(6);

  const [needsInit, setNeedsInit] = useState<boolean | null>(null);

  // show placeholders instead of "0" until first load completes
const [loadingPools, setLoadingPools] = useState(true);
const [loadingStats, setLoadingStats] = useState(true);


useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const cfg = deriveConfigPda();
      const info = await connection.getAccountInfo(cfg);
      if (!alive) return;
      setNeedsInit(!info); // true => not initialized yet
    } catch {
      setNeedsInit(true);
    }
  })();
  return () => { alive = false; };
}, [connection]);




  useEffect(() => {
  let alive = true;
  (async () => {
    if (!connected || !publicKey) return;
    try {
      if (alive) {
        setLoadingPools(true);
        setLoadingStats(true);
      }

      const [poolsRes, statsRes] = await Promise.allSettled([
        loadUserStaking(connection, wallet, publicKey),
        loadGlobalStats(connection, wallet),
      ]);

      if (!alive) return;

      if (poolsRes.status === 'fulfilled') setStakingPools(poolsRes.value);
      if (statsRes.status === 'fulfilled') setGlobalStats(statsRes.value);
    } catch (e) {
      console.error('staking init load failed', e);
    } finally {
      if (alive) {
        setLoadingPools(false);
        setLoadingStats(false);
      }
    }
  })();
  return () => { alive = false; };
}, [connected, publicKey, connection, wallet]);




  

  // derived
  // who can see admin controls?
const isAuthority = useMemo(
  () => !!publicKey && !!configAuthority && publicKey.toBase58() === configAuthority,
  [publicKey, configAuthority]
);

const totalStaked = useMemo(
  () => stakingPools.reduce((s, p) => s + p.amount, 0),
  [stakingPools]
);



  const totalPendingRewards = useMemo(
    () =>
      stakingPools.reduce(
        (sum, p) => ({
          woodeng: sum.woodeng + p.pendingRewards.woodeng,
          sol: sum.sol + p.pendingRewards.sol,
        }),
        { woodeng: 0, sol: 0 }
      ),
    [stakingPools]
  );

  const showToast = useCallback((status: 'success' | 'error', msg: string) => {
    setTransactionStatus(status);
    setTransactionMessage(msg);
    setTimeout(() => setTransactionStatus('idle'), 3000);
  }, []);

  /* ─────────────────── actions (call rpc_*) ─────────────────── */

  // helpers used by the handlers (must be inside the component)
const refreshAll = useCallback(async () => {
  if (!publicKey) return;
  // avoid flicker by not toggling if we already have data once
  setLoadingPools((v) => v || stakingPools.length === 0);
  setLoadingStats((v) => v || globalStats.circulatingSupply === 0);

  try {
    const [pools, stats] = await Promise.all([
      loadUserStaking(connection, wallet, publicKey),
      loadGlobalStats(connection, wallet),
    ]);
    setStakingPools(pools);
    setGlobalStats(stats);
  } finally {
    setLoadingPools(false);
    setLoadingStats(false);
  }
}, [connection, wallet, publicKey, stakingPools.length, globalStats.circulatingSupply]);






// confirm a signature when your SDK returns it (safe no-op if undefined)
const confirmIfPossible = async (sig?: string) => {
  if (!sig) return;
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
};


  const handleStake = async () => {
  if (!connected || !publicKey) return;
  const amt = Number(stakeAmount || 0);
  if (!amt || amt <= 0 || amt > userBalance) return;

  setIsProcessing(true);
  try {
    // your SDK may return a signature; it's fine if it returns void
    const sig = await stakeTx(
      connection,
      wallet,
      publicKey,
      amt,
      stakingMode,
      stakingMode === 'lock' ? lockPeriod : undefined
    );

    await confirmIfPossible(sig);
    await refreshAll();

    setStakeAmount('');
    setShowStakeModal(false);
    setTransactionStatus('success');
    setTransactionMessage('Tokens staked successfully!');
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('already been processed')) {
      // treat as success, refresh state
      await refreshAll();
      setStakeAmount('');
      setShowStakeModal(false);
      setTransactionStatus('success');
      setTransactionMessage('Tokens staked successfully!');
    } else {
      if (typeof e?.getLogs === 'function') {
        try { console.error('Tx logs:', await e.getLogs(connection)); } catch {}
      }
      setTransactionStatus('error');
      setTransactionMessage('Failed to stake tokens. Please try again.');
    }
  } finally {
    setIsProcessing(false);
    setTimeout(() => setTransactionStatus('idle'), 3000);
  }
};


  const handleUnstake = async () => {
  if (!connected || !publicKey || !selectedPool) return;
  const amt = Number(unstakeAmount || 0);
  if (!amt || amt <= 0 || amt > selectedPool.amount) return;

  setIsProcessing(true);
  try {
    const sig = await unstakeTx(
      connection,
      wallet,
      publicKey,
      amt,
      selectedPool
    );

    await confirmIfPossible(sig);
    await refreshAll();

    setUnstakeAmount('');
    setShowUnstakeModal(false);
    setSelectedPool(null);
    setTransactionStatus('success');
    setTransactionMessage('Tokens unstaked successfully!');
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('already been processed')) {
      await refreshAll();
      setUnstakeAmount('');
      setShowUnstakeModal(false);
      setSelectedPool(null);
      setTransactionStatus('success');
      setTransactionMessage('Tokens unstaked successfully!');
    } else {
      if (typeof e?.getLogs === 'function') {
        try { console.error('Tx logs:', await e.getLogs(connection)); } catch {}
      }
      setTransactionStatus('error');
      setTransactionMessage('Failed to unstake tokens. Please try again.');
    }
  } finally {
    setIsProcessing(false);
    setTimeout(() => setTransactionStatus('idle'), 3000);
  }
};



  const handleClaimAll = async () => {
  if (!connected || !publicKey) return;

  setIsProcessing(true);
  try {
    await claimTx(connection, wallet, publicKey); // per-mode claims can loop inside your SDK if needed

    // refresh from chain
    const [pools, stats] = await Promise.all([
      loadUserStaking(connection, wallet, publicKey),
      loadGlobalStats(connection, wallet),
    ]);
    setStakingPools(pools);
    setGlobalStats(stats);

    setTransactionStatus('success');
    setTransactionMessage('Successfully claimed rewards!');
  } catch (e) {
    console.error(e);
    setTransactionStatus('error');
    setTransactionMessage('Failed to claim rewards. Please try again.');
  } finally {
    setIsProcessing(false);
    setTimeout(() => setTransactionStatus('idle'), 3000);
  }
};


  /* ───────────────────────── UI ───────────────────────── */

  if (!connected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <div className="text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
            <Coins className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold">WOODENG Staking</h1>
          <p className="text-xl text-muted-foreground max-w-lg">
            Connect your wallet to start earning rewards through staking.
          </p>
        </div>
        <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !px-8 !py-3 !text-lg" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-extrabold">WOODENG Staking</h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4">
          Stake your WOODENG tokens to earn rewards from platform activity. Choose between flexible
          staking or lock staking for higher yields.
        </p>
      </div>

     {connected && ((needsInit === true) || (isAuthority && missingModes)) && (
  <div className="container mx-auto px-6">
    <div className="my-4 p-3 md:p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm">
          <b>{needsInit ? 'Staking not initialized on this cluster.' : 'Mode accounts missing (0/3/6/12).'}</b><br />
          Click to create the config + vaults + mode PDAs (payer = your wallet).
          {configAuthority && (
            <div className="mt-1 text-xs text-muted-foreground">
              Config authority: <span className="font-mono">{configAuthority}</span>
            </div>
          )}
        </div>
        <button
          onClick={async () => {
            setIsProcessing(true);
            try {
              await initializeIfNeeded(connection, wallet); // this will call initModesIfNeeded if config exists
              setNeedsInit(false);
              setMissingModes(false);
              setTransactionStatus('success');
              setTransactionMessage('Staking initialized / modes created!');
            } catch (e:any) {
              console.error(e);
              setTransactionStatus('error');
              setTransactionMessage(
                'Initialize failed. Ensure you are using the config authority wallet to create modes.'
              );
            } finally {
              setIsProcessing(false);
              setTimeout(() => setTransactionStatus('idle'), 3000);
            }
          }}
          disabled={isProcessing}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isProcessing ? 'Initializing…' : 'Initialize staking'}
        </button>
      </div>
    </div>
  </div>
)}





      {/* Global Statistics */}
      <div className="container mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">

        <div className="bg-card border border-border rounded-lg p-3 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs md:text-sm text-muted-foreground">Total Staked</h3>
            <Coins className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          

          <p className="text-lg md:text-2xl font-bold">
  {loadingStats
    ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
    : (globalPrincipalStaked ?? 0).toLocaleString()
  }
</p>


          <p className="text-xs md:text-sm text-muted-foreground mt-1">WOODENG</p>
           <p className="text-xs md:text-sm text-muted-foreground">
   {stakedPctLocal.toFixed(2)}% of circulating supply
 </p>
        </div>

        

        <div className="bg-card border border-border rounded-lg p-3 md:p-6 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs md:text-sm text-muted-foreground">Circulating Supply</h3>
            <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <p className="text-lg md:text-2xl font-bold">
  {loadingStats ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
                 : globalStats.circulatingSupply.toLocaleString()}
</p>

          <p className="text-xs md:text-sm text-muted-foreground mt-1">WOODENG tokens</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 md:p-6 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs md:text-sm text-muted-foreground">Reward Pool</h3>
            <Gift className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-lg md:text-2xl font-bold">
  {loadingStats ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
                 : `${globalStats.totalRewardPool.woodeng.toLocaleString()} WOODENG`}
</p>
<p className="text-lg md:text-2xl font-bold">
  {loadingStats ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
                 : `${globalStats.totalRewardPool.sol.toLocaleString()} SOL`}
</p>

          </div>
          

        </div>
      </div>

      {/* Your Stake Overview */}
      <div className="container mx-auto px-4 sm:px-6 bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold">Your Stake</h2>
          <button
            onClick={() => setShowStakeModal(true)}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm md:text-base"
          >
            <Coins className="w-4 h-4" />
            <span className="hidden sm:inline">Stake Tokens</span>
            <span className="sm:hidden">Stake</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-xs md:text-sm text-muted-foreground">Available Balance</span>
            </div>
            <p className="text-lg md:text-2xl font-bold">
  {(loadingPools || loadingStats)
    ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
    : userBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
</p>


            <p className="text-xs md:text-sm text-muted-foreground">WOODENG</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-primary" />
              <span className="text-xs md:text-sm text-muted-foreground">Total Staked</span>
            </div>
            <p className="text-lg md:text-2xl font-bold">
  {loadingPools
    ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
    : totalStaked.toLocaleString()}
</p>

            <p className="text-xs md:text-sm text-muted-foreground">WOODENG</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-primary" />
              <span className="text-xs md:text-sm text-muted-foreground">Pending Rewards</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg md:text-2xl font-bold">
  {loadingPools
    ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
    : `${totalPendingRewards.woodeng.toFixed(6)} WOODENG`}
</p>
<p className="text-lg md:text-2xl font-bold">
  {loadingPools
    ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</span>
    : `${totalPendingRewards.sol.toFixed(4)} SOL`}
</p>

            </div>
          </div>
        </div>

        {/* Claim Rewards */}
{!loadingPools && (totalPendingRewards.woodeng > 0 || totalPendingRewards.sol > 0) && (
  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-primary">Rewards Available</h3>
                <p className="text-sm text-muted-foreground">Claim your staking rewards</p>
              </div>
              <div className="flex">
  <button
    onClick={handleClaimAll}
    disabled={isProcessing}
    className="px-3 py-1.5 md:px-4 md:py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm md:text-base"
  >
    Claim All Rewards
  </button>
</div>

            </div>
          </div>
        )}

        {/* Staking Pools */}
        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-semibold">Your Staking Pools</h3>
          {loadingPools ? (
  <div className="text-center py-8 text-muted-foreground">
    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
    <p>Loading your pools…</p>
  </div>
) : stakingPools.length > 0 ? (
  <div className="space-y-4">
    {stakingPools.map((pool) => (
      <div
        key={pool.id}
        className={cn(
          'border rounded-lg p-3 md:p-4',
          pool.type === 'flexible'
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-primary/20 bg-primary/5'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {pool.type === 'flexible' ? (
              <Unlock className="w-5 h-5 text-green-500" />
            ) : (
              <Lock className="w-5 h-5 text-primary" />
            )}
            <div>
              <h4 className="text-sm md:text-base font-medium">
                {pool.type === 'flexible' ? 'Flexible Staking' : `Lock Staking (${pool.lockPeriod}M)`}
              </h4>
              <p className="text-xs md:text-sm text-muted-foreground">
  {pool.amount.toLocaleString()} WOODENG

  {pool.yieldBonus ? (
    <span className="text-primary ml-2">(+{pool.yieldBonus}% shares applied)</span>
  ) : null}
</p>

            </div>
          </div>
          <div className="flex items-center gap-2">
            {(pool.canUnstake ||
              (pool.type === 'lock' && pool.endDate && new Date(pool.endDate) <= new Date())) && (
              <button
                onClick={() => {
                  setSelectedPool(pool);
                  setShowUnstakeModal(true);
                }}
                className="px-2 py-1 md:px-3 md:py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs md:text-sm"
              >
                Unstake
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Start Date</p>
            <p className="text-xs md:text-sm font-medium">
              {new Date(pool.startDate).toLocaleDateString()}
            </p>
          </div>
          {pool.type === 'lock' && pool.endDate ? (
            <div>
              <p className="text-xs text-muted-foreground">Unlock Time</p>
              <p className="text-xs md:text-sm font-medium">
                {new Date(pool.endDate).toLocaleDateString()}
              </p>
              {new Date(pool.endDate) <= new Date() ? (
                <p className="text-xs text-green-500 font-medium mt-1">✓ Unlocked - Ready to unstake</p>
              ) : (
                <p className="text-xs text-primary mt-1">{getRemainingTime(pool.endDate)}</p>
              )}
            </div>
          ) : (
            pool.type === 'flexible' && (
              <div>
                <p className="text-xs text-muted-foreground">30-Day Period End</p>
                <p className="text-xs md:text-sm font-medium">
                  {new Date(
                    new Date(pool.startDate).getTime() + 30 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </p>
              </div>
            )
          )}
          <div>
            <p className="text-xs text-muted-foreground">WOODENG Rewards</p>
            <p className="text-xs md:text-sm font-medium">{pool.pendingRewards.woodeng.toFixed(6)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">SOL Rewards</p>
            <p className="text-xs md:text-sm font-medium">{pool.pendingRewards.sol.toFixed(6)}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="text-center py-8 text-muted-foreground">
    <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
    <p>No active staking pools</p>
  </div>
)}

        </div>
      </div>

      {/* Staking Information */}
      <div className="container mx-auto px-6 space-y-8">
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 lg:p-8">
          <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">Staking Modes</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Flexible Staking */}
            <div className="border border-green-500/20 rounded-lg p-3 md:p-4 bg-green-500/5">
              <div className="flex items-center gap-3 mb-3">
                <Unlock className="w-5 h-5 text-green-500" />
                <h3 className="text-sm md:text-base font-semibold">Flexible Staking</h3>
              </div>
              <ul className="space-y-2 text-xs md:text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>No mandatory lock period</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>30-day reward safeguard</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span>Early exit reduces rewards</span>
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Current APR: {loadingStats ? 'Loading…' : `${globalStats.apr.flexible}%`}</span>

                </li>
              </ul>
            </div>

            {/* Lock Staking */}
            <div className="border border-primary/20 rounded-lg p-3 md:p-4 bg-primary/5">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-5 h-5 text-primary" />
                <h3 className="text-sm md:text-base font-semibold">Lock Staking</h3>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1 md:gap-2 text-xs">
                  <div className="text-center p-1.5 md:p-2 bg-background/50 rounded">
                    <p className="font-medium text-xs">3 Months</p>
                    <p className="text-primary">+30% Bonus</p>
                    <p className="text-muted-foreground text-xs">{globalStats.apr.lock3m}% APR</p>
                  </div>
                  <div className="text-center p-1.5 md:p-2 bg-background/50 rounded">
                    <p className="font-medium text-xs">6 Months</p>
                    <p className="text-primary">+80% Bonus</p>
                    <p className="text-muted-foreground text-xs">{globalStats.apr.lock6m}% APR</p>
                  </div>
                  <div className="text-center p-1.5 md:p-2 bg-background/50 rounded">
                    <p className="font-medium text-xs">12 Months</p>
                    <p className="text-primary">+200% Bonus</p>
                    <p className="text-muted-foreground text-xs">{globalStats.apr.lock12m}% APR</p>
                  </div>
                </div>
                <ul className="space-y-2 text-xs md:text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Higher yield bonuses</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Rewards claimable during lock period</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span>Tokens locked until maturity</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Reward Information */}
<div className="bg-card border border-border rounded-lg p-4 md:p-6 lg:p-8">
  <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">Reward Information</h2>

  <div className="space-y-6">
    {/* Reward Sources */}
    <div>
      <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Reward Sources
      </h3>
      <p className="text-xs md:text-sm text-muted-foreground mb-4">
        Staking rewards are funded by multiple revenue streams from platform activity:
      </p>

      <div className="space-y-4">
        {/* Music NFT Revenue */}
        <div className="bg-muted/50 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Music2 className="w-4 h-4 text-primary" />
            <h4 className="text-sm md:text-base font-medium">Music NFT Revenue</h4>
          </div>
          <ul className="space-y-1 text-xs md:text-sm">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              <span>20% from primary sales</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              <span>20% from secondary royalties</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              <span>AMM trading fees flow to stakers</span>
            </li>
          </ul>
        </div>

        {/* Sound Meme Revenue */}
        <div className="bg-muted/50 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="w-4 h-4 text-secondary" />
            <h4 className="text-sm md:text-base font-medium">Sound Meme Revenue</h4>
          </div>
          <ul className="space-y-1 text-xs md:text-sm">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
              <span>0.1% from AMM swaps (staker share)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
              <span>4% from bonding early sales (staker share) (pre-migration)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
              <span>1% from bonding buys (staker share) (pre-migration)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
              <span>0.1% from bonding curve (staker share) (post-migration)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* Current APR Rates (unchanged) */}
    <div>
      <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Current APR Rates
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 md:p-3">
          <p className="text-xs md:text-sm text-muted-foreground">Flexible</p>
          <p className="text-base md:text-lg font-bold text-green-500">
  {loadingStats ? '—' : `${globalStats.apr.flexible}%`}
</p>

        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 md:p-3">
          <p className="text-xs md:text-sm text-muted-foreground">Lock (3M)</p>
          <p className="text-base md:text-lg font-bold text-primary">
  {loadingStats ? '—' : `${globalStats.apr.lock3m}%`}
</p>

        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 md:p-3">
          <p className="text-xs md:text-sm text-muted-foreground">Lock (6M)</p>
          <p className="text-base md:text-lg font-bold text-primary">
  {loadingStats ? '—' : `${globalStats.apr.lock6m}%`}
</p>

        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 md:p-3">
          <p className="text-xs md:text-sm text-muted-foreground">Lock (12M)</p>
          <p className="text-base md:text-lg font-bold text-primary">
  {loadingStats ? '—' : `${globalStats.apr.lock12m}%`}
</p>

        </div>
      </div>
    </div>
  </div>
</div>
</div>


      {/* Admin init + seed panel (shows only when wallet is connected) */}
{connected && ((needsInit === true) || isAuthority) && (
  <div className="container mx-auto px-6">
    <div className="my-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
      <div className="flex flex-col gap-3">
        <div className="text-sm">
          <b>Initialize staking & seed rewards</b>
          <div className="text-xs text-muted-foreground">
            This will create the config + vaults + modes (0/3/6/12). 
            The signer becomes the config authority.
          </div>
          {configAuthority && (
            <div className="mt-1 text-xs text-muted-foreground">
              Current config authority:&nbsp;
              <span className="font-mono">{configAuthority}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              setIsProcessing(true);
              try {
                await initializeIfNeeded(connection, wallet);
                setNeedsInit(false);
                setMissingModes(false);
                setTransactionStatus('success');
                setTransactionMessage('Staking initialized (and/or modes ensured).');
              } catch (e:any) {
                console.error(e);
                setTransactionStatus('error');
                setTransactionMessage(e.message || 'Initialize failed.');
              } finally {
                setIsProcessing(false);
                setTimeout(() => setTransactionStatus('idle'), 3000);
              }
            }}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isProcessing ? 'Initializing…' : 'Initialize staking'}
          </button>

          <div className="flex flex-wrap items-center gap-2">

            <input
              type="number"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              min={0}
              step={0.000001}
              className="w-36 px-3 py-2 bg-background border border-border rounded-lg"
              placeholder="0.10"
              title="WOODENG amount"
            />
            <button
              onClick={async () => {
                setIsProcessing(true);
                try {
                  // optional: ensure initialized first
                  await initializeIfNeeded(connection, wallet);
                  await depositRewards(connection, wallet, Number(topupAmount || 0));
                  setTransactionStatus('success');
                  setTransactionMessage(`Deposited ${topupAmount} WOODENG into rewards stream.`);
                } catch (e:any) {
                  console.error(e);
                  setTransactionStatus('error');
                  setTransactionMessage(e.message || 'Deposit failed.');
                } finally {
                  setIsProcessing(false);
                  setTimeout(() => setTransactionStatus('idle'), 3000);
                }
              }}
              disabled={isProcessing || Number(topupAmount) <= 0}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {isProcessing ? 'Depositing…' : 'Seed rewards (WOODENG)'}
            </button>

            <span className="text-[10px] font-mono opacity-70 select-none">[v-penalty]</span>

<button
  onClick={async () => {
    setIsProcessing(true);
    try {
      await setParams(connection, wallet, {
        flexiblePenaltyBps: 1000, // 10%
        minFlexDays: 30,          // 30 days
      });
      setTransactionStatus('success');
      setTransactionMessage('Updated params → 10% penalty, 30 days.');
    } catch (e:any) {
      console.error(e);
      setTransactionStatus('error');
      setTransactionMessage(e.message || 'setParams failed.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setTransactionStatus('idle'), 3000);
    }
  }}
  disabled={isProcessing}
  className="px-4 py-2 rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50"
>
  Apply penalty: 10% / 30 days
</button>

          </div>
        </div>
      </div>
    </div>
  </div>
)}


      {/* Stake Modal */}
       {showStakeModal && (
   <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
     {/* the empty spacer nudges content below iOS browser chrome */}
     <div className="h-4 w-px shrink-0" />
     <div className="relative w-full sm:max-w-md bg-card rounded-xl shadow-lg my-6 max-h-[90vh] overflow-hidden">
       <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <h3 className="text-xl font-semibold">Stake WOODENG Tokens</h3>
              <button
                onClick={() => setShowStakeModal(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-64px)]">
              {/* Staking Mode Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Staking Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setStakingMode('flexible')}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all text-left',
                      stakingMode === 'flexible' ? 'border-green-500 bg-green-500/10' : 'border-border hover:border-green-500/50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Unlock className="w-4 h-4 text-green-500" />
                      <span className="font-medium">Flexible</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
  {loadingStats ? 'Loading…' : `${globalStats.apr.flexible}% APR`}
</p>

                  </button>

                  <button
  onClick={() => setStakingMode('lock')}
  className={cn(
    'p-4 rounded-lg border-2 transition-all text-left',
    stakingMode === 'lock'
      ? 'border-green-500 bg-green-500/10'
      : 'border-border hover:border-green-500/50'
  )}
>
  <div className="flex items-center gap-2 mb-2">
    <Lock className={cn('w-4 h-4', stakingMode === 'lock' ? 'text-green-500' : 'text-primary')} />
    <span className="font-medium">Lock</span>
  </div>
  <p className="text-xs text-muted-foreground">
  {loadingStats ? 'Loading…' : `Up to ${globalStats.apr.lock12m}% APR`}
</p>

</button>

                </div>
              </div>

              {/* Lock Period Selection */}
              {stakingMode === 'lock' && (
                <div>
                  <label className="block text-sm font-medium mb-3">Lock Period</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 6, 12].map((m) => (
                      <button
  key={m}
  onClick={() => setLockPeriod(m as LockMonths)}
  className={cn(
    'p-3 rounded-lg border-2 transition-all text-center',
    lockPeriod === m
      ? 'border-green-500 bg-green-500/10'
      : 'border-border hover:border-green-500/50'
  )}
>
  <p className="font-medium">{m}M</p>
  <p className={cn('text-xs', lockPeriod === m ? 'text-green-500' : 'text-primary')}>
    +{getYieldBonus(m)}%
  </p>
  <p className="text-xs text-muted-foreground">
  {loadingStats
    ? 'Loading…'
    : `${m === 3 ? globalStats.apr.lock3m : m === 6 ? globalStats.apr.lock6m : globalStats.apr.lock12m}% APR`}
</p>

</button>

                    ))}
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Amount to Stake</label>
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary transition-colors"
                  />
                  <button
  onClick={() => setStakeAmount(userBalance.toFixed(2))}

                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
  Available: {userBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} WOODENG
</div>

              </div>

              {/* Info box */}
              <div
                className={cn(
                  'p-4 rounded-lg border',
                  stakingMode === 'flexible' ? 'bg-green-500/10 border-green-500/20' : 'bg-primary/10 border-primary/20'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="font-medium">Staking Information</span>
                </div>
                {stakingMode === 'flexible' ? (
                  <ul className="text-sm space-y-1">
                    <li>• No lock period required</li>
                    <li>• Reward safeguard period ~30 days</li>
                    <li>• Early exit reduces rewards and amount staked by 10%</li>
                  </ul>
                ) : (
                  <ul className="text-sm space-y-1">
                    <li>• Tokens locked for {lockPeriod} months</li>
                    <li>• +{getYieldBonus(lockPeriod)}% yield bonus</li>
                    <li>• Rewards claimable during lock period</li>
                  </ul>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowStakeModal(false)} className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleStake}
                  disabled={
                    !stakeAmount ||
                    parseFloat(stakeAmount) <= 0 ||
                    parseFloat(stakeAmount) > userBalance ||
                    isProcessing
                  }
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Staking...
                    </>
                  ) : (
                    'Stake Tokens'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unstake Modal */}
      {showUnstakeModal && selectedPool && (
         <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
   <div className="relative w-full sm:max-w-md bg-card rounded-xl shadow-lg my-6 max-h-[90vh] overflow-hidden">
     <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <h3 className="text-xl font-semibold">Unstake Tokens</h3>
              <button
                onClick={() => {
                  setShowUnstakeModal(false);
                  setSelectedPool(null);
                }}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-64px)]">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {selectedPool.type === 'flexible' ? (
                    <Unlock className="w-4 h-4 text-green-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-primary" />
                  )}
                  <span className="font-medium">
                    {selectedPool.type === 'flexible' ? 'Flexible Staking' : `Lock Staking (${selectedPool.lockPeriod}M)`}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Staked: {selectedPool.amount.toLocaleString()} WOODENG</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount to Unstake</label>
                <div className="relative">
                  <input
                    type="number"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="Enter amount"
                    max={selectedPool.amount}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-primary transition-colors"
                  />
                  <button
                    onClick={() => setUnstakeAmount(String(selectedPool.amount))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Maximum: {selectedPool.amount.toLocaleString()} WOODENG
                </p>
              </div>

              {selectedPool.type === 'flexible' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium text-yellow-500">Early Withdrawal Warning</span>
                  </div>
                  <p className="text-sm">
                    Unstaking before 30 days will reduce your pending rewards and staked amount by 10%.
                  </p>
                  {selectedPool.penaltyAmount && (
                    <p className="text-sm text-yellow-500 mt-1">
                      Penalty: {selectedPool.penaltyAmount.toFixed(2)} WOODENG
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowUnstakeModal(false);
                    setSelectedPool(null);
                  }}
                  className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnstake}
                  disabled={
                    !unstakeAmount ||
                    parseFloat(unstakeAmount) <= 0 ||
                    parseFloat(unstakeAmount) > selectedPool.amount ||
                    isProcessing
                  }
                  className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Unstake Tokens'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Toast */}
      {transactionStatus !== 'idle' && (
        <div
          className={cn(
            'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 max-w-md z-50',
            transactionStatus === 'success' && 'bg-green-500/10 text-green-500 border border-green-500/20',
            transactionStatus === 'error' && 'bg-destructive/10 text-destructive border border-destructive/20'
          )}
        >
          {transactionStatus === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {transactionStatus === 'error' && <AlertCircle className="w-5 h-5" />}
          <p>{transactionMessage}</p>
          <button onClick={() => setTransactionStatus('idle')} className="ml-auto p-1 hover:bg-background/20 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
