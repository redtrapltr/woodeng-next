// scripts/create-price-views.ts
// Neon (plain Postgres) has no continuous aggregates, so the OHLC rollups
// that app/api/ohlc/* and app/api/candles expect are recreated as plain
// views over price_ticks (schema: meme_mint, ts timestamptz, price_lamports).
import { config } from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

config({ path: path.resolve(process.cwd(), '.env.local') });

const BUCKETS: Record<string, string> = {
  price_5m: '5 minutes',
  price_15m: '15 minutes',
  price_30m: '30 minutes',
  price_1h: '1 hour',
  price_4h: '4 hours',
  price_24h: '24 hours',
};

function viewSql(name: string, interval: string) {
  return `
    CREATE OR REPLACE VIEW ${name} AS
    SELECT
      meme_mint,
      date_bin('${interval}', ts, TIMESTAMPTZ '2000-01-01') AS bucket,
      (ARRAY_AGG(price_lamports ORDER BY ts ASC))[1]  AS open,
      MAX(price_lamports)                              AS high,
      MIN(price_lamports)                              AS low,
      (ARRAY_AGG(price_lamports ORDER BY ts DESC))[1] AS close,
      COUNT(*)                                         AS trades
    FROM price_ticks
    GROUP BY meme_mint, date_bin('${interval}', ts, TIMESTAMPTZ '2000-01-01')
  `;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (check .env.local)');
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  for (const [name, interval] of Object.entries(BUCKETS)) {
    await pool.query(viewSql(name, interval));
    console.log('OK:', name);
  }

  await pool.end();
  console.log('Price rollup views created against', new URL(connectionString).host);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
