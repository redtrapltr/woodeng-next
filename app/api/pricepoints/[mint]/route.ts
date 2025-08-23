import { NextResponse } from 'next/server';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Next 14/15: params must be awaited
export async function GET(req: Request, ctx: { params: Promise<{ mint: string }> }) {
  try {
    const { mint } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get('limit') ?? '2000');
    const limit = Math.min(Math.max(rawLimit, 1), 5000);

    const { rows } = await pool.query(
  `
  SELECT
    ts AS time,
    price_lamports AS "priceLamports"
  FROM price_ticks
  WHERE meme_mint = $1
  ORDER BY ts ASC
  LIMIT $2
  `,
  [mint, limit]
);

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('fetch error', e);
    return NextResponse.json({ error: 'fetch failed', detail: e?.message }, { status: 500 });
  }
}
