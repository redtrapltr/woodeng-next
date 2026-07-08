"use client";

import React from "react";
import Link from "next/link";

export default function TradeSoundMemesGuide() {
  return (
    <main style={{ maxWidth: 900, margin: "90px auto 60px", padding: "0 16px", color: "#e6e6ff" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>How to trade Sound Memes</h1>
      <p style={{ color: "#9aa0b6", marginBottom: 22 }}>
        Learn how to discover, buy, and sell tokens on Woodeng.
      </p>

      <div
        style={{
          border: "1px solid #232332",
          background: "#0f111a",
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
        }}
      >
        {/* Replace the src with your actual video file path */}
        <video
          controls
          style={{ width: "100%", borderRadius: 12, outline: "none" }}
          src="/videos/woo-how-to-buy-and-sell-sound-meme.mp4.mp4"

        />
      </div>

      <ol style={{ lineHeight: 1.7, fontSize: 16, paddingLeft: 18 }}>
        <li><strong>Browse Sound Memes:</strong> Use search or the Sound Memes page.</li>
        <li><strong>Open a meme:</strong> Review the card, liquidity, and activity.</li>
        <li><strong>Trade:</strong> Click Buy/Sell, set amount, approve in your wallet.</li>
        <li><strong>Track holdings:</strong> Your positions show up under your wallet and in-app.</li>
        <li><strong>Pro tip:</strong> Watch fees/liquidity on early bonding curve stages.</li>
      </ol>

      <div style={{ marginTop: 24 }}>
        <Link href="/sound-memes" style={{ color: "#a088fa", fontWeight: 700 }}>← Explore Sound Memes</Link>
      </div>
    </main>
  );
}
