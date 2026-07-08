// scripts/init-db.ts
// Creates the tables the API routes expect (see app/api/register-meme,
// app/api/pricepoints/*, app/api/amm/prices) against DATABASE_URL.
import { config } from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

config({ path: path.resolve(process.cwd(), '.env.local') });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS memes (
    meme_mint TEXT PRIMARY KEY,
    name TEXT,
    symbol TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS price_ticks (
    meme_mint TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    price_lamports NUMERIC NOT NULL,
    woodeng_decimals SMALLINT NOT NULL DEFAULT 9,
    tx_sig TEXT,
    volume_quote NUMERIC DEFAULT 0,
    PRIMARY KEY (meme_mint, ts)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_price_ticks_mint_ts ON price_ticks (meme_mint, ts DESC)`,
  `CREATE TABLE IF NOT EXISTS amm_music_prices (
    id SERIAL PRIMARY KEY,
    pool TEXT NOT NULL,
    price NUMERIC NOT NULL,
    quote TEXT NOT NULL DEFAULT 'TOKEN',
    ts TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'trade',
    tx TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_amm_music_prices_pool_ts ON amm_music_prices (pool, ts)`,
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (check .env.local)');
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  for (const sql of STATEMENTS) {
    await pool.query(sql);
    console.log('OK:', sql.trim().split('\n')[0]);
  }

  await pool.end();
  console.log('Schema initialized against', new URL(connectionString).host);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
