'use client';

import React, {
  useEffect, useMemo, useState, useRef,
  useDeferredValue, useTransition, useCallback, startTransition,
} from 'react';

import { useWallet } from '@solana/wallet-adapter-react';
import { loadMarketNfts } from '@/lib/loadMarketNfts';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { Grid, List, ChevronDown, Package, Layers, LineChart } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { NFT } from '@/types/nft';

import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';

const NFTCard = dynamic(() => import('./NFTCard').then(m => m.NFTCard), {
  ssr: false,
  loading: () => <div className="h-48 rounded-lg bg-muted/20 animate-pulse" />,
});

/* ----------------------- helpers ----------------------- */
const isAddressRE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const scoreSymHit = (sym: string, q: string) =>
  sym === q ? 1000 : sym.startsWith(q) ? 800 : sym.includes(q) ? 600 : 0;
const scoreNameHit = (name: string, q: string) =>
  name === q ? 500 : name.startsWith(q) ? 300 : name.includes(q) ? 200 : 0;

const hasPool = (n: NFT) => {
  if ((n as any).hasPool !== undefined) return Boolean((n as any).hasPool);
  if ((n as any).poolPda || (n as any).poolAddress) return true;
  const p =
    (n as any).pool ??
    (n as any).amm ??
    (n as any).bundle ??
    (n as any).bundlePda ??
    (n as any).bundleAddress ??
    (n as any).vault?.pool;
  if (!p) return false;
  if (typeof p === 'string') return p.length > 0;
  return Boolean(p.pda || p.address || p.addr || p.publicKey || p.pubkey || p.id);
};

const getPoolAddr = (n: NFT): string | undefined => {
  if ((n as any).poolPda) return (n as any).poolPda as string;
  if ((n as any).poolAddress) return (n as any).poolAddress as string;
  const p =
    (n as any).pool ??
    (n as any).amm ??
    (n as any).bundle ??
    (n as any).bundlePda ??
    (n as any).bundleAddress ??
    (n as any).vault?.pool;
  if (!p) return;
  if (typeof p === 'string') return p;
  return (p.pda || p.address || p.addr || p.publicKey || p.pubkey || p.id) as string | undefined;
};

const normToken = (t?: string) => {
  const x = (t || '').toLowerCase();
  if (x.startsWith('sol')) return 'sol';
  if (x.startsWith('wsol')) return 'sol';
  if (x.startsWith('sol-')) return 'sol';
  if (x.startsWith('woodeng')) return 'woodeng';
  return x;
};
const normType = (t?: string) => {
  const x = (t || '').toLowerCase();
  if (x.includes('bundle') || x.includes('vault')) return 'bundle';
  return 'single';
};

/* ---------------- Virtuoso grid wrappers ---------------- */
const GridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}
    />
  ),
);
GridList.displayName = 'GridList';

const GridItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} {...props} />,
);
GridItem.displayName = 'GridItem';

/* ---------------- Header & Filters ---------------- */
const Header = ({
  view, setView,
}: { view: 'grid' | 'list'; setView: (v: 'grid' | 'list') => void }) => (
  <div className="container mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
    <h1 className="text-4xl font-extrabold">NFT Marketplace</h1>
    <div className="flex gap-2">
      <button
        onClick={() => startTransition(() => setView('grid'))}
        className={cn('p-2 rounded-full', view === 'grid' ? 'bg-primary text-white' : 'bg-muted/10 hover:bg-muted/20')}
      >
        <Grid className="w-5 h-5" />
      </button>
      <button
        onClick={() => startTransition(() => setView('list'))}
        className={cn('p-2 rounded-full', view === 'list' ? 'bg-primary text-white' : 'bg-muted/10 hover:bg-muted/20')}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  </div>
);

