// app/api/pricepoints/bulk/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/pg';

type PricePoint = {
  mint: string;
  priceLamports: number | string;
  at: number;                       // ms since epoch
  tx_sig?: string | null;
  woodeng_decimals?: number;        // default 9
  volumeLamports?: number | string; // optional
};

export async function POST(req: Request) {
  const { points } = (await req.json()) as { points?: PricePoint[] };

  // Normalize + validate
  const valid = (points ?? [])
    .map(p => ({
      mint: String(p?.mint ?? '').trim(),
      at: new Date(Number(p?.at ?? 0)),                    // timestamptz
      price: String(p?.priceLamports ?? ''),               // numeric
      dec: Number.isFinite(p?.woodeng_decimals) ? Number(p!.woodeng_decimals) : 9,
      tx: p?.tx_sig ? String(p.tx_sig) : null,             // text (nullable)
      vol: p?.volumeLamports != null ? String(p.volumeLamports) : '0', // numeric
    }))
    .filter(p =>
      p.mint &&
      Number.isFinite(p.at.valueOf()) &&
      /^\d+(\.\d+)?$/.test(p.price)
    );

  if (!valid.length) {
    return NextResponse.json(
      { ok: true, saved: 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Bulk UPSERT via UNNEST
  // IMPORTANT: the WHERE clause after DO UPDATE ensures we only write if the row actually changes
  await pool.query(
    `
    INSERT INTO price_ticks
      (meme_mint, ts, price_lamports, woodeng_decimals, tx_sig, volume_quote)
    SELECT * FROM UNNEST (
      $1::text[],
      $2::timestamptz[],
      $3::numeric[],
      $4::smallint[],
      $5::text[],
      $6::numeric[]
    )
    ON CONFLICT (meme_mint, ts) DO UPDATE
      SET price_lamports   = EXCLUDED.price_lamports,
          woodeng_decimals = EXCLUDED.woodeng_decimals,
          -- accumulate volume when present; keeps idempotency on zero-volume repeats
          volume_quote     = COALESCE(price_ticks.volume_quote, 0) + COALESCE(EXCLUDED.volume_quote, 0),
          tx_sig           = COALESCE(EXCLUDED.tx_sig, price_ticks.tx_sig)
    WHERE
         EXCLUDED.price_lamports   IS DISTINCT FROM price_ticks.price_lamports
      OR EXCLUDED.woodeng_decimals IS DISTINCT FROM price_ticks.woodeng_decimals
      OR EXCLUDED.tx_sig           IS DISTINCT FROM price_ticks.tx_sig
      OR COALESCE(EXCLUDED.volume_quote, 0) <> 0
    `,
    [
      valid.map(v => v.mint),
      valid.map(v => v.at.toISOString()),
      valid.map(v => v.price),
      valid.map(v => v.dec),
      valid.map(v => v.tx),
      valid.map(v => v.vol),
    ]
  );

  return NextResponse.json(
    { ok: true, saved: valid.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
