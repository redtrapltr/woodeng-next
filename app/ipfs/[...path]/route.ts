// app/ipfs/[...path]/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const ORIGIN = process.env.IPFS_ORIGIN ?? 'https://gateway.pinata.cloud';

function forwardHeaders(req: Request) {
  const h = new Headers();
  const range = req.headers.get('range');                 if (range) h.set('range', range);
  const inm   = req.headers.get('if-none-match');         if (inm)   h.set('if-none-match', inm);
  const ims   = req.headers.get('if-modified-since');     if (ims)   h.set('if-modified-since', ims);
  const accept= req.headers.get('accept');                if (accept)h.set('accept', accept);
  return h;
}
function filtered(up: Response) {
  const h = new Headers();
  for (const k of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','cache-control'])
    { const v = up.headers.get(k); if (v) h.set(k, v); }
  if (!h.has('content-type')) h.set('content-type','application/octet-stream');
  if (!h.has('cache-control') && up.ok) h.set('cache-control','public, max-age=31536000, immutable');
  h.set('x-robots-tag','noindex');
  return h;
}
const restPath = (p?: string[]) => (p ?? []).join('/').replace(/^ipfs\//i,'');


type Ctx = { params: Promise<{ path?: string[] }> };

async function proxy(req: Request, ctx: Ctx) {
  const { path } = await ctx.params; // ← await params
  const up = await fetch(`${ORIGIN}/ipfs/${restPath(path)}`, {
    headers: forwardHeaders(req),
  });
  return new Response(up.body, {
    status: up.status,
    statusText: up.statusText,
    headers: filtered(up),
  });
}

export async function GET(req: Request, ctx: Ctx) {
  return proxy(req, ctx);
}

export async function HEAD(req: Request, ctx: Ctx) {
  return proxy(req, ctx);
}

