"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";


import {
  Home, Waves, Music, ShieldCheck, User as UserIcon,
  Search as SearchIcon, ChevronRight, X
} from "lucide-react";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

/* ───── chain + program ids ─────────────────────────────────────────────── */
const DEVNET = new Connection("https://api.devnet.solana.com", "confirmed");
const AMM_PROGRAM_ID = new PublicKey("FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS");
const WOODENG_MINT = "CWMoq79uHDL8XgAfMLSP6kCwmu9WzgfxNJxBSLtqYEad";





/* ───── tiny icon for Sound Memes ───────────────────────────────────────── */
export function AnimatedSoundWaveIcon() {
  return (
    <span style={{ display: "inline-block", width: 28, height: 24, verticalAlign: "middle" }}>
      <svg width="28" height="24" viewBox="0 0 28 24" style={{ display: "block" }}>
        <rect className="bar" x="2" y="13" width="3" height="8" rx="1.5" style={{ animationDelay: "0s" }} />
        <rect className="bar" x="7" y="10" width="3" height="11" rx="1.5" style={{ animationDelay: "0.13s" }} />
        <rect className="bar" x="12" y="7" width="3" height="14" rx="1.5" style={{ animationDelay: "0.26s" }} />
        <rect className="bar" x="17" y="4" width="3" height="17" rx="1.5" style={{ animationDelay: "0.39s" }} />
        <rect className="moon-bar" x="22" y="14" width="3" height="7" rx="1.5" />
        <style>{`
          .bar { fill:#b8baff; opacity:.85; transform-origin:50% 100%; animation:barBounce 1.4s infinite; }
          @keyframes barBounce { 0%,100%{transform:scaleY(.4)} 30%{transform:scaleY(1)} 60%{transform:scaleY(.6)} 80%{transform:scaleY(.8)} }
          .moon-bar { fill:#b8baff; opacity:1; transform-origin:50% 100%; animation:moonGrow 2.1s cubic-bezier(.36,1.42,.49,.98) infinite; }
          @keyframes moonGrow { 0%{transform:scaleY(.6);fill:#b8baff} 60%{transform:scaleY(.9)} 85%{transform:scaleY(2.6);fill:#53ff53} 95%{transform:scaleY(2.9);fill:#13e858} 100%{transform:scaleY(.6);fill:#b8baff} }
        `}</style>
      </svg>
    </span>
  );
}

/* ───── helper types ────────────────────────────────────────────────────── */
type ResolvedKind =
  | { kind: "musicPool"; addr: PublicKey }
  | { kind: "soundMemeMint"; addr: PublicKey }
  | { kind: "unknown" };

type Suggestion = {
  key: string;
  href: string;
  title: string;
  badge: "Music NFT" | "Sound Meme" | "Search • Music" | "Search • Sound Memes";
  subtitle?: string;
  highPriority?: boolean;
};







export default function Header() {
  const wallet = useWallet();
  const router = useRouter();
  const pathname = usePathname();

  const [woodengBalance, setWoodengBalance] = useState<string>("0");

  // search state
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addrResult, setAddrResult] = useState<ResolvedKind>({ kind: "unknown" });

  // MOBILE drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);


  const searchRefMobile = useRef<HTMLInputElement | null>(null);

  const isOnSoundMemes = pathname?.startsWith("/sound-memes") ?? false;

  /* ───── WOODENG balance (devnet) ─────────────────────────────────────── */
  useEffect(() => {
    const run = async () => {
      if (!wallet.publicKey) return setWoodengBalance("0");
      try {
        const ata = await getAssociatedTokenAddress(new PublicKey(WOODENG_MINT), wallet.publicKey);
        const bal = await DEVNET.getTokenAccountBalance(ata);
        setWoodengBalance(
          (Number(bal.value.amount) / 10 ** bal.value.decimals).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })
        );
      } catch {
        setWoodengBalance("0");
      }
    };
    run();
  }, [wallet.publicKey]);


  useEffect(() => {
  if (mobileOpen) {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }
}, [mobileOpen]);




