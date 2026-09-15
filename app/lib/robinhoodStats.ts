// Aggregation helpers for the Robinhood Chain detail page — holders, volume,
// hold-score, and creator-score are not tracked on-chain as single reads, so
// they're reconstructed client-side from event logs. Robinhood Chain Testnet
// has no indexer/subgraph and low trading volume, so a full-range log scan
// (fromBlock: 0n) is cheap enough to do directly from the browser.
import { formatEther, type Address } from "viem";
import {
  robinhoodPublicClient,
  RH_CONFIG,
  SWL444_FACTORY_ABI,
  DIAMOND_GATE_ABI,
  TOTAL_SUPPLY,
  BONDING_SUPPLY,
  INIT_VIRTUAL_ETH,
} from "./robinhoodChain";

// Mirrors WETH in contracts-rh/script/Deploy.s.sol.
export const WETH_ADDRESS: Address = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const UNISWAP_V2_PAIR_ABI = [
  {
    type: "function", name: "getReserves", inputs: [], stateMutability: "view",
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  { type: "function", name: "token0", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
] as const;

export const TRANSFER_EVENT = {
  type: "event", name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

export const BUY_EVENT = {
  type: "event", name: "Buy",
  inputs: [
    { name: "token", type: "address", indexed: true },
    { name: "buyer", type: "address", indexed: true },
    { name: "ethIn", type: "uint256", indexed: false },
    { name: "tokensOut", type: "uint256", indexed: false },
    { name: "newPrice", type: "uint256", indexed: false },
  ],
} as const;

export const SELL_EVENT = {
  type: "event", name: "Sell",
  inputs: [
    { name: "token", type: "address", indexed: true },
    { name: "seller", type: "address", indexed: true },
    { name: "tokensIn", type: "uint256", indexed: false },
    { name: "ethOut", type: "uint256", indexed: false },
    { name: "newPrice", type: "uint256", indexed: false },
  ],
} as const;

export const PRICE_UPDATE_EVENT = {
  type: "event", name: "PriceUpdate",
  inputs: [
    { name: "token", type: "address", indexed: true },
    { name: "price", type: "uint256", indexed: false },
    { name: "timestamp", type: "uint256", indexed: false },
  ],
} as const;

// ─── ETH/USD price ─────────────────────────────────────────────
let cachedEthUsd: { price: number; at: number } | null = null;
const ETH_USD_CACHE_MS = 60_000;

export async function fetchEthUsd(): Promise<number | null> {
  if (cachedEthUsd && Date.now() - cachedEthUsd.at < ETH_USD_CACHE_MS) return cachedEthUsd.price;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const price = data?.ethereum?.usd;
    if (typeof price !== "number") return cachedEthUsd?.price ?? null;
    cachedEthUsd = { price, at: Date.now() };
    return price;
  } catch (e) {
    console.warn("[robinhoodStats] ETH/USD fetch failed:", e);
    return cachedEthUsd?.price ?? null;
  }
}

export function formatUsd(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n <= 0) return "$0.00";
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  // Sub-cent token prices — 4 fixed decimals would collapse to "$0.0000",
  // so scale decimals to the value's magnitude to keep 2-3 significant digits.
  const decimals = Math.min(12, -Math.floor(Math.log10(n)) + 2);
  return `$${n.toFixed(decimals)}`;
}

/** Renders an avg-hold-days figure (which can be a fraction of a day) with
 * every unit down to minutes visible, so a live-ticking display shows
 * seconds-to-minutes progress instead of jumping only once an hour/day
 * boundary is crossed. */
export function formatHoldTime(avgDays: number): string {
  if (avgDays <= 0) return "0m";
  const totalMinutes = Math.floor(avgDays * 24 * 60);
  const totalHours = Math.floor(avgDays * 24);
  const days = Math.floor(avgDays);

  if (days > 0) return `${days}d ${totalHours % 24}h ${totalMinutes % 60}m`;
  if (totalHours > 0) return `${totalHours}h ${totalMinutes % 60}m`;
  return `${totalMinutes}m`;
}

// ─── Spot price / mcap / liquidity ─────────────────────────────
export function bondingSpotPriceEth(pool: any): number {
  if (pool.virtualTokens === 0n) return 0;
  return Number(formatEther((pool.virtualEth * 10n ** 18n) / pool.virtualTokens));
}

async function getPairReserves(pair: Address): Promise<{ ethReserve: bigint; tokenReserve: bigint } | null> {
  if (!pair || pair.toLowerCase() === ZERO_ADDRESS) return null;
  try {
    const [reserves, token0] = await Promise.all([
      robinhoodPublicClient.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: "getReserves" }),
      robinhoodPublicClient.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: "token0" }),
    ]);
    const [reserve0, reserve1] = reserves as readonly [bigint, bigint, number];
    const wethIsToken0 = (token0 as string).toLowerCase() === WETH_ADDRESS.toLowerCase();
    return wethIsToken0
      ? { ethReserve: reserve0, tokenReserve: reserve1 }
      : { ethReserve: reserve1, tokenReserve: reserve0 };
  } catch (e) {
    console.warn("[robinhoodStats] pair reserves fetch failed:", e);
    return null;
  }
}

