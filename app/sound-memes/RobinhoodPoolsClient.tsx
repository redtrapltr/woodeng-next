"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Feather, RefreshCw, ExternalLink } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useRobinhoodWallet } from "@/hooks/useRobinhoodWallet";
import {
  robinhoodPublicClient,
  RH_CONFIG,
  SWL444_FACTORY_ABI,
  ERC20_MINIMAL_ABI,
  DIAMOND_GATE_ABI,
  BONDING_SUPPLY,
  POOL_PHASE,
  IS_ROBINHOOD_MAINNET,
  type PoolPhase,
} from "../lib/robinhoodChain";
import {
  getSpotPriceEth,
  mcapEth,
  circulatingSupplyForPool,
  fetchEthUsd,
  formatUsd,
  formatHoldTime,
  ipfsToHttp,
  getHolderRows,
  avgHoldDaysAcross,
  type HolderRow,
} from "../lib/robinhoodStats";
import RobinhoodPhaseBadge from "../components/RobinhoodPhaseBadge";
import { HOOD_TIERS, tierForDays } from "../lib/hoodTiers";

type PoolRow = {
  token: `0x${string}`;
  name: string;
  symbol: string;
  phase: PoolPhase;
  mcapEth: number | null;
  bondingSold: bigint;
  metadataUri: string | null;
  minAvgHoldDays: number;
};

type FilterKey = "all" | "open" | "gated" | "eligible";
type SortKey = "newest" | "mcap" | "holdScore" | "graduation";

const TIER_COLORS: Record<string, string> = {
  Peasant: "#8a8f9e",
  Outlaw: "#ff6b6b",
  Archer: "#00E676",
  "Merry Man": "#4d9fff",
  "Little John": "#c0c0c0",
  "Robin Hood": "#FFD700",
};

const RANK_EMOJI = ["👑", "🛡️", "🏹", "🎯", "🗡️"];

/** Forces a re-render every `intervalMs` so hold-time displays extrapolated
 * from a last-fetched base value visibly tick forward between polls. */
function useNowTick(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
}

