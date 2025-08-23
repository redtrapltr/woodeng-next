import 'server-only';
import { Pool } from 'pg';

if (!process.env.TIMESCALE_URL) {
  throw new Error('Missing TIMESCALE_URL in env');
}

export const pool = new Pool({
  connectionString: process.env.TIMESCALE_URL,
  ssl: { rejectUnauthorized: false },
});