useEffect(() => {
  if (mobileOpen) {
    // small delay so the panel finishes sliding in
    const t = setTimeout(() => searchRefMobile.current?.focus(), 100);
    return () => clearTimeout(t);
  }
}, [mobileOpen]);



  /* ───── address detection (debounced + cached) ───────────────────────── */
  const cacheRef = useRef<Map<string, ResolvedKind>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPubkey = (s: string) => {
    try { new PublicKey(s); return true; } catch { return false; }
  };

  useEffect(() => {
    if (!query || !isPubkey(query.trim())) {
      setAddrResult({ kind: "unknown" });
      setLoading(false);
      return;
    }

    const q = query.trim();
    const cached = cacheRef.current.get(q);
    if (cached) {
      setAddrResult(cached);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const pk = new PublicKey(q);
        const withTimeout = <T,>(p: Promise<T>, ms = 1200) =>
          Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);
        const info = await withTimeout(DEVNET.getAccountInfo(pk));

        if (info?.owner?.equals(AMM_PROGRAM_ID)) {
          const res: ResolvedKind = { kind: "musicPool", addr: pk };
          cacheRef.current.set(q, res); setAddrResult(res);
        } else if (info?.owner?.equals(TOKEN_PROGRAM_ID)) {
          const res: ResolvedKind = { kind: "soundMemeMint", addr: pk };
          cacheRef.current.set(q, res); setAddrResult(res);
        } else {
          const res: ResolvedKind = { kind: "unknown" };
          cacheRef.current.set(q, res); setAddrResult(res);
        }
      } catch {
        setAddrResult({ kind: "unknown" });
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query]);

  /* ───── suggestions builder ──────────────────────────────────────────── */
  const suggestions: Suggestion[] = useMemo(() => {
    const q = query.trim();
    const looksLikeTicker = /^[a-z0-9]{2,6}$/i.test(q);
    if (!q) return [];

    const base: Suggestion[] = [
      {
        key: `search-soundmemes-${q}`,
        href: `/sound-memes?q=${encodeURIComponent(q)}`,
        title: `Search "${q}"`,
        subtitle: "by name, symbol, or address",
        badge: "Search • Sound Memes",
        highPriority: looksLikeTicker || isOnSoundMemes,
      },
      {
        key: `search-music-${q}`,
        href: `/marketplace?q=${encodeURIComponent(q)}`,
        title: `Search "${q}"`,
        subtitle: "by artist, song title, or address",
        badge: "Search • Music",
        highPriority: !isOnSoundMemes,
      },
    ];

    if (isPubkey(q)) {
      if (addrResult.kind === "musicPool") {
        base.unshift({
          key: `direct-music-${q}`,
          href: `/amm?addr=${q}`,
          title: `${q.slice(0, 4)}…${q.slice(-4)}`,
          subtitle: "Open Music pool",
          badge: "Music NFT",
          highPriority: true,
        });
      } else if (addrResult.kind === "soundMemeMint") {
        base.unshift({
          key: `direct-meme-${q}`,
          href: `/sound-memes?mint=${q}`,
          title: `${q.slice(0, 4)}…${q.slice(-4)}`,
          subtitle: "Open Sound Meme mint",
          badge: "Sound Meme",
          highPriority: true,
        });
      }
    }
    return base;
  }, [query, addrResult, isOnSoundMemes]);

  /* ───── submit behaviour ─────────────────────────────────────────────── */
  const onSubmit = () => {
    const q = query.trim();
    if (!q) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("woodeng:audio:stop-all"));
    }
    if (addrResult.kind === "musicPool") {
      router.push(`/amm?addr=${addrResult.addr.toBase58()}`); setMobileOpen(false); return;
    }
    if (addrResult.kind === "soundMemeMint") {
      router.push(`/sound-memes?mint=${addrResult.addr.toBase58()}`); setMobileOpen(false); return;
    }
    const top = suggestions.find((s) => s.highPriority) ?? suggestions[0];
    if (top) { router.push(top.href); setMobileOpen(false); }
  };

  /* ───── close mobile when route changes or Esc is pressed ───────────── */
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* layout styles */
  const headerContainer: React.CSSProperties = {
  width: "100%",
  background: "#0a0a12",
  borderBottom: "1px solid #1a1a22",
  position: "fixed",          // was "sticky"
  top: 0,
  left: 0,
  right: 0,
  zIndex: 60,                 // a bit higher than the drawer overlay
  boxSizing: "border-box",
};







  // contentWrapper: was "space-between"
