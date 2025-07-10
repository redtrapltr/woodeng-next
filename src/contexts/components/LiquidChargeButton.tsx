import React, { useRef, useState, useEffect } from "react";

const NOTE_EMOJIS = ["🎶", "🎵", "🎼", "🎤", "🎷", "🎸"];

type Note = {
  x: number;
  delay: number;
  note: string;
  key: string;
};

type LiquidChargeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function LiquidChargeButton({
  children,
  disabled,
  ...props
}: LiquidChargeButtonProps) {
  const [progress, setProgress] = useState(0); // 0-100
  const [charging, setCharging] = useState(false);
  const [flyingNotes, setFlyingNotes] = useState<Note[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [noteCount, setNoteCount] = useState(0);

  // Progress bar animation
  useEffect(() => {
    let frame: number | undefined;
    if (charging && progress < 100) {
      frame = window.setInterval(() => {
        setProgress((p) => Math.min(100, p + 1.6));
      }, 13);
    } else if (!charging && progress > 0) {
      frame = window.setInterval(() => {
        setProgress((p) => Math.max(0, p - 2.4));
      }, 11);
    }
    return () => { if (frame) window.clearInterval(frame); };
  }, [charging, progress]);

// Launch musical notes at intervals while fully charged & hovered
useEffect(() => {
  if (!(charging && progress >= 100)) return;

  let cancelled = false;
  const width = buttonRef.current?.offsetWidth || 320;

  function launchNoteLoop(count: number) {
    if (cancelled) return;
    // Limit to 3 notes at once
    setFlyingNotes((prev) => {
      if (prev.length >= 3) return prev;
      // Space notes across the button: up to 6 spots
      const spots = [0.13, 0.29, 0.45, 0.62, 0.78, 0.89];
      const frac = spots[count % spots.length];
      const x = Math.round(width * frac);

      return [
        ...prev,
        {
          x,
          delay: 0,
          note: NOTE_EMOJIS[count % NOTE_EMOJIS.length],
          key: `note-${count}-${Date.now()}`
        }
      ];
    });
    setNoteCount((prev) => prev + 1);

    setTimeout(() => {
      if (charging && progress >= 100) {
        launchNoteLoop(count + 1);
      }
    }, 700 + Math.random() * 220); // slower: ~0.7s between notes
  }

  launchNoteLoop(noteCount);

  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line
}, [charging, progress]);


  // Remove old notes after animation (1.25s fade-up)
  useEffect(() => {
    if (!flyingNotes.length) return;
    const cleanup = setTimeout(() => {
      setFlyingNotes((prev) =>
        prev.filter(
          (n) => Date.now() - parseInt(n.key.split("-").slice(-1)[0]) < 1200
        )
      );
    }, 800);
    return () => clearTimeout(cleanup);
  }, [flyingNotes]);

  // Reset notes when progress bar is reset (e.g. mouse leaves)
  useEffect(() => {
    if (!charging || progress < 100) {
      setFlyingNotes([]);
      setNoteCount(0);
    }
  }, [charging, progress]);

  function onHoverStart() {
    if (!disabled) setCharging(true);
  }
  function onHoverEnd() {
    setCharging(false);
  }

  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible", pointerEvents: disabled ? "none" : undefined }}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`liquid-charge-btn w-full py-3 text-lg font-bold rounded-2xl mt-7 relative overflow-hidden
          text-white shadow-lg hover:shadow-xl active:scale-95 select-none
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        {...props}
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* Main gradient BG */}
        <span
          className="main-bg"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            borderRadius: "inherit",
            background:
              "linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 50%, #FFE66D 100%)",
          }}
          aria-hidden
        />
        {/* Progress bar overlay */}
        <span
          className="progress-bar"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            width: `${progress}%`,
            background:
              "linear-gradient(90deg, #00c6ff 10%, #0072ff 80%)",
            borderRadius: "inherit",
            transition: progress === 0 || progress === 100
              ? "width 0.32s cubic-bezier(.5,1.3,.5,.98)"
              : "width 0.16s linear",
            mixBlendMode: "screen",
          }}
          aria-hidden
        />
        {/* Button Text */}
        <span
          style={{
            position: "relative",
            zIndex: 2,
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.13em",
            letterSpacing: ".01em",
            textShadow: "0 1px 10px #0006",
            display: "inline-block",
            transition: "color 0.16s",
            pointerEvents: "none",
          }}
        >
          {children}
        </span>
        {/* Styles */}
        <style jsx>{`
          .liquid-charge-btn {
            border: none;
            background: none;
            border-radius: 1rem;
            box-shadow: 0 3px 20px 0 #0000002a;
          }
          .liquid-charge-btn:active {
            filter: brightness(0.97) saturate(1.12);
          }
        `}</style>
      </button>
      {/* Musical note explosion */}
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        pointerEvents: "none",
        height: 38,
        zIndex: 99,
      }}>
        {flyingNotes.map((note) => (
          <span
            key={note.key}
            style={{
              position: "absolute",
              left: note.x,
              bottom: 1,
              fontSize: 22 + Math.random() * 9,
              animation: `note-fly 1.18s 0s both cubic-bezier(.42,1.7,.7,1)`,
              pointerEvents: "none",
              zIndex: 99,
              userSelect: "none",
              filter: "drop-shadow(0 1px 6px #0be1ff99)",
            }}
          >
            {note.note}
          </span>
        ))}
        <style jsx>{`
          @keyframes note-fly {
            0% { opacity: 0; transform: translateY(0) scale(1);}
            7% { opacity: 1;}
            88% { opacity: 1; }
            100% { opacity: 0; transform: translateY(-72px) scale(1.26);}
          }
        `}</style>
      </div>
    </div>
  );
}
