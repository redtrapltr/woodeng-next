"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Home,
  Waves,
  Music,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Woodeng devnet mint address
const WOODENG_MINT = "CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad";

// Animated Sound Meme Icon
export function AnimatedSoundWaveIcon() {
  return (
    <span style={{ display: "inline-block", width: 28, height: 24, verticalAlign: "middle" }}>
      <svg width="28" height="24" viewBox="0 0 28 24" style={{ display: "block" }}>
        {/* Regular bars */}
        <rect className="bar" x="2"  y="13" width="3" height="8" rx="1.5" style={{ animationDelay: "0s" }} />
        <rect className="bar" x="7"  y="10" width="3" height="11" rx="1.5" style={{ animationDelay: "0.13s" }} />
        <rect className="bar" x="12" y="7"  width="3" height="14" rx="1.5" style={{ animationDelay: "0.26s" }} />
        <rect className="bar" x="17" y="4"  width="3" height="17" rx="1.5" style={{ animationDelay: "0.39s" }} />
        {/* Bullish/Meme bar */}
        <rect className="moon-bar" x="22" y="14" width="3" height="7" rx="1.5" />
        <style>
          {`
            .bar {
              fill: #b8baff;
              opacity: 0.85;
              transform-origin: 50% 100%;
              animation: barBounce 1.4s infinite;
            }
            @keyframes barBounce {
              0%,100% { transform: scaleY(0.4);}
              30% { transform: scaleY(1);}
              60% { transform: scaleY(0.6);}
              80% { transform: scaleY(0.8);}
            }
            .moon-bar {
              fill: #b8baff;
              opacity: 1;
              transform-origin: 50% 100%;
              animation: moonGrow 2.1s cubic-bezier(0.36,1.42,0.49,0.98) infinite;
            }
            @keyframes moonGrow {
              0%   { transform: scaleY(0.6); fill: #b8baff;}
              60%  { transform: scaleY(0.9); fill: #b8baff;}
              85%  { transform: scaleY(2.6); fill: #53ff53;} /* Green mooning */
              95%  { transform: scaleY(2.9); fill: #13e858;} /* Brighter green */
              100% { transform: scaleY(0.6); fill: #b8baff;}
            }
          `}
        </style>
      </svg>
    </span>
  );
}

export default function Header() {
  const [woodengBalance, setWoodengBalance] = useState<string>("0");
  const wallet = useWallet();

  // Fetch WOODENG balance on devnet
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet.publicKey) {
        setWoodengBalance("0");
        return;
      }
      try {
        const conn = new Connection("https://api.devnet.solana.com", "confirmed");
        const mint = new PublicKey(WOODENG_MINT);
        const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);
        const accountInfo = await conn.getTokenAccountBalance(ata);
        setWoodengBalance(
          (Number(accountInfo.value.amount) / Math.pow(10, accountInfo.value.decimals)).toLocaleString(undefined, { maximumFractionDigits: 8 })
        );
      } catch (e) {
        setWoodengBalance("0");
      }
    };
    fetchBalance();
  }, [wallet.publicKey]);

  // Navigation
  const navItems = [
    { href: "/", label: "Home", icon: <Home size={17} /> },
    { href: "/marketplace", label: "Market Place", icon: <Music size={17} /> },
    { href: "/sound-memes", label: "Sound Memes", icon: <AnimatedSoundWaveIcon /> },
    { href: "/amm", label: "Pool", icon: <Waves size={17} /> },
    { href: "/staking", label: "Staking", icon: <ShieldCheck size={17} /> },
  ];

  // Styling
  const headerContainer: React.CSSProperties = {
    width: "100vw",
    background: "#0a0a12",
    padding: "0",
    boxSizing: "border-box",
    borderBottom: "1px solid #1a1a22",
    position: "sticky",
    top: 0,
    zIndex: 20,
    left: 0,
    overflow: "hidden",
  };

  const contentWrapper: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    margin: "0 auto",
    maxWidth: 1800,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    boxSizing: "border-box",
    gap: 16,
  };

  const leftSection: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: "1 1 0",
    gap: 20,
  };

  const navStyle: React.CSSProperties = {
    display: "flex",
    gap: 24,
    minWidth: 0,
    whiteSpace: "nowrap",
    flex: "0 1 auto",
  };

  const createButtonStyle: React.CSSProperties = {
    background: "#a088fa",
    color: "white",
    padding: "10px 32px",
    borderRadius: "24px",
    fontWeight: 700,
    fontSize: "17px",
    border: "none",
    cursor: "pointer",
    marginRight: "10px",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 16px 0 #a088fa1a",
    transition: "background 0.18s",
  };

  return (
    <header style={headerContainer}>
      <div style={contentWrapper}>
        {/* Left: Logo, Search, Nav */}
        <div style={leftSection}>
          <img
            src="/hippo-logo.png"
            alt="Logo"
            style={{ width: 42, height: 42, objectFit: "cover", flexShrink: 0 }}
          />
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search..."
            style={{
              background: "#181929",
              color: "#b8baff",
              border: "none",
              borderRadius: 16,
              padding: "10px 24px",
              minWidth: 160,
              width: "100%",
              maxWidth: 340,
              fontSize: 17,
              outline: "none",
              marginRight: 6,
              flex: "1 1 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          />
          {/* Nav */}
          <nav style={navStyle}>
            {navItems.map((item) => (
              <Link href={item.href} key={item.href} legacyBehavior>
                <a
                  style={{
                    color: "#e6e6ff",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    textDecoration: "none",
                    fontSize: 16,
                    padding: "0 2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {item.icon}
                  <span style={{ whiteSpace: "nowrap", marginLeft: 3 }}>{item.label}</span>
                </a>
              </Link>
            ))}
          </nav>
        </div>
        {/* Right: Create, WOODENG, Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
          {/* Profile icon */}
          <Link href="/profile" legacyBehavior>
            <a
              title="Your profile"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#181929",
                color: "#e6e6ff",
                border: "1px solid #232332",
                transition: "background .18s",
              }}
            >
              <UserIcon size={18} />
            </a>
          </Link>
          <Link href="/create" legacyBehavior>
            <a style={createButtonStyle}>+ Create</a>
          </Link>
          {/* Woodeng Balance */}
          <div
            style={{
              background: "#232332",
              color: "#a088fa",
              fontWeight: 700,
              borderRadius: 16,
              padding: "7px 18px",
              marginRight: 8,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              minWidth: 110,
              maxWidth: 210,
            }}
          >
            <Waves size={18} style={{ color: "#a088fa" }} />
            {woodengBalance} WOODENG
          </div>
          <WalletMultiButton
            style={{
              borderRadius: 16,
              background: "#a088fa",
              color: "#fff",
              padding: "9px 30px",
              fontWeight: 700,
              fontSize: "16px",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
            }}
          />
        </div>
      </div>
    </header>
  );
}
