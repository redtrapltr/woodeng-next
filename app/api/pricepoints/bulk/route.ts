import { NextResponse } from 'next/server';

type PricePoint = { mint: string; priceLamports: number; at: number };

export async function POST(req: Request) {
  const { points } = (await req.json()) as { points?: PricePoint[] };

  const valid = (points ?? []).filter(p =>
    typeof p?.mint === 'string' &&
    Number.isFinite(p?.priceLamports) && p.priceLamports > 0 &&
    Number.isFinite(p?.at)
  );

  if (!valid.length) {
    return NextResponse.json({ ok: true, saved: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // TODO: do ONE batched DB write here (insertMany/upsert)
  // await db.pricepoints.bulkInsert(valid);

  return NextResponse.json(
    { ok: true, saved: valid.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
