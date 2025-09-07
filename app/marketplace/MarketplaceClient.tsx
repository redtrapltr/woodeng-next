'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { loadMarketNfts } from '@/lib/loadMarketNfts';
import { cn } from '@/lib/utils';
import { NFTCard } from './NFTCard';
import { Grid, List, ChevronDown, Package, Layers, LineChart } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { NFT } from '@/types/nft'; // add this import instead




// REPLACE your hasPool/getPoolAddr with this:
// ── pool/bundle presence detection ─────────────────────────────────────────────
const hasPool = (n: NFT) => {
  if ((n as any).hasPool !== undefined) return Boolean((n as any).hasPool);
  if ((n as any).poolPda || (n as any).poolAddress) return true;

  // cover bundle / alt shapes
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




// ADD this helper near the top:
const normToken = (t?: string) => {
  const x = (t || '').toLowerCase();
  if (x.startsWith('sol')) return 'sol';
  if (x.startsWith('wsol')) return 'sol';
  if (x.startsWith('sol-')) return 'sol';
  if (x.startsWith('woodeng')) return 'woodeng';
  return x; // fallback
};


const normType = (t?: string) => {
  const x = (t || '').toLowerCase();
  if (x.includes('bundle') || x.includes('vault')) return 'bundle';
  return 'single';
};




/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
export default function MarketplaceClient() {
  const router = useRouter();
  const { publicKey } = useWallet();

  const searchParams = useSearchParams();
  const queryRaw = (searchParams.get('q') || '').trim();
  const query = queryRaw.toLowerCase();

  const [nfts, setNfts] = useState<NFT[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'date' | 'price-asc' | 'price-desc' | 'popularity'>('date');
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
      document.querySelectorAll('audio').forEach((el) => {
        try { (el as HTMLAudioElement).pause(); (el as HTMLAudioElement).currentTime = 0; } catch {}
      });
      window.dispatchEvent(new Event('app:stop-audio'));
    };
    stopAll();
    return stopAll;
  }, [pathname]);

  useEffect(() => {
    (async () => {
      setNfts(await loadMarketNfts());
      setInitialLoading(false);
    })();
  }, []);

  const visibleNfts = useMemo(() => {
    const isAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
    const scoreOf = (n: NFT): number => {
      if (!query) return 0;
      const sym = String((n as any).symbol || (n as any).ticker || '').toLowerCase();
      const name = String(n.title || '').toLowerCase();
      let s = 0;
      if (sym) {
        if (sym === query) s += 1000;
        else if (sym.startsWith(query)) s += 800;
        else if (sym.includes(query)) s += 600;
      }
      if (name) {
        if (name === query) s += 500;
        else if (name.startsWith(query)) s += 300;
        else if (name.includes(query)) s += 200;
      }
      return s;
    };

    const pass1 = nfts.filter((n) => {
      if (filters.type.length && !filters.type.includes(normType((n as any).type))) return false;
      if (
  filters.token.length &&
  !filters.token.includes(normToken((n as any).tokenType) as 'sol' | 'woodeng')
) return false;
      if (filters.source === 'amm' && !hasPool(n)) return false;
      if (filters.source === 'direct' && hasPool(n)) return false;

      return true;
    });

    const filtered = query
      ? (isAddress(queryRaw)
          ? pass1.filter(n => n.mint === queryRaw || n.poolPda === queryRaw)
          : pass1.filter(n => scoreOf(n) > 0))
      : pass1;

    const byId = new Map<string, NFT>();
for (const n of filtered) {
  const prev = byId.get(n.id);
  if (!prev || (!hasPool(prev) && hasPool(n))) byId.set(n.id, n);
}


    const arr = [...byId.values()];
    arr.sort((a, b) => {
      const sa = scoreOf(a);
      const sb = scoreOf(b);
      if (sa !== sb) return sb - sa;
      switch (sort) {
        case 'date':       return +new Date(b.createdAt) - +new Date(a.createdAt);
        case 'popularity': return b.popularity - a.popularity;
        case 'price-asc':  return a.price[normToken((a as any).tokenType) as 'sol'|'woodeng'] - b.price[normToken((b as any).tokenType) as 'sol'|'woodeng'];
        case 'price-desc': return b.price[normToken((b as any).tokenType) as 'sol'|'woodeng'] - a.price[normToken((a as any).tokenType) as 'sol'|'woodeng'];
        default:           return 0;
      }
    });

    return arr;
  }, [nfts, filters, sort, query, queryRaw]);

  useEffect(() => {
    const stopAll = () => {
      document.querySelectorAll('audio').forEach((el) => {
        try { (el as HTMLAudioElement).pause(); (el as HTMLAudioElement).currentTime = 0; } catch {}
      });
      window.dispatchEvent(new Event('woodeng:audio:stop-all'));
    };
    stopAll();
    return stopAll;
  }, [pathname]);

  const pageNfts = visibleNfts.slice(0, page * 12);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (!busy && scrollTop + clientHeight >= scrollHeight - 4 && pageNfts.length < visibleNfts.length) {
      setBusy(true);
      setTimeout(() => { setPage((p) => p + 1); setBusy(false); }, 400);
    }
  };

