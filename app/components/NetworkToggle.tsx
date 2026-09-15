"use client";

import React, { useState } from "react";
import { Feather } from "lucide-react";
import { useChainMode } from "../contexts/NetworkContext";

function SolanaMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ntSolGrad" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <path d="M5 21.5a1.4 1.4 0 0 1 1-.4h20.6c.9 0 1.3 1.1.7 1.7l-4.4 4.4a1.4 1.4 0 0 1-1 .4H1.3c-.9 0-1.3-1.1-.7-1.7Z" fill="url(#ntSolGrad)" />
      <path d="M5 4.4A1.4 1.4 0 0 1 6 4h20.6c.9 0 1.3 1.1.7 1.7l-4.4 4.4a1.4 1.4 0 0 1-1 .4H1.3c-.9 0-1.3-1.1-.7-1.7Z" fill="url(#ntSolGrad)" />
      <path d="M22.9 12.9a1.4 1.4 0 0 0-1-.4H1.3c-.9 0-1.3 1.1-.7 1.7l4.4 4.4a1.4 1.4 0 0 0 1 .4h20.6c.9 0 1.3-1.1.7-1.7Z" fill="url(#ntSolGrad)" />
    </svg>
  );
}

export default function NetworkToggle() {
  const { network, setNetwork } = useChainMode();
  const [pressed, setPressed] = useState(false);

  const onToggle = () => {
    setNetwork(network === "solana" ? "robinhood" : "solana");
    setPressed(true);
    setTimeout(() => setPressed(false), 180);
  };

  const isRobinhood = network === "robinhood";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isRobinhood}
      title={isRobinhood ? "Switch to Solana" : "Switch to Robinhood Chain"}
      className="nt-pill"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 148,
        height: 34,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        padding: 3,
        cursor: "pointer",
        flexShrink: 0,
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.12s ease",
      }}
    >
      <style jsx>{`
        .nt-thumb {
          position: absolute;
          top: 3px;
          bottom: 3px;
          width: calc(50% - 3px);
          border-radius: 999px;
          transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.28s ease;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
        }
        .nt-label {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          transition: color 0.2s ease;
        }
      `}</style>

      <div
        className="nt-thumb"
        style={{
          transform: isRobinhood ? "translateX(calc(100% + 3px))" : "translateX(0)",
          background: isRobinhood
            ? "linear-gradient(135deg, #00C805 0%, #00E676 100%)"
            : "linear-gradient(135deg, #a088fa 0%, #6b52ff 100%)",
        }}
      />

      <span className="nt-label" style={{ color: !isRobinhood ? "#fff" : "#8a8fa6" }}>
        <SolanaMark />
        Solana
      </span>
      <span className="nt-label" style={{ color: isRobinhood ? "#fff" : "#8a8fa6" }}>
        <Feather size={13} />
        Robinhood
      </span>
    </button>
  );
}
