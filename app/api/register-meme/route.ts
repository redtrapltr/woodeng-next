// app/api/register-meme/route.ts
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
const pool = getPool();


export async function POST(req: Request) {
  try {
    const { memeMint, name, symbol } = await req.json();
    if (!memeMint) return NextResponse.json({ error: 'memeMint required' }, { status: 400 });

    await pool.query(
      `INSERT INTO memes (meme_mint, name, symbol)
       VALUES ($1, $2, $3)
       ON CONFLICT (meme_mint) DO NOTHING`,
      [memeMint, name ?? null, symbol ?? null]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
