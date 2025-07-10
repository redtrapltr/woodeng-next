"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Partner {
  name: string;
  logo: string;
  url: string;
}

export function LogoAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const partners: Partner[] = [
    {
      name: "DexTools",
      logo: "https://i.postimg.cc/8P4222z9/Dextools-white.png",
      url: "https://www.dextools.io/app/en/token/woodeng?t=1733133934991",
    },
    {
      name: "GeckoTerminal",
      logo: "https://i.postimg.cc/g055mhQ6/Variant-Color-Dark-BG-1.png",
      url: "https://www.geckoterminal.com/solana/pools/DDPNGS9UkdgNbdT2v6X1NwyWwhF4CdtVzuKVKXHSWCdY",
    },
    {
      name: "CoinGecko",
      logo: "https://i.postimg.cc/BQXmQb5T/Variant-White.png",
      url: "https://www.coingecko.com",
    },
    {
      name: "DexView",
      logo: "https://i.postimg.cc/PfYwb8bf/dexview-white.webp",
      url: "https://www.dexview.com/solana/83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5",
    },
    {
      name: "Raydium",
      logo: "https://i.postimg.cc/KzFRJ0DZ/raydium.png",
      url: "https://raydium.io/swap/?inputMint=sol&outputMint=83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5",
    },
    {
      name: "Coinsult",
      logo: "https://i.postimg.cc/LsfMnRfX/audit-by-coinsult.png",
      url: "https://coinsult.net",
    },
    {
      name: "PinkSale",
      logo: "https://i.postimg.cc/Dw2pxC15/pinksale.png",
      url: "https://www.pinksale.finance",
    },
    {
      name: "DexScreener",
      logo: "https://i.postimg.cc/yx9TqQSk/dexscreener.png",
      url: "https://dexscreener.com/solana/ddpngs9ukdgnbdt2v6x1nwywwhf4cdtvzukvkxhswcdy",
    },
    {
      name: "CoinMarketCap",
      logo: "https://i.postimg.cc/X7m11YsY/coinmarketcap-white.png",
      url: "https://coinmarketcap.com/dexscan/solana/DDPNGS9UkdgNbdT2v6X1NwyWwhF4CdtVzuKVKXHSWCdY/",
    },
  ];

  const allPartners = [...partners, ...partners];

  // measure widths & animate
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const update = () => {
      setContainerWidth(c.parentElement?.clientWidth || 0);
      setContentWidth(c.scrollWidth / 2);
    };
    update();
    window.addEventListener("resize", update);

    let raf: number;
    const speed = 1.2;
    const loop = () => {
      if (!isHovered) {
        setPosition((p) => (p + speed >= contentWidth ? 0 : p + speed));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, [contentWidth, isHovered]);

  const slide = (delta: number) =>
    setPosition((p) => {
      let nxt = p + delta;
      if (nxt < 0) nxt = contentWidth - (Math.abs(nxt) % contentWidth);
      if (nxt >= contentWidth) nxt = nxt % contentWidth;
      return nxt;
    });

  return (
    <div className="w-full overflow-hidden py-16 md:py-24 bg-background">
      <div className="relative container mx-auto px-4">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10"/>
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10"/>

        <button
          onClick={() => slide(-200)}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 p-2 bg-card/80 rounded-full"
        >
          <ChevronLeft className="w-6 h-6"/>
        </button>
        <button
          onClick={() => slide(200)}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 p-2 bg-card/80 rounded-full"
        >
          <ChevronRight className="w-6 h-6"/>
        </button>

        <div
          ref={containerRef}
          className="flex items-center gap-16 transition-transform"
          style={{ transform: `translateX(-${position}px)` }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {allPartners.map((p, i) => (
            <a
              key={`${p.name}-${i}`}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 group relative"
            >
              <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center p-4 rounded-full bg-card/50 border border-border/50 group-hover:border-primary/30 group-hover:shadow-lg">
                <img
                  src={p.logo}
                  alt={p.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
