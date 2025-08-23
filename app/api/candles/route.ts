// app/api/candles/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET /api/candles?mint=<BASE58>&tf=5m|1h&limit=200
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mint = searchParams.get('mint');
    const tf = searchParams.get('tf') ?? '5m';
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 1000);

    if (!mint) return NextResponse.json({ error: 'mint is required' }, { status: 400 });

    const view = tf === '1h' ? 'price_1h' : 'price_5m';

    const { rows } = await pool.query(
      `SELECT bucket, open, high, low, close, trades
       FROM ${view}
       WHERE meme_mint = $1
       ORDER BY bucket DESC
       LIMIT $2`,
      [mint, limit]
    );

    // reverse to ascending time for charts
    rows.reverse();
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
