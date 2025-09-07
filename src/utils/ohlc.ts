// src/utils/ohlc.ts
export type Tick = { t: number; p: number };        // epoch ms + price
export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type Resolution =
  | '1m' | '5m' | '30m'
  | '1H' | '24H'
  | '7D' | '30D' | '1Y';

const SECS: Record<Resolution, number> = {
  '1m': 60,
  '5m': 60 * 5,
  '30m': 60 * 30,
  '1H': 60 * 60,
  '24H': 60 * 60 * 24,
  '7D': 60 * 60 * 24 * 7,
  '30D': 60 * 60 * 24 * 30,
  '1Y': 60 * 60 * 24 * 365,
};

export function bucketStartMs(tsMs: number, res: Resolution) {
  const size = SECS[res];
  return Math.floor((tsMs / 1000) / size) * size * 1000;
}

/** Build full candle series from ticks for a given resolution */
export function buildCandles(ticks: Tick[], res: Resolution): Candle[] {
  if (!ticks?.length) return [];
  const out: Candle[] = [];
  for (const tick of ticks) {
    const b = bucketStartMs(tick.t, res);
    const last = out[out.length - 1];
    if (!last || last.t !== b) {
      out.push({ t: b, o: tick.p, h: tick.p, l: tick.p, c: tick.p });
    } else {
      last.h = Math.max(last.h, tick.p);
      last.l = Math.min(last.l, tick.p);
      last.c = tick.p;
    }
  }
  return out;
}

/** Merge a *single incoming tick* into an existing candle array */
export function mergeTick(
  bars: Candle[],
  tick: Tick,
  res: Resolution
): { bars: Candle[]; latest: Candle } {
  const b = bucketStartMs(tick.t, res);
  const out = bars.slice();
  const last = out[out.length - 1];

  if (!last || last.t !== b) {
    const nc = { t: b, o: tick.p, h: tick.p, l: tick.p, c: tick.p };
    out.push(nc);
    return { bars: out, latest: nc };
  } else {
    last.h = Math.max(last.h, tick.p);
    last.l = Math.min(last.l, tick.p);
    last.c = tick.p;
    return { bars: out, latest: last };
  }
}
