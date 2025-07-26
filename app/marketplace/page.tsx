'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Grid,
  List,
  Play,
  Pause,
  Sparkles,
  ChevronDown,
  Package,
  Layers,
  LineChart,
} from 'lucide-react';

import { loadMarketNfts } from '@/lib/loadMarketNfts';
import { cn } from '@/lib/utils';
import { Web3Image, useAudio } from '@/contexts/components/Web3Media';
import { NFTCard } from './NFTCard';

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

/* helper */
const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${`${sec % 60}`.padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
export default function MarketplacePage() {
  const router = useRouter();
  const { publicKey } = useWallet();

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

  const [currencyOpen, setCurrencyOpen] = useState(false);

  /* -------------- fetch once ------------- */
  useEffect(() => {
    (async () => {
      setNfts(await loadMarketNfts()); // keep raw URLs – helpers will convert
      setInitialLoading(false);
    })();
  }, []);

  /* -------------- derived list ----------- */
  const visibleNfts = useMemo(() => {
    const filtered = nfts.filter((n) => {
      if (filters.type.length && !filters.type.includes(n.type)) return false;
      if (filters.token.length && !filters.token.includes(n.tokenType))
        return false;
      if (filters.source === 'amm' && !n.hasPool) return false;
      if (filters.source === 'direct' && n.hasPool) return false;
      return true;
    });

    /* keep pool listing if duplicate */
    const byId = new Map<string, NFT>();
    filtered.forEach((n) => {
      const existing = byId.get(n.id);
      if (!existing || (!existing.hasPool && n.hasPool)) byId.set(n.id, n);
    });

    return [...byId.values()].sort((a, b) => {
      switch (sort) {
        case 'date':
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        case 'popularity':
          return b.popularity - a.popularity;
        case 'price-asc':
          return a.price[a.tokenType] - b.price[b.tokenType];
        case 'price-desc':
          return b.price[b.tokenType] - a.price[a.tokenType];
      }
    });
  }, [nfts, filters, sort]);

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
        <Filters
          filters={filters}
          setFilters={setFilters}
          currencyOpen={currencyOpen}
          setCurrencyOpen={setCurrencyOpen}
        />

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

function Filters({
  filters,
  setFilters,
  currencyOpen,
  setCurrencyOpen,
}: any) {
  return (
    <div className="container mx-auto px-6 mt-6 flex flex-wrap gap-3">
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

      {/* currency */}
      <div
        className="relative"
        onMouseEnter={() => setCurrencyOpen(true)}
        onMouseLeave={() => setCurrencyOpen(false)}
      >
        <FilterPill
          active={!!filters.token.length}
          onClick={() => setCurrencyOpen((o: boolean) => !o)}
          icon={<ChevronDown className="w-4 h-4 -rotate-90" />}
        >
          Currency
        </FilterPill>

        {currencyOpen && (
          <div className="absolute mt-2 left-0 min-w-[150px] bg-popover border border-border rounded-lg shadow-lg py-1">
            {(['woodeng', 'sol'] as const).map((tok) => (
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
                    : 'hover:bg-muted/20',
                )}
              >
                {tok.toUpperCase()}
                {filters.token.includes(tok) && '✓'}
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-black/60 text-white">
      {children}
    </span>
  );
}
