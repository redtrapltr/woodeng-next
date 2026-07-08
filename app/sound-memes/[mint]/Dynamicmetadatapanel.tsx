"use client";

/**
 * DynamicMetadataPanel — SWL-444 "Living Meme" Creator Update Panel
 *
 * Renders on /sound-memes/[mint] when wallet === locker.locker_owner
 *
 * Flow:
 *  1. Creator uploads new image + audio via drag-drop
 *  2. Files are uploaded to Pinata (IPFS) → returns ipfs:// URIs
 *  3. New metadata JSON is assembled (preserving name/symbol from chain)
 *  4. Metadata JSON uploaded → gets a final URI
 *  5. Calls update_locker_uri on the meme_locker_factory program
 *     which writes the new URI to locker.meme_uri on-chain.
 *     Future NFT minters will get this URI permanently baked in
 *     via CreateMetadataAccountV3 (is_mutable: false).
 *     Previously minted NFTs are unaffected.
 *
 * Dependencies:
 *   @project-serum/anchor
 *   @solana/wallet-adapter-react
 *   @solana/web3.js
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import {
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import type { Idl } from "@project-serum/anchor";
import lockerIdlJson from "../../idl/hybrid_meme_coin_nft_locker.json";

// ── Constants ────────────────────────────────────────────────────────────────

const LOCKER_PROGRAM_ID = new PublicKey(
  "cJcMJ8YWacxRPMG5r1E8GmVgxnS9KogUe6m7sN2TaHS"
);

const lockerIdl = lockerIdlJson as Idl;

// ── Types ────────────────────────────────────────────────────────────────────

interface CurrentMetadata {
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  animation_url?: string;
  description?: string;
}

interface DynamicMetadataPanelProps {
  /** The SPL token mint of the meme coin */
  memeMint: string;
  /** The locker PDA address (from meme_locker_factory) */
  lockerPda: string;
  /** The wallet that created the locker (locker.locker_owner) */
  lockerOwner: string;
  /** Current on-chain metadata (fetched from the locker's meme_uri) */
  currentMetadata: CurrentMetadata;
  /** Called after successful on-chain update */
  onUpdateSuccess?: (newUri: string, newImageUrl: string, newAudioUrl: string) => void;
}

// ── Upload helpers (Pinata — matching the rest of the SWL-444 app) ──────────

async function pinFile(file: File): Promise<string> {
  const { jwt } = await fetch("/api/pinata-token")
    .then((r) => {
      if (!r.ok) throw new Error("Could not fetch Pinata token");
      return r.json() as Promise<{ jwt: string }>;
    });
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || data.message || "Pinata upload failed");
  return `ipfs://${data.IpfsHash}`;
}

async function uploadMetadataJSON(metadata: object): Promise<string> {
  const blob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });
  return pinFile(new File([blob], "metadata.json"));
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface DropZoneProps {
  label: string;
  accept: string;
  icon: React.ReactNode;
  preview?: string;
  previewType: "image" | "audio";
  onFile: (f: File) => void;
}

function DropZone({
  label,
  accept,
  icon,
  preview,
  previewType,
  onFile,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      className="drop-zone"
      data-dragging={dragging}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />

      {!preview && (
        <div className="drop-zone__empty">
          <span className="drop-zone__icon">{icon}</span>
          <span className="drop-zone__label">{label}</span>
          <span className="drop-zone__hint">drag & drop or click</span>
        </div>
      )}

      {preview && previewType === "image" && (
        <div className="drop-zone__preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" />
          <div className="drop-zone__replace">replace →</div>
        </div>
      )}

      {preview && previewType === "audio" && (
        <div className="drop-zone__audio-preview">
          <span className="drop-zone__icon drop-zone__icon--sm">{icon}</span>
          <audio src={preview} controls />
          <div className="drop-zone__replace">replace →</div>
        </div>
      )}
    </div>
  );
}

type Step =
  | "idle"
  | "uploading-image"
  | "uploading-audio"
  | "uploading-metadata"
  | "sending-tx"
  | "confirming"
  | "done"
  | "error";

// ── Main component ───────────────────────────────────────────────────────────

