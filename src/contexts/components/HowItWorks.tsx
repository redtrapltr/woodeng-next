"use client";

import React from "react";
import Link from "next/link";
import {
  Wallet,
  Music2,
  BarChart3,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../utils";

const STEPS = [
  {
    title: "Connect Wallet",
    icon: Wallet,
    gradient: "from-primary/20 to-primary/10",
  },
  {
    title: "Create & Mint",
    icon: Music2,
    gradient: "from-primary/20 to-secondary/10",
  },
  {
    title: "Set Pools",
    icon: BarChart3,
    gradient: "from-secondary/20 to-primary/10",
  },
  {
    title: "Launch & Trade",
    icon: Rocket,
    gradient: "from-primary/20 to-secondary/10",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-12 md:py-20">
      {/* Pulsing background circles */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-primary/5 rounded-3xl blur-xl opacity-30" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full animate-pulse" />
        <div
          className="absolute top-1/2 -right-24 w-64 h-64 bg-secondary/10 rounded-full animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-56 h-56 bg-primary/10 rounded-full animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Main container: matches HeroSection width */}
      <div className="relative w-full max-w-7xl mx-auto px-4 z-10">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary">
            How It Works
          </h2>
          <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
            Create, mint, and trade your music NFTs and SPL404 Sound Memes in
            just a few simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative group">
                <div
                  className={cn(
                    "rounded-xl p-[2px] transition-transform duration-300 group-hover:scale-105",
                    `bg-gradient-to-r ${step.gradient}`
                  )}
                >
                  <div className="bg-card rounded-xl p-6 flex flex-col items-center text-center">
                    <div
                      className="p-3 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 
                                 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="mt-4 font-semibold text-lg">{step.title}</h3>
                  </div>
                </div>

                {/* step number */}
<div
  className="
    absolute -top-4 -left-4
    w-10 h-10 rounded-full
    bg-gradient-to-tr from-[#8b5cf6] to-[#4f8ef5]
    flex items-center justify-center
    text-white font-bold text-base
    shadow-lg z-10
  "
>
  {i + 1}
</div>


                {/* arrow to next */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-12 transform -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA with smaller half-circle behind */}
        <div className="relative mt-12 flex justify-center">
          {/* smaller semicircle */}
          <div className="absolute -bottom-6 w-48 h-24 bg-[#1c1b2a] rounded-t-full opacity-30" />
          <Link
            href="/mint"
            className="relative inline-flex items-center gap-2 px-8 py-3 rounded-full 
                       bg-gradient-to-r from-[#8b5cf6] to-[#4f8ef5] text-white font-semibold
                       transition-transform duration-300 hover:-translate-y-1"
          >
            Start Creating
            <Rocket className="w-5 h-5 animate-pulse" />
          </Link>
        </div>
      </div>
    </section>
  );
}