function tierProgress(days: number) {
  let current = HOOD_TIERS[0];
  for (const t of HOOD_TIERS) {
    if (days >= t.minDays) current = t;
  }
  const idx = HOOD_TIERS.indexOf(current);
  const next = idx + 1 < HOOD_TIERS.length ? HOOD_TIERS[idx + 1] : null;
  const progress = next ? ((days - current.minDays) / (next.minDays - current.minDays)) * 100 : 100;
  return { current, next, progress: Math.min(100, Math.max(0, progress)) };
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 9,
        border: `1px solid ${active ? "rgba(0,200,5,0.4)" : "rgba(255,255,255,0.08)"}`,
        background: active ? "rgba(0,200,5,0.14)" : "rgba(255,255,255,0.03)",
        color: active ? "#00E676" : "#9aa0b6",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function RobinhoodPoolsClient() {
  const [pools, setPools] = useState<PoolRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ethUsd, setEthUsd] = useState<number | null>(null);
  const [poolImages, setPoolImages] = useState<Record<string, string>>({});
  const [holderRowsByToken, setHolderRowsByToken] = useState<Record<string, HolderRow[]>>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const { authenticated } = usePrivy();
  const { address } = useRobinhoodWallet();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = (await robinhoodPublicClient.readContract({
        address: RH_CONFIG.factory,
        abi: SWL444_FACTORY_ABI,
        functionName: "getAllPools",
      })) as `0x${string}`[];

      if (tokens.length === 0) {
        setPools([]);
        return;
      }

      // No multicall3 contract on Robinhood Chain Testnet — fan out individual
      // eth_call requests instead (see robinhoodPublicClient's batch config).
      const settled = await Promise.all(
        tokens.map((token) =>
          Promise.allSettled([
            robinhoodPublicClient.readContract({
              address: RH_CONFIG.factory,
              abi: SWL444_FACTORY_ABI,
              functionName: "getPool",
              args: [token],
            }),
            robinhoodPublicClient.readContract({ address: token, abi: ERC20_MINIMAL_ABI, functionName: "name" }),
            robinhoodPublicClient.readContract({ address: token, abi: ERC20_MINIMAL_ABI, functionName: "symbol" }),
          ])
        )
      );

      const rows: PoolRow[] = await Promise.all(
        tokens.map(async (token, i) => {
          const [poolRes, nameRes, symbolRes] = settled[i];
          const pool: any = poolRes.status === "fulfilled" ? poolRes.value : null;
          const name = nameRes.status === "fulfilled" ? (nameRes.value as string) : "Unknown";
          const symbol = symbolRes.status === "fulfilled" ? (symbolRes.value as string) : "???";
          const priceEth = pool ? await getSpotPriceEth(pool).catch(() => null) : null;
          return {
            token,
            name,
            symbol,
            phase: pool ? POOL_PHASE[pool.phase as number] : "Bonding",
            mcapEth: priceEth !== null && pool ? mcapEth(priceEth, circulatingSupplyForPool(pool)) : null,
            bondingSold: pool ? (pool.bondingSold as bigint) : 0n,
            metadataUri: pool ? (pool.metadataUri as string) : null,
            minAvgHoldDays: pool ? Number(pool.minAvgHoldDays as bigint) : 0,
          };
        })
      );

      // Newest first — allPools() is append-only, so reverse gives recency order.
      setPools(rows.reverse());
    } catch (e: any) {
      console.warn("[RobinhoodPoolsClient] load failed:", e);
      setError(e?.shortMessage || e?.message || `Couldn't reach ${RH_CONFIG.chainName} RPC.`);
      setPools(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const loadUsd = () => fetchEthUsd().then((p) => { if (!cancelled) setEthUsd(p); });
    loadUsd();
    const i = setInterval(loadUsd, 60000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  // Token images from each pool's pinned metadata — fetched once per token,
  // independent of the 20s pool-state refresh so it doesn't re-fetch on poll.
  useEffect(() => {
    if (!pools) return;
    pools.forEach((pool) => {
      if (!pool.metadataUri || poolImages[pool.token]) return;
      const url = ipfsToHttp(pool.metadataUri);
      if (!url) return;
      fetch(url)
        .then((r) => r.json())
        .then((meta) => {
          const img = ipfsToHttp(meta?.image);
          if (img) setPoolImages((prev) => ({ ...prev, [pool.token]: img }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools]);

  // Holder rows (per-token, used for the leaderboard + avg holder score cards)
  // are a full Transfer-log scan per token, so they're keyed off the token
  // *list* (not the whole `pools` object, which gets a new reference on every
  // 20s price poll) — otherwise every price refresh would re-scan every
  // token's full history.
  const poolsRef = useRef<PoolRow[] | null>(null);
  useEffect(() => { poolsRef.current = pools; }, [pools]);
  const tokenListKey = pools ? pools.map((p) => p.token).join(",") : "";

  const loadHolderData = useCallback(async () => {
    const current = poolsRef.current;
    if (!current || current.length === 0) return;
    const entries = await Promise.all(
      current.map(async (p) => [p.token.toLowerCase(), await getHolderRows(p.token).catch(() => [])] as const)
    );
    setHolderRowsByToken(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    if (!tokenListKey) return;
    loadHolderData();
    const i = setInterval(loadHolderData, 60000);
    return () => clearInterval(i);
  }, [tokenListKey, loadHolderData]);

  const avgHolderDaysByToken = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [token, rows] of Object.entries(holderRowsByToken)) {
      m[token] = avgHoldDaysAcross(rows);
    }
    return m;
  }, [holderRowsByToken]);

  // Global leaderboard — getAvgHoldSeconds (read inside getHolderRows) is
  // already a cross-token aggregate per holder, so the same score shows up
  // in every pool that holder is in; dedupe by address into one ranked list.
  const globalHolders = useMemo(() => {
    const map = new Map<string, number>();
    for (const rows of Object.values(holderRowsByToken)) {
      for (const r of rows) {
        const addr = r.address.toLowerCase();
        const existing = map.get(addr);
        if (existing === undefined || r.avgHoldDays > existing) map.set(addr, r.avgHoldDays);
      }
    }
    return Array.from(map.entries())
      .map(([holderAddress, avgHoldDays]) => ({ address: holderAddress, avgHoldDays }))
      .sort((a, b) => b.avgHoldDays - a.avgHoldDays);
  }, [holderRowsByToken]);

  const topHolders = globalHolders.slice(0, 10);

  // Connected wallet's own Hood Score — read directly rather than pulled from
  // the leaderboard scan, so it stays accurate even before that scan resolves.
  const [hoodSeconds, setHoodSeconds] = useState<number | null>(null);
  const [hoodFetchedAt, setHoodFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!address) { setHoodSeconds(null); setHoodFetchedAt(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const seconds = await robinhoodPublicClient.readContract({
          address: RH_CONFIG.gate, abi: DIAMOND_GATE_ABI, functionName: "getAvgHoldSeconds", args: [address],
        });
        if (!cancelled) { setHoodSeconds(Number(seconds)); setHoodFetchedAt(Date.now()); }
      } catch {
        if (!cancelled) { setHoodSeconds(null); setHoodFetchedAt(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  // Ticks every second so the sticky Hood Score card visibly climbs between
  // polls — same extrapolation technique as the token detail page.
  useNowTick();

  const liveHoodDays = hoodSeconds !== null && hoodFetchedAt !== null
    ? hoodSeconds / 86400 + (Date.now() - hoodFetchedAt) / 86_400_000
    : null;

  const userRank = address
    ? (() => {
        const idx = globalHolders.findIndex((h) => h.address === address.toLowerCase());
        return idx >= 0 ? idx + 1 : null;
      })()
    : null;

  const { current: userTier, progress: userTierProgress } = tierProgress(liveHoodDays ?? 0);

  const visiblePools = useMemo(() => {
    if (!pools) return [];
    let list = pools;
    if (filter === "open") list = list.filter((p) => p.minAvgHoldDays === 0);
    else if (filter === "gated") list = list.filter((p) => p.minAvgHoldDays > 0);
    else if (filter === "eligible") {
      list = list.filter((p) => p.minAvgHoldDays === 0 || (liveHoodDays !== null && liveHoodDays >= p.minAvgHoldDays));
    }

    const progressOf = (p: PoolRow) =>
      BONDING_SUPPLY > 0n ? Math.min(100, Number((p.bondingSold * 10000n) / BONDING_SUPPLY) / 100) : 0;

    const sorted = [...list];
    if (sort === "mcap") sorted.sort((a, b) => (b.mcapEth ?? -1) - (a.mcapEth ?? -1));
    else if (sort === "holdScore") {
      sorted.sort((a, b) => (avgHolderDaysByToken[b.token.toLowerCase()] ?? 0) - (avgHolderDaysByToken[a.token.toLowerCase()] ?? 0));
    } else if (sort === "graduation") sorted.sort((a, b) => progressOf(b) - progressOf(a));
    // "newest" keeps the load order (allPools() reversed = newest first).
    return sorted;
  }, [pools, filter, sort, liveHoodDays, avgHolderDaysByToken]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "calc(var(--header-h, 64px) + 24px) 16px 60px" }}>
      {/* Testnet banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 10,
          background: "rgba(0,200,5,0.08)",
          border: "1px solid rgba(0,200,5,0.2)",
          color: "#00E676",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 22,
        }}
      >
        <Feather size={13} /> Trading on Robinhood Chain (Testnet)
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h1
          style={{
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 800,
            margin: "0 0 10px",
            background: "linear-gradient(135deg, #00C805 0%, #00E676 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Steal from the Flippers. Give to the Holders.
        </h1>
        <p style={{ color: "#9aa0b6", fontSize: 15, maxWidth: 560, margin: "0 auto" }}>
          The only launchpad where diamond hands get rewarded, not rugged. Hold longer, unlock more.
        </p>
      </div>

      {/* Leaderboard */}
      {topHolders.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(0,200,5,0.08), rgba(0,230,118,0.04))",
            border: "1px solid rgba(0,200,5,0.2)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ color: "#00E676", margin: 0, fontSize: 16 }}>🏆 The Merry Men — Top Diamond Hands</h3>
          <p style={{ color: "#888", fontSize: 12, margin: "4px 0 16px" }}>Ranked by global Hood Score across all tokens</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
            {topHolders.slice(0, 5).map((h, i) => {
              const t = tierForDays(h.avgHoldDays);
              return (
                <div
                  key={h.address}
                  style={{
                    background: i === 0 ? "rgba(255,215,0,0.1)" : "rgba(0,200,5,0.05)",
                    border: `1px solid ${i === 0 ? "rgba(255,215,0,0.3)" : "rgba(0,200,5,0.15)"}`,
                    borderRadius: 12,
                    padding: 12,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24 }}>{RANK_EMOJI[i]}</div>
                  <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                    {h.address.slice(0, 6)}…{h.address.slice(-4)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#00E676" }}>{formatHoldTime(h.avgHoldDays)}</div>
                  <div style={{ fontSize: 10, color: TIER_COLORS[t.name] ?? "#FFD700" }}>{t.emoji} {t.name}</div>
                </div>
              );
            })}
          </div>

          {topHolders.length > 5 && (
            <div style={{ marginTop: 10 }}>
              {topHolders.slice(5, 10).map((h, i) => {
                const t = tierForDays(h.avgHoldDays);
                return (
                  <div
                    key={h.address}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", fontSize: 12 }}
                  >
                    <span style={{ color: "#666", width: 28 }}>#{i + 6}</span>
                    <span style={{ color: "#aaa", fontFamily: "monospace", flex: 1 }}>
                      {h.address.slice(0, 6)}…{h.address.slice(-4)}
                    </span>
                    <span style={{ color: "#00E676", marginRight: 8 }}>{formatHoldTime(h.avgHoldDays)}</span>
                    <span>{t.emoji}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Your Hood Score — sticky */}
      {authenticated && address && (
        <div
          style={{
            position: "sticky",
            top: "calc(var(--header-h, 64px) + 12px)",
            zIndex: 10,
            background: "rgba(0,200,5,0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(0,200,5,0.25)",
            borderRadius: 14,
            padding: "12px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            overflow: "hidden",
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: "#888" }}>Your Hood Score</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#00E676" }}>
              {liveHoodDays !== null ? formatHoldTime(liveHoodDays) : "—"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className={userTier.name === "Robin Hood" ? "rh-tier-sparkle" : undefined} style={{ fontSize: 28 }}>
              {userTier.emoji}
            </div>
            <div style={{ fontSize: 11, color: TIER_COLORS[userTier.name] ?? "#FFD700", fontWeight: 700 }}>{userTier.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 12, color: "#888" }}>Rank</span>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{userRank ? `#${userRank}` : "—"}</div>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${userTierProgress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #00C805, #00E676)",
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <span style={{ color: "#e6e6ff", fontWeight: 700, fontSize: 15 }}>
          {pools ? `${visiblePools.length} pool${visiblePools.length === 1 ? "" : "s"}` : "Meme Tokens"}
        </span>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(0,200,5,0.08)",
            border: "1px solid rgba(0,200,5,0.2)",
            borderRadius: 10,
            color: "#00E676",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "rh-spin 0.8s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Filters + sort */}
      {pools && pools.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All Tokens</FilterButton>
          <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>🔓 Open (No Gate)</FilterButton>
          <FilterButton active={filter === "gated"} onClick={() => setFilter("gated")}>🏹 Gated Only</FilterButton>
          <FilterButton active={filter === "eligible"} onClick={() => setFilter("eligible")}>✅ I Can Enter</FilterButton>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "#9aa0b6",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <option value="newest">Newest First</option>
            <option value="mcap">Market Cap ↓</option>
            <option value="holdScore">Avg Hold Score ↓</option>
            <option value="graduation">Closest to Graduation</option>
          </select>
        </div>
      )}

      {/* States */}
      {error && (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "rgba(255,107,107,0.06)",
            border: "1px solid rgba(255,107,107,0.18)",
            color: "#ff9b9b",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {!pools && !error && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7084" }}>
          <RefreshCw size={20} style={{ animation: "rh-spin 0.8s linear infinite", marginBottom: 10 }} />
          <div>Loading pools from Robinhood Chain…</div>
        </div>
      )}

      {pools && pools.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            borderRadius: 16,
            border: "1px dashed rgba(0,200,5,0.25)",
            color: "#9aa0b6",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>🏹</div>
          <div style={{ color: "#e6e6ff", fontWeight: 700, marginBottom: 6 }}>No tokens launched yet</div>
          <div style={{ fontSize: 13 }}>Be the first to launch in Sherwood Forest.</div>
        </div>
      )}

      {pools && pools.length > 0 && visiblePools.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            borderRadius: 16,
            border: "1px dashed rgba(0,200,5,0.25)",
            color: "#9aa0b6",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
          <div style={{ color: "#e6e6ff", fontWeight: 700, marginBottom: 6 }}>No pools match this filter</div>
          <div style={{ fontSize: 13 }}>Try a different filter or sort.</div>
        </div>
      )}

      {/* Pool grid */}
      {visiblePools.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {visiblePools.map((p, idx) => {
            const progress = BONDING_SUPPLY > 0n
              ? Math.min(100, Number((p.bondingSold * 10000n) / BONDING_SUPPLY) / 100)
              : 0;
            const mcapUsd = p.mcapEth !== null && ethUsd !== null ? p.mcapEth * ethUsd : null;
            const image = poolImages[p.token];
            const avgHolderDays = avgHolderDaysByToken[p.token.toLowerCase()];
            const gateTier = p.minAvgHoldDays > 0 ? tierForDays(p.minAvgHoldDays) : null;
            return (
              <Link
                key={p.token}
                href={`/sound-memes/${p.token}`}
                className="rh-pool-card"
                style={{
                  display: "block",
                  padding: 16,
                  borderRadius: 16,
                  background: "linear-gradient(180deg, rgba(0,200,5,0.06), rgba(0,200,5,0.015))",
                  border: "1px solid rgba(0,200,5,0.15)",
                  boxShadow: "0 0 20px rgba(0,200,5,0.06)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  textDecoration: "none",
                  opacity: 0,
                  animation: "rh-card-in 0.5s ease forwards",
                  animationDelay: `${Math.min(idx, 20) * 45}ms`,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(0,200,5,0.2)" }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, rgba(0,200,5,0.15), rgba(0,200,5,0.03))", border: "1px solid rgba(0,200,5,0.2)" }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "#e6e6ff", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ color: "#6b7084", fontSize: 12 }}>${p.symbol}</div>
                  </div>
                  <RobinhoodPhaseBadge phase={p.phase} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  {gateTier ? (
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 8, fontSize: 11,
                        background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)", color: "#FFD700",
                      }}
                    >
                      🏹 {p.minAvgHoldDays}d gate — {gateTier.name}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#666" }}>🔓 Open</div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em" }}>MCAP</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                  <span style={{ color: "#00E676", fontWeight: 800, fontSize: 18 }}>
                    {p.mcapEth === null ? "—" : mcapUsd !== null ? formatUsd(mcapUsd) : `${p.mcapEth.toFixed(p.mcapEth < 1 ? 4 : 2)} ETH`}
                  </span>
                  {p.mcapEth !== null && mcapUsd !== null && (
                    <span style={{ color: "#6b7084", fontSize: 12 }}>(~{p.mcapEth.toFixed(p.mcapEth < 1 ? 4 : 2)} ETH)</span>
                  )}
                </div>

                {avgHolderDays !== undefined && (
                  <div style={{ fontSize: 11, color: "#00E676", marginBottom: 8 }}>
                    👥 Avg Holder: {formatHoldTime(avgHolderDays)} — {tierForDays(avgHolderDays).name}
                  </div>
                )}

                {p.phase === "Bonding" ? (
                  <div>
                    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div
                        className="rh-progress-fill"
                        style={{
                          height: "100%",
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                    <div style={{ color: "#6b7084", fontSize: 11, marginTop: 5 }}>
                      🏹 Bonding — {progress.toFixed(1)}% to graduation
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 5 }}>
                    <div style={{ color: "#6b7084", fontSize: 11 }}>🏰 Graduated — trading on Uniswap</div>
                    {IS_ROBINHOOD_MAINNET && (
                      <a
                        href={`https://dexscreener.com/robinhood/${p.token}`}
                        target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#00E676", fontSize: 11, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}
                      >
                        📊 DexScreener
                      </a>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {pools && pools.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 30 }}>
          <a
            href={`${RH_CONFIG.explorer}/address/${RH_CONFIG.factory}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#6b7084", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            View factory contract <ExternalLink size={11} />
          </a>
        </div>
      )}

      <style jsx global>{`
        @keyframes rh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rh-card-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .rh-pool-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 28px rgba(0,200,5,0.18);
          border-color: rgba(0,200,5,0.35);
        }
        .rh-progress-fill {
          background: linear-gradient(90deg, #00C805, #00E676);
          transition: width 0.4s ease;
          animation: rh-progress-pulse 2.2s ease-in-out infinite;
        }
        @keyframes rh-progress-pulse {
          0%, 100% { filter: brightness(1); box-shadow: 0 0 6px rgba(0,230,118,0.35); }
          50% { filter: brightness(1.25); box-shadow: 0 0 12px rgba(0,230,118,0.7); }
        }
        .rh-tier-sparkle {
          animation: rh-tier-sparkle-kf 1.8s ease-in-out infinite;
        }
        @keyframes rh-tier-sparkle-kf {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(255,215,0,0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,215,0,0.9)); }
        }
      `}</style>
    </div>
  );
}
