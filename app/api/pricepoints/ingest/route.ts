import { NextResponse } from 'next/server';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// optional debug endpoint: proves the route exists
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST JSON here to insert a tick' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const mint = String(body.mint ?? '').trim();
    if (!mint) return NextResponse.json({ error: 'mint required' }, { status: 400 });

    const priceLamports = BigInt(body.priceLamports ?? 0);
    if (priceLamports <= 0n) return NextResponse.json({ error: 'priceLamports must be > 0' }, { status: 400 });

    const txSig = body.tx_sig ? String(body.tx_sig) : null;
    const woodengDecimals = Number.isFinite(body.woodeng_decimals) ? Number(body.woodeng_decimals) : 9;

    await pool.query(
      `
      INSERT INTO price_ticks (ts, meme_mint, price_lamports, woodeng_decimals, tx_sig)
      VALUES (now(), $1, $2::numeric, $3::smallint, $4)
      `,
      [mint, priceLamports.toString(), woodengDecimals, txSig]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('ingest error', e);
    return NextResponse.json({ error: 'ingest failed', detail: e?.message }, { status: 500 });
  }
}
