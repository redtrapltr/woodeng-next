import React from "react"
import { AnimatedWelcomeText } from "./AnimatedWelcomeText"
import { Container } from "./Container"
import Link from "next/link"
import { ArrowRight, Music2 } from "lucide-react"


export function HeroSection() {
  return (
    <section className="relative flex justify-center items-center py-4 md:py-8 bg-background">
      {/* constrain everything into the same width */}
      <Container>
        {/* BACKGROUND FX (unchanged) */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div
            className="absolute -top-24 -left-24 w-[260px] h-[260px] rounded-full
                       bg-gradient-to-br from-[#50f2f5] via-[#6444ff33] to-[#1b1348]
                       blur-[60px] opacity-25 animate-logo-glow"
          />
          <div className="absolute -top-16 -left-16 w-40 h-40 bg-[#24213c] rounded-br-full opacity-15 animate-fade-in-out" />
          <div className="absolute -bottom-12 -right-20 w-56 h-56 bg-[#161b27] rounded-tl-full opacity-25 animate-fade-in-out2" />
          <div className="absolute left-1/3 -bottom-10 w-72 h-36 bg-[#1c1b2a] rounded-t-full opacity-20 animate-fade-in-out3" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center">
          {/* LOGO + GLOW */}
          <div className="relative flex-shrink-0 flex items-center justify-center mr-8 md:mr-16 mb-8 md:mb-0">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-[110px] h-[110px] md:w-[150px] md:h-[150px] rounded-full
                           bg-gradient-to-tr from-[#6dfffa] to-[#a991ff]
                           blur-xl opacity-40 animate-logo-glow"
              />
            </div>
            <img
              src="/brand/logo.png"
              alt="Woodeng"
              className="relative z-10 h-[120px] md:h-[200px] w-auto select-none"
              draggable={false}
              decoding="async"
              loading="eager"
            />
          </div>

          {/* WELCOME TEXT */}
          <div className="flex-1 flex flex-col items-center md:items-start justify-center">
            <div className="w-full md:w-3/6">
              <AnimatedWelcomeText
                text="Introducing Solana World Library : 
                Tokenized Metadata & Sound Memes are the new Sound Money"
                className="text-[1.1rem] md:text-[1.6rem] font-bold text-primary leading-snug text-center md:text-left"
                waveDelay={0.17}
                waveClassName="text-[#b89fff] font-bold"
              />
              {/* CTA (high-converting) */}
<div className="mt-7 flex items-center gap-3 justify-center md:justify-start">
  <Link
    href="/sound-memes"
    aria-label="Trade Sound Memes now"
    className="group relative inline-flex items-center gap-3 rounded-full
               px-6 py-3.5 text-[0.98rem] font-semibold
               text-white focus:outline-none
               bg-gradient-to-r from-[#5c3bff] via-[#8a5bff] to-[#b17cff]
               shadow-[0_10px_30px_-10px_rgba(137,90,255,0.65)]
               ring-1 ring-white/10 hover:ring-white/20
               transition-all duration-200 ease-out
               hover:scale-[1.03] active:scale-[0.99]"
  >
    {/* live dot */}
    <span className="relative flex items-center">
      <span className="absolute -left-2 -top-2 h-3 w-3 rounded-full bg-emerald-400/70 animate-ping"></span>
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"></span>
    </span>

    
    <span className="whitespace-nowrap">Trade Sound Memes Now</span>

    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[0.72rem] font-medium">
      Live
    </span>

    <ArrowRight className="w-4 h-4 translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5" />

    {/* subtle glow on hover */}
    <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200
                     shadow-[0_0_0_4px_rgba(255,255,255,0.06),0_20px_60px_-20px_rgba(177,124,255,0.65)]"></span>
  </Link>
</div>

            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}