function FilterPill({
  active, onClick, children, icon,
}: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
        active ? 'bg-primary/10 text-primary' : 'bg-muted/10 hover:bg-muted/20',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Filters({ filters, setFilters }: any) {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currencyOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!currencyRef.current?.contains(e.target as Node)) setCurrencyOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [currencyOpen]);

  return (
    <div className="container mx-auto px-6 mt-6 flex flex-wrap gap-3 relative z-40">
      <FilterPill
        active={filters.type.includes('single')}
        onClick={() =>
          startTransition(() =>
            setFilters((f: any) => ({
              ...f,
              type: f.type.includes('single') ? f.type.filter((x: any) => x !== 'single') : [...f.type, 'single'],
            })),
          )
        }
        icon={<Package className="w-4 h-4" />}
      >
        Single NFTs
      </FilterPill>

      <FilterPill
        active={filters.type.includes('bundle')}
        onClick={() =>
          startTransition(() =>
            setFilters((f: any) => ({
              ...f,
              type: f.type.includes('bundle') ? f.type.filter((x: any) => x !== 'bundle') : [...f.type, 'bundle'],
            })),
          )
        }
        icon={<Layers className="w-4 h-4" />}
      >
        Bundles
      </FilterPill>

      <FilterPill
        active={filters.source === 'amm'}
        onClick={() =>
          startTransition(() => setFilters((f: any) => ({ ...f, source: f.source === 'amm' ? '' : 'amm' })))
        }
        icon={<LineChart className="w-4 h-4" />}
      >
        AMM Pools
      </FilterPill>

      <FilterPill
        active={filters.source === 'direct'}
        onClick={() =>
          startTransition(() => setFilters((f: any) => ({ ...f, source: f.source === 'direct' ? '' : 'direct' })))
        }
        icon={<Package className="w-4 h-4" />}
      >
        Direct Listings
      </FilterPill>

      <div ref={currencyRef} className="relative">
        <button
          onClick={() => setCurrencyOpen((o) => !o)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition',
            currencyOpen || filters.token.length ? 'bg-[#232332] text-primary' : 'bg-muted/10 hover:bg-muted/20',
          )}
        >
          Currency
          <ChevronDown className={cn('w-4 h-4 transition-transform', currencyOpen ? 'rotate-0' : '-rotate-90')} />
        </button>

        {currencyOpen && (
          <div className="absolute z-50 mt-2 left-0 min-w-[160px] bg-[#2c2c33] rounded-lg shadow-lg py-1">
            {(['woodeng', 'sol'] as const).map((tok) => (
              <div
                key={tok}
                onClick={() =>
                  startTransition(() =>
                    setFilters((f: any) => ({
                      ...f,
                      token: f.token.includes(tok) ? f.token.filter((x: any) => x !== tok) : [...f.token, tok],
                    })),
                  )
                }
                className={cn(
                  'px-4 py-2 text-sm cursor-pointer flex items-center gap-2 select-none',
                  filters.token.includes(tok) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/20',
                )}
              >
                {tok.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Main component ---------------- */
export default function MarketplaceClient() {
  const router = useRouter();
  const { publicKey } = useWallet();

  const searchParams = useSearchParams();
  const queryRaw = (searchParams.get('q') || '').trim();
  const query = queryRaw.toLowerCase();

  const deferredQuery = useDeferredValue(query);
  const [isPending] = useTransition();

  const [nfts, setNfts] = useState<NFT[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'date' | 'price-asc' | 'price-desc' | 'popularity'>('date');

  const [filters, setFilters] = useState<{
    type: ('single' | 'bundle')[];
    token: ('woodeng' | 'sol')[];
    source: '' | 'amm' | 'direct';
  }>({ type: [], token: [], source: '' });

  const pathname = usePathname();

  useEffect(() => {
    const stopAll = () => {
      document.querySelectorAll('audio').forEach((el) => {
        try {
          (el as HTMLAudioElement).pause();
          (el as HTMLAudioElement).currentTime = 0;
        } catch {}
      });
      window.dispatchEvent(new Event('app:stop-audio'));
    };
    stopAll();
    return stopAll;
  }, [pathname]);

  useEffect(() => {
  const ac = new AbortController();
  let alive = true;

  (async () => {
    // 1) Try session cache first (instant)
    const cached = sessionStorage.getItem('marketNfts:v1');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as NFT[];
        if (alive && Array.isArray(parsed)) setNfts(parsed);
      } catch {}
    }

    // 2) Fetch fresh in the background (abort-aware) and refresh the cache
    try {
      const t0 = performance.now();
      const fresh = await loadMarketNfts({ signal: ac.signal }); // 👈 pass signal
      if (!alive || ac.signal.aborted) return;

      setNfts(fresh);
      try { sessionStorage.setItem('marketNfts:v1', JSON.stringify(fresh)); } catch {}
      // console.log('loadMarketNfts ms:', Math.round(performance.now() - t0));
    } catch (e) {
      if (ac.signal.aborted) return; // ignore aborted fetches
      console.error('loadMarketNfts failed', e);
    }
  })();

  return () => {
    alive = false;
    ac.abort(); // 👈 cancel in-flight RPC/metadata fetches
  };
}, []);



  const visibleNfts = useMemo(() => {
    const q = deferredQuery;
    const rawQ = queryRaw;

    const filteringByType = filters.type.length > 0;
    const filteringByToken = filters.token.length > 0;
    const filteringBySource = !!filters.source;
    const isAddress = !!rawQ && isAddressRE.test(rawQ);

    const scored: Array<{ nft: NFT; score: number; priceKey: 'sol' | 'woodeng' }> = [];

    for (const n of nfts) {
      if (filteringByType) {
        const t = normType((n as any).type);
        if (!filters.type.includes(t)) continue;
      }
      if (filteringByToken) {
        const tok = normToken((n as any).tokenType) as 'sol' | 'woodeng';
        if (!filters.token.includes(tok)) continue;
      }
      if (filteringBySource) {
        const pool = hasPool(n);
        if (filters.source === 'amm' && !pool) continue;
        if (filters.source === 'direct' && pool) continue;
      }

      let score = 0;
      if (q) {
        if (isAddress) {
          if (!((n.mint === rawQ) || ((n as any).poolPda === rawQ))) continue;
          score = 2000;
        } else {
          const sym = String((n as any).symbol || (n as any).ticker || '').toLowerCase();
          const name = String(n.title || '').toLowerCase();
          const s1 = sym ? scoreSymHit(sym, q) : 0;
          const s2 = name ? scoreNameHit(name, q) : 0;
          score = s1 + s2;
          if (score === 0) continue;
        }
      }

      const priceKey = (normToken((n as any).tokenType) as 'sol' | 'woodeng') ?? 'sol';
      scored.push({ nft: n, score, priceKey });
    }

    const bestById = new Map<string, { nft: NFT; score: number; priceKey: 'sol' | 'woodeng' }>();
    for (const item of scored) {
      const prev = bestById.get(item.nft.id);
      if (!prev) bestById.set(item.nft.id, item);
      else if (!hasPool(prev.nft) && hasPool(item.nft)) bestById.set(item.nft.id, item);
      else if (item.score > prev.score) bestById.set(item.nft.id, item);
    }

    const arr = Array.from(bestById.values());
    arr.sort((A, B) => {
      if (A.score !== B.score) return B.score - A.score;
      const a = A.nft, b = B.nft;
      switch (sort) {
        case 'date':       return +new Date(b.createdAt) - +new Date(a.createdAt);
        case 'popularity': return (b as any).popularity - (a as any).popularity;
        case 'price-asc':  return (a as any).price[A.priceKey] - (b as any).price[B.priceKey];
        case 'price-desc': return (b as any).price[B.priceKey] - (a as any).price[A.priceKey];
        default:           return 0;
      }
    });

    return arr.map((x) => x.nft);
  }, [nfts, filters, sort, deferredQuery, queryRaw]);

  const openCard = useCallback(
    (n: NFT) => {
      const addr = getPoolAddr(n);
      if (addr) router.push(`/amm?addr=${addr}`);
      else router.push(`/nft/${n.mint || n.id}`);
    },
    [router],
  );

  return (
    <>
      <div className="min-h-screen pt-28 md:pt-32 pb-8">
        <Header view={view} setView={setView} />
        <Filters filters={filters} setFilters={setFilters} />

        <div className="container mx-auto px-6 mt-8">
          {view === 'grid' ? (
            <VirtuosoGrid
              totalCount={visibleNfts.length}
              itemContent={(index: number) => (
                <NFTCard
                  key={visibleNfts[index].id}
                  nft={visibleNfts[index]}
                  view={view}
                  onOpen={openCard}
                  userPubkey={publicKey?.toBase58()}
                />
              )}
              components={{ List: GridList, Item: GridItem }}
              style={{ height: 'calc(100vh - 200px)' }}
            />
          ) : (
            <Virtuoso
  totalCount={visibleNfts.length}
  itemContent={(index: number) => (
    <NFTCard
      key={visibleNfts[index].id}
      nft={visibleNfts[index]}
      view={view}
      onOpen={openCard}
      userPubkey={publicKey?.toBase58()}
    />
  )}
  components={{
    List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      (props, ref) => <div ref={ref} {...props} className="space-y-4" />
    ),
    Item: (props) => <div {...props} className="w-full" />,
  }}
  style={{ height: 'calc(100vh - 180px)' }}
/>

          )}
        </div>
      </div>
    </>
  );
}
