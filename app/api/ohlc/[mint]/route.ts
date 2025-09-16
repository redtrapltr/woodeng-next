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
  { params }: { params: { mint: string } }
) {
  const mint   = params.mint;
  const url    = new URL(req.url);
  const tf     = url.searchParams.get('tf')    ?? '15m';
  const limit  = Number(url.searchParams.get('limit') ?? '200');
  const cursor = url.searchParams.get('cursor'); // ISO timestamp or null
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

  const { rows } = await pool.query(sql, [mint, ts, limit]);

  rows.reverse(); // ascending by time
  return NextResponse.json(rows, { status: 200 });
}
