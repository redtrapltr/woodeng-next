"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { parseEther, decodeEventLog, isAddress } from "viem";
import { Loader2, Feather, UploadCloud, ChevronDown } from "lucide-react";
import { useRobinhoodWallet } from "@/hooks/useRobinhoodWallet";
import {
  RH_CONFIG,
  SWL444_FACTORY_ABI,
  robinhoodPublicClient,
} from "../lib/robinhoodChain";
import { GRADUATION_TARGET_ETH } from "../lib/robinhoodStats";
import { tierForDays, HOOD_TIERS } from "../lib/hoodTiers";
import { pinFile, pinJson } from "../lib/pinata";
import RobinhoodPhaseBadge from "../components/RobinhoodPhaseBadge";
import LoginMenu from "../components/LoginMenu";

const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "10px 13px",
};

const LABEL: React.CSSProperties = {
  display: "block",
  color: "var(--muted-foreground)",
  fontSize: 11.5,
  fontWeight: 700,
  marginBottom: 5,
  letterSpacing: "0.02em",
};

// Tick marks on the Hood Gate slider mark each tier boundary (skip the 0-day
// "no gate" tier — the slider only ever represents an active gate).
const HOOD_TICKS = HOOD_TIERS.map((t) => t.minDays).filter((d) => d > 0);
const HOOD_MIN = 1;
const HOOD_MAX = 180;

// Mirrors CREATOR_BUY_FEE_BPS/STAKER_BUY_FEE_BPS in contracts-rh/src/SWL444Factory.sol.
// Bonding and trading fees split the same 70/30 way, so the preview shows one figure.
const FEE_SPLIT = { creator: 70, stakers: 30 };

// Total ETH needed to sell out BONDING_SUPPLY — see GRADUATION_TARGET_ETH in
// app/lib/robinhoodStats.ts for the derivation (single source of truth,
// shared with the detail page).
const GRADUATION_ETH = GRADUATION_TARGET_ETH;