/** Current spot price in ETH per token. Post-graduation, reads live Uniswap
 * pair reserves; falls back to the frozen graduation-moment bonding price if
 * the pair can't be read. */
export async function getSpotPriceEth(pool: any): Promise<number> {
  if (pool.phase === 0) return bondingSpotPriceEth(pool);
  const reserves = await getPairReserves(pool.uniswapPair as Address);
  if (reserves && reserves.tokenReserve > 0n) {
    return Number(formatEther((reserves.ethReserve * 10n ** 18n) / reserves.tokenReserve));
  }
  return bondingSpotPriceEth(pool);
}

// Fully-diluted supply is only meaningful once every token is actually
// circulating (post-graduation, on Uniswap). During bonding, most of the
// 444M supply is still virtual/unminted — pricing it at the spot price
// wildly overstates mcap (e.g. ~$50K "mcap" off a $1 buy at launch, since
// spot price already reflects the phantom INIT_VIRTUAL_ETH seed). Pass the
// actual circulating supply instead: bondingSold while bonding, full supply
// once graduated.
export function mcapEth(priceEth: number, circulatingSupplyTokens: number): number {
  return priceEth * circulatingSupplyTokens;
}

/** Circulating supply for a live pool read (has exact bondingSold). */
export function circulatingSupplyForPool(pool: any): number {
  if (pool.phase === 0) return Number(formatEther(pool.bondingSold));
  return Number(formatEther(TOTAL_SUPPLY));
}

const TOTAL_SUPPLY_TOKENS = Number(formatEther(TOTAL_SUPPLY));
const CURVE_K = TOTAL_SUPPLY_TOKENS * Number(formatEther(INIT_VIRTUAL_ETH));

/** Recovers circulating supply from a historical bonding-phase price point
 * via the constant-product invariant (virtualEth * virtualTokens = k), since
 * PriceUpdate logs carry only price, not bondingSold. Only valid pre-
 * graduation — PriceUpdate stops firing once a pool graduates. */
export function impliedBondingCirculatingSupply(priceEth: number): number {
  if (priceEth <= 0) return 0;
  const virtualTokens = Math.sqrt(CURVE_K / priceEth);
  return Math.max(0, TOTAL_SUPPLY_TOKENS - virtualTokens);
}

// Gross ETH the bonding curve raises before it sells out and auto-graduates.
// Mirrors the derivation comment on INIT_VIRTUAL_ETH in SWL444Factory.sol —
// single source of truth so the create form and detail page can't drift.
export const GRADUATION_TARGET_ETH = (() => {
  const totalSupply = Number(formatEther(TOTAL_SUPPLY));
  const bondingSupply = Number(formatEther(BONDING_SUPPLY));
  const initVirtualEth = Number(formatEther(INIT_VIRTUAL_ETH));
  const BUY_FEE_BPS = 100;
  const k = totalSupply * initVirtualEth;
  const finalVirtualTokens = totalSupply - bondingSupply;
  const netEthTotal = k / finalVirtualTokens - initVirtualEth;
  return netEthTotal / (1 - BUY_FEE_BPS / 10000);
})();

/** Real ETH liquidity backing the pool right now — bonding reserve (net of
 * the phantom seed) while bonding, live Uniswap pair reserve once graduated. */
export async function getLiquidityEth(pool: any): Promise<number> {
  if (pool.phase === 0) {
    const real = pool.virtualEth - INIT_VIRTUAL_ETH;
    return Number(formatEther(real > 0n ? real : 0n));
  }
  const reserves = await getPairReserves(pool.uniswapPair as Address);
  return reserves ? Number(formatEther(reserves.ethReserve)) : 0;
}

// ─── Holders ────────────────────────────────────────────────────
/** Reconstructs current holder balances from Transfer logs. */
export async function getTokenHolders(token: Address): Promise<Map<string, bigint>> {
  const logs = await robinhoodPublicClient.getLogs({
    address: token,
    event: TRANSFER_EVENT,
    fromBlock: 0n,
    toBlock: "latest",
  });
  const balances = new Map<string, bigint>();
  for (const log of logs as any[]) {
    const from = (log.args.from as string).toLowerCase();
    const to = (log.args.to as string).toLowerCase();
    const value = log.args.value as bigint;
    if (from !== ZERO_ADDRESS) balances.set(from, (balances.get(from) ?? 0n) - value);
    if (to !== ZERO_ADDRESS) balances.set(to, (balances.get(to) ?? 0n) + value);
  }
  for (const [addr, bal] of balances) {
    if (bal <= 0n) balances.delete(addr);
  }
  return balances;
}

