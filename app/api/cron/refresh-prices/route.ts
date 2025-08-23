// app/api/cron/refresh-prices/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// TODO: replace this with real on-chain pricing for each mint
async function getCurrentLamportsForMint(_mint: string): Promise<number | null> {
  // e.g. read your pool vaults or last trade price;
  // return lamports per 1 MEME (integer)
  return null;
}

export async function GET() {
  try {
    const { rows: memes } = await pool.query('SELECT meme_mint FROM memes');

    for (const m of memes) {
      const mint: string = m.meme_mint;
      const priceLamports = await getCurrentLamportsForMint(mint);
      if (priceLamports && priceLamports > 0) {
        await pool.query(
          `INSERT INTO price_ticks (ts, meme_mint, price_lamports, woodeng_decimals)
           VALUES (now(), $1, $2, 9)`,
          [mint, priceLamports]
        );
      }
    }

    return NextResponse.json({ ok: true, count: memes.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
