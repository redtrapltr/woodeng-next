import { Pool } from 'pg';

let _pool: Pool | null = null;

function createPool() {
  const connectionString =
    process.env.TIGER_CLOUD_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'No DB connection string. Set TIGER_CLOUD_DATABASE_URL or DATABASE_URL in .env.local'
    );
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
}

export function getPool() {
  if (_pool) return _pool;
  _pool = createPool();
  return _pool;
}

export const pool = getPool();
