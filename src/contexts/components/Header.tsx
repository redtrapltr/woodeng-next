
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useConnection } from '@solana/wallet-adapter-react';

import {
  Home,
  Waves,
  Gift,
  Music,
  ShieldCheck,
  User as UserIcon,
  Search as SearchIcon,
  ChevronRight,
  ChevronDown,
  Wallet as WalletIcon,
} from "lucide-react";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from '@solana/web3.js';



import { TOKEN_PROGRAM_ID } from "@solana/spl-token";



import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useWoodengBalanceLive } from '@/hooks/useWoodengBalanceLive';
import WalletPanel from "../../../app/components/WalletPanel";




/* ───── mobile breakpoint hook (avoid SSR flash) ───── */
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width:${breakpoint}px)`);
    const apply = () => setIsMobile(mql.matches);
    apply();
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else mql.addListener(apply);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", apply);
      else mql.removeListener(apply);
    };
  }, [breakpoint]);
  return isMobile;
}

/* ───── chain + program ids ─────────────────────────────────────────────── */


const AMM_PROGRAM_ID = new PublicKey("FU6vmNrLCqS5ewMhyW17ydwwY81RX6Tfn8bmbVDya1bS");
const WOODENG_MINT_PK = new PublicKey("83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5");


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

/* ───── SearchBox ──────────────────────────────────────────────────────── */
type SearchBoxProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  suggestions: Suggestion[];
  loading: boolean;
  compact?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onPickLink?: () => void;
};

const SearchBox: React.FC<SearchBoxProps> = React.memo(
  ({ value, onChange, onSubmit, suggestions, loading, compact = false, inputRef, onPickLink }) => {
    const [open, setOpen] = React.useState(false);
    const boxRef = React.useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const onDown = (e: MouseEvent | TouchEvent) => {
        if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown as any, { passive: true } as any);
      return () => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("touchstart", onDown as any);
      };
    }, []);

    return (
      <div
        ref={boxRef}
        style={{
          position: "relative",
          flex: compact ? "1 1 auto" : "1 1 360px",
          minWidth: 160,
          maxWidth: compact ? undefined : 560,
          zIndex: 61,
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            onSubmit();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search by name, symbol, or address…"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            style={{
              background: "#181929",
              color: "#e6e6ff",
              border: "1px solid #232332",
              borderRadius: 14,
              padding: "8px 36px 8px 12px",
              width: "100%",
              fontSize: compact ? 16 : 14, // iOS anti-zoom
              outline: "none",
            }}
          />

          <button
            type="submit"
            aria-label="Search"
            title="Search"
            onMouseDown={(e) => e.preventDefault()}
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

        {open && value.trim() && (
          <div
            tabIndex={-1}
            style={{
              position: "absolute",
              top: "100%",

              left: 0,
              right: 0,
              background: "#11131e",
              border: "1px solid #232332",
              borderRadius: 12,
              boxShadow: "0 8px 30px rgba(0,0,0,.4)",
              overflow: "hidden",
              zIndex: 70,
            }}
          >
            {loading && (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "#9aa0b6", borderBottom: "1px solid #232332" }}>
                Checking address…
              </div>
            )}

            {suggestions.map((s) => (
              <Link href={s.href} key={s.key}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onPickLink?.();
                }}
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
                        s.badge === "Music NFT" ? "#2b364c" : s.badge === "Sound Meme" ? "#2b3f2e" : "#2b2b3b",
                      color:
                        s.badge === "Music NFT" ? "#90b4ff" : s.badge === "Sound Meme" ? "#9af2a1" : "#b8baff",
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
                    {s.subtitle && <div style={{ fontSize: 12, color: "#9aa0b6" }}>{s.subtitle}</div>}
                  </div>

                  <ChevronRight size={16} style={{ opacity: 0.6 }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }
);

/* ───── Header ─────────────────────────────────────────────────────────── */
 const LOGO_H_DESKTOP = 68; // ↑ avant 36
 const LOGO_H_MOBILE  = 54; // ↑ avant ~2


/* ───── small helper to render a nav item that can be disabled ───── */
function NavItem({
  href,
  label,
  icon,
  disabled = false,
  onClick,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const baseStyle: React.CSSProperties = {
    color: "#e6e6ff",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 7,
    textDecoration: "none",
    fontSize: 15,
    padding: "0 2px",
    whiteSpace: "nowrap",
  };

  if (disabled) {
  return (
    <span
      className="ni"
      title="Coming soon"
      style={{ ...baseStyle, opacity: 0.6, cursor: "not-allowed" }}
      aria-disabled="true"
    >
      {icon}
      <span style={{ whiteSpace: "nowrap", marginLeft: 3 }}>{label}</span>
    </span>
  );
}

  return (
  <Link href={href!} className="ni" style={baseStyle} onClick={onClick}>
    {icon}
    <span style={{ whiteSpace: "nowrap", marginLeft: 3 }}>{label}</span>
  </Link>
);
}

/* mobile version (block-style button) */
function MobileNavItem({
  href,
  label,
  icon,
  disabled = false,
  onClick,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const itemStyle: React.CSSProperties = {
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
  };

  if (disabled) {
    return (
      <div
        title="Coming soon"
        style={{ ...itemStyle, opacity: 0.6, cursor: "not-allowed" }}
        aria-disabled="true"
      >
        {icon}
        <span style={{ marginLeft: 3 }}>{label}</span>
      </div>
    );
  }

  return (
    <Link href={href!} onClick={onClick} style={itemStyle}>
      {icon}
      <span style={{ marginLeft: 3 }}>{label}</span>
    </Link>
  );
}

/* desktop dropdown ("Tutorials") */
function NavMenu({
  label,
  icon,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  items: { href: string; title: string; subtitle?: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown as any, { passive: true } as any);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, []);

  return (
  <div
    ref={wrapRef}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
   style={{ position: "relative" }}

  >
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      style={{
        color: "#e6e6ff",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 15,
        padding: "0 2px",
        whiteSpace: "nowrap",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
<ChevronDown size={16} style={{ opacity: 0.7, marginLeft: 6 }} />

    </button>

    {/* hover bridge: fills the previous gap so mouse never "leaves" the wrapper */}
    {open && (
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "100%",
          height: 8,
        }}
      />
    )}

    {open && (
      <div
        role="menu"
        style={{
          position: "absolute",
          top: "100%",           // was: calc(100% + 8px)
          left: 0,
          minWidth: 280,
          background: "#0f111a",
          border: "1px solid #232332",
          borderRadius: 12,
          boxShadow: "0 10px 28px rgba(0,0,0,.45)",
          padding: 8,
          zIndex: 80,
          marginTop: 8,          // creates visual space without a “mouse gap”
        }}
      >
        {items.map((it) => (
          <Link href={it.href} key={it.href}
            role="menuitem"
            style={{
              display: "block",
              textDecoration: "none",
              color: "#e6e6ff",
              padding: "10px 12px",
              borderRadius: 10,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{it.title}</div>
            {it.subtitle && (
              <div style={{ fontSize: 12, color: "#9aa0b6", marginTop: 2 }}>{it.subtitle}</div>
            )}
          </Link>
        ))}
      </div>
    )}
  </div>
);

}

/* ───── wallet button contents: icon + live WOODENG balance ─────────────────
   Shows a wallet-brand icon (Phantom/Solflare/...) or a generic wallet icon
   for the embedded wallet, next to the live balance — makes it obvious this
   is "my Woodeng wallet" without ever showing the raw address in the header. */
function WalletIdentity({
  isEmbeddedWallet,
  walletClientType,
  unifiedAddress,
  providerLabel,
  balance,
}: {
  isEmbeddedWallet: boolean;
  walletClientType: string | null;
  unifiedAddress: string | null;
  providerLabel: string;
  balance: number;
}) {
  if (!unifiedAddress) {
    return (
      <>
        <WalletIcon size={16} style={{ color: "#4ECDC4", flexShrink: 0 }} />
        <span>{providerLabel}</span>
      </>
    );
  }

  const balanceStr = balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const brandEmoji =
    walletClientType === "phantom" ? "👻" :
    walletClientType === "solflare" ? "🔥" :
    walletClientType === "glow" ? "🌙" :
    walletClientType === "backpack" ? "🎒" :
    null;

  return (
    <>
      {isEmbeddedWallet || !brandEmoji ? (
        <WalletIcon size={16} style={{ color: isEmbeddedWallet ? "#a088fa" : "#4ECDC4", flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{brandEmoji}</span>
      )}
      <span>{balanceStr} WOODENG</span>
    </>
  );
}

export default function Header() {
  const { connection } = useConnection();
if (typeof window !== 'undefined') {
  console.debug('[Header] connection.rpcEndpoint =', (connection as any)?.rpcEndpoint);
}


  const wallet = useWallet();
  const { login, logout, authenticated, user: privyUser } = usePrivy();
  const { address: unifiedAddress, publicKey: unifiedPublicKey, isEmbeddedWallet, walletClientType } = useUnifiedWallet();
  const providerLabel = (privyUser?.linkedAccounts?.[0] as any)?.type?.replace('_oauth', '') ?? 'privy';
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile(860);
  const logoH = isMobile ? LOGO_H_MOBILE : LOGO_H_DESKTOP; // taille responsive du logo

  // 👇 Force Helius just for this balance widget (testing the 403/CORS issue)
  const forced = React.useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC!;
    const conn = new Connection(url, { commitment: 'confirmed' });
    if (typeof window !== 'undefined') {
      console.debug('[Header] forced rpcEndpoint =', url);
    }
    return conn;
  }, []);

  const liveWoodengBalance = useWoodengBalanceLive(forced, unifiedPublicKey, WOODENG_MINT_PK);



  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [addrResult, setAddrResult] = useState<ResolvedKind>({ kind: "unknown" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [createBtnPulse, setCreateBtnPulse] = useState(false);
  const createHoveredRef = useRef(false);

  const searchRefMobile = useRef<HTMLInputElement>(null!);
  const isOnSoundMemes = pathname?.startsWith("/sound-memes") ?? false;

 

  /* periodic attention pulse on Create button every 8s (pauses on hover) */
  useEffect(() => {
    const id = setInterval(() => {
      if (!createHoveredRef.current) {
        setCreateBtnPulse(true);
        setTimeout(() => setCreateBtnPulse(false), 450);
      }
    }, 8000);
    return () => clearInterval(id);
  }, []);

  /* lock body scroll + autofocus search when drawer opens */
  useEffect(() => {
    if (!mobileOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => searchRefMobile.current?.focus(), 120);
    return () => {
      document.body.style.overflow = overflow;
      clearTimeout(t);
    };
  }, [mobileOpen]);

  /* address detection (debounced + cached) */
  const cacheRef = useRef<Map<string, ResolvedKind>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPubkey = (s: string) => {
    try {
      new PublicKey(s);
      return true;
    } catch {
      return false;
    }
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
        const info = await withTimeout(connection.getAccountInfo(pk));


        if (info?.owner?.equals(AMM_PROGRAM_ID)) {
          const res: ResolvedKind = { kind: "musicPool", addr: pk };
          cacheRef.current.set(q, res);
          setAddrResult(res);
        } else if (
  info?.owner?.equals(TOKEN_PROGRAM_ID) ||
  info?.owner?.toBase58() === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" // TOKEN_2022_PROGRAM_ID
) {
  const res: ResolvedKind = { kind: "soundMemeMint", addr: pk };
  cacheRef.current.set(q, res);
  setAddrResult(res);
}
 else {
          const res: ResolvedKind = { kind: "unknown" };
          cacheRef.current.set(q, res);
          setAddrResult(res);
        }
      } catch {
        setAddrResult({ kind: "unknown" });
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query]);

  /* suggestions */
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

  /* submit */
  const onSubmit = () => {
    const q = query.trim();
    if (!q) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("woodeng:audio:stop-all"));
    }
    if (addrResult.kind === "musicPool") {
      router.push(`/amm?addr=${addrResult.addr.toBase58()}`);
      setMobileOpen(false);
      return;
    }
    if (addrResult.kind === "soundMemeMint") {
      router.push(`/sound-memes?mint=${addrResult.addr.toBase58()}`);
      setMobileOpen(false);
      return;
    }
    const top = suggestions.find((s) => s.highPriority) ?? suggestions[0];
    if (top) {
      router.push(top.href);
      setMobileOpen(false);
    }
  };

  /* close drawer on route change / Esc */
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* layout styles */
  const headerContainer: React.CSSProperties = {
    width: "100%",
    background: "#0a0a12",
    borderBottom: "1px solid #1a1a22",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 60,
    boxSizing: "border-box",
  };

  const contentWrapper: React.CSSProperties = {
    width: "100%",
    margin: "0 auto",
    maxWidth: 1800,
    minHeight: 64,
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-start",
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

const navStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  minWidth: 0,
  flex: "0 1 auto",
  flexWrap: "nowrap",
  overflow: "visible",
  paddingRight: 20,
  alignItems: "center",          // ← add this
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

  return (
    <header style={headerContainer}>
      {/* Desktop helper */}
      <style jsx global>{`
        .hide-on-mobile { display: flex !important; }
        @media (max-width: 860px) { .hide-on-mobile { display: none !important; } }
      `}</style>


      <style jsx global>{`
  /* Compact header when screen < 1360px */
  @media (max-width: 1360px) {
    /* shrink nav text + spacing */
    .nav-compact .ni {
      font-size: 14px !important;
      gap: 6px !important;
    }
    .nav-compact {
      gap: 10px !important;
    }

    /* shrink Create button */
    .create-btn {
      padding: 8px 20px !important;
      font-size: 15px !important;
      border-radius: 20px !important;
    }

    /* if space is still tight, hide Airdrop */
    .hide-when-tight {
      display: none !important;
    }
  }
