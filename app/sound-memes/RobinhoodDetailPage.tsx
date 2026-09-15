"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEther, parseEther, parseUnits, formatUnits, decodeEventLog } from "viem";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowLeft, Loader2, ExternalLink, Users, Droplets, TrendingUp, Award, Twitter, Send, Globe, Sparkles, UploadCloud } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useRobinhoodWallet } from "@/hooks/useRobinhoodWallet";
import {
  robinhoodPublicClient,
  RH_CONFIG,
  SWL444_FACTORY_ABI,
  ERC20_MINIMAL_ABI,
  DIAMOND_GATE_ABI,
  SWL444_TOKEN_ABI,
  NFT_MINTER_ABI,
  NFT_LOCK_AMOUNT,
  POOL_PHASE,
  BONDING_SUPPLY,
  TOTAL_SUPPLY,
  IS_ROBINHOOD_MAINNET,
  type PoolPhase,
} from "../lib/robinhoodChain";
import {
  PRICE_UPDATE_EVENT,
  fetchEthUsd,
  formatUsd,
  formatHoldTime,
  getSpotPriceEth,
  mcapEth,
  circulatingSupplyForPool,
  impliedBondingCirculatingSupply,
  getLiquidityEth,
  getVolume24hEth,
  getHolderRows,
  avgHoldDaysAcross,
  getCreatorScore,
  getCreatorFirstBuyTokens,
  ipfsToHttp,
  GRADUATION_TARGET_ETH,
  type HolderRow,
} from "../lib/robinhoodStats";
import { getUserLivingNfts, type LivingNft } from "../lib/robinhoodNft";
import { pinFile, pinJson } from "../lib/pinata";
import RobinhoodPhaseBadge from "../components/RobinhoodPhaseBadge";
import { tierForDays } from "../lib/hoodTiers";

function timeAgo(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const GLASS: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(0,200,5,0.07), rgba(0,200,5,0.02))",
  border: "1px solid rgba(0,200,5,0.18)",
  borderRadius: 16,
  padding: "18px 20px",
};

// Mirrors BUY_FEE_BPS/CREATOR_BUY_FEE_BPS/STAKER_BUY_FEE_BPS and
// SELL_PENALTY_BPS/CREATOR_SELL_FEE_BPS/STAKER_SELL_FEE_BPS in
// contracts-rh/src/SWL444Factory.sol — used to show the fee split on the
// post-trade receipt without waiting on a separate log/event read.
const CREATOR_BUY_FEE_BPS = 70n;
const STAKER_BUY_FEE_BPS = 30n;
const SELL_PENALTY_BPS = 1000n;
const CREATOR_SELL_FEE_BPS = 700n;
const STAKER_SELL_FEE_BPS = 300n;

type TradeReceipt = {
  type: "buy" | "sell";
  tokenAmount: string;
  ethAmount: string;
  creatorFee: string;
  stakerFee: string;
};

type GateRejection = {
  required: number;
  current: number;
};

type ChartPoint = { t: number; price: number; mcap: number };
type Socials = { twitter?: string; telegram?: string; website?: string };
type Metadata = { description?: string; image?: string; socials?: Socials };

const TIMEFRAMES = [
  { key: "1h", label: "1H", ms: 3600_000 },
  { key: "4h", label: "4H", ms: 4 * 3600_000 },
  { key: "24h", label: "24H", ms: 24 * 3600_000 },
  { key: "7d", label: "7D", ms: 7 * 24 * 3600_000 },
  { key: "all", label: "ALL", ms: Infinity },
] as const;
type TimeframeKey = (typeof TIMEFRAMES)[number]["key"];

/** Forces a re-render every `intervalMs` — used so hold-time displays that
 * are extrapolated from a last-fetched base value visibly tick forward
 * (minutes climbing in real time) between polls, instead of only updating
 * when fresh chain data arrives. */
function useNowTick(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
}

function useCountUp(value: number, duration = 500) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) {
      setDisplay(to);
      prevRef.current = to;
      return;
    }
    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return display;
}

function MetricTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rh-glass" style={{ padding: "14px 16px", borderRadius: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", marginBottom: 7, textTransform: "uppercase" }}>
        {icon} {label}
      </div>
      <div style={{ color: "var(--foreground)", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ConfettiBurst({ active }: { active: boolean }) {
  // Re-randomize on every new burst (active flipping false->true), not just once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const particles = useMemo(() => Array.from({ length: 26 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.15,
    duration: 0.9 + Math.random() * 0.7,
    size: 6 + Math.random() * 6,
    rotate: Math.random() * 360,
    color: ["#00E676", "#00C805", "#FFD700", "#ffffff"][Math.floor(Math.random() * 4)],
  })), [active]);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute", top: -10, left: `${p.left}%`,
            width: p.size, height: p.size * 1.6, background: p.color,
            opacity: 0.9, borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `rh-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function SocialIcons({ socials }: { socials?: Socials }) {
  if (!socials || (!socials.twitter && !socials.telegram && !socials.website)) return null;
  const iconStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 999,
    background: "rgba(0,200,5,0.08)", border: "1px solid rgba(0,200,5,0.2)",
    color: "#00E676", textDecoration: "none", transition: "box-shadow 0.15s ease, transform 0.15s ease",
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {socials.twitter && (
        <a href={socials.twitter} target="_blank" rel="noreferrer" className="rh-social-icon" style={iconStyle} title="Twitter / X"><Twitter size={14} /></a>
      )}
      {socials.telegram && (
        <a href={socials.telegram} target="_blank" rel="noreferrer" className="rh-social-icon" style={iconStyle} title="Telegram"><Send size={14} /></a>
      )}
      {socials.website && (
        <a href={socials.website} target="_blank" rel="noreferrer" className="rh-social-icon" style={iconStyle} title="Website"><Globe size={14} /></a>
      )}
    </div>
  );
}

export default function RobinhoodDetailPage() {
  const params = useParams();
  const token = ((params?.mint as string) || "").toLowerCase() as `0x${string}`;

  const { authenticated, login } = usePrivy();
  const { connected, address, ethBalance, writeContract } = useRobinhoodWallet();

  const [pool, setPool] = useState<any>(null);
  const poolRef = useRef<any>(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("???");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [priceEth, setPriceEth] = useState<number | null>(null);
  const [liquidityEth, setLiquidityEth] = useState<number | null>(null);
  const [ethUsd, setEthUsd] = useState<number | null>(null);

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txReceipt, setTxReceipt] = useState<TradeReceipt | null>(null);
  const [gateRejection, setGateRejection] = useState<GateRejection | null>(null);
  const [flash, setFlash] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const [chart, setChart] = useState<ChartPoint[] | null>(null);
  const [chartMode, setChartMode] = useState<"price" | "mcap">("mcap");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("all");

  const [hoodDays, setHoodDays] = useState<number | null>(null);
  const [hoodDaysFetchedAt, setHoodDaysFetchedAt] = useState<number | null>(null);
  const [holderRows, setHolderRows] = useState<HolderRow[] | null>(null);
  const [holderRowsFetchedAt, setHolderRowsFetchedAt] = useState<number | null>(null);
  const [volume24h, setVolume24h] = useState<number | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<{ score: number | null; tokenCount: number; sinceSec: number | null } | null>(null);

  // Snipe Tax — live block number while the launch-block tax window is still
  // open, and how much (if any) of the total supply the creator bought in
  // their own exempt first buy.
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [creatorFirstBuyTokens, setCreatorFirstBuyTokens] = useState<bigint | null>(null);

  // Living Meme — creator metadata updates. liveMetadataUri is read straight
  // off the SWL444Token contract on every load — NOT pool.metadataUri, which
  // is the factory's Pool struct field frozen at creation time and never
  // updated by updateMetadataUri. Reading the wrong one is why a reload used
  // to show the pre-update image/description again.
  const [metadataUpdateCount, setMetadataUpdateCount] = useState(0);
  const [liveMetadataUri, setLiveMetadataUri] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [updatingMetadata, setUpdatingMetadata] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // Living NFT — lock 444K to mint, burn to unlock
  const [userNfts, setUserNfts] = useState<LivingNft[] | null>(null);
  const [nftImages, setNftImages] = useState<Record<string, string>>({});
  const [mintingNft, setMintingNft] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [burningNftId, setBurningNftId] = useState<bigint | null>(null);
  const [burnError, setBurnError] = useState<string | null>(null);

  useEffect(() => { poolRef.current = pool; }, [pool]);

  const loadPool = useCallback(async () => {
    if (!token) return;
    try {
      const [poolRes, name, symbol, updateCount, currentMetadataUri] = await Promise.all([
        robinhoodPublicClient.readContract({
          address: RH_CONFIG.factory, abi: SWL444_FACTORY_ABI, functionName: "getPool", args: [token],
        }),
        robinhoodPublicClient.readContract({ address: token, abi: ERC20_MINIMAL_ABI, functionName: "name" }).catch(() => "Unknown"),
        robinhoodPublicClient.readContract({ address: token, abi: ERC20_MINIMAL_ABI, functionName: "symbol" }).catch(() => "???"),
        robinhoodPublicClient.readContract({ address: token, abi: SWL444_TOKEN_ABI, functionName: "metadataUpdateCount" }).catch(() => 0n),
        robinhoodPublicClient.readContract({ address: token, abi: SWL444_TOKEN_ABI, functionName: "metadataUri" }).catch(() => null),
      ]);
      setPool(poolRes);
      setTokenName(name as string);
      setTokenSymbol(symbol as string);
      setMetadataUpdateCount(Number(updateCount as bigint));
      if (currentMetadataUri) setLiveMetadataUri(currentMetadataUri as string);
      setLoadError(null);
      return poolRes;
    } catch (e: any) {
      console.warn("[RobinhoodDetailPage] load failed:", e);
      setLoadError(e?.shortMessage || e?.message || "Couldn't load this pool from Robinhood Chain.");
      return null;
    }
  }, [token]);

  const loadUserBalance = useCallback(async () => {
    if (!token || !address) { setUserBalance(0n); return; }
    try {
      const bal = await robinhoodPublicClient.readContract({
        address: token, abi: ERC20_MINIMAL_ABI, functionName: "balanceOf", args: [address],
      });
      setUserBalance(bal as bigint);
    } catch { setUserBalance(0n); }
  }, [token, address]);

  const refreshUserNfts = useCallback(async () => {
    if (!token || !address) { setUserNfts(null); return; }
    try {
      const nfts = await getUserLivingNfts(token, address);
      setUserNfts(nfts);
    } catch (e) {
      console.warn("[RobinhoodDetailPage] living NFT load failed:", e);
      setUserNfts([]);
    }
  }, [token, address]);

  useEffect(() => { refreshUserNfts(); }, [refreshUserNfts]);

  // Each Living NFT's snapshot metadata is a separate IPFS JSON — fetched
  // once per token id, independent of any polling loop.
  useEffect(() => {
    if (!userNfts) return;
    userNfts.forEach((nft) => {
      const key = nft.tokenId.toString();
      if (nftImages[key]) return;
      const url = ipfsToHttp(nft.metadataUri);
      if (!url) return;
      fetch(url)
        .then((r) => r.json())
        .then((meta) => {
          const img = ipfsToHttp(meta?.image);
          if (img) setNftImages((prev) => ({ ...prev, [key]: img }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userNfts]);

  const loadChart = useCallback(async () => {
    if (!token) return;
    try {
      const logs = await robinhoodPublicClient.getLogs({
        address: RH_CONFIG.factory,
        event: PRICE_UPDATE_EVENT,
        args: { token },
        fromBlock: 0n,
        toBlock: "latest",
      });
      const points: ChartPoint[] = (logs as any[]).map((l) => {
        const priceEthPoint = Number(formatEther(l.args.price as bigint));
        const mcapPoint = mcapEth(priceEthPoint, impliedBondingCirculatingSupply(priceEthPoint));
        return { t: Number(l.args.timestamp) * 1000, price: priceEthPoint, mcap: mcapPoint };
      });
      setChart(points);
    } catch (e) {
      console.warn("[RobinhoodDetailPage] chart load failed:", e);
      setChart((prev) => prev ?? []);
    }
  }, [token]);

  const loadAggregates = useCallback(async (creator: `0x${string}`) => {
    try {
      const [rows, vol, allTokens] = await Promise.all([
        getHolderRows(token),
        getVolume24hEth(token),
        robinhoodPublicClient.readContract({
          address: RH_CONFIG.factory, abi: SWL444_FACTORY_ABI, functionName: "getAllPools",
        }) as Promise<`0x${string}`[]>,
      ]);
      setHolderRows(rows);
      setHolderRowsFetchedAt(Date.now());
      setVolume24h(vol);
      const creatorScoreRes = await getCreatorScore(creator, allTokens);
      setCreatorInfo(creatorScoreRes);

      const creationBlock = poolRef.current?.creationBlock as bigint | undefined;
      if (creationBlock !== undefined) {
        const firstBuy = await getCreatorFirstBuyTokens(token, creator, creationBlock);
        setCreatorFirstBuyTokens(firstBuy);
      }
    } catch (e) {
      console.warn("[RobinhoodDetailPage] aggregates load failed:", e);
    }
  }, [token]);

  // Metadata JSON (description / image / socials) from the token's LIVE
  // metadataUri (liveMetadataUri, read fresh from SWL444Token every loadPool
  // poll) — not pool.metadataUri, which is frozen at creation. cache: "no-store"
  // stops the browser from serving a stale response for the same IPFS gateway
  // URL after a Living Meme update reuses/redirects through it.
  useEffect(() => {
    if (!liveMetadataUri) return;
    const url = ipfsToHttp(liveMetadataUri);
    if (!url) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" }).then((r) => r.json()).then((data) => { if (!cancelled) setMetadata(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [liveMetadataUri]);

  useEffect(() => {
    loadPool();
    const i = setInterval(loadPool, 15000);
    return () => clearInterval(i);
  }, [loadPool]);

  useEffect(() => { loadUserBalance(); }, [loadUserBalance, txSuccess]);
  useEffect(() => { loadChart(); }, [loadChart]);

  // Spot price + liquidity — recomputed whenever the pool state changes
  // (post-graduation this reads live Uniswap reserves, not a cached value).
  useEffect(() => {
    if (!pool) return;
    let cancelled = false;
    (async () => {
      const [p, l] = await Promise.all([getSpotPriceEth(pool), getLiquidityEth(pool)]);
      if (!cancelled) { setPriceEth(p); setLiquidityEth(l); }
    })();
    return () => { cancelled = true; };
  }, [pool]);

  // Holders / volume / creator score — run once the creator address is known
  // (invariant across polls), not on every 15s pool refresh.
  useEffect(() => {
    if (pool?.creator) loadAggregates(pool.creator);
  }, [pool?.creator, loadAggregates]);

  // Live block number — only worth polling while the snipe-tax window (first
  // 3 blocks) might still be open; self-stops once past it so an old token's
  // page doesn't poll forever.
  useEffect(() => {
    if (!pool?.creationBlock) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const bn = await robinhoodPublicClient.getBlockNumber();
        if (cancelled) return;
        setCurrentBlock(bn);
        if (bn - (pool.creationBlock as bigint) > 2n && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch {}
    };
    poll();
    intervalId = setInterval(poll, 2000);
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, [pool?.creationBlock]);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetchEthUsd().then((p) => { if (!cancelled) setEthUsd(p); });
    load();
    const i = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  // Hood score for connected wallet
  useEffect(() => {
    if (!address) { setHoodDays(null); setHoodDaysFetchedAt(null); return; }
    (async () => {
      try {
        // getAvgHoldSeconds, not getAvgHoldDays — the days version floors to
        // 0 for under a day, which broke the score for anyone who just
        // bought. Converted to fractional days for formatHoldTime below.
        const seconds = await robinhoodPublicClient.readContract({
          address: RH_CONFIG.gate, abi: DIAMOND_GATE_ABI, functionName: "getAvgHoldSeconds", args: [address],
        });
        setHoodDays(Number(seconds) / 86400);
        setHoodDaysFetchedAt(Date.now());
      } catch { setHoodDays(null); setHoodDaysFetchedAt(null); }
    })();
  }, [address, txSuccess]);

  // Ticks every second so live-extrapolated hold-time displays below climb
  // in real time between polls.
  useNowTick();

  // Extrapolated forward from the last chain read using elapsed wall-clock
  // time — average hold time climbs 1:1 with real time while a balance is
  // held unchanged, so this reads as live-ticking minutes without polling
  // the chain every second.
  const liveHoodDays = hoodDays !== null && hoodDaysFetchedAt !== null
    ? hoodDays + (Date.now() - hoodDaysFetchedAt) / 86_400_000
    : hoodDays;
  const holderRowsElapsedDays = holderRowsFetchedAt !== null ? (Date.now() - holderRowsFetchedAt) / 86_400_000 : 0;

  const phase: PoolPhase = pool ? POOL_PHASE[pool.phase as number] : "Bonding";

  const progress = pool && pool.phase === 0
    ? Math.min(100, Number((pool.bondingSold * 10000n) / BONDING_SUPPLY) / 100)
    : 100;
  const tokensRemaining = pool && pool.phase === 0
    ? Number(formatUnits(BONDING_SUPPLY - pool.bondingSold, 18))
    : 0;
  const realEthRaised = pool && pool.phase === 0 ? (liquidityEth ?? 0) : GRADUATION_TARGET_ETH;

  const mcap = priceEth !== null && pool ? mcapEth(priceEth, circulatingSupplyForPool(pool)) : null;
  const mcapUsd = mcap !== null && ethUsd !== null ? mcap * ethUsd : null;
  const priceUsd = priceEth !== null && ethUsd !== null ? priceEth * ethUsd : null;
  const liquidityUsd = liquidityEth !== null && ethUsd !== null ? liquidityEth * ethUsd : null;
  const volumeUsd = volume24h !== null && ethUsd !== null ? volume24h * ethUsd : null;

  const animatedMcap = useCountUp(mcap ?? 0);
  const animatedHolders = useCountUp(holderRows?.length ?? 0, 400);
  const animatedVolume = useCountUp(volume24h ?? 0, 400);
  const animatedAvgHold = useCountUp((holderRows ? avgHoldDaysAcross(holderRows) : 0) + holderRowsElapsedDays, 400);
  const animatedMcapUsd = ethUsd !== null ? animatedMcap * ethUsd : null;
  const animatedVolumeUsd = ethUsd !== null ? animatedVolume * ethUsd : null;

  const filteredChart = useMemo(() => {
    if (!chart) return null;
    const tf = TIMEFRAMES.find((t) => t.key === timeframe)!;
    const cutoff = tf.ms === Infinity ? -Infinity : Date.now() - tf.ms;
    // USD series uses today's ETH/USD rate applied uniformly across history —
    // there's no historical ETH/USD feed here, so this is an approximation,
    // but it keeps the axis in USD as requested rather than showing nothing.
    const rate = ethUsd ?? 0;
    return chart
      .filter((p) => p.t >= cutoff)
      .map((p) => ({ ...p, priceUsd: p.price * rate, mcapUsd: p.mcap * rate }));
  }, [chart, timeframe, ethUsd]);

  const buyPreview = useMemo(() => {
    if (!pool || !ethAmount || Number(ethAmount) <= 0) return null;
    try {
      const ethIn = parseEther(ethAmount);
      const netEth = ethIn - (ethIn * 100n) / 10000n; // 1% total buy fee
      if (pool.virtualEth + netEth === 0n) return null;
      const tokensOut = (pool.virtualTokens * netEth) / (pool.virtualEth + netEth);
      return formatUnits(tokensOut, 18);
    } catch { return null; }
  }, [pool, ethAmount]);

  const sellPreview = useMemo(() => {
    if (!pool || !tokenAmount || Number(tokenAmount) <= 0) return null;
    try {
      const amtIn = parseUnits(tokenAmount, 18);
      if (pool.virtualTokens + amtIn === 0n) return null;
      const ethOut = (pool.virtualEth * amtIn) / (pool.virtualTokens + amtIn);
      const net = ethOut - (ethOut * 1000n) / 10000n; // 10% total sell penalty
      return formatEther(net);
    } catch { return null; }
  }, [pool, tokenAmount]);

  const refreshAfterTrade = useCallback(async () => {
    const fresh = await loadPool();
    await Promise.all([
      loadUserBalance(),
      loadChart(),
      (fresh ?? poolRef.current)?.creator ? loadAggregates((fresh ?? poolRef.current).creator) : Promise.resolve(),
    ]);
  }, [loadPool, loadUserBalance, loadChart, loadAggregates]);

  const handleBuy = async () => {
    setTxError(null); setTxBusy(true); setTxSuccess(null); setTxReceipt(null); setGateRejection(null);
    try {
      if (pool && pool.minAvgHoldDays > 0n) {
        const required = Number(pool.minAvgHoldDays);
        const current = liveHoodDays ?? 0;
        if (current < required) {
          setGateRejection({ required, current });
          return;
        }
      }

      const value = parseEther(ethAmount);
      const hash = await writeContract({
        address: RH_CONFIG.factory, abi: SWL444_FACTORY_ABI, functionName: "buy", args: [token], value,
      });
      setTxSuccess(hash);

      // Decode the Buy event for the exact ethIn/tokensOut actually applied
      // on-chain (accounts for snipe tax / bonding-cap clamps that can make
      // this differ from the raw ethAmount the user typed).
      try {
        const receipt = await robinhoodPublicClient.getTransactionReceipt({ hash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: SWL444_FACTORY_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === "Buy") {
              const args = decoded.args as any;
              const ethIn = args.ethIn as bigint;
              const creatorFee = (ethIn * CREATOR_BUY_FEE_BPS) / 10000n;
              const stakerFee = (ethIn * STAKER_BUY_FEE_BPS) / 10000n;
              setTxReceipt({
                type: "buy",
                tokenAmount: Number(formatUnits(args.tokensOut as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                ethAmount: formatEther(ethIn),
                creatorFee: formatEther(creatorFee),
                stakerFee: formatEther(stakerFee),
              });
              break;
            }
          } catch {
            // not a Buy log — skip
          }
        }
      } catch {
        // receipt/decode failure shouldn't block the rest of the success flow
      }

      setEthAmount("");
      setFlash(true); setTimeout(() => setFlash(false), 900);
      setConfetti(true); setTimeout(() => setConfetti(false), 1500);
      await refreshAfterTrade();
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || "Buy failed");
    } finally {
      setTxBusy(false);
    }
  };

  const handleSell = async () => {
    setTxError(null); setTxBusy(true); setTxSuccess(null); setTxReceipt(null);
    try {
      const amt = parseUnits(tokenAmount, 18);
      const hash = await writeContract({
        address: RH_CONFIG.factory, abi: SWL444_FACTORY_ABI, functionName: "sell", args: [token, amt],
      });
      setTxSuccess(hash);

      // netEth in the Sell event is post-penalty (what the seller actually
      // received) — back out the pre-penalty gross to split the fee, since
      // creatorFee/stakerFee are computed off the gross amount on-chain.
      try {
        const receipt = await robinhoodPublicClient.getTransactionReceipt({ hash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: SWL444_FACTORY_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === "Sell") {
              const args = decoded.args as any;
              const netEth = args.ethOut as bigint;
              const creatorFee = (netEth * CREATOR_SELL_FEE_BPS) / (10000n - SELL_PENALTY_BPS);
              const stakerFee = (netEth * STAKER_SELL_FEE_BPS) / (10000n - SELL_PENALTY_BPS);
              setTxReceipt({
                type: "sell",
                tokenAmount: Number(formatUnits(args.tokensIn as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                ethAmount: formatEther(netEth),
                creatorFee: formatEther(creatorFee),
                stakerFee: formatEther(stakerFee),
              });
              break;
            }
          } catch {
            // not a Sell log — skip
          }
        }
      } catch {
        // receipt/decode failure shouldn't block the rest of the success flow
      }

      setTokenAmount("");
      setFlash(true); setTimeout(() => setFlash(false), 900);
      await refreshAfterTrade();
    } catch (e: any) {
      setTxError(e?.shortMessage || e?.message || "Sell failed");
    } finally {
      setTxBusy(false);
    }
  };

  const onPickNewImage = (f: File | null) => {
    setNewImageFile(f);
    setNewImagePreview(f ? URL.createObjectURL(f) : null);
  };

  const handleUpdateMetadata = async () => {
    if (!token) return;
    setUpdateError(null); setUpdateSuccess(null); setUpdatingMetadata(true);
    try {
      const imageUri = newImageFile ? await pinFile(newImageFile) : (metadata?.image ?? "");
      const finalDesc = newDesc.trim() || metadata?.description || "";
      // name/symbol are pulled from the token's own immutable ERC20 fields,
      // never from user input or the previous metadata blob — Living Meme
      // only ever touches image/description, per contract: name+symbol can't
      // change once the token is created.
      const metaUri = await pinJson({
        name: tokenName,
        symbol: tokenSymbol,
        description: finalDesc,
        image: imageUri,
        ...(metadata?.socials ? { socials: metadata.socials } : {}),
      });

      const hash = await writeContract({
        address: token, abi: SWL444_TOKEN_ABI, functionName: "updateMetadataUri", args: [metaUri],
      });
      setUpdateSuccess(hash);
      setNewDesc(""); setNewImageFile(null); setNewImagePreview(null);

      // Drives the single metadata-fetch effect (cache: "no-store") rather
      // than duplicating a fetch here — keeps one source of truth for how
      // `metadata` gets populated.
      setLiveMetadataUri(metaUri);
      await loadPool();
    } catch (e: any) {
      setUpdateError(e?.shortMessage || e?.message || "Metadata update failed");
    } finally {
      setUpdatingMetadata(false);
    }
  };

  const handleMintNft = async () => {
    if (!token || !tokenName) return;
    setMintError(null); setMintSuccess(null); setMintingNft(true);
    try {
      // Build NFT-specific metadata (ERC721 name/description/attributes) from
      // the token's CURRENT live metadata, fetched fresh rather than trusted
      // from React state — this is a snapshot moment, not a display refresh.
      // The minter contract no longer reads the token's metadataUri itself
      // (see SWL444NFTMinter.mintNFT): it just stores whatever URI it's
      // handed, so this JSON — not the raw token metadata — is what explorers
      // and marketplaces will resolve via tokenURI().
      const currentUri = await robinhoodPublicClient.readContract({
        address: token, abi: SWL444_TOKEN_ABI, functionName: "metadataUri",
      }) as string;
      const tokenMetaUrl = ipfsToHttp(currentUri);
      const tokenMeta = tokenMetaUrl
        ? await fetch(tokenMetaUrl, { cache: "no-store" }).then((r) => r.json()).catch(() => null)
        : null;

      const snapshotIso = new Date().toISOString();
      const nftMetadata = {
        name: `${tokenName} — Living NFT Snapshot`,
        description:
          `Metadata snapshot of $${tokenSymbol} captured on ${snapshotIso.slice(0, 10)}. ` +
          `This NFT preserves the token's metadata at this moment.` +
          (tokenMeta?.description ? ` ${tokenMeta.description}` : ""),
        image: tokenMeta?.image ?? "",
        external_url: typeof window !== "undefined" ? `${window.location.origin}/sound-memes/${token}` : undefined,
        attributes: [
          { trait_type: "Token Name", value: tokenName },
          { trait_type: "Symbol", value: tokenSymbol },
          { trait_type: "Snapshot Date", value: snapshotIso },
          { trait_type: "Locked Tokens", value: "444000" },
          { trait_type: "Token Address", value: token },
        ],
      };
      const nftUri = await pinJson(nftMetadata, "nft-metadata.json");

      await writeContract({
        address: token, abi: ERC20_MINIMAL_ABI, functionName: "approve",
        args: [RH_CONFIG.nftMinter, NFT_LOCK_AMOUNT],
      });
      const hash = await writeContract({
        address: RH_CONFIG.nftMinter, abi: NFT_MINTER_ABI, functionName: "mintNFT", args: [token, nftUri],
      });
      setMintSuccess(hash);
      await Promise.all([loadUserBalance(), refreshUserNfts()]);
    } catch (e: any) {
      setMintError(e?.shortMessage || e?.message || "Mint failed");
    } finally {
      setMintingNft(false);
    }
  };

  const handleBurnNft = async (tokenId: bigint) => {
    setBurnError(null); setBurningNftId(tokenId);
    try {
      await writeContract({
        address: RH_CONFIG.nftMinter, abi: NFT_MINTER_ABI, functionName: "burnNFT", args: [tokenId],
      });
      await Promise.all([loadUserBalance(), refreshUserNfts()]);
    } catch (e: any) {
      setBurnError(e?.shortMessage || e?.message || "Burn failed");
    } finally {
      setBurningNftId(null);
    }
  };

  const isCreator = !!pool && !!address && (pool.creator as string).toLowerCase() === address.toLowerCase();
  const canMintNft = userBalance >= NFT_LOCK_AMOUNT;

  const blocksSinceCreation = pool && currentBlock !== null
    ? Number(currentBlock - (pool.creationBlock as bigint))
    : null;
  const creatorFirstBuyPct = creatorFirstBuyTokens && creatorFirstBuyTokens > 0n
    ? (Number(creatorFirstBuyTokens) / Number(TOTAL_SUPPLY)) * 100
    : 0;

  const hoodTier = liveHoodDays !== null ? tierForDays(liveHoodDays) : null;
  const avgHoldDays = (holderRows ? avgHoldDaysAcross(holderRows) : 0) + holderRowsElapsedDays;
  const avgHoldTier = tierForDays(avgHoldDays);
  const imageUrl = ipfsToHttp(metadata?.image);

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "calc(var(--header-h, 64px) + 20px) 16px 60px" }}>
      <ConfettiBurst active={confetti} />
      <Link href="/sound-memes" style={{ color: "var(--muted-foreground)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Back to pools
      </Link>

      {loadError && (
        <div style={{ ...GLASS, color: "#ff9b9b", borderColor: "rgba(255,107,107,0.2)", marginBottom: 16 }}>{loadError}</div>
      )}

      {!pool && !loadError && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
          <Loader2 size={20} className="rh-spin" style={{ marginBottom: 10 }} />
          <div>Loading pool…</div>
        </div>
      )}

      {pool && (
        <>
          {/* ── Hero ── */}
          <div className="rh-glass" style={{ ...GLASS, display: "flex", gap: 18, marginBottom: 16, flexWrap: "wrap" }}>
            {imageUrl ? (
              <img src={imageUrl} alt="" style={{ width: 84, height: 84, borderRadius: 18, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 84, height: 84, borderRadius: 18, background: "var(--card)", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ color: "var(--foreground)", fontSize: 24, fontWeight: 800, margin: 0 }}>{tokenName}</h1>
                <RobinhoodPhaseBadge phase={phase} />
                {metadataUpdateCount > 0 && (
                  <span
                    title={`Metadata updated ${metadataUpdateCount} time${metadataUpdateCount === 1 ? "" : "s"} by the creator`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)", color: "#00E676",
                    }}
                  >
                    <Sparkles size={11} /> Living Meme — Updated {metadataUpdateCount}x
                  </span>
                )}
              </div>
              <div style={{ color: "var(--muted-foreground)", fontSize: 13, marginTop: 4 }}>${tokenSymbol}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <a
                  href={`${RH_CONFIG.explorer}/address/${pool.creator}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: "var(--muted-foreground)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                >
                  by {pool.creator.slice(0, 6)}…{pool.creator.slice(-4)} <ExternalLink size={11} />
                </a>
                {creatorInfo && (
                  creatorInfo.score !== null ? (
                    <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 700 }}>
                      Creator Score: {creatorInfo.score.toFixed(1)}x avg 🎯
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted-foreground)", fontSize: 12, fontWeight: 700 }}>First Launch 🆕</span>
                  )
                )}
                {creatorFirstBuyTokens !== null && creatorFirstBuyTokens > 0n && (
                  <span style={{ fontSize: 11, color: "#888" }}>
                    Creator bought {creatorFirstBuyPct.toFixed(2)}% at launch
                  </span>
                )}
              </div>

              {metadata?.description && (
                <div style={{ color: "var(--muted-foreground)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{metadata.description}</div>
              )}

              <div style={{ marginTop: 10 }}>
                <SocialIcons socials={metadata?.socials} />
              </div>
            </div>

            <a
              href={`${RH_CONFIG.explorer}/address/${token}`}
              target="_blank" rel="noreferrer"
              style={{ color: "var(--muted-foreground)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", alignSelf: "flex-start" }}
            >
              {token.slice(0, 6)}…{token.slice(-4)} <ExternalLink size={11} />
            </a>
          </div>

          {blocksSinceCreation !== null && blocksSinceCreation <= 2 && (
            <div style={{
              background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)",
              borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "var(--foreground)",
            }}>
              ⚠️ Snipe protection active — {
                blocksSinceCreation === 0 ? "50% tax this block" :
                blocksSinceCreation === 1 ? "25% tax this block" : "10% tax this block"
              }. Wait {3 - blocksSinceCreation} block{3 - blocksSinceCreation > 1 ? "s" : ""} for normal fees.
            </div>
          )}

          {pool.minAvgHoldDays > 0n && (
            <div className="rh-glass" style={{ ...GLASS, marginBottom: 16, fontSize: 13, color: "var(--foreground)" }}>
              🏹 The Hood Gate — wallets need ≥ {pool.minAvgHoldDays.toString()} day avg hold time to enter this bonding curve.
            </div>
          )}

          {/* ── Living Meme — creator metadata panel ── */}
          {isCreator && (
            <div className="rh-glass" style={{ ...GLASS, marginBottom: 16 }}>
              <h4 style={{ color: "#00E676", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6, fontSize: 15 }}>
                <Sparkles size={16} /> Living Meme — Update Your Token
              </h4>
              <p style={{ color: "var(--muted-foreground)", fontSize: 12, margin: "0 0 14px" }}>
                Your token's image and description can evolve anytime — name and symbol are locked forever. Holders who minted a Living NFT keep their original snapshot regardless.
              </p>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                    border: "1px dashed var(--border)", borderRadius: 12, cursor: "pointer",
                    color: "var(--muted-foreground)", fontSize: 10.5, width: 84, height: 84, flexShrink: 0, overflow: "hidden",
                  }}
                >
                  <input type="file" accept="image/*" hidden onChange={(e) => onPickNewImage(e.target.files?.[0] ?? null)} />
                  {newImagePreview || imageUrl ? (
                    <img src={newImagePreview ?? imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <><UploadCloud size={20} /><span>Drop image</span></>
                  )}
                </label>

                <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ color: "var(--foreground)", fontWeight: 700, fontSize: 14 }}>{tokenName} <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>${tokenSymbol}</span></div>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder={metadata?.description ? "New description" : "Add a description"}
                    rows={3}
                    style={{ resize: "none" }}
                  />
                </div>
              </div>

              <button
                className="bg-primary"
                onClick={handleUpdateMetadata}
                disabled={updatingMetadata}
                style={{ marginTop: 12, padding: "11px 18px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {updatingMetadata ? <><Loader2 size={15} className="rh-spin" /> Updating…</> : <>✨ Update Metadata</>}
              </button>

              {updateError && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff9b9b", fontSize: 12 }}>
                  {updateError}
                </div>
              )}
              {updateSuccess && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(0,200,5,0.08)", border: "1px solid rgba(0,200,5,0.2)", color: "#00E676", fontSize: 12 }}>
                  ✓ Metadata updated —{" "}
                  <a href={`${RH_CONFIG.explorer}/tx/${updateSuccess}`} target="_blank" rel="noreferrer" style={{ color: "#00E676" }}>
                    view tx ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── Metrics bar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
            <MetricTile
              icon={<TrendingUp size={12} />}
              label="Market Cap"
              value={mcap === null ? "—" : animatedMcapUsd !== null ? formatUsd(animatedMcapUsd) : `${animatedMcap.toFixed(animatedMcap < 1 ? 4 : 2)} ETH`}
              sub={mcap !== null ? `${animatedMcap.toFixed(animatedMcap < 1 ? 4 : 2)} ETH` : undefined}
            />
            <MetricTile
              icon={<Droplets size={12} />}
              label="Liquidity"
              value={liquidityEth === null ? "—" : liquidityUsd !== null ? formatUsd(liquidityUsd) : `${liquidityEth.toFixed(4)} ETH`}
              sub={liquidityEth !== null ? `${liquidityEth.toFixed(4)} ETH` : undefined}
            />
            <MetricTile
              icon={<TrendingUp size={12} />}
              label="24h Volume"
              value={volume24h === null ? "—" : animatedVolumeUsd !== null ? formatUsd(animatedVolumeUsd) : `${animatedVolume.toFixed(4)} ETH`}
              sub={volume24h !== null ? `${animatedVolume.toFixed(4)} ETH` : undefined}
            />
            <MetricTile
              icon={<Users size={12} />}
              label="Holders"
              value={holderRows === null ? "—" : Math.round(animatedHolders).toLocaleString()}
            />
            <MetricTile
              icon={<Award size={12} />}
              label="Avg Hold Score"
              value={holderRows === null ? "—" : `${formatHoldTime(animatedAvgHold)} ${avgHoldTier.emoji}`}
              sub={avgHoldTier.name}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* ── Chart ── */}
              <div className={`rh-glass${flash ? " rh-flash" : ""}`} style={GLASS}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ color: "#00E676", fontWeight: 800, fontSize: 22 }}>
                      {chartMode === "mcap"
                        ? (mcap === null ? "—" : mcapUsd !== null ? formatUsd(mcapUsd) : `${mcap.toFixed(mcap < 1 ? 4 : 2)} ETH`)
                        : (priceEth === null ? "—" : priceUsd !== null ? formatUsd(priceUsd) : `${priceEth.toFixed(10)} ETH`)}
                    </span>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>{chartMode === "mcap" ? "mcap" : "price"}</span>
                    {chartMode === "mcap" && mcap !== null && mcapUsd !== null && (
                      <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>({mcap.toFixed(mcap < 1 ? 4 : 2)} ETH)</span>
                    )}
                    {chartMode === "price" && priceEth !== null && priceUsd !== null && (
                      <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>({priceEth.toFixed(10)} ETH)</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3 }}>
                    {(["price", "mcap"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setChartMode(m)}
                        style={{
                          padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                          background: chartMode === m ? "rgba(0,200,5,0.15)" : "transparent",
                          color: chartMode === m ? "#00E676" : "var(--muted-foreground)",
                          fontWeight: 700, fontSize: 12, textTransform: "capitalize",
                        }}
                      >
                        {m === "mcap" ? "Market Cap" : "Price"}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ width: "100%", height: 200 }}>
                  {filteredChart === null ? (
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center", paddingTop: 80 }}>Loading chart…</div>
                  ) : filteredChart.length === 0 ? (
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center", paddingTop: 80 }}>No trades in this window</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredChart}>
                        <defs>
                          <linearGradient id="rhPriceFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00E676" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} hide />
                        <YAxis
                          domain={["auto", "auto"]}
                          tickFormatter={(v: number) => formatUsd(v)}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={64}
                        />
                        <Tooltip
                          labelFormatter={(t) => new Date(t as number).toLocaleString()}
                          formatter={(v: number) => [formatUsd(v), chartMode === "mcap" ? "mcap" : "price"]}
                          contentStyle={{ background: "#0f111a", border: "1px solid rgba(0,200,5,0.2)", borderRadius: 8, fontSize: 12 }}
                        />
                        <Area type="monotone" dataKey={chartMode === "mcap" ? "mcapUsd" : "priceUsd"} stroke="#00E676" strokeWidth={2} fill="url(#rhPriceFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={{ display: "flex", gap: 4, marginTop: 12, justifyContent: "center" }}>
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.key}
                      onClick={() => setTimeframe(tf.key)}
                      style={{
                        padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: timeframe === tf.key ? "rgba(0,200,5,0.15)" : "transparent",
                        color: timeframe === tf.key ? "#00E676" : "var(--muted-foreground)",
                        fontWeight: 700, fontSize: 11,
                      }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {phase === "Bonding" && (
                  <div style={{ marginTop: 16 }}>
                    <div className="rh-progress-track" style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div className="rh-progress-fill" style={{ height: "100%", width: `${progress}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <div style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
                        {realEthRaised.toFixed(4)} ETH / {GRADUATION_TARGET_ETH.toFixed(4)} ETH target
                      </div>
                      <div style={{ color: "#00E676", fontSize: 11, fontWeight: 700 }}>{progress.toFixed(1)}% to graduation</div>
                    </div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginTop: 3 }}>
                      ~{tokensRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} {tokenSymbol} left in bonding
                    </div>
                  </div>
                )}
              </div>

              {/* ── Holders table ── */}
              <div className="rh-glass" style={GLASS}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--foreground)", fontWeight: 700, fontSize: 14 }}>
                    <Users size={16} color="#00E676" /> Holders
                  </div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                    Avg Hold: <span style={{ color: "#00E676", fontWeight: 700 }}>{formatHoldTime(avgHoldDays)}</span> — {avgHoldTier.name} {avgHoldTier.emoji}
                  </div>
                </div>
                {holderRows === null ? (
                  <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Loading holders…</div>
                ) : holderRows.length === 0 ? (
                  <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No holders yet — be the first.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {holderRows.slice(0, 10).map((h, i) => {
                      const liveDays = h.avgHoldDays + holderRowsElapsedDays;
                      const t = tierForDays(liveDays);
                      return (
                        <div key={h.address} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ color: "var(--muted-foreground)", fontSize: 12, width: 18 }}>#{i + 1}</span>
                            <span style={{ fontSize: 14 }}>{t.emoji}</span>
                            <span style={{ color: "var(--foreground)", fontSize: 13, fontFamily: "monospace" }}>
                              {h.address.slice(0, 6)}…{h.address.slice(-4)}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                              {Number(formatUnits(h.balance, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} {tokenSymbol}
                            </span>
                            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{t.name} · {formatHoldTime(liveDays)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Creator info ── */}
              <div className="rh-glass" style={GLASS}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--foreground)", fontWeight: 700, fontSize: 14 }}>
                  <Award size={16} color="#FFD700" /> Creator
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                  <div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>ADDRESS</div>
                    <a href={`${RH_CONFIG.explorer}/address/${pool.creator}`} target="_blank" rel="noreferrer" style={{ color: "var(--foreground)", fontSize: 13, fontFamily: "monospace", textDecoration: "none" }}>
                      {pool.creator.slice(0, 8)}…{pool.creator.slice(-6)}
                    </a>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CREATOR SCORE</div>
                    <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 700 }}>
                      {creatorInfo === null ? "—" : creatorInfo.score !== null ? `${creatorInfo.score.toFixed(1)}x avg 🎯` : "First Launch 🆕"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>TOKENS CREATED</div>
                    <div style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 700 }}>{creatorInfo?.tokenCount ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CREATOR SINCE</div>
                    <div style={{ color: "var(--foreground)", fontSize: 13, fontWeight: 700 }}>
                      {creatorInfo?.sinceSec ? new Date(creatorInfo.sinceSec * 1000).toLocaleDateString() : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Hood score */}
              {authenticated && (
                <div className="rh-glass" style={GLASS}>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>YOUR HOOD SCORE</div>
                  {hoodTier ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 28 }}>{hoodTier.emoji}</span>
                      <div>
                        <div style={{ color: "var(--foreground)", fontWeight: 700, fontSize: 15 }}>{hoodTier.name}</div>
                        <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{formatHoldTime(liveHoodDays ?? 0)} avg hold</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No hold history yet</div>
                  )}
                </div>
              )}

              {/* Buy / Sell */}
              <div className="rh-glass" style={GLASS}>
                {phase === "Graduated" ? (
                  <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, padding: "10px 0" }}>
                    <div style={{ color: "var(--foreground)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                      🏰 Graduated — Trading on Uniswap
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
                      {IS_ROBINHOOD_MAINNET && (
                        <>
                          <a
                            href={`https://dexscreener.com/robinhood/${token}`}
                            target="_blank" rel="noreferrer"
                            style={{
                              padding: "8px 16px", borderRadius: 10, background: "rgba(0,200,5,0.15)",
                              border: "1px solid rgba(0,200,5,0.3)", color: "#00E676", textDecoration: "none", fontSize: 13, fontWeight: 700,
                            }}
                          >
                            📊 DexScreener
                          </a>
                          <a
                            href={`https://app.uniswap.org/swap?chain=robinhood&inputCurrency=ETH&outputCurrency=${token}`}
                            target="_blank" rel="noreferrer"
                            style={{
                              padding: "8px 16px", borderRadius: 10, background: "rgba(0,200,5,0.15)",
                              border: "1px solid rgba(0,200,5,0.3)", color: "#00E676", textDecoration: "none", fontSize: 13, fontWeight: 700,
                            }}
                          >
                            🦄 Uniswap
                          </a>
                        </>
                      )}
                      <a
                        href={`${RH_CONFIG.explorer}/token/${token}`}
                        target="_blank" rel="noreferrer"
                        style={{
                          padding: "8px 16px", borderRadius: 10, background: "rgba(0,200,5,0.15)",
                          border: "1px solid rgba(0,200,5,0.3)", color: "#00E676", textDecoration: "none", fontSize: 13, fontWeight: 700,
                        }}
                      >
                        🔍 Explorer
                      </a>
                    </div>
                    {pool.uniswapPair !== "0x0000000000000000000000000000000000000000" && (
                      <div style={{ marginTop: 10 }}>
                        <a href={`${RH_CONFIG.explorer}/address/${pool.uniswapPair}`} target="_blank" rel="noreferrer" style={{ color: "#00E676" }}>
                          View pair ↗
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 11, padding: 4, marginBottom: 16 }}>
                      {(["buy", "sell"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setTab(t); setTxError(null); setGateRejection(null); }}
                          style={{
                            flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: tab === t ? (t === "buy" ? "rgba(0,200,5,0.15)" : "rgba(255,107,107,0.12)") : "transparent",
                            color: tab === t ? (t === "buy" ? "#00E676" : "#ff9b9b") : "var(--muted-foreground)",
                            fontWeight: 700, fontSize: 13, textTransform: "capitalize",
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {tab === "buy" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <label style={{ color: "var(--muted-foreground)", fontSize: 12, fontWeight: 600 }}>ETH to spend</label>
                        {connected && ethBalance !== null && ethBalance > 0 && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {[10, 25, 50, 100].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  const spendable = pct === 100 ? Math.max(ethBalance - 0.0005, 0) : (ethBalance * pct) / 100;
                                  setEthAmount(spendable.toFixed(6));
                                }}
                                style={{
                                  flex: 1, padding: "6px", borderRadius: 8, cursor: "pointer",
                                  background: "rgba(0,200,5,0.15)", border: "1px solid rgba(0,200,5,0.3)",
                                  color: "#00E676", fontSize: 12, fontWeight: 700,
                                }}
                              >
                                {pct === 100 ? "MAX" : `${pct}%`}
                              </button>
                            ))}
                          </div>
                        )}
                        <input value={ethAmount} onChange={(e) => { setEthAmount(e.target.value); setGateRejection(null); }} type="number" min="0" step="any" placeholder="0.0" />
                        {buyPreview && (
                          <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                            ≈ {Number(buyPreview).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}
                            {ethUsd !== null && Number(ethAmount) > 0 && (
                              <span> (~{formatUsd(Number(ethAmount) * ethUsd)})</span>
                            )}
                          </div>
                        )}
                        {!authenticated ? (
                          <button className="bg-primary" onClick={login} style={{ padding: 13, fontWeight: 700 }}>Connect wallet</button>
                        ) : (
                          <button
                            className="bg-primary"
                            onClick={handleBuy}
                            disabled={txBusy || !ethAmount || Number(ethAmount) <= 0}
                            style={{ padding: 13, fontWeight: 800, opacity: (!ethAmount || Number(ethAmount) <= 0) ? 0.5 : 1 }}
                          >
                            {txBusy ? "Buying…" : `Buy ${tokenSymbol} 🏹`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <label style={{ color: "var(--muted-foreground)", fontSize: 12, fontWeight: 600 }}>
                          {tokenSymbol} to sell
                        </label>
                        {connected && userBalance > 0n && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {[10, 25, 50, 100].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  const amount = (userBalance * BigInt(pct)) / 100n;
                                  setTokenAmount(formatUnits(amount, 18));
                                }}
                                style={{
                                  flex: 1, padding: "6px", borderRadius: 8, cursor: "pointer",
                                  background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.3)",
                                  color: "#ff9b9b", fontSize: 12, fontWeight: 700,
                                }}
                              >
                                {pct === 100 ? "MAX" : `${pct}%`}
                              </button>
                            ))}
                          </div>
                        )}
                        <input value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} type="number" min="0" step="any" placeholder="0.0" />
                        <div style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
                          Balance: {Number(formatUnits(userBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}
                        </div>
                        {sellPreview && (
                          <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                            ≈ {Number(sellPreview).toFixed(8)} ETH
                            {ethUsd !== null && <span> (~{formatUsd(Number(sellPreview) * ethUsd)})</span>} — rewards shared with holders & stakers
                          </div>
                        )}
                        {!authenticated ? (
                          <button className="bg-primary" onClick={login} style={{ padding: 13, fontWeight: 700 }}>Connect wallet</button>
                        ) : (
                          <button
                            onClick={handleSell}
                            disabled={txBusy || !tokenAmount || Number(tokenAmount) <= 0}
                            style={{
                              padding: 13, fontWeight: 800, borderRadius: 12, border: "none", cursor: "pointer",
                              background: "linear-gradient(135deg, #ff6b6b, #c0392b)", color: "#fff",
                              opacity: (!tokenAmount || Number(tokenAmount) <= 0) ? 0.5 : 1,
                            }}
                          >
                            {txBusy ? "Selling…" : "⚔️ Sell"}
                          </button>
                        )}
                      </div>
                    )}

                    {gateRejection && (
                      <div style={{
                        background: "linear-gradient(135deg, rgba(255,50,50,0.1), rgba(255,150,0,0.05))",
                        border: "1px solid rgba(255,50,50,0.3)",
                        borderRadius: 16, padding: 20, marginTop: 12,
                        animation: "rh-slide-down 0.3s ease",
                      }}>
                        <div style={{ fontSize: 24, textAlign: "center", marginBottom: 8 }}>🏹 ⛔</div>
                        <h4 style={{ color: "#ff6b6b", textAlign: "center", margin: "0 0 8px", fontSize: 15 }}>
                          Hood Gate Blocked
                        </h4>
                        <p style={{ color: "#aaa", textAlign: "center", fontSize: 13, margin: 0 }}>
                          This token requires <strong style={{ color: "#FFD700" }}>{tierForDays(gateRejection.required).name}</strong> tier{" "}
                          ({gateRejection.required}+ days avg hold)
                        </p>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, margin: "16px 0" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "#888" }}>Your Score</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#ff6b6b" }}>
                              {formatHoldTime(gateRejection.current)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                              {tierForDays(gateRejection.current).emoji} {tierForDays(gateRejection.current).name}
                            </div>
                          </div>
                          <div style={{ fontSize: 24, color: "var(--muted-foreground)" }}>→</div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "#888" }}>Required</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#FFD700" }}>
                              {gateRejection.required}d
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                              {tierForDays(gateRejection.required).emoji} {tierForDays(gateRejection.required).name}
                            </div>
                          </div>
                        </div>
                        <p style={{ color: "#888", textAlign: "center", fontSize: 12, margin: 0 }}>
                          Keep holding tokens on the platform to increase your Hood Score.
                          Buy ungated tokens to start building your score.
                        </p>
                        <button
                          onClick={() => setGateRejection(null)}
                          style={{
                            width: "100%", padding: 10, borderRadius: 10, marginTop: 8,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "#aaa", cursor: "pointer",
                          }}
                        >
                          Got it
                        </button>
                      </div>
                    )}
                    {txError && (
                      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff9b9b", fontSize: 12 }}>
                        {txError}
                      </div>
                    )}
                    {txSuccess && (
                      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(0,200,5,0.08)", border: "1px solid rgba(0,200,5,0.2)", color: "#00E676", fontSize: 12 }}>
                        {txReceipt ? (
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontWeight: 700 }}>
                              ✅ {txReceipt.type === "buy" ? "Bought" : "Sold"} {txReceipt.tokenAmount} {tokenSymbol} for {Number(txReceipt.ethAmount).toFixed(6)} ETH
                            </div>
                            <div style={{ color: "var(--muted-foreground)", marginTop: 4, fontSize: 11.5, lineHeight: 1.6 }}>
                              → Creator received: {Number(txReceipt.creatorFee).toFixed(6)} ETH (70%)<br />
                              → Community pool: {Number(txReceipt.stakerFee).toFixed(6)} ETH (30%)
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom: 4 }}>✓ Confirmed</div>
                        )}
                        <a href={`${RH_CONFIG.explorer}/tx/${txSuccess}`} target="_blank" rel="noreferrer" style={{ color: "#00E676" }}>
                          view tx ↗
                        </a>
                      </div>
                    )}
                    {!connected && authenticated && (
                      <div style={{ marginTop: 10, color: "var(--muted-foreground)", fontSize: 12, textAlign: "center" }}>
                        Waiting for your Robinhood Chain wallet…
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Mint Living NFT */}
              {connected && canMintNft && (
                <div
                  className="rh-glass"
                  style={{
                    ...GLASS,
                    background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,200,5,0.05))",
                    border: "1px solid rgba(255,215,0,0.3)",
                  }}
                >
                  <h4 style={{ color: "#FFD700", margin: "0 0 8px", fontSize: 15 }}>🎨 Mint Living NFT</h4>
                  <p style={{ color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.5 }}>
                    Lock {(NFT_LOCK_AMOUNT / 10n ** 18n).toLocaleString()} {tokenSymbol} to mint an NFT that captures this token's current metadata.
                    If the creator updates the token later, your NFT preserves this moment forever.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Cost:</span>
                    <span style={{ color: "#FFD700", fontWeight: 700, fontSize: 13 }}>
                      {(NFT_LOCK_AMOUNT / 10n ** 18n).toLocaleString()} {tokenSymbol}
                    </span>
                  </div>
                  <p style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 12 }}>
                    You can burn the NFT anytime to unlock your tokens back.
                  </p>
                  <button
                    onClick={handleMintNft}
                    disabled={mintingNft}
                    style={{
                      width: "100%", padding: 12, borderRadius: 12, border: "none", cursor: mintingNft ? "not-allowed" : "pointer",
                      background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000", fontWeight: 700, fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: mintingNft ? 0.7 : 1,
                    }}
                  >
                    {mintingNft ? <><Loader2 size={15} className="rh-spin" /> Minting…</> : <>🎨 Mint NFT — Lock {(NFT_LOCK_AMOUNT / 10n ** 18n).toLocaleString()} {tokenSymbol}</>}
                  </button>
                  {mintError && (
                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff9b9b", fontSize: 12 }}>
                      {mintError}
                    </div>
                  )}
                  {mintSuccess && (
                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(0,200,5,0.08)", border: "1px solid rgba(0,200,5,0.2)", color: "#00E676", fontSize: 12 }}>
                      ✓ Minted —{" "}
                      <a href={`${RH_CONFIG.explorer}/tx/${mintSuccess}`} target="_blank" rel="noreferrer" style={{ color: "#00E676" }}>
                        view tx ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* User's Living NFTs */}
              {userNfts !== null && userNfts.length > 0 && (
                <div className="rh-glass" style={GLASS}>
                  <h5 style={{ color: "#FFD700", margin: "0 0 10px", fontSize: 14 }}>🖼️ Your Living NFTs ({userNfts.length})</h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {userNfts.map((nft) => {
                      const id = nft.tokenId.toString();
                      const img = nftImages[id];
                      const burning = burningNftId === nft.tokenId;
                      return (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, borderRadius: 10, background: "rgba(255,215,0,0.05)" }}>
                          {img ? (
                            <img src={img} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--card)", flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 700 }}>NFT #{id}</div>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Minted {timeAgo(nft.mintTimestamp)}</div>
                          </div>
                          <button
                            onClick={() => handleBurnNft(nft.tokenId)}
                            disabled={burning}
                            style={{
                              flexShrink: 0, background: "none", border: "none", color: "#ff9b9b", fontSize: 12, fontWeight: 700,
                              cursor: burning ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {burning ? <Loader2 size={12} className="rh-spin" /> : "🔓"} Unlock Tokens
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {burnError && (
                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff9b9b", fontSize: 12 }}>
                      {burnError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .rh-spin { animation: rh-spin-kf 0.8s linear infinite; }
        @keyframes rh-spin-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .rh-glass { transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease; }
        .rh-glass:hover { border-color: rgba(0,200,5,0.35); box-shadow: 0 0 32px rgba(0,200,5,0.14); }

        .rh-flash { animation: rh-flash-kf 0.9s ease-out; }
        @keyframes rh-flash-kf {
          0% { box-shadow: 0 0 0 2px rgba(0,230,118,0.6), 0 0 40px rgba(0,230,118,0.4); }
          100% { box-shadow: none; }
        }

        .rh-progress-fill {
          background: linear-gradient(90deg, #00C805, #00E676);
          transition: width 0.5s ease;
          animation: rh-progress-pulse 2.2s ease-in-out infinite;
        }
        @keyframes rh-progress-pulse {
          0%, 100% { filter: brightness(1); box-shadow: 0 0 6px rgba(0,230,118,0.4); }
          50% { filter: brightness(1.25); box-shadow: 0 0 14px rgba(0,230,118,0.75); }
        }

        .rh-social-icon:hover { box-shadow: 0 0 14px rgba(0,230,118,0.4); transform: translateY(-1px); }

        @keyframes rh-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(600deg); opacity: 0; }
        }

        @keyframes rh-slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
