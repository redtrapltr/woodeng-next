"use client";

import React from "react";
import Link from "next/link";

export default function BuyWoodengGuide() {
  return (
    <main style={{ maxWidth: 900, margin: "90px auto 60px", padding: "0 16px", color: "#e6e6ff" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>How to buy WOODENG</h1>
      <p style={{ color: "#9aa0b6", marginBottom: 22 }}>
        Short, practical walkthrough for newcomers. No crypto experience required.
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
          src="/videos/woo-how-to-buy-woodeng.mp4.mp4"

        />
      </div>

      <ol style={{ lineHeight: 1.7, fontSize: 16, paddingLeft: 18 }}>
        <li><strong>Install a wallet:</strong> We recommend Phantom.</li>
        <li><strong>Fund your wallet:</strong> Buy SOL on an exchange and withdraw to your Phantom address.</li>
        <li><strong>Open Woodeng:</strong> Connect wallet (top-right).</li>
        <li><strong>Buy WOODENG:</strong> Use the Buy flow and confirm in your wallet.</li>
        <li><strong>Verify balance:</strong> You’ll see WOODENG in the header and your wallet.</li>
      </ol>

      <div style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "#a088fa", fontWeight: 700 }}>← Back to home</Link>
      </div>
    </main>
  );
}