`}</style>


      {/* local styles (no .logo-img rules anymore) */}
      <style jsx>{`
        .iconText { font-size: 22px; line-height: 1; font-weight: 700; display: block; transform: translateY(-1px); }
      `}</style>

      <style jsx global>{`
        @keyframes btn-attention {
          0%,100%{transform:scale(1)}
          25%{transform:scale(1.08)}
          50%{transform:scale(0.97)}
          75%{transform:scale(1.05)}
        }
        @keyframes shimmer-sweep {
          from{background-position:-200% 0}
          to{background-position:200% 0}
        }
        .create-btn {
          position: relative !important;
          overflow: hidden !important;
          text-decoration: none !important;
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease !important;
          display: inline-block;
        }
        .create-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, #6b52ff 0%, #907aff 100%);
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          border-radius: inherit;
          z-index: 0;
        }
        .create-btn:hover::before { transform: translateY(0%); }
        .create-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.22) 50%, transparent 62%);
          background-size: 200% 100%;
          background-position: -200% 0;
          border-radius: inherit;
          z-index: 2;
          pointer-events: none;
          opacity: 0;
        }
        .create-btn:hover::after {
          opacity: 1;
          animation: shimmer-sweep 0.65s ease 0.1s 1 forwards;
        }
        .create-btn:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 4px 20px rgba(107,82,255,0.5), 0 0 0 1px rgba(144,122,255,0.2) !important;
          text-decoration: none !important;
        }
        .create-btn:active {
          transform: scale(0.93) !important;
          transition: transform 0.08s ease !important;
        }
        .create-btn.btn-pulsing {
          animation: btn-attention 0.45s ease both;
        }
        .create-btn > * {
          position: relative;
          z-index: 1;
        }
      `}</style>

      <div style={contentWrapper}>
        {/* Left: Hamburger (mobile) + Logo + Search + Nav */}
        <div style={leftSection}>
          {isMobile && (
            <button
              type="button"
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
                WebkitTapHighlightColor: "transparent",
                display: "inline-flex",
              }}
            >
              <span aria-hidden="true" className="iconText">☰</span>
            </button>
          )}

          {/* Logo — give the browser an intrinsic height on first paint */}
          <Link href="/" aria-label="Woodeng home" style={{ display: "inline-flex", alignItems: "center" }}>
            <img
              src="/brand/logo.png"
              alt="Woodeng"
              draggable={false}
              height={logoH}
              style={{ height: logoH, width: "auto", display: "block", flexShrink: 0 }}
              decoding="async"
              loading="eager"
            />
          </Link>

          {/* Desktop search */}
          <div className="hide-on-mobile" style={{ flex: "1 1 auto" }}>
            <SearchBox
              value={query}
              onChange={setQuery}
              onSubmit={onSubmit}
              suggestions={suggestions}
              loading={loading}
            />
          </div>

          
          {/* Desktop nav */}
<nav className="hide-on-mobile nav-compact" style={{ ...navStyle, marginRight: 16 }}>


  <NavItem href="/" label="Home" icon={<Home size={17} />} />
  <NavItem href="/profile" label="Profile" icon={<UserIcon size={17} />} />
  <NavItem href="/sound-memes" label="Sound Memes" icon={<AnimatedSoundWaveIcon />} />
  <NavItem href="/staking" label="Staking" icon={<ShieldCheck size={17} />} />

  {/* Start here dropdown */}
  <NavMenu
  label="Start here"
  icon={<ChevronRight size={16} />}
  items={[
    {
      href: "/guides/buy-woodeng",
      title: "How to buy WOODENG",
      subtitle: "Create a wallet, fund it, and purchase WOODENG safely.",
    },
    // ↓ ADD THIS NEW ITEM
    {
      href: "/guides/fund-wallet",
      title: "Fund your wallet with SOL (mobile)",
      subtitle: "Buy SOL on your phone, then swap for WOODENG.",
    },
    {
      href: "/guides/trade-sound-memes",
      title: "How to trade tokens on woodeng",
      subtitle: "Step-by-step trading on Woodeng AMM & bonding.",
    },
  ]}
/>


  {/* Airdrop (disabled) */}
  <span className="hide-when-tight">
  <NavItem label="Airdrop" icon={<Gift size={17} />} disabled />
</span>

</nav>


 

        </div>

        {/* Right: desktop-only */}
        <div className="hide-on-mobile"
     style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: "auto" }}>

          <Link href="/create"
  className={`create-btn${createBtnPulse ? ' btn-pulsing' : ''}`}
  style={createButtonStyle}
  onMouseEnter={() => { createHoveredRef.current = true; }}
  onMouseLeave={() => { createHoveredRef.current = false; }}
><span style={{ position: 'relative', zIndex: 1 }}>+ Create</span></Link>


          {authenticated ? (
            <button
              onClick={() => setWalletPanelOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(78,205,196,0.08)",
                border: "1px solid rgba(78,205,196,0.2)",
                borderRadius: 16, padding: "8px 18px",
                color: "#4ECDC4", fontSize: 14, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(78,205,196,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(78,205,196,0.08)")}
            >
              <WalletIdentity
                isEmbeddedWallet={isEmbeddedWallet}
                walletClientType={walletClientType}
                unifiedAddress={unifiedAddress}
                providerLabel={providerLabel}
                balance={liveWoodengBalance}
              />
            </button>
          ) : (
            <button onClick={login} style={{
              borderRadius: 16, background: "#a088fa", color: "#fff",
              padding: "9px 30px", fontWeight: 700, fontSize: "16px",
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              letterSpacing: "0.01em",
            }}>
              Login
            </button>
          )}
        </div>
      </div>

      {/* Mobile overlay & drawer (rendered only on mobile) */}
      {isMobile && (
        <div
          aria-hidden={!mobileOpen}
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: mobileOpen ? "rgba(0,0,0,0.6)" : "transparent",
            transition: "background .18s ease",
            pointerEvents: mobileOpen ? "auto" : "none",
            zIndex: 50,
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
              width: "min(calc(100vw - 16px), 420px)",
              boxSizing: "border-box",
              background: "#0b0c14",
              borderRight: "1px solid #1a1a22",
              transform: `translate3d(${mobileOpen ? "0%" : "-100%"}, 0, 0)`,
              transition: "transform .22s ease",
              willChange: "transform",
              contain: "layout paint size",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "14px 14px 18px",
            }}
          >
            {/* drawer top bar */}
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
                <img
                  src="/brand/logo.png"
                  alt="Woodeng"
                  draggable={false}
                  height={logoH}
                  style={{ height: logoH, width: "auto", display: "block" }}
                  decoding="async"
                  loading="eager"
                />

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  style={{
                    height: 40,
                    width: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    border: "1px solid #232332",
                    background: "#181929",
                    color: "#e6e6ff",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span aria-hidden="true" className="iconText">×</span>
                </button>
              </div>
            </div>

            {/* actions row */}
            <div style={{ display: "flex", gap: 10, margin: "8px 0 6px" }}>
              <Link
  href="/profile"
  aria-label="Profile"
  onClick={() => setMobileOpen(false)}
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
    cursor: "pointer",
    textDecoration: "none",
  }}
>
  <UserIcon size={18} />
</Link>


              {authenticated ? (
                <button
                  onClick={() => { setWalletPanelOpen(true); setMobileOpen(false); }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "rgba(78,205,196,0.08)",
                    border: "1px solid rgba(78,205,196,0.2)",
                    borderRadius: 12, padding: "10px 16px",
                    color: "#4ECDC4", fontSize: 15, fontWeight: 700,
                    cursor: "pointer", lineHeight: 1,
                  }}
                >
                  <WalletIdentity
                    isEmbeddedWallet={isEmbeddedWallet}
                    walletClientType={walletClientType}
                    unifiedAddress={unifiedAddress}
                    providerLabel={providerLabel}
                    balance={liveWoodengBalance}
                  />
                </button>
              ) : (
                <button onClick={() => { login(); setMobileOpen(false); }} style={{
                  flex: 1, borderRadius: 12, background: "#a088fa", color: "#fff",
                  padding: "10px 16px", fontWeight: 700, fontSize: "15px",
                  border: "none", cursor: "pointer", lineHeight: 1,
                }}>
                  Login
                </button>
              )}
            </div>

            {/* search (compact) */}
            <SearchBox
              compact
              inputRef={searchRefMobile}
              value={query}
              onChange={setQuery}
              onSubmit={onSubmit}
              suggestions={suggestions}
              loading={loading}
              onPickLink={() => setMobileOpen(false)}
            />

            {/* main nav */}
            {/* main nav */}
<div style={{ marginTop: 2 }}>
  <div style={{ color: "#8d92a8", fontSize: 12, margin: "8px 2px" }}>Navigate</div>

  <MobileNavItem href="/" label="Home" icon={<Home size={17} />} onClick={() => setMobileOpen(false)} />

  <MobileNavItem href="/profile" label="Profile" icon={<UserIcon size={17} />} onClick={() => setMobileOpen(false)} />

  <MobileNavItem
    href="/sound-memes"
    label="Tokens"
    icon={<AnimatedSoundWaveIcon />}
    onClick={() => setMobileOpen(false)}
  />

  <MobileNavItem
    href="/staking"
    label="Staking"
    icon={<ShieldCheck size={17} />}
    onClick={() => setMobileOpen(false)}
  />

    {/* Start Here (mobile) */}
  <div style={{ color: "#8d92a8", fontSize: 12, margin: "14px 2px 6px" }}>Start here</div>

  <MobileNavItem
  href="/guides/buy-woodeng"
  label="How to buy WOODENG"
  icon={<Waves size={17} />}
  onClick={() => setMobileOpen(false)}
/>

<MobileNavItem
  href="/guides/fund-wallet"
  label="Fund your wallet with SOL (mobile)"
  icon={<Waves size={17} />}
  onClick={() => setMobileOpen(false)}
/>

<MobileNavItem
  href="/guides/trade-sound-memes"
  label="How to trade Sound Memes"
  icon={<AnimatedSoundWaveIcon />}
  onClick={() => setMobileOpen(false)}
/>



  {/* New disabled "Airdrop" */}
  <MobileNavItem label="Airdrop" icon={<Gift size={17} />} disabled />
</div>


            {/* user actions */}
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/create"
                className="create-btn"
                onClick={() => setMobileOpen(false)}
                style={{
                  background: "#a088fa",
                  color: "white",
                  padding: "12px 20px",
                  borderRadius: "24px",
                  fontWeight: 700,
                  fontSize: "16px",
                  textAlign: "center",
                  boxShadow: "0 2px 16px 0 #a088fa1a",
                }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>+ Create</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      <WalletPanel open={walletPanelOpen} onClose={() => setWalletPanelOpen(false)} />
    </header>
  );
}
