// src/contexts/components/TokenPurchaseSection.tsx
"use client";

import React, { useState } from 'react';
import { Coins, ArrowRight, Sparkles, TrendingUp, Rocket, Copy, Check } from 'lucide-react';

export function TokenPurchaseSection() {
  const [copied, setCopied] = useState(false);
  const contractAddress = "83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-16">
      {/* pulsing background circles */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-3xl blur-xl opacity-70" />

      {/* match other sections’ width */}
      <div className="relative w-full max-w-7xl mx-auto px-4 z-10 rounded-3xl border border-primary/20 backdrop-blur-sm overflow-hidden">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          
          {/* Left: mascot + animated blobs */}
          <div className="relative h-64 md:h-80 flex items-center justify-center">
            <div className="absolute top-1/4 left-1/4 w-12 md:w-32 h-12 md:h-32 bg-primary/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-1/3 right-1/3 w-8 md:w-24 h-8 md:h-24 bg-secondary/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-secondary/40 rounded-full blur-xl opacity-70 animate-pulse" />
              <img
                src="https://i.postimg.cc/KzwCSxDx/Logo-WB.png"
                alt="Woodeng Mascot"
                className="relative z-10 h-24 md:h-64 object-contain"
              />
            </div>
            <Coins className="absolute top-1/4 right-1/4 w-3 md:w-8 h-3 md:h-8 text-primary animate-bounce" style={{ animationDuration: '3s' }} />
            <TrendingUp className="absolute bottom-1/4 left-1/4 w-2 md:w-6 h-2 md:h-6 text-secondary animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
            <Sparkles className="absolute top-1/3 left-1/3 w-2 md:w-5 h-2 md:h-5 text-primary/80 animate-pulse" style={{ animationDuration: '4s' }} />
          </div>

          {/* Right: text, buttons, contract */}
          <div className="space-y-6 p-4 md:p-8">
            <div className="inline-flex items-center gap-2 px-4 py-1 bg-primary/10 rounded-full">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium whitespace-nowrap">$WOODENG Token</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Need Woodeng Tokens?
            </h2>

            <p className="text-sm md:text-lg text-muted-foreground">
              Power your Music NFT transactions and SPL404 Sound Memes deployment with the native Woodeng token
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://raydium.io/swap/?inputMint=sol&outputMint=83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#4f8ef5] text-white font-semibold shadow-lg shadow-primary/20 transition-transform hover:-translate-y-1"
              >
                <Rocket className="w-5 h-5" />
                Buy on Raydium
              </a>
              <a
                href="/whitepaper#section-5"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-card border border-primary/20 text-white transition-transform hover:-translate-y-1"
              >
                Learn More
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="mt-4">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">Contract Address</p>
              <div
                className="flex items-center justify-between p-3 bg-background/50 rounded-lg cursor-pointer hover:bg-background/80 transition-colors"
                onClick={copyToClipboard}
              >
                <span className="font-mono text-sm text-primary truncate">
                  {contractAddress}
                </span>
                <button
                  className="p-2 bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                  aria-label="Copy address"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-primary" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-500 mt-1 text-right">
                  Copied to clipboard!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