const contentWrapper: React.CSSProperties = {
  width: "100%",
  margin: "0 auto",
  maxWidth: 1800,
  minHeight: 64,
  display: "flex",
  flexWrap: "nowrap",
  alignItems: "center",
  justifyContent: "flex-start",   // <- change
  padding: "10px 16px",
  gap: 12,
};




  const leftSection: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: "1 1 auto",
    gap: 12,
    flexWrap: "nowrap",
  };

  const searchWrapBase: React.CSSProperties = {
    position: "relative",
    flex: "1 1 360px",
    minWidth: 160,
    maxWidth: 560,
  };

  const navStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    minWidth: 0,
    flex: "0 1 auto",
    flexWrap: "nowrap",
    overflow: "hidden",
  };

  const createButtonStyle: React.CSSProperties = {
    background: "#a088fa",
    color: "white",
    padding: "10px 28px",
    borderRadius: "24px",
    fontWeight: 700,
    fontSize: "16px",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 16px 0 #a088fa1a",
    transition: "background 0.18s",
  };

  /* Reusable search box (desktop + mobile drawer share this) */
  /* Reusable search box (desktop + mobile drawer share this) */
const SearchBox = ({
  compact = false,
  inputRef,
}: {
  compact?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;

}) => (
  <div
    style={{
      ...searchWrapBase,
      flex: compact ? "1 1 auto" : (searchWrapBase as any).flex,
      maxWidth: compact ? undefined : searchWrapBase.maxWidth,
    }}
    onFocus={() => setOpen(true)}
    onBlur={() => setTimeout(() => setOpen(false), 120)}
  >
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}                            // << focusable on mobile
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, symbol, or address…"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        style={{
          background: "#181929",
          color: "#e6e6ff",
          border: "1px solid #232332",
          borderRadius: 14,
          padding: "8px 36px 8px 12px",
          width: "100%",
          fontSize: 14,
          outline: "none",
        }}
      />
      <button
        type="submit"
        aria-label="Search"
        title="Search"
        style={{
          position: "absolute",
          right: 6,
          top: 0,
          bottom: 0,
          margin: "auto",
          height: 30,
          width: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#b8baff",
        }}
      >
        <SearchIcon size={18} />
      </button>
    </form>

    {/* Suggestions dropdown */}
    {open && query.trim() && (
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: "#11131e",
          border: "1px solid #232332",
          borderRadius: 12,
          boxShadow: "0 8px 30px rgba(0,0,0,.4)",
          overflow: "hidden",
          zIndex: 50,
        }}
      >
        {loading && (
          <div
            style={{
              padding: "10px 14px",
              fontSize: 12,
              color: "#9aa0b6",
              borderBottom: suggestions.length ? "1px solid #232332" : undefined,
            }}
          >
            Checking address…
          </div>
        )}

        {suggestions.map((s) => (
          <Link href={s.href} key={s.key} legacyBehavior>
            <a
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                color: "#e6e6ff",
                textDecoration: "none",
                fontSize: 14,
                borderTop: "1px solid #191c29",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background:
                    s.badge === "Music NFT"
                      ? "#2b364c"
                      : s.badge === "Sound Meme"
                      ? "#2b3f2e"
                      : "#2b2b3b",
                  color:
                    s.badge === "Music NFT"
                      ? "#90b4ff"
                      : s.badge === "Sound Meme"
                      ? "#9af2a1"
                      : "#b8baff",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {s.badge}
              </span>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.title}
                </div>
                {s.subtitle && (
                  <div style={{ fontSize: 12, color: "#9aa0b6" }}>{s.subtitle}</div>
                )}
              </div>

              <ChevronRight size={16} style={{ opacity: 0.6 }} />
            </a>
          </Link>
        ))}
      </div>
    )}
  </div>
);


  return (
    <header style={headerContainer}>
      {/* global fixes */}
  <style jsx global>{`
    html, body { overflow-x: hidden; }
    @supports (padding: max(0px)) {
      .safe-top { padding-top: env(safe-area-inset-top); }
    }
  `}</style>
      {/* small CSS just to hide/show chunks responsively */}

      <style jsx>{`
  .hide-on-mobile { display: flex; }
  .show-on-mobile { display: none; }
  @media (max-width: 860px) {
    .hide-on-mobile { display: none !important; }
    .show-on-mobile { display: inline-flex !important; } /* <- inline-flex is safer here */
  }
  .menu-btn svg { display: block; }
`}</style>



      <div style={contentWrapper}>
        {/* Left: Logo, Search, Nav */}
        <div style={leftSection}>
          



          {mounted && (
  <button
    type="button"
    className="show-on-mobile menu-btn"
    aria-label="Open menu"
    aria-controls="mobile-drawer"
    aria-expanded={mobileOpen}
    onClick={() => setMobileOpen(true)}
    style={{
      position: "relative",
      zIndex: 120,
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
      borderRadius: 12,
      border: "1px solid #232332",
      background: "#181929",
      color: "#e6e6ff",
      cursor: "pointer",
    }}
  >
    <svg
  aria-hidden="true"
  width="20"
  height="20"
  viewBox="0 0 24 24"
  style={{ display: "block" }}
>
  <path
    d="M3 6h18M3 12h18M3 18h18"
    stroke="#e6e6ff"
    strokeWidth="2"
    strokeLinecap="round"
    fill="none"
  />
</svg>

  </button>
)}



          {/* Logo */}
          <img
  src="https://i.postimg.cc/hPSvz1KS/Woo-logo1.png"
  alt="" aria-hidden="true" draggable={false}
  style={{ height: 24, width: "auto", flexShrink: 0 }}
/>


          {/* Desktop search */}
          <div className="hide-on-mobile" style={{ flex: "1 1 auto" }}>
            <SearchBox />
          </div>

          {/* Desktop nav */}
          <nav className="hide-on-mobile" style={navStyle}>
            {[
              { href: "/", label: "Home", icon: <Home size={17} /> },
              { href: "/marketplace", label: "Market Place", icon: <Music size={17} /> },
              { href: "/sound-memes", label: "Sound Memes", icon: <AnimatedSoundWaveIcon /> },
              { href: "/staking", label: "Staking", icon: <ShieldCheck size={17} /> },
            ].map((item) => (
              <Link href={item.href} key={item.href} legacyBehavior>
                <a
                  style={{
                    color: "#e6e6ff",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    textDecoration: "none",
                    fontSize: 15,
                    padding: "0 2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.icon}
                  <span style={{ whiteSpace: "nowrap", marginLeft: 3 }}>{item.label}</span>
                </a>
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Create, WOODENG, Profile, Wallet (hidden on mobile) */}
        <div
  className="hide-on-mobile"
  style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0, marginLeft: "auto" }} // <- add marginLeft
>
          <Link href="/create" legacyBehavior>
            <a style={createButtonStyle}>+ Create</a>
          </Link>

          <div
            style={{
              background: "#232332",
              color: "#a088fa",
              fontWeight: 700,
              borderRadius: 16,
              padding: "7px 18px",
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
              }}
            >
              <UserIcon size={18} />
            </a>
          </Link>

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





      
<div
  aria-hidden={!mobileOpen}
  onClick={() => setMobileOpen(false)}
  className="show-on-mobile"
  style={{
    position: "fixed",
    inset: 0,
    background: mobileOpen ? "rgba(0,0,0,0.6)" : "transparent",
    transition: "background .18s ease",
    pointerEvents: mobileOpen ? "auto" : "none",
    zIndex: 50,                   // overlay above header
    overscrollBehaviorY: "contain",
  }}
>


<aside
  id="mobile-drawer"
  onClick={(e) => e.stopPropagation()}
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    height: "100dvh",
    width: "min(calc(100vw - 16px), 420px)",  // never wider than screen
    boxSizing: "border-box",
    background: "#0b0c14",
    borderRight: "1px solid #1a1a22",
    transform: `translate3d(${mobileOpen ? "0%" : "-100%"}, 0, 0)`, // GPU
    transition: "transform .22s ease",
    willChange: "transform",
    contain: "layout paint size",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "14px 14px 18px",
  }}
>


{/* drawer top bar (sticky) */}
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#0b0c14",
    paddingBottom: 10,
    marginBottom: 8,
    borderBottom: "1px solid #1a1a22",
  }}