export default function RobinhoodCreateForm() {
  const { authenticated } = usePrivy();
  const { connected, address, writeContract } = useRobinhoodWallet();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [hoodGateOn, setHoodGateOn] = useState(false);
  const [minAvgHoldDays, setMinAvgHoldDays] = useState(30);

  const [initialBuyEth, setInitialBuyEth] = useState("");
  const [feeWallet, setFeeWallet] = useState("");
  const [showFeeWallet, setShowFeeWallet] = useState(false);

  const [twitterUrl, setTwitterUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [showSocials, setShowSocials] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchedToken, setLaunchedToken] = useState<`0x${string}` | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const gateTier = useMemo(() => tierForDays(minAvgHoldDays), [minAvgHoldDays]);
  const gateRangePct = ((minAvgHoldDays - HOOD_MIN) / (HOOD_MAX - HOOD_MIN)) * 100;

  const feeWalletValid = feeWallet.trim().length === 0 || isAddress(feeWallet.trim());

  const canLaunch =
    name.trim().length > 0 && name.length <= 32 &&
    symbol.trim().length > 0 && symbol.length <= 10 &&
    feeWalletValid &&
    !!imageFile;

  const readyToLaunch = authenticated && connected && canLaunch && !launching;

  const onPickImage = (f: File | null) => {
    setImageFile(f);
    if (f) setImagePreview(URL.createObjectURL(f));
    else setImagePreview(null);
  };

  const handleLaunch = async () => {
    setLaunchError(null);
    setLaunching(true);
    try {
      let imageUri = "";
      if (imageFile) imageUri = await pinFile(imageFile);

      const socials: Record<string, string> = {};
      if (twitterUrl.trim()) socials.twitter = twitterUrl.trim();
      if (telegramUrl.trim()) socials.telegram = telegramUrl.trim();
      if (websiteUrl.trim()) socials.website = websiteUrl.trim();

      const metaUri = await pinJson({
        name, symbol, description, image: imageUri,
        ...(Object.keys(socials).length > 0 ? { socials } : {}),
      });

      const buyWei = initialBuyEth.trim() ? parseEther(initialBuyEth.trim()) : 0n;
      const gateDays = hoodGateOn ? BigInt(minAvgHoldDays) : 0n;
      const feeRecipient = (feeWallet.trim() ? feeWallet.trim() : "0x0000000000000000000000000000000000000000") as `0x${string}`;

      const hash = await writeContract({
        address: RH_CONFIG.factory,
        abi: SWL444_FACTORY_ABI,
        functionName: "createToken",
        args: [name.trim(), symbol.trim(), metaUri, gateDays, buyWei, feeRecipient],
        value: buyWei,
      });
      setTxHash(hash);

      const receipt = await robinhoodPublicClient.getTransactionReceipt({ hash });
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: SWL444_FACTORY_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === "TokenCreated") {
            setLaunchedToken((decoded.args as any).token as `0x${string}`);
            break;
          }
        } catch {
          // not a TokenCreated log — skip
        }
      }
    } catch (e: any) {
      console.warn("[RobinhoodCreateForm] launch failed:", e);
      setLaunchError(e?.shortMessage || e?.message || "Launch failed");
    } finally {
      setLaunching(false);
    }
  };

  if (launchedToken) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(var(--header-h, 64px) + 40px) 16px 0", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🏰</div>
        <h2 style={{ color: "var(--foreground)", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          Your token is live in Sherwood Forest
        </h2>
        <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 24 }}>
          {name} (${symbol}) has entered the bonding curve.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="bg-primary"
            onClick={() => router.push(`/sound-memes/${launchedToken}`)}
            style={{ padding: "13px", fontWeight: 700 }}
          >
            View your token →
          </button>
          {txHash && (
            <a
              href={`${RH_CONFIG.explorer}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--muted-foreground)", fontSize: 12 }}
            >
              View transaction on explorer ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  const descPreview = description.trim().length > 72 ? `${description.trim().slice(0, 72)}…` : description.trim();

  return (
    <div className="rh-cf-wrap" style={{ maxWidth: 1120, margin: "0 auto", padding: "calc(var(--header-h, 64px) + 14px) 16px 14px" }}>
      <button
        type="button"
        onClick={() => router.push("/sound-memes")}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", color: "#888",
          cursor: "pointer", fontSize: 14, marginBottom: 16, padding: 0, fontFamily: "inherit",
        }}
      >
        ← Back to pools
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 8, color: "var(--primary)", fontWeight: 700, fontSize: 12 }}>
        <Feather size={12} /> Launch your token in Sherwood Forest
      </div>

      <div className="rh-cf-grid">
        {/* ── Left (60%): the form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {/* Image + name + symbol */}
          <div className="rh-card" style={{ ...CARD, display: "flex", gap: 12 }}>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onPickImage(f);
              }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                border: `1px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
                borderRadius: 12, cursor: "pointer", color: "var(--muted-foreground)", fontSize: 10.5,
                width: 76, height: 76, boxSizing: "border-box", flexShrink: 0,
                background: dragOver ? "rgba(0,200,5,0.06)" : "transparent",
                overflow: "hidden", transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
              {imagePreview ? (
                <img src={imagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <UploadCloud size={18} />
                  <span style={{ textAlign: "center", lineHeight: 1.2 }}>Drop image</span>
                </>
              )}
            </label>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              {!imageFile && (
                <div style={{ color: "#ff9b9b", fontSize: 11 }}>Token image is required</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 116px", gap: 8 }}>
                <div>
                  <label style={LABEL}>Token name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sherwood Coin" maxLength={32} style={{ borderRadius: 12, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={LABEL}>Symbol</label>
                  <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SHRWD" maxLength={10} style={{ borderRadius: 12, width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rh-card" style={CARD}>
            <label style={LABEL}>Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's this token about?" style={{ borderRadius: 12, resize: "none" }} />
          </div>

          {/* Social links (collapsed by default) */}
          <div className="rh-card" style={CARD}>
            <button
              type="button"
              onClick={() => setShowSocials((v) => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                background: "none", border: "none", color: "var(--foreground)", fontWeight: 700, fontSize: 13,
                cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}
            >
              Social links (optional)
              <ChevronDown size={16} style={{ transform: showSocials ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {showSocials && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="Twitter / X — https://x.com/yourtoken" style={{ borderRadius: 12 }} />
                <input value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} placeholder="Telegram — https://t.me/yourtoken" style={{ borderRadius: 12 }} />
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="Website — https://yourtoken.xyz" style={{ borderRadius: 12 }} />
              </div>
            )}
          </div>

          {/* Hood Gate */}
          <div className={`rh-card rh-hoodgate ${hoodGateOn ? "rh-hoodgate-on" : "rh-hoodgate-off"}`} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "var(--foreground)", fontWeight: 700, fontSize: 15 }}>🏹 Hood Gate</div>
                <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 2 }}>
                  {hoodGateOn ? "Only diamond hands can enter your bonding curve" : "🔓 Open to everyone"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoodGateOn((v) => !v)}
                aria-pressed={hoodGateOn}
                style={{
                  position: "relative", width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                  background: hoodGateOn ? "linear-gradient(135deg, #00C805, #00E676)" : "var(--card)",
                  transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: hoodGateOn ? 23 : 3,
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>

            {hoodGateOn && (
              <div>
                <input
                  className="rh-range"
                  type="range"
                  min={HOOD_MIN}
                  max={HOOD_MAX}
                  step={1}
                  value={minAvgHoldDays}
                  onChange={(e) => setMinAvgHoldDays(Number(e.target.value))}
                  style={{ ["--rh-range-pct" as any]: `${gateRangePct}%` }}
                />
                <div className="rh-range-ticks">
                  {HOOD_TICKS.map((d) => (
                    <span
                      key={d}
                      className="rh-range-tick"
                      style={{ left: `${((d - HOOD_MIN) / (HOOD_MAX - HOOD_MIN)) * 100}%` }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <div style={{ color: "var(--primary)", fontWeight: 800, fontSize: 15 }}>
                    {minAvgHoldDays} day{minAvgHoldDays === 1 ? "" : "s"} — {gateTier.name} {gateTier.emoji}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* First buy */}
          <div className="rh-card" style={CARD}>
            <label style={LABEL}>First buy (ETH, optional)</label>
            <input value={initialBuyEth} onChange={(e) => setInitialBuyEth(e.target.value)} placeholder="0.0" type="number" min="0" step="any" style={{ borderRadius: 12 }} />
            <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginTop: 5 }}>
              You can buy up to 1% of total supply at launch.
            </div>
          </div>

          {/* Fee wallet (collapsed by default) */}
          <div className="rh-card" style={CARD}>
            <button
              type="button"
              onClick={() => setShowFeeWallet((v) => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                background: "none", border: "none", color: "var(--foreground)", fontWeight: 700, fontSize: 13,
                cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}
            >
              Fee wallet (optional)
              <ChevronDown size={16} style={{ transform: showFeeWallet ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {showFeeWallet && (
              <div style={{ marginTop: 10 }}>
                <input
                  value={feeWallet}
                  onChange={(e) => setFeeWallet(e.target.value)}
                  placeholder="Defaults to your connected wallet"
                  style={{ fontFamily: "monospace", borderRadius: 12 }}
                />
                <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginTop: 6 }}>
                  Revenue from trading fees goes to this wallet.
                </div>
                {!feeWalletValid && (
                  <div style={{ color: "#ff9b9b", fontSize: 11, marginTop: 6 }}>Not a valid address</div>
                )}
              </div>
            )}
          </div>

          {/* Launch */}
          {!authenticated ? (
            <LoginMenu
              dropUp
              style={{ width: "100%" }}
              trigger={(toggle) => (
                <button className="bg-primary" onClick={toggle} style={{ padding: "14px", fontWeight: 700, width: "100%", borderRadius: 14 }}>
                  Connect wallet to launch
                </button>
              )}
            />
          ) : !connected ? (
            <div style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center" }}>
              Waiting for your Robinhood Chain wallet…
            </div>
          ) : (
            <button
              className={`bg-primary${readyToLaunch ? " rh-launch-ready" : ""}`}
              onClick={handleLaunch}
              disabled={launching || !canLaunch}
              style={{ padding: "15px", fontWeight: 800, fontSize: 16, borderRadius: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: canLaunch ? 1 : 0.5 }}
            >
              {launching ? (
                <><Loader2 size={17} className="rh-spin" /> Launching…</>
              ) : (
                <>🏹 Launch Token</>
              )}
            </button>
          )}

          {address && (
            <div style={{ color: "var(--muted-foreground)", fontSize: 11, textAlign: "center" }}>
              Signing from {address.slice(0, 6)}…{address.slice(-4)}
            </div>
          )}

          {launchError && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff9b9b", fontSize: 13 }}>
              {launchError}
            </div>
          )}
        </div>

        {/* ── Right (40%): live preview ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="rh-card" style={{ ...CARD, padding: 16 }}>
            <div style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: "0.04em" }}>
              LIVE PREVIEW
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {imagePreview ? (
                <img src={imagePreview} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--card)", flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "var(--foreground)", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {name.trim() || "Your Token Name"}
                </div>
                <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>${symbol.trim() || "SYM"}</div>
              </div>
              <RobinhoodPhaseBadge phase="Bonding" />
            </div>

            {descPreview && (
              <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                {descPreview}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
              <span style={{ color: "#00E676", fontWeight: 800, fontSize: 16 }}>~{GRADUATION_ETH.toFixed(2)} ETH</span>
              <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>graduation target</span>
            </div>

            {hoodGateOn && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12,
                padding: "3px 10px", borderRadius: 999, background: "rgba(0,200,5,0.1)",
                color: "#00E676", fontSize: 11, fontWeight: 700,
              }}>
                {gateTier.emoji} {minAvgHoldDays}d+ gate
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 700 }}>Fee Split</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ color: "#00E676" }}>Creator {FEE_SPLIT.creator}%</span>
                <span style={{ color: "var(--muted-foreground)" }}> / </span>
                <span style={{ color: "var(--muted-foreground)" }}>Stakers {FEE_SPLIT.stakers}%</span>
              </span>
            </div>
          </div>

          <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 11.5 }}>
            Rewards shared with creators &amp; stakers 🏹
          </div>
        </div>
      </div>

      <style jsx global>{`
        .rh-spin { animation: rh-spin-kf 0.8s linear infinite; }
        @keyframes rh-spin-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .rh-cf-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 12px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .rh-cf-grid { grid-template-columns: 1fr; }
        }

        .rh-card { transition: box-shadow 0.2s ease, border-color 0.2s ease; }
        .rh-card:hover { border-color: rgba(0,200,5,0.3); box-shadow: 0 0 22px rgba(0,200,5,0.1); }

        .rh-hoodgate-off { opacity: 0.72; }
        .rh-hoodgate-on {
          border-color: rgba(0,200,5,0.4) !important;
          animation: rh-hoodgate-pulse 3s ease-in-out infinite;
        }
        @keyframes rh-hoodgate-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(0,200,5,0.22), 0 0 16px rgba(0,200,5,0.12); }
          50% { box-shadow: 0 0 0 1px rgba(0,200,5,0.4), 0 0 28px rgba(0,200,5,0.24); }
        }

        .rh-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #00C805 0%,
            #00E676 var(--rh-range-pct, 0%),
            rgba(255,255,255,0.08) var(--rh-range-pct, 0%),
            rgba(255,255,255,0.08) 100%
          );
          cursor: pointer;
        }
        .rh-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,200,5,0.35), 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
        }
        .rh-range::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%;
          background: #fff; border: none;
          box-shadow: 0 0 0 3px rgba(0,200,5,0.35), 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
        }
        .rh-range::-moz-range-progress { background: transparent; }
        .rh-range::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); }

        .rh-range-ticks {
          position: relative;
          height: 10px;
          margin-top: 2px;
        }
        .rh-range-tick {
          position: absolute;
          top: 0;
          width: 2px;
          height: 6px;
          border-radius: 1px;
          background: rgba(255,255,255,0.25);
          transform: translateX(-1px);
        }

        @keyframes rh-breathe {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,200,5,0.25); }
          50% { box-shadow: 0 4px 20px rgba(0,200,5,0.25), 0 0 34px rgba(0,200,5,0.55); }
        }
        .rh-launch-ready { animation: rh-breathe 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
