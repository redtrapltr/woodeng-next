import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { pool } from '@/lib/pg'; // ← use the shared pool

const TABLE = (tf: string) =>
  tf === '30m' ? 'price_30m' :
  tf === '1h'  ? 'price_1h'  :
  tf === '4h'  ? 'price_4h'  :
  tf === '24h' ? 'price_24h' : 'price_15m';

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const tf     = url.searchParams.get('tf')    ?? '15m';
  const limit  = Number(url.searchParams.get('limit') ?? '120'); // bars per mint
  const cursor = url.searchParams.get('cursor');
  const mints  = (url.searchParams.get('mints') ?? '').split(',').filter(Boolean);

  if (!mints.length) return NextResponse.json({}, { status: 200 });

  const table = TABLE(tf);
  const ts = cursor ? new Date(cursor).toISOString() : new Date().toISOString();

  const sql = `
    WITH ranked AS (
      SELECT
        meme_mint,
        EXTRACT(EPOCH FROM bucket)*1000 AS t,
        open::float8  AS o,
        high::float8  AS h,
        low::float8   AS l,
        close::float8 AS c,
        trades::int   AS v,
        ROW_NUMBER() OVER (PARTITION BY meme_mint ORDER BY bucket DESC) AS rn
      FROM ${table}
      WHERE meme_mint = ANY($1::text[])
        AND bucket    < $2::timestamptz
    )
    SELECT meme_mint, t, o, h, l, c, v
    FROM ranked
    WHERE rn <= $3
    ORDER BY meme_mint, t ASC;
  `;

  const { rows } = await pool.query(sql, [mints, ts, limit]);

  const out: Record<string, any[]> = {};
  for (const r of rows) (out[r.meme_mint] ??= []).push({
    t: Number(r.t), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v
  });

  return NextResponse.json(out, { status: 200 });
}
