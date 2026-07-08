import 'server-only';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function getDbUrl() {
  return process.env.DATABASE_URL || '';
}

export function getPool(): Pool {
  if (!global.__dbPool) {
    const url = getDbUrl();
    if (!url) throw new Error('Missing DB URL');
    global.__dbPool = new Pool({
      connectionString: url,
      max: 3,                       // 👈 keep small on serverless/dev
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return global.__dbPool;
}
