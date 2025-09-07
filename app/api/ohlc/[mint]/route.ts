// app/api/ohlc/[mint]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { pool } from '@/lib/pg';

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

export async function GET(req: NextRequest, ctx: { params: { mint: string } }) {
  try {
    const mint = String(ctx.params?.mint ?? '').trim();
    if (!mint) return NextResponse.json({ error: 'mint required' }, { status: 400 });

    const url   = new URL(req.url);
    const tf    = (url.searchParams.get('tf') as TF) || '1h';
    const limit = Math.min(2000, Math.max(10, Number(url.searchParams.get('limit') ?? 1000)));

    // 1) Load persisted ticks (ASC, UTC ms + lamports)
    const { rows } = await pool.query(
      `
      SELECT EXTRACT(EPOCH FROM ts)*1000 AS t_ms, price_lamports::numeric AS p_lamports
      FROM price_ticks
      WHERE meme_mint = $1
      ORDER BY ts ASC
      LIMIT $2
      `,
      [mint, limit * 50] // generous tick cap so we can aggregate down
    );
    const pts = rows
      .map((r: any) => ({ t: Number(r.t_ms), p: Number(r.p_lamports) }))
      .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.p))
      .sort((a, b) => a.t - b.t);

    if (!pts.length) return NextResponse.json([]);

    // 2) Build OHLC with gap-fill (flat candles when no trades)
    const bucketMs = TF_MS[tf];
    const firstB = bucketStartUTC(pts[0].t, tf);
    const lastB  = bucketStartUTC(pts[pts.length - 1].t, tf);

    const out: Array<{ t:number;o:number;h:number;l:number;c:number;v:number }> = [];
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

    // 3) Keep the newest N bars
    const MAX = Math.min(2000, limit);
    const trimmed = out.length > MAX ? out.slice(-MAX) : out;

    return NextResponse.json(trimmed);
  } catch (e: any) {
    console.error('ohlc error', e);
    return NextResponse.json({ error: 'ohlc failed', detail: e?.message }, { status: 500 });
  }
}
