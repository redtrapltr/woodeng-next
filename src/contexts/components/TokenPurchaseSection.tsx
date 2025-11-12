// src/contexts/components/TokenPurchaseSection.tsx
"use client";

import React, { useState } from "react";
import { Container } from "./Container";
import {
  Coins,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Rocket,
  Copy,
  Check,
} from "lucide-react";

// Custom pulse/fade keyframes for glows
const extraGlowStyles = `
@keyframes fadePulse {
  0%,100% { opacity: .62; }
  50%    { opacity: 1;   }
}
@keyframes fadePulseReverse {
  0%,100% { opacity: .28; }
  50%    { opacity: .48; }
}
`;

export function TokenPurchaseSection() {
  const [copied, setCopied] = useState(false);
  const contractAddress = "83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-6 md:py-8">
      {/* Animate glows */}
      <style>{extraGlowStyles}</style>

      <Container>
        {/* 1) Frame locked to Container’s max-width */}
           <div className="
            relative
            overflow-hidden
            bg-background
            -mx-4 px-4
            sm:-mx-6 sm:px-6
            lg:-mx-16 lg:px-8
            rounded-[2.2rem]
            border-2 border-[#7a80fa]
          ">
          {/* 2) Blurred gradient background clipped inside the same rounding */}
          <div
            className="
              absolute inset-0
              bg-gradient-to-r from-[#8b5cf6]/15 via-[#4f8ef5]/15 to-[#8b5cf6]/15
              rounded-[2.2rem]
              blur-xl opacity-80 pointer-events-none
            "
          />

          {/* 3) Content wrapper (backdrop blur + padding) */}
          <div className="relative backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              {/* Left: mascot + glows */}
              <div className="relative h-full min-h-[120px] md:min-h-[210px] flex items-center">
                <div
                  className="absolute left-0 md:left-1/4 top-0 md:top-1/4 pointer-events-none"
                  style={{
                    width: "160px",
                    height: "160px",
                    borderRadius: "50%",
                    background: "rgba(114,107,224,0.13)",
                    animation: "fadePulseReverse 3.5s ease-in-out infinite",
                    zIndex: 0,
                  }}
                />
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    width: "250px",
                    height: "250px",
                    background:
                      "radial-gradient(circle at 50% 50%, #7a80fa 55%, #4567e9 90%)",
                    filter: "blur(65px)",
                    opacity: 0.75,
                    borderRadius: "50%",
                    animation: "fadePulse 2.6s ease-in-out infinite",
                    zIndex: 1,
                  }}
                />
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    width: "135px",
                    height: "135px",
                    borderRadius: "50%",
                    background: "rgba(139,92,246,0.22)",
                    animation: "fadePulseReverse 2.7s ease-in-out infinite",
                    zIndex: 2,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <img
                    src="https://i.postimg.cc/KzwCSxDx/Logo-WB.png"
                    alt="Woodeng Mascot"
                    className="h-20 md:h-60 object-contain"
                  />
                </div>
                <Coins
                  className="absolute top-1/4 right-1/4 w-3 md:w-8 h-3 md:h-8 text-primary animate-bounce z-20"
                  style={{ animationDuration: "3s" }}
                />
                <TrendingUp
                  className="absolute bottom-1/4 left-1/4 w-2 md:w-6 h-2 md:h-6 text-secondary animate-bounce z-20"
                  style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
                />
                <Sparkles
                  className="absolute top-1/3 left-1/4 w-2 md:w-5 h-2 md:h-5 text-primary/80 animate-pulse z-20"
                  style={{ animationDuration: "4s" }}
                />
              </div>

              {/* Right: content */}
              <div className="p-4 md:p-8 lg:p-12">
                <div className="space-y-4 md:space-y-6">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7d80be]/15 rounded-full">
                    <Coins className="w-5 h-5 text-[#a892fc]" />
                    <span className="text-base font-normal text-white">
                      $WOODENG Token
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-[#6d85fa] to-[#906cff] bg-clip-text text-transparent">
                    Need Woodeng Tokens?
                  </h2>

                  <p className="text-sm md:text-lg text-muted-foreground">
                    Power your SWL444 Tokens
                    with the native Woodeng token and earn platform fees
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a
                      href="https://raydium.io/swap/?inputMint=sol&outputMint=83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-gradient-to-r from-[#7a5cff] to-[#8e7bfa] text-white rounded-full flex items-center gap-2 transition hover:scale-105 shadow-lg shadow-[#7a5cff]/30"
                    >
                      <Rocket className="w-5 h-5" />
                      Buy on Raydium
                    </a>
                    <a
                      href="/whitepaper#section-5"
                      className="px-6 py-3 border border-primary/20 rounded-full text-white transition hover:-translate-y-0.5 flex items-center gap-2"
                    >
                      Learn More <ArrowRight className="w-5 h-5" />
                    </a>
                  </div>

                  {/* Contract Address */}
                  <div className="bg-[#17182a] border border-[#232446] rounded-2xl p-4 mt-4">
                    <p className="text-base text-[#dbdbef] mb-2">Contract Address</p>
                    <div className="flex items-center justify-between bg-[#101120] rounded-xl p-3">
                      <span className="font-mono text-sm text-[#8176fa] break-all">
                        {contractAddress}
                      </span>
                      <button
                        className="p-2 bg-[#221a3f]/70 hover:bg-[#3d3260]/80 rounded-full transition"
                        onClick={copyToClipboard}
                        aria-label="Copy contract address"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-[#77ffbe]" />
                        ) : (
                          <Copy className="w-5 h-5 text-[#b39afc]" />
                        )}
                      </button>
                    </div>
                    {copied && (
                      <p className="mt-2 text-sm text-[#77ffbe] text-right">
                        Copied to clipboard!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
