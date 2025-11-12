"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { Container } from "../src/contexts/components/Container";
import { HeroSection } from "../src/contexts/components/HeroSection";
import { HowItWorks } from "../src/contexts/components/HowItWorks";
import { TokenPurchaseSection } from "../src/contexts/components/TokenPurchaseSection";
import { LogoAnimation } from "../src/contexts/components/LogoAnimation";
import { Footer } from "../src/contexts/components/Footer";
import { Music2, Sparkles, Coins } from "lucide-react";
// ⛔️ remove these
// import { useSearchParams, useRouter } from "next/navigation";
// import { Suspense } from "react";

type Feature = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: Music2,
    title: "Music NFTs",
    description:
      "Transform your music into unique digital assets with flexible pricing models. Choose between fixed royalties or dynamic AMM pools with permanently locked liquidity.",
  },
  {
    icon: Sparkles,
    title: "Sound Memes",
    description:
      "Create tokenized sound memes using the revolutionary SWL-444 standard. Choose liquidity pools or bonding curves with automatic migration to DEX at $44K market cap.",
  },
  {
    icon: Coins,
    title: "$WOODENG Token",
    description:
      "Stake tokens to earn 100% of platform fees from all transactions. Choose flexible staking or lock periods with yield bonuses up to 200% for 12-month commitment.",
  },
];


const toHttp = (u?: string) => {
  if (!u) return undefined;
  if (u.startsWith("ipfs://")) {
    const rest = u.slice(7).replace(/^ipfs\//, "");
    return `/ipfs/${rest}`;
  }
  return u;
};

type PanelItem = {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  price: number;
  market_cap: number;
  change_24h?: number;
};

function MCard({ item }: { item: PanelItem }) {
  const up = (item.change_24h ?? 0) >= 0;
  const hasChg = Number.isFinite(item.change_24h as number);
  const imgSrc =
    toHttp(item.image) ||
    toHttp((item as any).imageUrl) ||
    "https://placehold.co/160x160?text=No+Image";
  return (
    <Link
      href={`/sound-memes?mint=${item.mint}`}
      className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl p-4 flex gap-4 hover:border-[#7c3aed] transition-colors group"
    >
      <img src={imgSrc} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-bold truncate">{item.name}</div>
          <span className="text-xs bg-[#2b323c] px-2 py-0.5 rounded">{item.symbol}</span>
        </div>
        <div className="mt-1 text-sm">
          <span className="font-semibold text-[#ffc371]">
            {Number(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </span>
          <span className="text-[#ffc371]/80 ml-1">WOODENG</span>
        </div>
        {Number.isFinite(item.market_cap) && (
          <div className="text-xs text-[#adb] mt-1">
            MCAP: {Number(item.market_cap).toLocaleString(undefined, { maximumFractionDigits: 2 })} WOODENG
          </div>
        )}
        <div
          className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
            hasChg ? (up ? "bg-green-600/20 text-green-300" : "bg-red-600/20 text-red-300")
                   : "bg-[#2b323c] text-[#c9cbd6]"}`
          }
          title="24h change"
        >
          {hasChg ? (up ? "▲ " : "▼ ") : "— "}
          {hasChg ? Math.abs(item.change_24h as number).toFixed(2) + "%" : "24h"}
        </div>
      </div>
    </Link>
  );
}

function Home() {
  // ⛔️ remove needAuth
  // const searchParams = useSearchParams();
  // const needAuth = (searchParams?.get("need_auth") === "1");

  const [loading, setLoading] = useState(true);
  const didLoadOnce = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [trending, setTrending] = useState<PanelItem[]>([]);
  const [recent, setRecent] = useState<PanelItem[]>([]);
  const [topCap, setTopCap] = useState<PanelItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!mounted) return;
        setErr(null);
        setLoading(true);
        const r = await fetch(`/api/memes/home-panels?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as {
          trending: PanelItem[]; recentlyAdded: PanelItem[]; topMarketCap: PanelItem[];
        };
        const pickImg = (x: any) =>
          toHttp(x.image || x.imageUrl || x.logo || x.thumbnail || x.metadata?.image || x.image_uri);
        const normalize = (arr: any[] = []): PanelItem[] =>
          arr.map((x) => ({
            mint: x.mint,
            name: x.name,
            symbol: x.symbol,
            image: pickImg(x),
            price: Number(x.price ?? x.last_price ?? 0),
            market_cap: Number(x.market_cap ?? x.marketCap ?? 0),
            change_24h: Number(x.change_24h ?? x.change24h ?? x.pct_change_24h ?? 0),
          }));
        if (!mounted) return;
        setTrending(normalize(j.trending));
        setRecent(normalize(j.recentlyAdded));
        setTopCap(normalize(j.topMarketCap));
        didLoadOnce.current = true;
      } catch (e: any) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#101014] flex flex-col pt-20">
      {/* 🔥 PasswordModal removed; always show the homepage content */}
      <Container><HeroSection /></Container>
      <Container><HowItWorks /></Container>
      <Container><TokenPurchaseSection /></Container>

      {/* TRENDING */}
      <Container>
        <section className="my-16">
          <h2 className="text-3xl font-bold mb-6 text-white">Trending NFTs</h2>
          {err && <div className="text-red-400 mb-3">Error: {err}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading && !didLoadOnce.current
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl h-28 animate-pulse" />
                ))
              : trending.map((item) => <MCard key={item.mint} item={item} />)}
          </div>
          {!loading && trending.length === 0 && <p className="mt-3 text-sm text-[#9aa]">No data yet.</p>}
        </section>
      </Container>

      {/* RECENTLY ADDED */}
      <Container>
        <section className="my-16">
          <h2 className="text-3xl font-bold mb-6 text-white">Recently Added</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading && !didLoadOnce.current
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl h-28 animate-pulse" />
                ))
              : recent.map((item) => <MCard key={item.mint} item={item} />)}
          </div>
          {!loading && recent.length === 0 && <p className="mt-3 text-sm text-[#9aa]">No data yet.</p>}
        </section>
      </Container>

      {/* BIGGEST SOUND MEMES */}
      <Container>
        <section className="my-16">
          <h2 className="text-3xl font-bold mb-6 text-white">Biggest Sound Memes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading && !didLoadOnce.current
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl h-28 animate-pulse" />
                ))
              : topCap.map((item) => <MCard key={item.mint} item={item} />)}
          </div>
          {!loading && topCap.length === 0 && <p className="mt-3 text-sm text-[#9aa]">No data yet.</p>}
        </section>
      </Container>

      <Container>
        <section className="text-center space-y-4 md:space-y-6 my-16">
          <h2 className="text-xl md:text-3xl font-bold text-white">Ready to Join the Revolution?</h2>
          <p className="text-sm md:text-xl text-muted-foreground max-w-2xl mx-auto">
            SWL-444: The revolutionary token standard that merges fungible and non-fungible properties for any metadata-rich digital asset.
          </p>
        </section>
      </Container>

      <Container>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 my-16">
          {FEATURES.map((feat, i) => (
            <div key={i} className="border border-[#28283b] hover:border-2 hover:border-purple-400 transition-all duration-200 rounded-xl p-6 cursor-pointer group">
              <div className="p-2 md:p-3 bg-primary/10 rounded-lg w-fit mb-4 group-hover:bg-primary/20 transition-colors duration-200">
                <feat.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-white">{feat.title}</h3>
              <p className="text-sm text-muted-foreground">{feat.description}</p>
            </div>
          ))}
        </section>
      </Container>

      <LogoAnimation />
      <Footer />
    </div>
  );
}

// Keep Suspense wrapper if you want; it’s harmless now.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
