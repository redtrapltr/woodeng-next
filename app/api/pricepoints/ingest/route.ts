// app/api/pricepoints/ingest/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// cache probe so we check the schema only once per server process
let HAS_VOLUME_COL: boolean | null = null;
async function hasVolumeColumn(): Promise<boolean> {
  if (HAS_VOLUME_COL != null) return HAS_VOLUME_COL;
  const r = await pool.query(
    `select 1
       from information_schema.columns
      where table_name='price_ticks'
        and column_name='volume_quote'
      limit 1`
  );
  HAS_VOLUME_COL = r.rowCount > 0;
  return HAS_VOLUME_COL;
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST JSON here to insert a tick' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // accept either `mint` or `memeMint`
    const mint = String(body.mint ?? body.memeMint ?? '').trim();
    if (!mint) return NextResponse.json({ error: 'mint required' }, { status: 400 });

    const priceLamports = BigInt(body.priceLamports ?? 0);
    if (priceLamports <= 0n) {
      return NextResponse.json({ error: 'priceLamports must be > 0' }, { status: 400 });
    }

    // client timestamp (milliseconds since epoch)
    const at = Number(body.at ?? Date.now());
    if (!Number.isFinite(at) || at <= 0) {
      return NextResponse.json({ error: 'invalid timestamp' }, { status: 400 });
    }

    const txSig = body.tx_sig ? String(body.tx_sig) : null;
    const woodengDecimals = Number.isFinite(body.woodeng_decimals)
      ? Number(body.woodeng_decimals)
      : 9;

    // optional volume in quote units (lamports)
    const volumeLamports =
      body.volumeLamports != null ? String(body.volumeLamports) : '0';

    if (await hasVolumeColumn()) {
      await pool.query(
        `
        INSERT INTO price_ticks
          (meme_mint, ts, price_lamports, woodeng_decimals, tx_sig, volume_quote)
        VALUES
          ($1, to_timestamp($2/1000.0), $3::numeric, $4::smallint, $5, $6::numeric)
        ON CONFLICT (meme_mint, ts) DO UPDATE
          SET price_lamports   = EXCLUDED.price_lamports,
              woodeng_decimals = EXCLUDED.woodeng_decimals,
              volume_quote     = COALESCE(price_ticks.volume_quote, 0) + COALESCE(EXCLUDED.volume_quote, 0),
              tx_sig           = COALESCE(EXCLUDED.tx_sig, price_ticks.tx_sig)
        `,
        [mint, at, priceLamports.toString(), woodengDecimals, txSig, volumeLamports]
      );
    } else {
      // older schema (no volume column)
      await pool.query(
        `
        INSERT INTO price_ticks
          (meme_mint, ts, price_lamports, woodeng_decimals, tx_sig)
        VALUES
          ($1, to_timestamp($2/1000.0), $3::numeric, $4::smallint, $5)
        ON CONFLICT (meme_mint, ts) DO UPDATE
          SET price_lamports   = EXCLUDED.price_lamports,
              woodeng_decimals = EXCLUDED.woodeng_decimals,
              tx_sig           = COALESCE(EXCLUDED.tx_sig, price_ticks.tx_sig)
        `,
        [mint, at, priceLamports.toString(), woodengDecimals, txSig]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('ingest error', e);
    return NextResponse.json({ error: 'ingest failed', detail: e?.message }, { status: 500 });
  }
}
