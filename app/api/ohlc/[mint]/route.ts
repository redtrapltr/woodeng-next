import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { pool } from '@/lib/pg'; // ← use the shared pool

const TABLE = (tf: string) =>
  tf === '30m' ? 'price_30m' :
  tf === '1h'  ? 'price_1h'  :
  tf === '4h'  ? 'price_4h'  :
  tf === '24h' ? 'price_24h' : 'price_15m';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const url    = new URL(req.url);
  const tf     = url.searchParams.get('tf')    ?? '15m';
// clamp the requested limit
const limitRaw = Number(url.searchParams.get('limit') ?? '200');
const limit    = Math.max(1, Math.min(2000, limitRaw));

const cursor = url.searchParams.get('cursor');
const table  = TABLE(tf);

  const ts = cursor ? new Date(cursor).toISOString() : new Date().toISOString();

  const sql = `
    SELECT
      EXTRACT(EPOCH FROM bucket)*1000 AS t,
      open::float8  AS o,
      high::float8  AS h,
      low::float8   AS l,
      close::float8 AS c,
      trades::int   AS v
    FROM ${table}
    WHERE meme_mint = $1
      AND bucket    < $2::timestamptz
    ORDER BY bucket DESC
    LIMIT $3
  `;

  try {
    const { rows } = await pool.query(sql, [mint, ts, limit]);
    rows.reverse(); // ascending by time
    return NextResponse.json(rows, { status: 200 });
  } catch (e: any) {
    // Rollup tables (price_15m/30m/1h/4h/24h) may not exist yet on this DB —
    // the frontend already falls back to client-built candles from raw
    // price_ticks when this returns empty, so degrade instead of 500ing.
    console.error(`[ohlc/${mint}] query failed (table: ${table}):`, e?.message ?? e);
    return NextResponse.json([], { status: 200 });
  }
}
