// app/api/ohlc/[mint]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TF = '15m' | '30m' | '1h' | '4h' | '24h';
const TF_MS: Record<TF, number> = {
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h' : 60 * 60_000,
  '4h' : 4  * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};
const DAY_MS = 24 * 60 * 60 * 1000;

function bucketStartUTC(tMs: number, tf: TF): number {
  if (tf === '24h') return Math.floor(tMs / DAY_MS) * DAY_MS; // UTC midnight
  const ms = TF_MS[tf];
  return Math.floor(tMs / ms) * ms;
}

// --- tiny in-memory cache (15s TTL) ---
type Bar = { t:number;o:number;h:number;l:number;c:number;v:number };
type CacheEntry = { ts: number; data: Bar[] };
const CACHE_TTL_MS = 15_000;
const cache = (global as any).__ohlcCache ??= new Map<string, CacheEntry>();
const inflight = (global as any).__ohlcInflight ??= new Map<string, Promise<Bar[]>>();

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> } // 👈 await params
) {
  try {
    const { mint } = await ctx.params;                // ✅
    const m = String(mint || '').trim();
    if (!m) return NextResponse.json({ error: 'mint required' }, { status: 400 });

    const url   = new URL(req.url);
    const tf    = (url.searchParams.get('tf') as TF) || '1h';
    const limit = Math.min(2000, Math.max(10, Number(url.searchParams.get('limit') ?? 1000)));
    const key   = `${m}|${tf}|${limit}`;

    // serve from cache
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      return NextResponse.json(hit.data);
    }
    if (inflight.has(key)) {
      const data = await inflight.get(key)!;
      return NextResponse.json(data);
    }

    const p = (async (): Promise<Bar[]> => {
      const pool = getPool();

      // Only pull what we need for `limit` bars (+ a small buffer)
      const windowMs = TF_MS[tf] * (limit + 3);
      const sinceMs  = Date.now() - windowMs;

      const { rows } = await pool.query(
        `
        SELECT EXTRACT(EPOCH FROM ts)*1000 AS t_ms, price_lamports::numeric AS p_lamports
        FROM price_ticks
        WHERE meme_mint = $1
          AND ts >= to_timestamp($2/1000.0)
        ORDER BY ts ASC
        `,
        [m, sinceMs]
      );

      const pts = rows
        .map((r: any) => ({ t: Number(r.t_ms), p: Number(r.p_lamports) }))
        .filter(x => Number.isFinite(x.t) && Number.isFinite(x.p))
        .sort((a, b) => a.t - b.t);

      if (!pts.length) return [];

      // Build OHLC + gap-fill
      const bucketMs = TF_MS[tf];
      const firstB = bucketStartUTC(pts[0].t, tf);
      const lastB  = bucketStartUTC(pts[pts.length - 1].t, tf);

      const out: Bar[] = [];
      let i = 0;
      let lastClose = pts[0].p;

      for (let bt = firstB; bt <= lastB; bt += bucketMs) {
        let o = lastClose, h = lastClose, l = lastClose, c = lastClose, v = 0;
        let saw = false;
        while (i < pts.length && bucketStartUTC(pts[i].t, tf) === bt) {
          const p = pts[i].p;
          if (!saw) { o = p; h = p; l = p; c = p; saw = true; }
          else { if (p > h) h = p; if (p < l) l = p; c = p; }
          v++; lastClose = c; i++;
        }
        out.push({ t: bt, o, h, l, c, v });
      }

      const MAX = Math.min(2000, limit);
      const trimmed = out.length > MAX ? out.slice(-MAX) : out;

      cache.set(key, { ts: Date.now(), data: trimmed });
      return trimmed;
    })();

    inflight.set(key, p);
    const data = await p;
    inflight.delete(key);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('ohlc error', e);
    return NextResponse.json({ error: 'ohlc failed', detail: e?.message }, { status: 500 });
  }
}
