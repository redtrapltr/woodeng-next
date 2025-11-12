// app/ipfs/[...path]/route.ts

export const runtime = 'edge';

// ✅ Use a number literal (Next 15 requires this)
export const revalidate = 31536000; // 1 year in seconds

const ORIGIN = (process.env.IPFS_ORIGIN ?? 'https://gateway.pinata.cloud').replace(/\/$/, '');
const GW_TOKEN = process.env.PINATA_GATEWAY_TOKEN || '';

function forwardHeaders(req: Request) {
  const h = new Headers();
  const range  = req.headers.get('range');              if (range)  h.set('range', range);
  const inm    = req.headers.get('if-none-match');      if (inm)    h.set('if-none-match', inm);
  const ims    = req.headers.get('if-modified-since');  if (ims)    h.set('if-modified-since', ims);
  const accept = req.headers.get('accept');             if (accept) h.set('accept', accept);

  // only for personal Pinata gateways, not gateway.pinata.cloud
  if (GW_TOKEN && /mypinata\.cloud$/.test(new URL(ORIGIN).hostname)) {
    h.set('x-pinata-gateway-token', GW_TOKEN);
  }
  return h;
}

// Pass in the requested path so we can set a sensible Content-Type
function filtered(up: Response, urlPath?: string) {
  const h = new Headers();

  for (const k of [
    'content-type','content-length','content-range','accept-ranges',
    'etag','last-modified','cache-control'
  ]) {
    const v = up.headers.get(k);
    if (v) h.set(k, v);
  }

  if (!h.has('content-type')) {
    const u = (urlPath || '').toLowerCase();
    if (u.endsWith('.mp3'))      h.set('content-type', 'audio/mpeg');
    else if (u.endsWith('.m4a')) h.set('content-type', 'audio/mp4');
    else if (u.endsWith('.wav')) h.set('content-type', 'audio/wav');
    else                         h.set('content-type', 'application/octet-stream');
  }

  if (!h.has('accept-ranges')) h.set('accept-ranges', 'bytes');

  if (up.ok && !h.has('cache-control')) {
    h.set('cache-control', 'public, immutable, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400');
  }

  h.set('Access-Control-Allow-Origin', '*');
  h.set('Cross-Origin-Resource-Policy', 'cross-origin');
  h.set('Vary', 'Range, Origin, Accept-Encoding');
  h.set('x-robots-tag', 'noindex');

  return h;
}

const restPath = (p?: string[]) => (p ?? []).join('/').replace(/^ipfs\//i, '');

type Ctx = { params: Promise<{ path?: string[] }> };

async function fetchWithBackoff(url: string, init: RequestInit, tries = 3) {
  let res: Response | undefined;
  for (let i = 0; i < tries; i++) {
    res = await fetch(url, {
      ...init,
      cache: 'force-cache',
      next: { revalidate },
    });
    if (res.status !== 429) return res;
    await new Promise(r => setTimeout(r, 250 * (i + 1)));
  }
  return res!;
}

async function proxy(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const pathStr = restPath(path);

  const upstream = await fetchWithBackoff(
    `${ORIGIN}/ipfs/${pathStr}`,
    { method: req.method, headers: forwardHeaders(req) }
  );

  return new Response(req.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: filtered(upstream, pathStr),
  });
}

export async function GET(req: Request, ctx: Ctx)  { return proxy(req, ctx); }
export async function HEAD(req: Request, ctx: Ctx) { return proxy(req, ctx); }