>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
    <img src="/woodeng-logo.png" alt="" aria-hidden="true" draggable={false}
     style={{ height: 22, width: "auto", display: "block" }} />

    <button
      onClick={() => setMobileOpen(false)}
      aria-label="Close menu"
      style={{
        height: 40, width: 40, display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 12, border: "1px solid #232332", background: "#181929", color: "#e6e6ff",
      }}
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" style={{ display: "block" }}>
  <path d="M5 5L19 19M19 5L5 19" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
</svg>

    </button>
  </div>
</div>




{/* actions row ABOVE search */}
<div style={{ display: "flex", gap: 10, margin: "8px 0 6px" }}>
  <Link href="/profile" legacyBehavior>
    <a
      onClick={() => setMobileOpen(false)}
      aria-label="Your profile"
      style={{
        height: 44,
        width: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        background: "#181929",
        color: "#e6e6ff",
        border: "1px solid #232332",
        flex: "0 0 44px",
      }}
    >
      <UserIcon size={18} />
    </a>
  </Link>

  <WalletMultiButton
    style={{
      flex: 1,
      borderRadius: 12,
      background: "#a088fa",
      color: "#fff",
      padding: "10px 16px",
      fontWeight: 700,
      fontSize: "15px",
      lineHeight: 1,
    }}
  />
