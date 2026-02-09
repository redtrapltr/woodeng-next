'use client';

import Link from 'next/link';
import React from 'react';

export default function FundWalletGuide() {
  return (
    <main
      style={{
        padding: '16px',
        paddingTop: 96, // clear the fixed header
        maxWidth: 980,
        margin: '0 auto',
        color: '#e6e6ff',
      }}
    >
      {/* Title */}
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        Fund your wallet with SOL (mobile)
      </h1>
      <p style={{ color: '#9aa0b6', marginBottom: 20 }}>
        This short video shows how to add SOL to your wallet so you can swap it for WOODENG.
      </p>

      {/* Responsive video */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0f111a',
          border: '1px solid #232332',
        }}
      >
        <video
          controls
          playsInline
          preload="metadata"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            background: 'black',
          }}
          poster="/brand/video-poster.png" // optional: place a poster image in public/brand/
        >
          <source src="/videos/fund-wallet-mobile.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Steps (mobile-first) */}
      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Steps shown in the video</h2>
        <ol style={{ lineHeight: 1.6, paddingLeft: 18, color: '#cfd3ea' }}>
          <li>Open your wallet app on mobile (e.g., Phantom).</li>
          <li>Tap <strong>Buy</strong> or <strong>Add funds</strong>, choose a provider, and purchase <strong>SOL</strong>.</li>
          <li>Wait for the SOL to appear in your wallet (usually under a minute).</li>
          <li>Head to <strong>Woodeng → Sound Memes</strong> or the swap and use SOL to acquire <strong>WOODENG</strong>.</li>
        </ol>
      </section>

      {/* CTA row (sticky on small screens) */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 22,
          background: 'linear-gradient(180deg, rgba(10,10,18,0) 0%, #0a0a12 24%)',
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/guides/buy-woodeng" style={btnStyle('#181929', '#e6e6ff', '#232332')}>
            How to buy WOODENG
          </Link>
          <Link href="/sound-memes" style={btnStyle('#a088fa', '#fff')}>
            Go to Sound Memes
          </Link>
        </div>
      </div>
    </main>
  );
}

function btnStyle(bg: string, color: string, border?: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: 14,
    background: bg,
    color,
    textDecoration: 'none',
    fontWeight: 800,
    letterSpacing: '0.01em',
    border: border ? `1px solid ${border}` : 'none',
    flex: '1 1 220px',
  };
}
