import React from "react";
import { Wallet, Music2, BarChart3, Rocket, ArrowRight } from "lucide-react";
import { Container } from "./Container"; // same Container your Hero uses

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const STEPS = [
  { title: "Connect Wallet",   icon: Wallet,   gradient: "from-primary/20 to-primary/10" },
  { title: "Create & Mint",    icon: Music2,   gradient: "from-primary/20 to-secondary/10" },
  { title: "Set Pools",        icon: BarChart3,gradient: "from-secondary/20 to-primary/10" },
  { title: "Launch & Trade",   icon: Rocket,   gradient: "from-primary/20 to-secondary/10" },
];

export function HowItWorks() {
  return (
    <section className="relative py-6 md:py-8">
      {/* pulse keyframes */}
      <style>{`
        @keyframes fadePulse {
          0%,100%{opacity:.17}
          50%{opacity:.32}
        }
      `}</style>

      <Container>
        {/* card wrapper */}
        <div className="relative overflow-hidden bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-16 lg:px-8">
          {/* clipped circles */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <div
              className="absolute -top-20 -left-20 w-60 h-60 rounded-full"
              style={{ background: "rgba(114,107,224,0.13)", animation: "fadePulse 5.5s ease-in-out infinite" }}
            />
            <div
              className="absolute -bottom-20 left-1/3 -translate-x-1/4 w-60 h-60 rounded-full"
              style={{ background: "rgba(80,111,245,0.11)", animation: "fadePulse 6.7s ease-in-out infinite" }}
            />
            <div
              className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full"
              style={{ background: "rgba(114,107,224,0.13)", animation: "fadePulse 5.5s ease-in-out infinite" }}
            />
          </div>

          {/* title */}
          <div className="relative z-10 text-center pt-10 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#6d85fa] to-[#906cff] bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="mt-2 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Transform your creativity into digital assets with SWL-444 tokens and music NFTs in just a few simple steps
            </p>
          </div>

          {/* steps */}
          <div className="relative z-10 flex flex-col items-center px-6 pb-6">
            <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 mb-8">
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
                      <div className="bg-[#181926]/90 rounded-xl p-6 flex flex-col items-center text-center min-h-[160px]">
                        <div
                          className="p-3 rounded-full transition-transform duration-300 group-hover:scale-110"
                          style={{
                            background:
                              "radial-gradient(circle, rgba(114,107,224,0.18) 0%, rgba(35,36,69,0.86) 80%)",
                            boxShadow:
                              "0 0 32px rgba(129,140,255,0.18), 0 0 0 8px rgba(80,111,245,0.09)",
                          }}
                        >
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="mt-4 font-semibold text-lg md:text-xl text-[#dee4fb]">
                          {step.title}
                        </h3>
                      </div>
                    </div>

                    {/* step number */}
                    <div
                      className={cn(
                        "absolute -top-5 -left-5 w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white shadow-lg",
                        "bg-gradient-to-tr from-[#8b5cf6] to-[#4f8ef5]",
                        "border-4 border-[#151522] transition-transform duration-300 group-hover:scale-105"
                      )}
                    >
                      {i + 1}
                    </div>

                    {/* arrow */}
                    {i < STEPS.length - 1 && (
                      <div className="hidden md:flex absolute top-1/2 right-[-24px] -translate-y-1/2">
                        <ArrowRight className="w-6 h-6 text-[#8379fc]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="relative flex justify-center">
              <div className="absolute -bottom-4 w-60 h-20 bg-[#221d3a]/40 rounded-t-full opacity-30" />
              <a
                href="/create"
                className="relative inline-flex items-center gap-2 px-8 py-3 rounded-full
                           bg-gradient-to-r from-[#8b5cf6] to-[#4f8ef5]
                           text-white font-bold transition-transform duration-300 hover:scale-105
                           shadow-lg shadow-[#8b5cf6]/20"
              >
                Start Creating
                <Rocket className="w-5 h-5 animate-pulse" />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
