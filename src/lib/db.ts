import 'server-only';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function getDbUrl() {
  return (
    process.env.TIMESCALE_URL ||
    process.env.TIGER_CLOUD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ''
  );
}

export function getPool(): Pool {
  if (!global.__dbPool) {
    const url = getDbUrl();
    if (!url) {
      throw new Error(
        'No DB connection string. Set TIMESCALE_URL or TIGER_CLOUD_DATABASE_URL or DATABASE_URL.'
      );
    }
    global.__dbPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return global.__dbPool;
}
