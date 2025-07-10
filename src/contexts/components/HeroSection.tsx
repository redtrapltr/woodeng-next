import React from "react"
import { AnimatedWelcomeText } from "./AnimatedWelcomeText"
import { Container } from "./Container"

export function HeroSection() {
  return (
    <section className="relative flex justify-center items-center py-32 bg-background">
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
              src="https://i.postimg.cc/pTd49kBG/Woo-Logo.png"
              alt="Woo Logo"
              className="relative z-10 w-[140px] md:w-[240px] h-auto select-none"
              draggable={false}
            />
          </div>

          {/* WELCOME TEXT */}
          <div className="flex-1 flex flex-col items-center md:items-start justify-center">
            <div className="w-full md:w-4/6">
              <AnimatedWelcomeText
                text="Welcome to the New Memetic era : Music NFT's & Sound Memes are the new Sound Money"
                className="text-[1.1rem] md:text-[1.6rem] font-bold text-primary leading-snug text-center md:text-left"
                waveDelay={0.17}
                waveClassName="text-[#b89fff] font-bold"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}