// ─── 24h volume ─────────────────────────────────────────────────
export async function getVolume24hEth(token: Address): Promise<number> {
  const sinceSec = Math.floor(Date.now() / 1000) - 24 * 3600;
  const [buyLogs, sellLogs] = await Promise.all([
    robinhoodPublicClient.getLogs({
      address: RH_CONFIG.factory, event: BUY_EVENT, args: { token }, fromBlock: 0n, toBlock: "latest",
    }),
    robinhoodPublicClient.getLogs({
      address: RH_CONFIG.factory, event: SELL_EVENT, args: { token }, fromBlock: 0n, toBlock: "latest",
    }),
  ]);
  const allLogs = [...buyLogs, ...sellLogs] as any[];
  if (allLogs.length === 0) return 0;

  const blockNumbers = Array.from(new Set(allLogs.map((l) => l.blockNumber as bigint)));
  const blocks = await Promise.all(blockNumbers.map((bn) => robinhoodPublicClient.getBlock({ blockNumber: bn })));
  const tsByBlock = new Map(blockNumbers.map((bn, i) => [bn.toString(), Number(blocks[i].timestamp)]));

  let total = 0n;
  for (const log of allLogs) {
    const ts = tsByBlock.get((log.blockNumber as bigint).toString());
    if (ts === undefined || ts < sinceSec) continue;
    total += (log.args.ethIn ?? log.args.ethOut) as bigint;
  }
  return Number(formatEther(total));
}

// ─── Creator's first buy (Snipe Tax section) ────────────────────
/** Tokens the creator bought in their own launch-block first buy, if any.
 * The creator's first buy always lands in the same block as creationBlock
 * (it happens inside the createToken transaction), so filtering Buy events
 * to that exact block + the creator's address isolates it precisely. */
export async function getCreatorFirstBuyTokens(
  token: Address,
  creator: Address,
  creationBlock: bigint
): Promise<bigint> {
  const logs = await robinhoodPublicClient.getLogs({
    address: RH_CONFIG.factory,
    event: BUY_EVENT,
    args: { token, buyer: creator },
    fromBlock: creationBlock,
    toBlock: creationBlock,
  });
  return (logs as any[]).reduce((sum, l) => sum + (l.args.tokensOut as bigint), 0n);
}

// ─── Holder rows (Holders table + avg hold score) ───────────────
export type HolderRow = { address: Address; balance: bigint; avgHoldDays: number };

export async function getHolderRows(token: Address): Promise<HolderRow[]> {
  const balances = await getTokenHolders(token);
  const holders = Array.from(balances.keys()) as Address[];
  if (holders.length === 0) return [];

  // No multicall3 on Robinhood Chain Testnet — fan out individual reads.
  // Reads getAvgHoldSeconds rather than getAvgHoldDays — the days version
  // floors to 0 for anyone who bought less than a day ago, which broke the
  // display for fresh holders. Converting to fractional days here keeps
  // formatHoldTime's existing minute/hour/day rendering unchanged.
  const results = await Promise.allSettled(
    holders.map((h) =>
      robinhoodPublicClient.readContract({
        address: RH_CONFIG.gate, abi: DIAMOND_GATE_ABI, functionName: "getAvgHoldSeconds", args: [h],
      })
    )
  );
  const rows = holders.map((h, i) => ({
    address: h,
    balance: balances.get(h.toLowerCase())!,
    avgHoldDays: results[i].status === "fulfilled" ? Number((results[i] as PromiseFulfilledResult<any>).value) / 86400 : 0,
  }));
  rows.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  return rows;
}

export function avgHoldDaysAcross(rows: HolderRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((a, r) => a + r.avgHoldDays, 0) / rows.length;
}

// ─── IPFS ────────────────────────────────────────────────────────
export function ipfsToHttp(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("ipfs://")) return `/ipfs/${url.slice(7).replace(/^ipfs\//, "")}`;
  return url;
}

// ─── Creator score ──────────────────────────────────────────────
/** Average (currentPrice / launchPrice) multiplier across every pool this
 * address has created. Returns score: null when they have no prior launches
 * (distinct from a 0x score — "First Launch", not "worthless creator"). */
export async function getCreatorScore(
  creator: Address,
  allTokens: Address[]
): Promise<{ score: number | null; tokenCount: number; sinceSec: number | null }> {
  const settled = await Promise.allSettled(
    allTokens.map((t) =>
      robinhoodPublicClient.readContract({
        address: RH_CONFIG.factory, abi: SWL444_FACTORY_ABI, functionName: "getPool", args: [t],
      })
    )
  );
  const own = settled
    .map((r, i) => ({ pool: r.status === "fulfilled" ? (r.value as any) : null, token: allTokens[i] }))
    .filter((x): x is { pool: any; token: Address } => !!x.pool && (x.pool.creator as string).toLowerCase() === creator.toLowerCase());

  if (own.length === 0) return { score: null, tokenCount: 0, sinceSec: null };

  const sinceSec = Math.min(...own.map((x) => Number(x.pool.createdAt)));

  const launchPriceEth = Number(formatEther(INIT_VIRTUAL_ETH)) / Number(formatEther(TOTAL_SUPPLY));
  const prices = await Promise.all(own.map((x) => getSpotPriceEth(x.pool)));
  const multipliers = prices.filter((p) => p > 0).map((p) => p / launchPriceEth);

  if (multipliers.length === 0) return { score: null, tokenCount: own.length, sinceSec };
  const score = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
  return { score, tokenCount: own.length, sinceSec };
}
