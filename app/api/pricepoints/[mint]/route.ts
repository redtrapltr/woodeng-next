// app/api/pricepoints/[mint]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { mint: string } | Promise<{ mint: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  try {
    // params can be a Promise on newer Next canaries
    const p = (typeof (ctx as any)?.params?.then === 'function')
      ? await (ctx as any).params
      : (ctx as any).params || {};

    const mint = String(p?.mint ?? '').trim();
    if (!mint) return NextResponse.json({ error: 'mint required' }, { status: 400 });

    const url = new URL(_req.url);
    const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit') ?? 1000)));

    const { rows } = await pool.query(
      `
      SELECT ts, price_lamports
      FROM price_ticks
      WHERE meme_mint = $1
      ORDER BY ts ASC
      LIMIT $2
      `,
      [mint, limit]
    );

    const out = rows.map((r: any) => ({
      time: r.ts instanceof Date ? r.ts.toISOString() : String(r.ts),
      priceLamports: String(r.price_lamports),
    }));

    return NextResponse.json(out);
  } catch (e: any) {
    console.error('history error', e);
    return NextResponse.json({ error: 'history failed', detail: e?.message }, { status: 500 });
  }
}
