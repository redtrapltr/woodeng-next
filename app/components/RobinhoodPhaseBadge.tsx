import React from "react";
import type { PoolPhase } from "../lib/robinhoodChain";

const STYLES: Record<PoolPhase, { bg: string; color: string; label: string }> = {
  Bonding: { bg: "rgba(0,200,5,0.12)", color: "#00E676", label: "🏹 Bonding" },
  Graduated: { bg: "rgba(255,255,255,0.08)", color: "#e6e6ff", label: "🏰 Graduated" },
};

export default function RobinhoodPhaseBadge({ phase }: { phase: PoolPhase }) {
  const s = STYLES[phase];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
