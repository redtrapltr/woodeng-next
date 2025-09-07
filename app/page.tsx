"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "../src/contexts/components/Container";
import { HeroSection } from "../src/contexts/components/HeroSection";
import { HowItWorks } from "../src/contexts/components/HowItWorks";
import { TokenPurchaseSection } from "../src/contexts/components/TokenPurchaseSection";
import { LogoAnimation } from "../src/contexts/components/LogoAnimation";
import { Footer } from "../src/contexts/components/Footer";
import { Music2, Sparkles, Coins } from "lucide-react";

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
  return (
    <Link
      href={`/sound-memes?mint=${item.mint}`}
      className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl p-4 flex gap-4 hover:border-[#7c3aed] transition-colors group"
    >
      <img
        src={item.image || "https://placehold.co/160x160?text=No+Image"}
        alt={item.name}
        className="w-20 h-20 rounded-xl object-cover"
      />
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
            MCAP:&nbsp;
            {Number(item.market_cap).toLocaleString(undefined, { maximumFractionDigits: 2 })} WOODENG
          </div>
        )}
        <div
          className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
            hasChg
              ? up
                ? "bg-green-600/20 text-green-300"
                : "bg-red-600/20 text-red-300"
              : "bg-[#2b323c] text-[#c9cbd6]"
          }`}
          title="24h change"
        >
          {hasChg ? (up ? "▲ " : "▼ ") : "— "}
          {hasChg ? Math.abs(item.change_24h as number).toFixed(2) + "%" : "24h"}
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const didLoadOnce = useRef(false); // ← prevents flicker on refresh
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

      // one-shot fetch; no interval
      const r = await fetch(`/api/memes/home-panels?ts=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const j = (await r.json()) as {
        trending: PanelItem[];
        recentlyAdded: PanelItem[];
        topMarketCap: PanelItem[];
      };

      if (!mounted) return;
      setTrending(j.trending ?? []);
      setRecent(j.recentlyAdded ?? []);
      setTopCap(j.topMarketCap ?? []);
    } catch (e: any) {
      if (mounted) setErr(e?.message || String(e));
    } finally {
      if (mounted) setLoading(false);
    }
  };

  load();               // ← fetch once on mount

  return () => { mounted = false; };   // ← no clearInterval needed
}, []);


  return (
    <div className="min-h-screen bg-[#101014] flex flex-col pt-20">
      {!authenticated && <PasswordModal onSuccess={() => setAuthenticated(true)} />}

      {authenticated && (
        <>
          <Container>
            <HeroSection />
          </Container>

            <Container>
              <HowItWorks />
            </Container>

            <Container>
              <TokenPurchaseSection />
            </Container>

          {/* TRENDING (Top 24h gainers) */}
          <Container>
            <section className="my-16">
              <h2 className="text-3xl font-bold mb-6 text-white">Trending NFTs</h2>
              {err && <div className="text-red-400 mb-3">Error: {err}</div>}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading && !didLoadOnce.current
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl h-28 animate-pulse"
                      />
                    ))
                  : trending.map((item) => <MCard key={item.mint} item={item} />)}
              </div>

              {!loading && trending.length === 0 && (
                <p className="mt-3 text-sm text-[#9aa]">No data yet.</p>
              )}
            </section>
          </Container>

          {/* RECENTLY ADDED */}
          <Container>
            <section className="my-16">
              <h2 className="text-3xl font-bold mb-6 text-white">Recently Added</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading && !didLoadOnce.current
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl h-28 animate-pulse"
                      />
                    ))
                  : recent.map((item) => <MCard key={item.mint} item={item} />)}
              </div>

              {!loading && recent.length === 0 && (
                <p className="mt-3 text-sm text-[#9aa]">No data yet.</p>
              )}
            </section>
          </Container>

          {/* SOUND MEMES (Top Market Cap) */}
          <Container>
            <section className="my-16">
              <h2 className="text-3xl font-bold mb-6 text-white">Biggest Sound Memes</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading && !didLoadOnce.current
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-[#1a1b20] border border-[#2b2d35] rounded-2xl h-28 animate-pulse"
                      />
                    ))
                  : topCap.map((item) => <MCard key={item.mint} item={item} />)}
              </div>

              {!loading && topCap.length === 0 && (
                <p className="mt-3 text-sm text-[#9aa]">No data yet.</p>
              )}
            </section>
          </Container>

          {/* READY TO GET STARTED */}
          <Container>
            <section className="text-center space-y-4 md:space-y-6 my-16">
              <h2 className="text-xl md:text-3xl font-bold text-white">Ready to Get Started?</h2>
              <p className="text-sm md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Mint your own music NFT and unleash your SPL404 Sound Meme in a single click
              </p>
            </section>
          </Container>

          {/* FEATURES GRID */}
          <Container>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 my-16">
              {[
                {
                  icon: Music2,
                  title: "Music NFTs",
                  description:
                    "Transform your music into unique digital assets. Set your own terms, earn royalties, and build direct relationships with fans.",
                },
                {
                  icon: Sparkles,
                  title: "Sound Memes",
                  description:
                    "Create viral sound memes as SPL404 NFTs. Leverage the power of social sharing while maintaining ownership and earning potential.",
                },
                {
                  icon: Coins,
                  title: "Woodeng Token",
                  description:
                    "Access exclusive features, participate in governance, and earn rewards through our native token ecosystem.",
                },
              ].map((feat, i) => (
                <div
                  key={i}
                  className="border border-[#28283b] hover:border-2 hover:border-purple-400 transition-all duration-200 rounded-xl p-6 cursor-pointer group"
                >
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
        </>
      )}
    </div>
  );
}

const PasswordModal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "ilovewoodeng") {
      setError("");
      onSuccess();
    } else {
      setError("Wrong password!");
    }
  };
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1c1ce] rounded-2xl p-8 flex flex-col items-center w-[400px] shadow-2xl border border-[#242426]"
      >
        <h2 className="text-3xl font-bold text-white mb-4">Enter Password</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full mb-4 px-4 py-2 rounded bg-[#18181b] border border-gray-700 text-white text-lg outline-none focus:ring focus:ring-primary/50"
        />
        <button
          type="submit"
          className="w-full py-2 bg-[#8b5cf6] rounded text-white text-lg font-semibold hover:bg-[#7c3aed] transition"
        >
          Submit
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </div>
  );
};
