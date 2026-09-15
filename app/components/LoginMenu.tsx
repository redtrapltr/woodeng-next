"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Mail } from "lucide-react";

// Two clearly separated login paths — "I already have a wallet" (direct
// connect, no account creation) vs "I'm new to crypto" (social login, Privy
// creates an embedded wallet). MetaMask/Phantom buttons pass Privy's
// walletList filter so its own connect modal opens straight to that single
// connector instead of a full wallet picker.
export default function LoginMenu({
  trigger,
  align = "right",
  dropUp = false,
  style,
}: {
  trigger: (toggle: () => void, open: boolean) => React.ReactNode;
  align?: "left" | "right";
  dropUp?: boolean;
  style?: React.CSSProperties;
}) {
  const { login } = usePrivy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown as any, { passive: true } as any);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [open]);

  const connectWallet = (walletName: "metamask" | "phantom") => {
    setOpen(false);
    login({ loginMethods: ["wallet"], walletList: [walletName] } as any);
  };
  const signUp = (loginMethods: ("twitter" | "google" | "email")[]) => {
    setOpen(false);
    login({ loginMethods } as any);
  };

  const walletBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: "1px solid rgba(160,136,250,0.25)",
    background: "rgba(160,136,250,0.08)",
    color: "#e6e6ff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "background 0.15s, border-color 0.15s",
  };

  const socialBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#e6e6ff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "background 0.15s",
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block", ...style }}>
      {trigger(() => setOpen((o) => !o), open)}

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            ...(dropUp ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
            [align]: 0,
            minWidth: 280,
            background: "#0f111a",
            border: "1px solid #232332",
            borderRadius: 16,
            boxShadow: "0 10px 28px rgba(0,0,0,.45)",
            padding: 14,
            zIndex: 200,
          } as React.CSSProperties}
        >
          <div style={{ color: "#e6e6ff", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            Connect to Woodeng
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <button
              style={walletBtnStyle}
              onClick={() => connectWallet("metamask")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(160,136,250,0.16)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(160,136,250,0.08)")}
            >
              <span style={{ fontSize: 18 }}>🦊</span> MetaMask
            </button>
            <button
              style={walletBtnStyle}
              onClick={() => connectWallet("phantom")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(160,136,250,0.16)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(160,136,250,0.08)")}
            >
              <span style={{ fontSize: 18 }}>👻</span> Phantom
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 4px 10px", color: "#4a4d5e", fontSize: 11 }}>
            <div style={{ flex: 1, height: 1, background: "#232332" }} />
            or create account
            <div style={{ flex: 1, height: 1, background: "#232332" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            <button style={socialBtnStyle} onClick={() => signUp(["twitter"])} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ width: 16, textAlign: "center" }}>𝕏</span> Sign up with X
            </button>
            <button style={socialBtnStyle} onClick={() => signUp(["google"])} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ width: 16, textAlign: "center" }}>G</span> Sign up with Google
            </button>
            <button style={socialBtnStyle} onClick={() => signUp(["email"])} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Mail size={16} /> Sign up with Email
            </button>
          </div>

          <div style={{ color: "#4a4d5e", fontSize: 11, lineHeight: 1.5 }}>
            Connect your existing wallet, or create a new one with social login.
          </div>
        </div>
      )}
    </div>
  );
}
