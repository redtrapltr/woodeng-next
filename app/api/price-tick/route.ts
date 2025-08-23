// app/api/price-tick/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { memeMint, priceLamports, txSig, decimals = 9 } = await req.json();
    if (!memeMint || typeof priceLamports !== 'number') {
      return NextResponse.json({ error: 'memeMint and priceLamports are required' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO price_ticks (ts, meme_mint, price_lamports, woodeng_decimals, tx_sig)
       VALUES (now(), $1, $2, $3, $4)`,
      [memeMint, priceLamports, decimals, txSig ?? null]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