const openCard = (n: NFT) => {
  const addr = getPoolAddr(n);
  if (addr) router.push(`/amm?addr=${addr}`);
  else router.push(`/nft/${n.mint || n.id}`);
};



  return (
    <>
      

      <div className="min-h-screen pt-20 pb-8">
        <Header view={view} setView={setView} />
        <Filters filters={filters} setFilters={setFilters} />

        <div
          onScroll={onScroll}
          className={cn(
            'container mx-auto px-6 mt-8 overflow-auto pr-1 no-scrollbar',
            view === 'grid' ? 'max-h-[calc(100vh-200px)]' : 'max-h-[calc(100vh-180px)]',
          )}
        >
          <div className={view === 'grid'
            ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'space-y-4'}
          >
            {pageNfts.map(n => (
              <NFTCard
                key={`${n.id}-${hasPool(n) ? 'pool' : 'nopool'}`}
                nft={n}
                view={view}
                onOpen={openCard}
                userPubkey={publicKey?.toBase58()}
              />
            ))}
          </div>

          {busy && (
            <div className="flex justify-center py-6">
              <span className="text-sm animate-pulse text-muted-foreground">Loading more…</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Header & Filters (client)                                         */
/* ------------------------------------------------------------------ */
const Header = ({
  view, setView,
}: { view: 'grid' | 'list'; setView: (v: 'grid' | 'list') => void; }) => (
  <div className="container mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
    <h1 className="text-4xl font-extrabold">NFT Marketplace</h1>
    <div className="flex gap-2">
      <button
        onClick={() => setView('grid')}
        className={cn('p-2 rounded-full', view === 'grid' ? 'bg-primary text-white' : 'bg-muted/10 hover:bg-muted/20')}
      >
        <Grid className="w-5 h-5" />
      </button>
      <button
        onClick={() => setView('list')}
        className={cn('p-2 rounded-full', view === 'list' ? 'bg-primary text-white' : 'bg-muted/10 hover:bg-muted/20')}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  </div>
);

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
          setFilters((f: any) => ({
            ...f,
            type: f.type.includes('single') ? f.type.filter((x: any) => x !== 'single') : [...f.type, 'single'],
          }))
        }
        icon={<Package className="w-4 h-4" />}
      >
        Single NFTs
      </FilterPill>

      <FilterPill
        active={filters.type.includes('bundle')}
        onClick={() =>
          setFilters((f: any) => ({
            ...f,
            type: f.type.includes('bundle') ? f.type.filter((x: any) => x !== 'bundle') : [...f.type, 'bundle'],
          }))
        }
        icon={<Layers className="w-4 h-4" />}
      >
        Bundles
      </FilterPill>

      <FilterPill
        active={filters.source === 'amm'}
        onClick={() => setFilters((f: any) => ({ ...f, source: f.source === 'amm' ? '' : 'amm' }))}
        icon={<LineChart className="w-4 h-4" />}
      >
        AMM Pools
      </FilterPill>

      <FilterPill
        active={filters.source === 'direct'}
        onClick={() => setFilters((f: any) => ({ ...f, source: f.source === 'direct' ? '' : 'direct' }))}
        icon={<Package className="w-4 h-4" />}
      >
        Direct Listings
      </FilterPill>

      <div ref={currencyRef} className="relative">
        <button
          onClick={() => setCurrencyOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition',
            currencyOpen || filters.token.length ? 'bg-[#232332] text-primary' : 'bg-muted/10 hover:bg-muted/20'
          )}
        >
          Currency
          <ChevronDown className={cn('w-4 h-4 transition-transform', currencyOpen ? 'rotate-0' : '-rotate-90')} />
        </button>

        {currencyOpen && (
          <div className="absolute z-50 mt-2 left-0 min-w-[160px] bg-[#2c2c33] rounded-lg shadow-lg py-1">
            {(['woodeng', 'sol'] as const).map(tok => (
              <div
                key={tok}
                onClick={() =>
                  setFilters((f: any) => ({
                    ...f,
                    token: f.token.includes(tok) ? f.token.filter((x: any) => x !== tok) : [...f.token, tok],
                  }))
                }
                className={cn(
                  'px-4 py-2 text-sm cursor-pointer flex items-center gap-2 select-none',
                  filters.token.includes(tok) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/20'
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

function FilterPill({
  active, onClick, children, icon,
}: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
      active ? 'bg-primary/10 text-primary' : 'bg-muted/10 hover:bg-muted/20')}
    >
      {icon}
      {children}
    </button>
  );
}
