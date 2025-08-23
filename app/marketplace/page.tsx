'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';


import { loadMarketNfts } from '@/lib/loadMarketNfts';
import { cn } from '@/lib/utils';
import { NFTCard } from './NFTCard';
import { Grid, List, ChevronDown, Package, Layers, LineChart } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export type NFT = {
  id: string;
  mint?: string;
  poolPda?: string;
  title: string;
  imageUrl: string;
  audioUrl: string;
  price: { sol: number; woodeng: number; usd: number };
  status: 'available' | 'sold' | 'auction' | 'listed';
  seller?: string;            // ← NEW
  type: 'single' | 'bundle';
  tokenType: 'woodeng' | 'sol';
  nftType: 'music' | 'soundmeme';
  hasPool: boolean;
  popularity: number;
  createdAt: string;
  collection: {
    name: string;
    verified: boolean;
    floorPrice: number;
    volume24h: number;
  };
  metadata: {
    artist: string;
    genre: string;
    duration: number;
    style?: string;
    collection?: string;
    royalties?: number;
  };
};



/* ------------------------------------------------------------------ */
export default function MarketplacePage() {
  const router = useRouter();
  const { publicKey } = useWallet();



  const searchParams = useSearchParams();
const queryRaw = (searchParams.get('q') || '').trim();
const query    = queryRaw.toLowerCase();



  


  const [nfts, setNfts] = useState<NFT[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<
    'date' | 'price-asc' | 'price-desc' | 'popularity'
  >('date');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const [filters, setFilters] = useState<{
    type: ('single' | 'bundle')[];
    token: ('woodeng' | 'sol')[];
    source: '' | 'amm' | 'direct';
  }>({ type: [], token: [], source: '' });

  const pathname = usePathname();

  useEffect(() => {
  const stopAll = () => {
    // Pause & reset every <audio> on the page
    document.querySelectorAll('audio').forEach((el) => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
    });
    // Tell any custom audio players to stop
    window.dispatchEvent(new Event('app:stop-audio'));
  };

  stopAll();        // stop when arriving here
  return stopAll;   // also stop when leaving
}, [pathname]);

 

  /* -------------- fetch once ------------- */
  useEffect(() => {
    (async () => {
      setNfts(await loadMarketNfts()); // keep raw URLs – helpers will convert
      setInitialLoading(false);
    })();
  }, []);

/* -------------- derived list ----------- */
const visibleNfts = useMemo(() => {
  // lightweight Solana address check (no imports, no RPC)
  const isAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

  // scoring based ONLY on symbol/ticker and title/name
  const scoreOf = (n: NFT): number => {
    if (!query) return 0;

    // symbol/ticker (optional field; we check a few possible props)
    const sym = String((n as any).symbol || (n as any).ticker || '').toLowerCase();
    const name = String(n.title || '').toLowerCase();

    let s = 0;

    // symbol priority
    if (sym) {
      if (sym === query)            s += 1000;
      else if (sym.startsWith(query)) s += 800;
      else if (sym.includes(query))  s += 600;
    }

    // name/title secondary
    if (name) {
      if (name === query)             s += 500;
      else if (name.startsWith(query))  s += 300;
      else if (name.includes(query))   s += 200;
    }

    return s;
  };

  // 1) apply pills/switches first
  const filteredPass1 = nfts.filter((n) => {
    if (filters.type.length && !filters.type.includes(n.type)) return false;
    if (filters.token.length && !filters.token.includes(n.tokenType)) return false;
    if (filters.source === 'amm' && !n.hasPool) return false;
    if (filters.source === 'direct' && n.hasPool) return false;
    return true;
  });

  // 2) address-only or score filter
  const filtered = query
    ? (
        isAddress(queryRaw)
          ? filteredPass1.filter(n => n.mint === queryRaw || n.poolPda === queryRaw)
          : filteredPass1.filter(n => scoreOf(n) > 0)
      )
    : filteredPass1;

  // 3) collapse duplicates (prefer the pool listing)
  const byId = new Map<string, NFT>();
  for (const n of filtered) {
    const prev = byId.get(n.id);
    if (!prev || (!prev.hasPool && n.hasPool)) byId.set(n.id, n);
  }

  // 4) sort: best match first, then your chosen sort mode
  const arr = [...byId.values()];
  arr.sort((a, b) => {
    const sa = scoreOf(a);
    const sb = scoreOf(b);
    if (sa !== sb) return sb - sa;

    switch (sort) {
      case 'date':       return +new Date(b.createdAt) - +new Date(a.createdAt);
      case 'popularity': return b.popularity - a.popularity;
      case 'price-asc':  return a.price[a.tokenType] - b.price[b.tokenType];
      case 'price-desc': return b.price[b.tokenType] - a.price[a.tokenType];
      default:           return 0;
    }
  });

  return arr;
}, [nfts, filters, sort, query, queryRaw]);





useEffect(() => {
  const stopAll = () => {
    // Stop any <audio> tags (if you ever render some)
    document.querySelectorAll('audio').forEach((el) => {
      try { el.pause(); el.currentTime = 0; } catch {}
    });
    // Tell useAudio() players to stop too
    window.dispatchEvent(new Event('woodeng:audio:stop-all'));
  };

  stopAll();        // when arriving here
  return stopAll;   // and when leaving
}, [pathname]);



  const pageNfts = visibleNfts.slice(0, page * 12);

  /* -------------- scroll ----------------- */
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (
      !busy &&
      scrollTop + clientHeight >= scrollHeight - 4 &&
      pageNfts.length < visibleNfts.length
    ) {
      setBusy(true);
      setTimeout(() => {
        setPage((p) => p + 1);
        setBusy(false);
      }, 400);
    }
  };

  /* -------------- nav helper ------------- */
  const openCard = (n: NFT) => {
    if (n.hasPool && n.poolPda) router.push(`/amm?addr=${n.poolPda}`);
    else router.push(`/nft/${n.mint || n.id}`);
  };

  /* ------------------------------------------------------------------ */
  return (
    <>
      {initialLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1.5 overflow-hidden bg-transparent">
          <div className="h-full w-1/2 animate-[music_2s_linear_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>
      )}

      <div className="min-h-screen py-8">
        {/* ---------- header ---------- */}
        <Header view={view} setView={setView} />

        {/* ---------- filters ---------- */}
        <Filters filters={filters} setFilters={setFilters} />


        {/* ---------- list area ---------- */}
        <div
          onScroll={onScroll}
          className={cn(
            'container mx-auto px-6 mt-8 overflow-auto pr-1 no-scrollbar',
            view === 'grid'
              ? 'max-h-[calc(100vh-200px)]'
              : 'max-h-[calc(100vh-180px)]',
          )}
        >
          <div
            className={
              view === 'grid'
                ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'space-y-4'
            }
          >
            {pageNfts.map(n => (
  <NFTCard
    key={`${n.id}-${n.hasPool}`}
    nft={n}
    view={view}
    onOpen={openCard}
    userPubkey={publicKey?.toBase58()} 
  />
))}

          </div>

          {busy && (
            <div className="flex justify-center py-6">
              <span className="text-sm animate-pulse text-muted-foreground">
                Loading more…
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


/* ------------------------------------------------------------------ */
/*  Header & Filters                                                  */
/* ------------------------------------------------------------------ */
const Header = ({
  view,
  setView,
}: {
  view: 'grid' | 'list';
  setView: (v: 'grid' | 'list') => void;
}) => (
  <div className="container mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
    <h1 className="text-4xl font-extrabold">NFT Marketplace</h1>
    <div className="flex gap-2">
      <button
        onClick={() => setView('grid')}
        className={cn(
          'p-2 rounded-full',
          view === 'grid' ? 'bg-primary text-white' : 'bg-muted/10 hover:bg-muted/20',
        )}
      >
        <Grid className="w-5 h-5" />
      </button>
      <button
        onClick={() => setView('list')}
        className={cn(
          'p-2 rounded-full',
          view === 'list' ? 'bg-primary text-white' : 'bg-muted/10 hover:bg-muted/20',
        )}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  </div>
);

function Filters({ filters, setFilters }: any) {
  /* local state --------------------------------------------------- */
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement | null>(null);

  /* click-outside to close ---------------------------------------- */
  useEffect(() => {
    if (!currencyOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!currencyRef.current?.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [currencyOpen]);

  /* --------------------------------------------------------------- */
  return (
    <div className="container mx-auto px-6 mt-6 flex flex-wrap gap-3 relative z-40">
        {/* -------------- SINGLE ---------------- */}
    <FilterPill
      active={filters.type.includes('single')}
      onClick={() =>
        setFilters((f: any) => ({
          ...f,
          type: f.type.includes('single')
            ? f.type.filter((x: any) => x !== 'single')
            : [...f.type, 'single'],
        }))
      }
      icon={<Package className="w-4 h-4" />}
    >
      Single NFTs
    </FilterPill>

    {/* -------------- BUNDLE --------------- */}
    <FilterPill
      active={filters.type.includes('bundle')}
      onClick={() =>
        setFilters((f: any) => ({
          ...f,
          type: f.type.includes('bundle')
            ? f.type.filter((x: any) => x !== 'bundle')
            : [...f.type, 'bundle'],
        }))
      }
      icon={<Layers className="w-4 h-4" />}
    >
      Bundles
    </FilterPill>

    {/* -------------- AMM POOLS ------------ */}
    <FilterPill
      active={filters.source === 'amm'}
      onClick={() =>
        setFilters((f: any) => ({
          ...f,
          source: f.source === 'amm' ? '' : 'amm',
        }))
      }
      icon={<LineChart className="w-4 h-4" />}
    >
      AMM Pools
    </FilterPill>

    {/* -------------- DIRECT --------------- */}
    <FilterPill
      active={filters.source === 'direct'}
      onClick={() =>
        setFilters((f: any) => ({
          ...f,
          source: f.source === 'direct' ? '' : 'direct',
        }))
      }
      icon={<Package className="w-4 h-4" />}
    >
      Direct Listings
    </FilterPill>

      {/* ───────── Currency pill + dropdown ───────── */}
      <div ref={currencyRef} className="relative">
        {/* the pill itself */}
        <button
          onClick={() => setCurrencyOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition',
            currencyOpen || filters.token.length
              ? 'bg-[#232332] text-primary'        // solid grey when open / active
              : 'bg-muted/10 hover:bg-muted/20'
          )}
        >
          Currency
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform',
              currencyOpen ? 'rotate-0' : '-rotate-90'
            )}
          />
        </button>

        {/* the dropdown */}
        {currencyOpen && (
          <div
  className="absolute z-50 mt-2 left-0 min-w-[160px]
             bg-[#2c2c33]           /* same grey as wallet menu */
             rounded-lg shadow-lg py-1"
>

            {(['woodeng', 'sol'] as const).map(tok => (
              <div
                key={tok}
                onClick={() =>
                  setFilters((f: any) => ({
                    ...f,
                    token: f.token.includes(tok)
                      ? f.token.filter((x: any) => x !== tok)
                      : [...f.token, tok],
                  }))
                }
                className={cn(
                  'px-4 py-2 text-sm cursor-pointer flex items-center gap-2 select-none',
                  filters.token.includes(tok)
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/20'
                )}
              >
                {tok.toUpperCase()}
                {filters.token.includes(tok)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Tiny helpers                                                      */
/* ------------------------------------------------------------------ */
function FilterPill({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
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