</div>



          {/* search (compact) */}
<SearchBox compact inputRef={searchRefMobile} />


          {/* section shortcuts (use hashes; add matching ids on target page) */}
          {isOnSoundMemes && (
            <div style={{ marginTop: 2 }}>
              <div style={{ color: "#8d92a8", fontSize: 12, margin: "8px 2px" }}>Sound Memes sections</div>
              {[
                { href: "/sound-memes#top-gainers", label: "Top Gainers (24h)" },
                { href: "/sound-memes#top-marketcap", label: "Top Market Cap" },
                { href: "/sound-memes#newest", label: "Newest" },
              ].map((it) => (
                <Link href={it.href} key={it.href} legacyBehavior>
                  <a
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: "block",
                      padding: "10px 10px",
                      color: "#e6e6ff",
                      textDecoration: "none",
                      border: "1px solid #1b1c26",
                      background: "#10121c",
                      borderRadius: 12,
                      marginBottom: 8,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {it.label}
                  </a>
                </Link>
              ))}
            </div>
          )}

          {/* main nav */}
          <div style={{ marginTop: 2 }}>
            <div style={{ color: "#8d92a8", fontSize: 12, margin: "8px 2px" }}>Navigate</div>
            {[
              { href: "/", label: "Home", icon: <Home size={17} /> },
              { href: "/marketplace", label: "Market Place", icon: <Music size={17} /> },
              { href: "/sound-memes", label: "Sound Memes", icon: <AnimatedSoundWaveIcon /> },
              { href: "/staking", label: "Staking", icon: <ShieldCheck size={17} /> },
            ].map((item) => (
              <Link href={item.href} key={item.href} legacyBehavior>
                <a
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    color: "#e6e6ff",
                    textDecoration: "none",
                    fontSize: 15,
                    border: "1px solid #1b1c26",
                    background: "#10121c",
                    borderRadius: 12,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  {item.icon}
                  <span style={{ marginLeft: 3 }}>{item.label}</span>
                </a>
              </Link>
            ))}
          </div>

          {/* user actions */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/create" legacyBehavior>
              <a
                onClick={() => setMobileOpen(false)}
                style={{
                  ...createButtonStyle,
                  display: "block",
                  textAlign: "center",
                  padding: "12px 20px",
                }}
              >
                + Create
              </a>
            </Link>

            <div
              style={{
                background: "#232332",
                color: "#a088fa",
                fontWeight: 700,
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
                letterSpacing: "0.01em",
              }}
            >
              <Waves size={18} style={{ color: "#a088fa" }} />
              {woodengBalance} WOODENG
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}
