/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import React, { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import {
  Home as HomeIcon,
  Library as LibraryIcon,
  Waves,
  Crown,
} from "lucide-react";

export default function Header() {
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Update isMobile state based on window width
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Wallet button styling
  const walletButtonStyle: React.CSSProperties = {
    whiteSpace: "nowrap",
    padding: "8px 16px",
    fontSize: "16px",
    marginLeft: isMobile ? "5px" : "10px",
  };

  // Header container: center content within a max-width
  const headerContainer: React.CSSProperties = {
    maxWidth: "1200px",
    width: "100%",
    margin: "0 auto",
    padding: "10px 20px",
    backgroundColor: "#000",
    boxSizing: "border-box",
  };

  // Button style for "+ Create"
  const createButtonStyle: React.CSSProperties = {
    backgroundColor: "#7c3aed", // A purple tone
    color: "white",
    padding: "8px 16px",
    borderRadius: "4px",
    textDecoration: "none",
    fontWeight: "bold",
    cursor: "pointer",
    border: "none",
  };

  // ------------------ DESKTOP LAYOUT ------------------
  if (!isMobile) {
    return (
      <header style={headerContainer}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* LEFT: Logo, Search, Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {/* Woodeng logo */}
            <img
              src="/hippo-logo.png"
              alt="Woodeng Logo"
              style={{ width: "50px", height: "50px", objectFit: "cover" }}
            />

            {/* Search bar */}
            <input
              type="text"
              placeholder="Search your tracks, collections..."
              style={{
                padding: "5px",
                outline: "none",
                border: "1px solid white",
                background: "black",
                color: "white",
                minWidth: "200px",
              }}
            />

            {/* Nav items (moved to the right of search via marginLeft: "auto") */}
            <nav
              style={{
                display: "flex",
                gap: "15px",
                marginLeft: "auto",
                alignItems: "center",
              }}
            >
              <Link href="/" legacyBehavior>
                <a
                  style={{
                    color: "white",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <HomeIcon size={16} />
                  <span>Home</span>
                </a>
              </Link>
              <Link href="/library" legacyBehavior>
                <a
                  style={{
                    color: "white",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <LibraryIcon size={16} />
                  <span>Library</span>
                </a>
              </Link>
              <Link href="/amm" legacyBehavior>
                <a
                  style={{
                    color: "white",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Waves size={16} />
                  <span>Pools</span>
                </a>
              </Link>
              <Link href="/premium" legacyBehavior>
                <a
                  style={{
                    color: "white",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Crown size={16} />
                  <span>Premium</span>
                </a>
              </Link>
            </nav>
          </div>

          {/* RIGHT: + Create, Wallet */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* + Create */}
            <Link href="/uploadYourMusic" legacyBehavior>
              <a style={createButtonStyle}>+ Create</a>
            </Link>

            {/* Wallet */}
            <WalletMultiButton style={walletButtonStyle} />
          </div>
        </div>
      </header>
    );
  }

  // ------------------ MOBILE LAYOUT ------------------
  return (
    <header style={headerContainer}>
      {/* TOP ROW: Logo, + Create, Wallet, Hamburger */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img
          src="/hippo-logo.png"
          alt="Woodeng Logo"
          style={{ width: "50px", height: "50px", objectFit: "cover" }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* + Create */}
          <Link href="/uploadYourMusic" legacyBehavior>
            <a style={createButtonStyle}>+ Create</a>
          </Link>

          {/* Wallet */}
          <WalletMultiButton style={walletButtonStyle} />

          {/* Hamburger Menu */}
          <div
            style={{ fontSize: "24px", cursor: "pointer", color: "white" }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </div>
        </div>
      </div>

      {/* If menu is open, show search + nav */}
      {menuOpen && (
        <div style={{ marginTop: "10px" }}>
          {/* Search bar */}
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Search your tracks, collections..."
              style={{
                width: "100%",
                padding: "5px",
                outline: "none",
                border: "1px solid white",
                background: "black",
                color: "white",
              }}
            />
          </div>

          {/* Nav items */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link href="/" legacyBehavior>
              <a
                style={{
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <HomeIcon size={16} />
                <span>Home</span>
              </a>
            </Link>
            <Link href="/library" legacyBehavior>
              <a
                style={{
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <LibraryIcon size={16} />
                <span>Library</span>
              </a>
            </Link>
            <Link href="/amm" legacyBehavior>
              <a
                style={{
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Waves size={16} />
                <span>Pools</span>
              </a>
            </Link>
            <Link href="/premium" legacyBehavior>
              <a
                style={{
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Crown size={16} />
                <span>Premium</span>
              </a>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
