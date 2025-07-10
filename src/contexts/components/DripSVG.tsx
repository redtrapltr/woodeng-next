import React from "react";

// DripSVG: always stretches exactly to button width
export function DripSVG({ show }: { show: boolean }) {
  return (
    <svg
      viewBox="0 0 100 18"
      width="100%"
      height="38"
      style={{
        display: show ? "block" : "none",
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id="drip-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00c6ff" />
          <stop offset="100%" stopColor="#0072ff" />
        </linearGradient>
      </defs>
      <path
        // Neat, modern liquid look (edit for more/less drama!)
        d="
          M0,0 
          H100 
          V9
          Q98,13 94,10 
          Q92,12 90,17 
          Q86,14 83,11 
          Q81,15 77,10 
          Q74,15 70,13 
          Q67,15 64,9
          Q60,17 57,13 
          Q54,18 50,11 
          Q46,17 43,14 
          Q40,16 36,10 
          Q33,15 30,12 
          Q27,14 24,8 
          Q20,18 17,9 
          Q14,15 11,10 
          Q6,16 3,8 
          Q1,12 0,9
          Z
        "
        fill="url(#drip-gradient)"
        style={{
          filter: "drop-shadow(0 4px 10px #00c6ff44)",
          transition: "d 0.42s cubic-bezier(.55,1.6,.45,1.1)",
          animation: show ? "dripAppear2 1.18s cubic-bezier(.55,1.6,.45,1.1)" : "none",
        }}
      />
      <style>
        {`
          @keyframes dripAppear2 {
            0% {
              opacity: 0;
              transform: translateY(-8px) scaleY(0.82);
            }
            60% {
              opacity: 1;
              transform: translateY(2px) scaleY(1.10);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scaleY(1);
            }
          }
        `}
      </style>
    </svg>
  );
}
