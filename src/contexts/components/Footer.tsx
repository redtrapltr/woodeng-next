"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, CheckCheck, ExternalLink } from "lucide-react";

const WOODENG_MINT = "83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5";
const JUPITER_SWAP = `https://jup.ag/swap/SOL-${WOODENG_MINT}`;

const NAV_COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "Sound Memes", href: "/sound-memes", external: false },
      { label: "Staking", href: "/staking", external: false },
      { label: "Profile", href: "/profile", external: false },
      { label: "Airdrop", href: "/airdrop", external: false },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Whitepaper", href: "/whitepaper", external: false },
      { label: "Start Here", href: "/start-here", external: false },
      { label: "Create Token", href: "/create", external: false },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Twitter / X", href: "https://x.com/Woodeng_SOL", external: true },
      { label: "Telegram", href: "https://t.me/woodeng_sol", external: true },
    ],
  },
  {
    heading: "Token",
    links: [
      { label: "Buy $WOODENG", href: JUPITER_SWAP, external: true },
      { label: "Solscan", href: `https://solscan.io/token/${WOODENG_MINT}`, external: true },
      { label: "Audit", href: "https://coinsult.net/projects/woodeng/", external: true },
      { label: "CoinGecko", href: "https://www.coingecko.com/en/coins/woodeng", external: true },
    ],
  },
];

export function Footer() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(WOODENG_MINT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <footer className="border-t border-border" style={{ background: "var(--surface)" }}>
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 footer-main-grid">

        {/* Brand */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">Woodeng</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                color: "var(--primary)",
                background: "rgba(141,125,195,0.12)",
                border: "1px solid rgba(141,125,195,0.25)",
                letterSpacing: "0.04em",
              }}
            >
              SWL-444
            </span>
          </div>
          <p className="text-xs text-muted-foreground">The SWL-444 Token Standard on Solana</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            Launch tokens with bonding curves, diamond-hand gates, and Meteora graduation.
          </p>
        </div>

        {/* Nav columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {NAV_COLUMNS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-2">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                {col.heading}
              </p>
              {col.links.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link flex items-center gap-1 text-sm text-muted-foreground"
                  >
                    {link.label}
                    <ExternalLink size={10} className="opacity-50" />
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="footer-link text-sm text-muted-foreground"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>

        {/* Contract address */}
        <div className="flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}
          >
            Contract Address
          </p>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <span
              className="font-mono text-xs break-all flex-1"
              style={{ color: "var(--primary)" }}
            >
              {WOODENG_MINT}
            </span>
            <button
              onClick={handleCopy}
              title="Copy address"
              className="flex-shrink-0 p-0.5 rounded transition-colors"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: copied ? "var(--success)" : "var(--muted-foreground)",
              }}
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t border-border"
        style={{ maxWidth: 1280, margin: "0 auto", padding: "0.75rem 1.5rem" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Woodeng Ecosystem. All rights reserved.
          </span>
          <span className="text-xs text-muted-foreground">
            Built on <span style={{ color: "var(--primary)", fontWeight: 600 }}>Solana</span>
          </span>
        </div>
      </div>

      <style>{`
        .footer-link { transition: color 0.15s; text-decoration: none; }
        .footer-link:hover { color: var(--primary) !important; }
        .footer-main-grid { grid-template-columns: 1fr; }
        @media (min-width: 768px) {
          .footer-main-grid { grid-template-columns: 200px 1fr 220px; }
        }
      `}</style>
    </footer>
  );
}

export default Footer;
