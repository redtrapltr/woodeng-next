"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { getCachedBalance, getCachedTokenBalance } from "@/lib/balanceCache";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { QRCodeSVG } from "qrcode.react";

const WOODENG_MINT_PK = new PublicKey("83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5");

// ── helpers ───────────────────────────────────────────────────────────────────

function abbr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number) {
  const s = Date.now() / 1000 - ts;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

let _stylesInjected = false;
function injectStyles() {
  if (typeof document === "undefined" || _stylesInjected) return;
  _stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes _wp_spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes _wp_fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes _wp_pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
    @keyframes _wp_pop { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
    ._wp_hover_row:hover { background: rgba(255,255,255,0.03) !important; }
  `;
  document.head.appendChild(el);
}

// ── types ─────────────────────────────────────────────────────────────────────

type TxEntry = {
  signature: string;
  blockTime: number | null;
};

type View = "main" | "deposit" | "withdraw";
type DepositTab = "address" | "card";
type SendToken = "SOL" | "WOODENG";

interface WalletPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── card style token ──────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: "16px 18px",
};

// ── component ─────────────────────────────────────────────────────────────────

export default function WalletPanel({ open, onClose }: WalletPanelProps) {
  const {
    publicKey, connected, authenticated,
    sendTransaction, logout, exportWallet,
    user, address,
  } = useUnifiedWallet();

  const rpcConnection = useMemo(
    () => new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!, { commitment: "confirmed" }),
    []
  );

  // panel animation state
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // view state
  const [view, setView] = useState<View>("main");
  const [depositTab, setDepositTab] = useState<DepositTab>("address");

  // balance
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [woodengBalance, setWoodengBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);

  // deposit
  const [copied, setCopied] = useState(false);

  // withdraw
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken] = useState<SendToken>("SOL");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSig, setSendSig] = useState("");
  const [sendStuck, setSendStuck] = useState(false);

  // Flag a stuck transaction after 10s so we can surface a recovery hint —
  // covers Privy accounts whose embedded wallet never confirms (see useUnifiedWallet).
  useEffect(() => {
    if (!sending) { setSendStuck(false); return; }
    const t = setTimeout(() => setSendStuck(true), 10000);
    return () => clearTimeout(t);
  }, [sending]);

  // activity
  const [txns, setTxns] = useState<TxEntry[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);

  useEffect(() => { injectStyles(); }, []);

  // open/close animation
  useEffect(() => {
    if (open) {
      setClosing(false);
      setVisible(true);
      setView("main");
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => { setVisible(false); setClosing(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // body scroll lock
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  // single source of truth for balances — never resets to 0 before fetching
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    try {
      const pubkey = new PublicKey(address);
      const sol = await getCachedBalance(rpcConnection, pubkey);
      setSolBalance(sol / LAMPORTS_PER_SOL);

      const ata = getAssociatedTokenAddressSync(WOODENG_MINT_PK, pubkey);
      try {
        const tokenBal = await getCachedTokenBalance(rpcConnection, ata);
        setWoodengBalance(tokenBal?.uiAmount ?? 0);
      } catch {
        setWoodengBalance(0);
      }
    } catch (e) {
      console.warn("Balance fetch error:", e);
    }
  }, [address, rpcConnection]);

  // poll every 15s — single effect, no competing subscriptions
  useEffect(() => {
    if (!address) return;
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [address, fetchBalances]);

  // fetch recent txns
  const fetchTxns = useCallback(async () => {
    if (!address) return;
    setTxnsLoading(true);
    try {
      const pubkey = new PublicKey(address);
      const sigs = await rpcConnection.getSignaturesForAddress(pubkey, { limit: 5 });
      setTxns(sigs.map(s => ({ signature: s.signature, blockTime: s.blockTime ?? null })));
    } catch { setTxns([]); }
    finally { setTxnsLoading(false); }
  }, [address, rpcConnection]);

  // fetch txns when panel opens
  useEffect(() => {
    if (open && address) fetchTxns();
  }, [open, address]);

  const handleRefresh = () => {
    if (spinning) return;
    setSpinning(true);
    // no state reset — just re-fetch
    Promise.all([fetchBalances(), fetchTxns()])
      .finally(() => setTimeout(() => setSpinning(false), 700));
  };

  const handleCopy = () => {
    if (!addr) return;
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!address) return;
    setSendError(""); setSendSig("");
    setSending(true);
    try {
      let dest: PublicKey;
      try { dest = new PublicKey(sendTo.trim()); }
      catch { throw new Error("Invalid destination address"); }
      const amt = parseFloat(sendAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid amount");

      const { blockhash } = await rpcConnection.getLatestBlockhash();
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      if (sendToken === "SOL") {
        tx.add(SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: dest,
          lamports: BigInt(Math.floor(amt * LAMPORTS_PER_SOL)),
        }));
      } else {
        const mintAcct = await rpcConnection.getAccountInfo(WOODENG_MINT_PK);
        const prog = mintAcct?.owner?.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
        const mintData = await getMint(rpcConnection, WOODENG_MINT_PK, "confirmed", prog);
        const srcATA = getAssociatedTokenAddressSync(WOODENG_MINT_PK, publicKey, false, prog);
        const dstATA = getAssociatedTokenAddressSync(WOODENG_MINT_PK, dest, false, prog);
        // Idempotent create is a no-op if the recipient's ATA already exists,
        // and avoids the InvalidAccountData failure when it doesn't.
        tx.add(createAssociatedTokenAccountIdempotentInstruction(
          publicKey, dstATA, dest, WOODENG_MINT_PK, prog
        ));
        tx.add(createTransferInstruction(
          srcATA, dstATA, publicKey,
          BigInt(Math.floor(amt * 10 ** mintData.decimals)),
          [], prog
        ));
      }

      const sig = await sendTransaction(tx);
      setSendSig(sig);
      setSendTo(""); setSendAmount("");
      await fetchBalances();
    } catch (e: any) {
      setSendError(e?.message ?? "Transaction failed");
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  const addr = address ?? "";

  // derive user identity
  let displayName = "Wallet User";
  let handle = "";
  let avatarUrl = "";
  let providerBadge = "🔑";

  if (user?.twitter?.username) {
    displayName = user.twitter.name ?? `@${user.twitter.username}`;
    handle = `@${user.twitter.username}`;
    avatarUrl = user.twitter.profilePictureUrl ?? "";
    providerBadge = "𝕏";
  } else if (user?.google?.name) {
    displayName = user.google.name;
    handle = user.google.email ?? "";
    providerBadge = "G";
  } else if (user?.email?.address) {
    displayName = user.email.address.split("@")[0];
    handle = user.email.address;
    providerBadge = "✉";
  }

  // ── shared sub-styles ─────────────────────────────────────────────────────

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
    background: active ? "rgba(255,255,255,0.09)" : "transparent",
    color: active ? "#e6e6ff" : "#6b7084",
    fontWeight: 600, fontSize: 13, fontFamily: "DM Sans, sans-serif",
    transition: "all 0.18s ease",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, color: "#e6e6ff", fontSize: 13, outline: "none",
    fontFamily: "DM Sans, sans-serif", transition: "border-color 0.18s",
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: closing ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.65)",
          backdropFilter: closing ? "none" : "blur(3px)",
          transition: "all 0.3s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(420px, 100vw)",
          background: "linear-gradient(180deg, rgba(12,12,22,0.99) 0%, rgba(8,8,18,0.99) 100%)",
          backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          zIndex: 9001,
          display: "flex", flexDirection: "column",
          transform: closing ? "translateX(100%)" : "translateX(0%)",
          transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "-32px 0 80px rgba(0,0,0,0.7)",
          overflowY: "auto", overflowX: "hidden",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        {/* ── Panel header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          background: "rgba(255,255,255,0.01)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {view !== "main" && (
              <button
                onClick={() => { setView("main"); setSendError(""); setSendSig(""); }}
                style={{
                  background: "none", border: "none", color: "#9aa0b6",
                  cursor: "pointer", fontSize: 20, lineHeight: 1,
                  padding: "0 4px 0 0", display: "flex", alignItems: "center",
                }}
              >
                ←
              </button>
            )}
            <span style={{ color: "#e6e6ff", fontWeight: 700, fontSize: 16 }}>
              {view === "main" ? "Wallet" : view === "deposit" ? "Deposit" : "Withdraw"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#6b7084", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ padding: "20px 20px 36px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 1 · User identity */}
          <div style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "_wp_fadeUp 0.3s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl} alt=""
                  style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #a088fa 0%, #ff6b6b 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "#fff",
                }}>
                  {providerBadge}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e6e6ff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {displayName}
                </div>
                {handle && (
                  <div style={{ color: "#6b7084", fontSize: 12, marginTop: 1 }}>
                    {handle}
                  </div>
                )}
                {addr && (
                  <div style={{ color: "#3d4155", fontSize: 11, marginTop: 1 }}>
                    {abbr(addr)}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => { onClose(); logout(); }}
              style={{
                flexShrink: 0, background: "none", border: "none",
                color: "#4a4d5e", fontSize: 12, cursor: "pointer",
                textDecoration: "underline", fontFamily: "inherit",
                marginLeft: 12, transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#9aa0b6")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4a4d5e")}
            >
              Logout
            </button>
          </div>

          {/* 2 · Balance card (main view) */}
          {view === "main" && (
            <div style={{
              ...CARD, textAlign: "center", position: "relative",
              animation: "_wp_fadeUp 0.3s ease 0.05s both",
              padding: "28px 20px 20px",
            }}>
              <button
                onClick={handleRefresh}
                title="Refresh"
                style={{
                  position: "absolute", top: 14, right: 14,
                  width: 30, height: 30, borderRadius: "50%",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  color: "#6b7084", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: spinning ? "_wp_spin 0.7s linear infinite" : "none",
                  transition: "color 0.2s, background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e6e6ff")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7084")}
              >
                ↻
              </button>

              {/* SOL big number */}
              <div style={{ animation: "_wp_pop 0.35s cubic-bezier(0.175,0.885,0.32,1.1) 0.1s both" }}>
                {solBalance !== null ? (
                  <div style={{ fontSize: 38, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                    {solBalance.toFixed(4)}{" "}
                    <span style={{ fontSize: 20, color: "#a088fa", fontWeight: 600 }}>SOL</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 38, fontWeight: 800, color: "#2a2b3d", animation: "_wp_pulse 1.5s ease infinite" }}>
                    —
                  </div>
                )}
              </div>

              {/* WOODENG */}
              <div style={{ fontSize: 15, color: "#7a80a0", marginTop: 8 }}>
                {woodengBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                <span style={{ color: "#a088fa" }}>WOODENG</span>
              </div>

              {/* Address link */}
              {addr ? (
                <a
                  href={`https://solscan.io/account/${addr}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: "#3d4155", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9aa0b6")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#3d4155")}
                >
                  {abbr(addr)} ↗
                </a>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, color: "#3d4155" }}>No wallet connected</div>
              )}
            </div>
          )}

          {/* 3 · Action buttons (main view) */}
          {view === "main" && (
            <div style={{ display: "flex", gap: 10, animation: "_wp_fadeUp 0.3s ease 0.1s both" }}>
              <button
                onClick={() => { setView("deposit"); setDepositTab("address"); }}
                style={{
                  flex: 1, padding: "15px 10px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg, #ffc371 0%, #ff6b6b 100%)",
                  color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontFamily: "inherit", boxShadow: "0 4px 20px rgba(255,107,107,0.25)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(255,107,107,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,107,107,0.25)"; }}
              >
                <span>💳</span> Deposit
              </button>
              <button
                onClick={() => { setView("withdraw"); setSendError(""); setSendSig(""); }}
                style={{
                  flex: 1, padding: "15px 10px", borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#e6e6ff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontFamily: "inherit", transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <span>↗</span> Withdraw
              </button>
            </div>
          )}

          {/* 4 · Deposit view */}
          {view === "deposit" && (
            <div style={{ animation: "_wp_fadeUp 0.28s ease both" }}>
              {/* Tabs */}
              <div style={{
                display: "flex", gap: 4, marginBottom: 16,
                background: "rgba(255,255,255,0.03)", borderRadius: 11, padding: 4,
              }}>
                <button style={tabBtn(depositTab === "address")} onClick={() => setDepositTab("address")}>
                  From Wallet
                </button>
                <button style={tabBtn(depositTab === "card")} onClick={() => setDepositTab("card")}>
                  Buy with Card
                </button>
              </div>

              {depositTab === "address" ? (
                addr ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                    {/* Address + copy */}
                    <div style={{ ...CARD, width: "100%", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box" }}>
                      <code style={{
                        flex: 1, fontSize: 11, color: "#9aa0b6", wordBreak: "break-all",
                        fontFamily: "monospace", lineHeight: 1.6,
                      }}>
                        {addr}
                      </code>
                      <button
                        onClick={handleCopy}
                        style={{
                          flexShrink: 0, padding: "9px 16px", borderRadius: 10,
                          background: copied ? "rgba(78,205,196,0.1)" : "rgba(160,136,250,0.08)",
                          border: `1px solid ${copied ? "rgba(78,205,196,0.25)" : "rgba(160,136,250,0.18)"}`,
                          color: copied ? "#4ECDC4" : "#a088fa",
                          fontWeight: 700, fontSize: 13, cursor: "pointer",
                          fontFamily: "inherit", minWidth: 64,
                          transition: "all 0.2s",
                        }}
                      >
                        {copied ? "✓" : "Copy"}
                      </button>
                    </div>

                    {/* QR code */}
                    <div style={{
                      ...CARD, padding: 22,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                      animation: "_wp_pop 0.35s cubic-bezier(0.175,0.885,0.32,1.1) 0.08s both",
                    }}>
                      <div style={{ background: "#fff", padding: 14, borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                        <QRCodeSVG value={addr} size={164} level="M" />
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7084", textAlign: "center", lineHeight: 1.6 }}>
                        Send SOL or tokens to this address from<br />
                        Phantom, an exchange, or any Solana wallet
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ ...CARD, textAlign: "center", color: "#6b7084", fontSize: 14, padding: "28px" }}>
                    Connect a wallet to see your deposit address
                  </div>
                )
              ) : (
                /* Buy with card */
                <div style={{ ...CARD, textAlign: "center", padding: "28px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>💳</div>
                  <div style={{ color: "#e6e6ff", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Buy SOL with Card</div>
                  <div style={{ color: "#6b7084", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                    Purchase SOL directly with your credit or debit card via MoonPay
                  </div>
                  {addr ? (
                    <a
                      href={`https://buy.moonpay.com/?apiKey=pk_live_NX4M5QHoqM6RXN8bEuGGPLxTa04c8&currencyCode=sol&walletAddress=${addr}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        display: "block", padding: "13px",
                        borderRadius: 12,
                        background: "linear-gradient(135deg, #ffc371, #ff6b6b)",
                        color: "#000", fontWeight: 700, fontSize: 14,
                        textDecoration: "none", textAlign: "center",
                      }}
                    >
                      Open MoonPay ↗
                    </a>
                  ) : (
                    <div style={{ color: "#3d4155", fontSize: 13 }}>Connect wallet to use this feature</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5 · Withdraw view */}
          {view === "withdraw" && (
            <div style={{ animation: "_wp_fadeUp 0.28s ease both", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Token toggle */}
              <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 11, padding: 4 }}>
                {(["SOL", "WOODENG"] as const).map(t => (
                  <button key={t} style={tabBtn(sendToken === t)} onClick={() => setSendToken(t)}>{t}</button>
                ))}
              </div>

              {/* Destination */}
              <div>
                <label style={{ display: "block", color: "#6b7084", fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                  Destination address
                </label>
                <input
                  value={sendTo}
                  onChange={e => setSendTo(e.target.value)}
                  placeholder="Solana wallet address…"
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                />
              </div>

              {/* Amount */}
              <div>
                <label style={{ display: "block", color: "#6b7084", fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                  Amount
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    value={sendAmount}
                    onChange={e => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="any"
                    style={{ ...inputStyle, paddingRight: 66 }}
                  />
                  <button
                    onClick={() => {
                      setSendAmount(
                        sendToken === "SOL"
                          ? Math.max(0, (solBalance ?? 0) - 0.000005).toFixed(6)
                          : woodengBalance.toFixed(2)
                      );
                    }}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      padding: "4px 10px", borderRadius: 8,
                      background: "rgba(160,136,250,0.08)", border: "1px solid rgba(160,136,250,0.18)",
                      color: "#a088fa", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    MAX
                  </button>
                </div>
                <div style={{ color: "#3d4155", fontSize: 11, marginTop: 5 }}>
                  Available:{" "}
                  {sendToken === "SOL"
                    ? `${(solBalance ?? 0).toFixed(4)} SOL`
                    : `${woodengBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} WOODENG`
                  }
                </div>
              </div>

              {/* Error / success */}
              {sendError && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(255,107,107,0.07)", border: "1px solid rgba(255,107,107,0.18)",
                  color: "#ff6b6b", fontSize: 13, lineHeight: 1.5,
                }}>
                  {sendError}
                </div>
              )}
              {sendSig && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(78,205,196,0.07)", border: "1px solid rgba(78,205,196,0.18)",
                  color: "#4ECDC4", fontSize: 12,
                }}>
                  ✓ Sent!{" "}
                  <a href={`https://solscan.io/tx/${sendSig}`} target="_blank" rel="noreferrer" style={{ color: "#4ECDC4" }}>
                    View on Solscan ↗
                  </a>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={sending || !sendTo.trim() || !sendAmount || !address}
                style={{
                  width: "100%", padding: "15px", borderRadius: 14, border: "none",
                  background: (sending || !sendTo.trim() || !sendAmount || !address)
                    ? "rgba(255,255,255,0.05)"
                    : "linear-gradient(135deg, #a088fa 0%, #6b52ff 100%)",
                  color: (sending || !sendTo.trim() || !sendAmount || !address) ? "#3d4155" : "#fff",
                  fontWeight: 700, fontSize: 15,
                  cursor: (sending || !address) ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                  boxShadow: (!sending && sendTo && sendAmount && !!address)
                    ? "0 4px 20px rgba(107,82,255,0.3)" : "none",
                }}
              >
                {sending ? (
                  <><span style={{ display: "inline-block", animation: "_wp_spin 0.7s linear infinite" }}>⟳</span> Sending…</>
                ) : (
                  `Send ${sendToken}`
                )}
              </button>

              {sendStuck && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(255,195,113,0.07)", border: "1px solid rgba(255,195,113,0.18)",
                  color: "#ffc371", fontSize: 12, textAlign: "center", lineHeight: 1.5,
                }}>
                  Having trouble? Try logging out and back in.
                </div>
              )}

              {!address && (
                <div style={{ textAlign: "center", color: "#4a4d5e", fontSize: 12 }}>
                  Connect a wallet to send funds
                </div>
              )}
            </div>
          )}

          {/* 6 · Recent Activity (main view) */}
          {view === "main" && (
            <div style={{ animation: "_wp_fadeUp 0.3s ease 0.15s both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "#9aa0b6", fontSize: 13, fontWeight: 700 }}>Recent Activity</span>
                {addr && (
                  <a
                    href={`https://solscan.io/account/${addr}`}
                    target="_blank" rel="noreferrer"
                    style={{ color: "#4a4d5e", fontSize: 12, textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#9aa0b6")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#4a4d5e")}
                  >
                    View all on Solscan →
                  </a>
                )}
              </div>

              <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
                {txnsLoading ? (
                  <div style={{ padding: "22px", textAlign: "center", color: "#3d4155", fontSize: 13 }}>
                    <span style={{ display: "inline-block", animation: "_wp_spin 1s linear infinite", marginRight: 8 }}>⟳</span>
                    Loading…
                  </div>
                ) : !addr ? (
                  <div style={{ padding: "22px", textAlign: "center", color: "#3d4155", fontSize: 13 }}>
                    Connect a wallet to see activity
                  </div>
                ) : txns.length === 0 ? (
                  <div style={{ padding: "22px", textAlign: "center", color: "#3d4155", fontSize: 13 }}>
                    No recent transactions
                  </div>
                ) : (
                  txns.map((tx, i) => (
                    <a
                      key={tx.signature}
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank" rel="noreferrer"
                      className="_wp_hover_row"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", textDecoration: "none",
                        borderBottom: i < txns.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: "rgba(160,136,250,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, color: "#a088fa", flexShrink: 0,
                        }}>
                          ↔
                        </div>
                        <div>
                          <div style={{ color: "#e6e6ff", fontSize: 13, fontWeight: 600 }}>
                            {abbr(tx.signature)}
                          </div>
                          <div style={{ color: "#3d4155", fontSize: 11, marginTop: 1 }}>
                            {tx.blockTime ? timeAgo(tx.blockTime) : "Recent"}
                          </div>
                        </div>
                      </div>
                      <span style={{ color: "#3d4155", fontSize: 14 }}>↗</span>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 7 · Footer links (main view) */}
          {view === "main" && (
            <div style={{
              display: "flex", justifyContent: "center", gap: 24, paddingTop: 4,
              animation: "_wp_fadeUp 0.3s ease 0.2s both",
            }}>
              {!!address && (exportWallet as any) && (
                <button
                  onClick={() => {
                    try { (exportWallet as any)({ address: addr, chainType: "solana" }); }
                    catch { (exportWallet as any)(); }
                  }}
                  style={{
                    background: "none", border: "none", color: "#3d4155",
                    fontSize: 12, cursor: "pointer", textDecoration: "underline",
                    fontFamily: "inherit", transition: "color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9aa0b6")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#3d4155")}
                >
                  Export Private Key
                </button>
              )}
              {addr && (
                <a
                  href={`https://solscan.io/account/${addr}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: "#3d4155", fontSize: 12, textDecoration: "underline" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9aa0b6")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#3d4155")}
                >
                  View on Solscan
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