export default function DynamicMetadataPanel({
  memeMint,
  lockerPda,
  lockerOwner,
  currentMetadata,
  onUpdateSuccess,
}: DynamicMetadataPanelProps) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { publicKey: unifiedPublicKey, connected: unifiedConnected, sendTransaction: unifiedSendTransaction, signTransaction: unifiedSignTransaction } = useUnifiedWallet();
  const effectivePublicKey = (wallet.connected && wallet.publicKey) ? wallet.publicKey : unifiedPublicKey;
  const effectiveConnected = wallet.connected || unifiedConnected;
  const effectiveSendTx = (wallet.connected && wallet.sendTransaction) ? wallet.sendTransaction : unifiedSendTransaction;
  const effectiveSignTx = (wallet.connected && wallet.signTransaction) ? wallet.signTransaction : unifiedSignTransaction;

  const anchorWallet = useMemo(() => {
    if (wallet.connected && wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      return {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
    }
    if (!effectivePublicKey || !effectiveSignTx) return null;
    return {
      publicKey: effectivePublicKey,
      signTransaction: effectiveSignTx,
      signAllTransactions: async (txs: Transaction[]) => {
        const signed: Transaction[] = [];
        for (const tx of txs) signed.push(await effectiveSignTx(tx));
        return signed;
      },
    };
  }, [wallet, effectivePublicKey, effectiveSignTx]);

  // Creator guard — only the locker owner sees this panel
  const isCreator =
    effectivePublicKey && effectivePublicKey.toBase58() === lockerOwner;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(
    currentMetadata.image ?? ""
  );
  const [audioPreview, setAudioPreview] = useState<string>(
    currentMetadata.animation_url ?? ""
  );
  const [description, setDescription] = useState(
    currentMetadata.description ?? ""
  );
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txSig, setTxSig] = useState("");

  const handleImageFile = useCallback((f: File) => {
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  }, []);

  const handleAudioFile = useCallback((f: File) => {
    setAudioFile(f);
    setAudioPreview(URL.createObjectURL(f));
  }, []);

  const hasChanges =
    !!imageFile || !!audioFile || description !== (currentMetadata.description ?? "");

  const handleUpdate = async () => {
    if (!effectivePublicKey || !isCreator) return;
    setStep("idle");
    setErrorMsg("");

    try {
      // 1. Upload image if changed
      let finalImageUri = currentMetadata.image ?? "";
      if (imageFile) {
        setStep("uploading-image");
        finalImageUri = await pinFile(imageFile);
      }

      // 2. Upload audio if changed
      let finalAudioUri = currentMetadata.animation_url ?? "";
      if (audioFile) {
        setStep("uploading-audio");
        finalAudioUri = await pinFile(audioFile);
      }

      // 3. Build new metadata JSON (name/symbol preserved from chain)
      setStep("uploading-metadata");
      const newMetadata = {
        name: currentMetadata.name,
        symbol: currentMetadata.symbol,
        description,
        image: finalImageUri,
        animation_url: finalAudioUri,
        properties: {
          files: [
            { uri: finalImageUri, type: imageFile?.type ?? "image/png" },
            { uri: finalAudioUri, type: audioFile?.type ?? "audio/mpeg" },
          ],
          category: "audio",
        },
        attributes: [
          { trait_type: "Platform", value: "SWL-444" },
          { trait_type: "Type", value: "Sound Meme" },
          { trait_type: "Mint", value: memeMint },
        ],
      };
      const newUri = await uploadMetadataJSON(newMetadata);

      // 4. On-chain: call update_locker_uri on the meme_locker_factory program
      //    This writes newUri into locker.meme_uri on-chain.
      //    Only requires: caller (signer) + locker PDA.
      //    The PDA constraint enforces locker.locker_owner == caller.
      setStep("sending-tx");

      if (!anchorWallet) throw new Error("Wallet not ready.");
      const provider = new AnchorProvider(connection, anchorWallet, {
        preflightCommitment: "confirmed",
      });
      const lockerProgram = new Program(lockerIdl, LOCKER_PROGRAM_ID, provider);

      const updateIx = await (lockerProgram.methods as any)
        .updateLockerUri(newUri)
        .accounts({
          caller: effectivePublicKey,
          locker: new PublicKey(lockerPda),
        })
        .instruction();

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        updateIx
      );

      const sig = await effectiveSendTx(tx, connection, {
        skipPreflight: false,
      });
      setTxSig(sig);

      setStep("confirming");
      await connection.confirmTransaction(sig, "confirmed");

      setStep("done");
      onUpdateSuccess?.(newUri, finalImageUri, finalAudioUri);
    } catch (e: unknown) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  if (!isCreator) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      <section className="dmp">
        {/* Header */}
        <header className="dmp__header">
          <div className="dmp__header-left">
            <span className="dmp__badge">✦ CREATOR</span>
            <h2 className="dmp__title">Living Meme Studio</h2>
          </div>
          <p className="dmp__subtitle">
            Update your meme&apos;s image &amp; audio — future NFT minters get the
            new version. Name and symbol are permanent.
          </p>
        </header>

        {/* Lock notice */}
        <div className="dmp__lock-notice">
          <span className="dmp__lock-icon">🔒</span>
          <span>
            <strong>{currentMetadata.name}</strong> ({currentMetadata.symbol})
            &nbsp;— immutable on-chain
          </span>
        </div>

        {/* Upload grid */}
        <div className="dmp__grid">
          <div className="dmp__col">
            <label className="dmp__col-label">
              <span className="dmp__col-label-icon">🖼</span> Meme Image
            </label>
            <DropZone
              label="Drop new image"
              accept="image/*"
              icon={<ImgIcon />}
              preview={imagePreview}
              previewType="image"
              onFile={handleImageFile}
            />
            {imageFile && (
              <p className="dmp__filename">
                {imageFile.name} &middot;{" "}
                {(imageFile.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div className="dmp__col">
            <label className="dmp__col-label">
              <span className="dmp__col-label-icon">🔊</span> Meme Audio
            </label>
            <DropZone
              label="Drop new audio"
              accept="audio/*"
              icon={<AudioIcon />}
              preview={audioPreview}
              previewType="audio"
              onFile={handleAudioFile}
            />
            {audioFile && (
              <p className="dmp__filename">
                {audioFile.name} &middot;{" "}
                {(audioFile.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="dmp__desc-row">
          <label className="dmp__col-label" htmlFor="dmp-desc">
            <span className="dmp__col-label-icon">📝</span> Description
          </label>
          <textarea
            id="dmp-desc"
            className="dmp__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your living meme..."
            maxLength={500}
            rows={3}
          />
          <span className="dmp__char-count">{description.length}/500</span>
        </div>

        {/* Status bar */}
        {step !== "idle" && (
          <div className={`dmp__status dmp__status--${step}`}>
            {step === "uploading-image" && (
              <><Spinner /> Uploading image to IPFS…</>
            )}
            {step === "uploading-audio" && (
              <><Spinner /> Uploading audio to IPFS…</>
            )}
            {step === "uploading-metadata" && (
              <><Spinner /> Uploading metadata JSON…</>
            )}
            {step === "sending-tx" && (
              <><Spinner /> Awaiting wallet signature…</>
            )}
            {step === "confirming" && (
              <><Spinner /> Confirming transaction…</>
            )}
            {step === "done" && (
              <>
                ✅ Meme updated!&nbsp;
                <a
                  className="dmp__tx-link"
                  href={`https://solscan.io/tx/${txSig}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View tx ↗
                </a>
              </>
            )}
            {step === "error" && (
              <>⚠ {errorMsg}</>
            )}
          </div>
        )}

        {/* Action */}
        <button
          className="dmp__btn"
          disabled={!hasChanges || (step !== "idle" && step !== "error" && step !== "done")}
          onClick={handleUpdate}
        >
          {step === "done" ? "✦ Updated!" : "✦ Publish Update"}
        </button>

        <p className="dmp__cost-note">
          ~0.001 SOL for on-chain locker URI update &middot; IPFS pinned via Pinata
        </p>
      </section>
    </>
  );
}

// ── Inline icons ─────────────────────────────────────────────────────────────

function ImgIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function Spinner() {
  return <span className="dmp__spinner" aria-hidden />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  .dmp {
    --c-bg: #0d0d11;
    --c-surface: #16161e;
    --c-surface2: #1e1e2a;
    --c-border: rgba(255,255,255,0.07);
    --c-accent: #c8ff00;
    --c-accent2: #ff6b35;
    --c-text: #e8e8f0;
    --c-muted: #6b6b80;
    --c-error: #ff4444;
    --c-ok: #00e676;

    font-family: 'Syne', sans-serif;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: 16px;
    padding: 28px;
    max-width: 740px;
    color: var(--c-text);
    position: relative;
    overflow: hidden;
  }

  .dmp::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    border-radius: inherit;
  }

  .dmp__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .dmp__badge {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.15em;
    color: var(--c-accent);
    background: rgba(200, 255, 0, 0.08);
    border: 1px solid rgba(200, 255, 0, 0.2);
    border-radius: 4px;
    padding: 3px 8px;
    margin-bottom: 6px;
  }

  .dmp__title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0;
    background: linear-gradient(135deg, #fff 0%, var(--c-accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .dmp__subtitle {
    font-size: 13px;
    color: var(--c-muted);
    margin: 6px 0 0;
    max-width: 320px;
    line-height: 1.5;
  }

  .dmp__lock-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 107, 53, 0.08);
    border: 1px solid rgba(255, 107, 53, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #ffaa80;
    margin-bottom: 24px;
    font-family: 'JetBrains Mono', monospace;
  }

  .dmp__lock-icon { font-size: 15px; }

  .dmp__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }

  @media (max-width: 560px) {
    .dmp__grid { grid-template-columns: 1fr; }
  }

  .dmp__col-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--c-muted);
    margin-bottom: 8px;
    cursor: default;
  }

  .dmp__col-label-icon { font-size: 15px; }

  .drop-zone {
    border: 1.5px dashed var(--c-border);
    border-radius: 12px;
    background: var(--c-surface);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    min-height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  .drop-zone:hover,
  .drop-zone[data-dragging="true"] {
    border-color: var(--c-accent);
    background: rgba(200, 255, 0, 0.04);
  }

  .drop-zone__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    color: var(--c-muted);
  }

  .drop-zone__icon { opacity: 0.5; }
  .drop-zone__icon--sm { opacity: 0.7; }

  .drop-zone__label {
    font-size: 13px;
    font-weight: 600;
  }

  .drop-zone__hint {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    opacity: 0.6;
  }

  .drop-zone__preview {
    width: 100%;
    height: 140px;
    position: relative;
  }

  .drop-zone__preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px;
  }

  .drop-zone__replace {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--c-accent);
    letter-spacing: 0.05em;
    border-radius: 10px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .drop-zone:hover .drop-zone__replace { opacity: 1; }

  .drop-zone__audio-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    width: 100%;
  }

  .drop-zone__audio-preview audio {
    width: 100%;
    height: 36px;
    accent-color: var(--c-accent);
  }

  .dmp__filename {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--c-accent);
    margin: 6px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dmp__desc-row {
    position: relative;
    margin-bottom: 20px;
  }

  .dmp__textarea {
    width: 100%;
    background: var(--c-surface);
    border: 1.5px solid var(--c-border);
    border-radius: 10px;
    color: var(--c-text);
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    padding: 12px 14px;
    resize: vertical;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .dmp__textarea:focus {
    outline: none;
    border-color: rgba(200, 255, 0, 0.4);
  }

  .dmp__textarea::placeholder { color: var(--c-muted); }

  .dmp__char-count {
    position: absolute;
    bottom: 10px;
    right: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--c-muted);
    pointer-events: none;
  }

  .dmp__status {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    margin-bottom: 16px;
    border: 1px solid;
  }

  .dmp__status--uploading-image,
  .dmp__status--uploading-audio,
  .dmp__status--uploading-metadata,
  .dmp__status--sending-tx,
  .dmp__status--confirming {
    background: rgba(200, 255, 0, 0.05);
    border-color: rgba(200, 255, 0, 0.2);
    color: var(--c-accent);
  }

  .dmp__status--done {
    background: rgba(0, 230, 118, 0.07);
    border-color: rgba(0, 230, 118, 0.25);
    color: var(--c-ok);
  }

  .dmp__status--error {
    background: rgba(255, 68, 68, 0.07);
    border-color: rgba(255, 68, 68, 0.25);
    color: var(--c-error);
  }

  .dmp__tx-link {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .dmp__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(200, 255, 0, 0.2);
    border-top-color: var(--c-accent);
    border-radius: 50%;
    animation: dmp-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes dmp-spin { to { transform: rotate(360deg); } }

  .dmp__btn {
    width: 100%;
    padding: 14px 24px;
    background: var(--c-accent);
    color: #0d0d11;
    border: none;
    border-radius: 10px;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.12s;
    position: relative;
    overflow: hidden;
  }

  .dmp__btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
    pointer-events: none;
  }

  .dmp__btn:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
  }

  .dmp__btn:active:not(:disabled) { transform: translateY(0); }

  .dmp__btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
  }

  .dmp__cost-note {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--c-muted);
    text-align: center;
    margin: 10px 0 0;
  }
`;
