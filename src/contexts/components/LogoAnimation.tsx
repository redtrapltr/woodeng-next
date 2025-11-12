"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Partner {
  name: string;
  logo: string;
  url: string;
}

export function LogoAnimation() {
  const [paused, setPaused] = useState(false);
  const [offset, setOffset] = useState(0); // occasional nudge via arrows
  const wrapRef = useRef<HTMLDivElement>(null);

  const partners: Partner[] = [
    { name: "DexTools",      logo: "https://i.postimg.cc/8P4222z9/Dextools-white.png",          url: "https://www.dextools.io/app/en/token/woodeng?t=1733133934991" },
    { name: "GeckoTerminal", logo: "https://i.postimg.cc/g055mhQ6/Variant-Color-Dark-BG-1.png", url: "https://www.geckoterminal.com/solana/pools/DDPNGS9UkdgNbdT2v6X1NwyWwhF4CdtVzuKVKXHSWCdY" },
    { name: "CoinGecko",     logo: "https://i.postimg.cc/BQXmQb5T/Variant-White.png",           url: "https://www.coingecko.com" },
    { name: "DexView",       logo: "https://i.postimg.cc/PfYwb8bf/dexview-white.webp",          url: "https://www.dexview.com/solana/83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5" },
    { name: "Raydium",       logo: "https://i.postimg.cc/KzFRJ0DZ/raydium.png",                 url: "https://raydium.io/swap/?inputMint=sol&outputMint=83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5" },
    { name: "Coinsult",      logo: "https://i.postimg.cc/LsfMnRfX/audit-by-coinsult.png",       url: "https://coinsult.net" },
    { name: "PinkSale",      logo: "https://i.postimg.cc/Dw2pxC15/pinksale.png",                url: "https://www.pinksale.finance" },
    { name: "DexScreener",   logo: "https://i.postimg.cc/yx9TqQSk/dexscreener.png",             url: "https://dexscreener.com/solana/ddpngs9ukdgnbdt2v6x1nwywwhf4cdtvzukvkxhswcdy" },
    { name: "CoinMarketCap", logo: "https://i.postimg.cc/X7m11YsY/coinmarketcap-white.png",     url: "https://coinmarketcap.com/dexscan/solana/DDPNGS9UkdgNbdT2v6X1NwyWwhF4CdtVzuKVKXHSWCdY/" },
  ];

  // duplicate inline for the seamless loop
  const loop = [...partners, ...partners];

  // pause on touch for iOS
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onStart = () => setPaused(true);
    const onEnd = () => setPaused(false);
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const nudge = (px: number) => {
    setPaused(true);
    setOffset((o) => o + px);
    // resume after a brief moment
    setTimeout(() => setPaused(false), 250);
  };

  return (
    <div className="w-full overflow-hidden py-16 md:py-24 bg-background">
      <div className="relative container mx-auto px-4">
        {/* gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* arrows */}
        <button
          onClick={() => nudge(-200)}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 p-2 bg-card/80 rounded-full"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => nudge(200)}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 p-2 bg-card/80 rounded-full"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* marquee */}
        <div
          ref={wrapRef}
          className="marquee"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          data-paused={paused ? "true" : "false"}
          style={
            {
              // feel free to tweak
              ["--dur" as any]: "28s",
              ["--offset" as any]: `${offset}px`,
            } as React.CSSProperties
          }
        >
          <div className="marquee__track">
            {loop.map((p, i) => (
              <a
                key={`${p.name}-${i}`}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bubble"
              >
                <div className="bubble__inner">
                  <img
                    src={p.logo}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="bubble__img"
                    style={{
                      transform: "translateZ(0)",
                      WebkitTransform: "translateZ(0)",
                    } as any}
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* explicit class names so styled-jsx always matches */}
      <style jsx>{`
        @keyframes marqueeX {
          from {
            transform: translate3d(var(--offset, 0), 0, 0);
          }
          to {
            transform: translate3d(calc(-50% + var(--offset, 0)), 0, 0);
          }
        }

        .marquee {
          position: relative;
          overflow: hidden;
          width: 100%;
          will-change: transform;
        }

        /* The moving track: a single row that contains two copies inline */
        .marquee__track {
          display: flex;
          gap: 4rem;
          width: max-content;                 /* never wraps into columns */
          animation: marqueeX var(--dur, 28s) linear infinite;
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* pause */
        .marquee[data-paused="true"] .marquee__track {
          animation-play-state: paused;
        }

        .bubble {
          flex: 0 0 auto;
          display: block;
        }
        .bubble__inner {
          width: 8rem;  /* w-32 */
          height: 8rem; /* h-32 */
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          border-radius: 9999px;
          background: color-mix(in srgb, var(--tw-bg-opacity) transparent 50%); /* safe fallback */
          background: var(--card, rgba(255,255,255,0.04));
          border: 1px solid rgba(255,255,255,0.12);
        }
        @media (min-width: 768px) {
          .bubble__inner { width: 10rem; height: 10rem; } /* md:w-40 h-40 */
        }
        .bubble__img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .marquee__track { animation: none; }
        }
      `}</style>
    </div>
  );
}
