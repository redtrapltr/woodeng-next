import React, { useRef, useState } from "react";

// Props with all standard button props
type LiquidButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function LiquidButton({ children, disabled, ...props }: LiquidButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; key: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rippleCount = useRef(0);

  // Handle ripple on mouseDown (or onClick if you prefer)
  function handleRipple(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    if (disabled) return;
    const rect = btnRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples(ripples => [
      ...ripples,
      { x, y, key: rippleCount.current++ },
    ]);
  }

  // Remove ripple after animation
  function handleRippleEnd(key: number) {
    setRipples(ripples => ripples.filter(r => r.key !== key));
  }

  return (
    <button
      ref={btnRef}
      type="button"
      className={`liquid-btn w-full py-3 text-lg font-bold rounded-2xl mt-7 relative overflow-hidden
        text-white shadow-lg hover:shadow-xl active:scale-95
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      disabled={disabled}
      onMouseDown={handleRipple}
      {...props}
    >
      {/* Ripple Elements */}
      {ripples.map(ripple => (
        <span
          key={ripple.key}
          className="ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
          onAnimationEnd={() => handleRippleEnd(ripple.key)}
        />
      ))}

      {/* Main background */}
      <span
        className="liquid-btn-bg"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          borderRadius: "inherit",
          background:
            "linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 50%, #FFE66D 100%)",
        }}
      />

      {/* Button Text */}
      <span
        style={{
          position: "relative",
          zIndex: 2,
          display: "block",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "1.17em",
          letterSpacing: "0.02em",
          textShadow: "0 1px 10px #0006",
        }}
      >
        {children}
      </span>

      {/* Styles for ripple and button */}
      <style jsx>{`
        .liquid-btn {
          border: none;
          background: none;
          border-radius: 1rem;
          will-change: filter;
          box-shadow: 0 3px 20px 0 #0000002a;
        }
        .liquid-btn:active {
          filter: brightness(0.97) saturate(1.1);
        }
        .ripple {
          position: absolute;
          width: 160px;
          height: 160px;
          margin-left: -80px;
          margin-top: -80px;
          border-radius: 50%;
          background: radial-gradient(circle, #4ecdc4bb 0%, #1bc6fa77 80%, transparent 100%);
          pointer-events: none;
          animation: ripple-animate 0.6s cubic-bezier(.2,1.4,.48,1) forwards;
          z-index: 1;
        }
        @keyframes ripple-animate {
          0% {
            transform: scale(0.3);
            opacity: 0.5;
          }
          60% {
            transform: scale(1.05);
            opacity: 0.24;
          }
          90% {
            transform: scale(1.5);
            opacity: 0.10;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
}
