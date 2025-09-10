// app/api/amm/prices/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';  // you already use @ -> src alias
const db = getPool();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pool  = searchParams.get('pool')?.trim();
  const limit = Math.min(Number(searchParams.get('limit') || 500), 2000);
  const from  = searchParams.get('from'); // optional ISO
  const to    = searchParams.get('to');   // optional ISO

  if (!pool) return NextResponse.json({ error: 'missing pool' }, { status: 400 });

  const params: any[] = [pool];
  let where = 'pool = $1';
  if (from) { params.push(from); where += ` and ts >= $${params.length}`; }
  if (to)   { params.push(to);   where += ` and ts <= $${params.length}`; }

  const { rows } = await db.query(
    `select ts, price::text as price, quote, source, tx
     from amm_music_prices
     where ${where}
     order by ts asc
     limit ${limit}`,
    params
  );

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'bad json' }, { status: 400 });

  const { pool, price, quote, ts, source, tx } = body;

  if (!pool || typeof price !== 'number' || !isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const iso = ts ? new Date(ts).toISOString() : new Date().toISOString();

  await db.query(
    `insert into amm_music_prices (pool, price, quote, ts, source, tx)
     values ($1, $2, $3, $4, coalesce($5,'trade'), $6)`,
    [pool, price, quote || 'TOKEN', iso, source, tx || null]
  );

  return NextResponse.json({ ok: true });
}
