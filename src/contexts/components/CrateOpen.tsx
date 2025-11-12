"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

type Tier = "bronze" | "silver" | "gold" | "diamond";

export default function CrateOpen({
  tier = "bronze",
  title = "Open crate",
  onOpen,
}: {
  tier?: Tier;
  title?: string;
  // optional async callback you can wire later to run a claim tx
  onOpen?: () => Promise<{ label: string; sublabel?: string } | void>;
}) {
  const [stage, setStage] = useState<"idle" | "opening" | "revealed">("idle");
  const [result, setResult] = useState<{ label: string; sublabel?: string }>();

  const open = async () => {
    if (stage !== "idle") return;
    setStage("opening");
    // simulate latency if no callback provided
    const r =
      (await onOpen?.()) ??
      (await new Promise<{ label: string; sublabel?: string }>((res) =>
        setTimeout(() => res({ label: "1,250 $SOUND", sublabel: "Congrats!" }), 1300)
      ));
    setResult(r);
    setStage("revealed");
  };

  const palette: Record<Tier, string> = {
    bronze: "from-amber-900/70 via-amber-800/50 to-zinc-900/60 border-amber-500/30",
    silver: "from-slate-600/60 via-slate-700/40 to-zinc-900/60 border-slate-300/40",
    gold: "from-yellow-700/60 via-amber-600/40 to-zinc-900/60 border-yellow-300/40",
    diamond: "from-cyan-700/40 via-sky-700/30 to-zinc-900/60 border-cyan-300/40",
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="mb-3 text-center">
        <div className="text-xs uppercase tracking-widest text-white/60">{tier} crate</div>
        <div className="text-lg font-semibold">{title}</div>
      </div>

      <AnimatePresence mode="wait">
        {stage !== "revealed" ? (
          <motion.button
            key="crate"
            aria-label="Open crate"
            onClick={open}
            className={`relative w-full h-56 rounded-2xl border backdrop-blur-sm shadow-xl overflow-hidden
              bg-gradient-to-br ${palette[tier]}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
          >
            {/* Cheap “shine” sweep */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-120%" }}
              animate={stage === "opening" ? { x: ["-120%", "120%"] } : {}}
              transition={stage === "opening" ? { duration: 0.9, ease: "easeInOut" } : {}}
              style={{
                background:
                  "linear-gradient(75deg, transparent 45%, rgba(255,255,255,.25) 50%, transparent 55%)",
              }}
            />

            {/* Lid wobble / lock pulse */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={
                stage === "opening"
                  ? { rotate: [0, 2, -2, 1, -1, 0], scale: [1, 1.02, 1] }
                  : {}
              }
              transition={{ duration: 0.9 }}
            >
              <CrateFace tier={tier} busy={stage === "opening"} />
            </motion.div>

            {/* Subtle grain */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                 style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')" }} />
          </motion.button>
        ) : (
          <motion.div
            key="reveal"
            className="relative w-full h-56 rounded-2xl border border-emerald-400/40 bg-emerald-900/30 shadow-2xl overflow-hidden flex items-center justify-center text-center"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <Sparkles />
            <div>
              <div className="text-sm text-white/70">You received</div>
              <div className="text-3xl font-bold mt-1">{result?.label}</div>
              {result?.sublabel && (
                <div className="text-sm text-white/60 mt-1">{result.sublabel}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiny helper text */}
      {stage === "idle" && (
        <p className="mt-3 text-center text-xs text-white/50">
          Click to open. Animation is lightweight—no canvas, no heavy libs.
        </p>
      )}
    </div>
  );
}

function CrateFace({ tier, busy }: { tier: "bronze" | "silver" | "gold" | "diamond"; busy: boolean }) {
  const ring =
    tier === "diamond"
      ? "ring-cyan-300/40"
      : tier === "gold"
      ? "ring-yellow-300/40"
      : tier === "silver"
      ? "ring-slate-300/40"
      : "ring-amber-400/40";

  return (
    <div
      className={`w-40 h-40 rounded-xl bg-zinc-900/40 border border-white/10 backdrop-blur-sm ring-2 ${ring} flex items-center justify-center`}
    >
      <motion.div
        className="w-9 h-9 rounded-lg bg-white/10 border border-white/20"
        animate={busy ? { scale: [1, 1.1, 1], opacity: [0.9, 1, 0.9] } : {}}
        transition={{ repeat: busy ? Infinity : 0, duration: 0.8 }}
      />
    </div>
  );
}

function Sparkles() {
  // super-light CSS sparkles
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-6 top-6 w-1 h-1 bg-white/80 rounded-full animate-ping" />
      <div className="absolute right-6 top-10 w-1 h-1 bg-white/70 rounded-full animate-ping [animation-delay:.2s]" />
      <div className="absolute left-10 bottom-8 w-1 h-1 bg-white/70 rounded-full animate-ping [animation-delay:.4s]" />
      <div className="absolute right-10 bottom-6 w-1 h-1 bg-white/80 rounded-full animate-ping [animation-delay:.1s]" />
    </div>
  );
}
