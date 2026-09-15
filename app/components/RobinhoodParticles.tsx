"use client";

import React, { useMemo } from "react";
import { useChainMode } from "../contexts/NetworkContext";

// Pure-CSS drifting sparkle field — no canvas/animation library, just
// randomized keyframe delays/durations per dot so the drift never looks synced.
const PARTICLE_COUNT = 26;

function seededParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 1000) / 10, // 0–100%
    size: 2 + Math.round(Math.random() * 4), // 2–6px
    duration: 14 + Math.round(Math.random() * 16), // 14–30s
    delay: -Math.round(Math.random() * 30), // negative = already mid-flight on mount
    opacity: 0.25 + Math.random() * 0.45,
  }));
}

export default function RobinhoodParticles() {
  const { isRobinhood } = useChainMode();
  const particles = useMemo(() => seededParticles(), []);

  if (!isRobinhood) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <style jsx>{`
        .rh-particle {
          position: absolute;
          bottom: -10px;
          border-radius: 50%;
          background: radial-gradient(circle, #00E676 0%, rgba(0, 200, 5, 0) 70%);
          animation-name: rh-drift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes rh-drift {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: var(--rh-op, 0.4); }
          50% { transform: translateY(-52vh) translateX(12px); }
          90% { opacity: var(--rh-op, 0.4); }
          100% { transform: translateY(-105vh) translateX(-8px); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <span
          key={p.id}
          className="rh-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--rh-op" as any]: p.opacity,
          }}
        />
      ))}
    </div>
  );
}
