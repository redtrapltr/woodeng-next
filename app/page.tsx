// app/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Container } from "../src/contexts/components/Container";
import { HeroSection } from "../src/contexts/components/HeroSection";
import { HowItWorks } from "../src/contexts/components/HowItWorks";
import { TokenPurchaseSection } from "../src/contexts/components/TokenPurchaseSection";
import { LogoAnimation } from "../src/contexts/components/LogoAnimation";
import { Footer } from "../src/contexts/components/Footer";
import { Music2, Sparkles, Coins } from "lucide-react";
import { SoundMemeSection } from "../src/contexts/components/SoundMemeSection";


// inline PasswordModal
const PasswordModal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "ilovewoodeng") {
      setError("");
      onSuccess();
    } else {
      setError("Wrong password!");
    }
  };
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1c1c1e] rounded-2xl p-8 flex flex-col items-center w-[400px] shadow-2xl border border-[#242426]"
      >
        <h2 className="text-3xl font-bold text-white mb-4">Enter Password</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full mb-4 px-4 py-2 rounded bg-[#18181b] border border-gray-700 text-white text-lg outline-none focus:ring focus:ring-primary/50"
        />
        <button
          type="submit"
          className="w-full py-2 bg-[#8b5cf6] rounded text-white text-lg font-semibold hover:bg-[#7c3aed] transition"
        >
          Submit
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </div>
  );
};

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);

  return (
    <div className="min-h-screen bg-[#101014] flex flex-col pt-20">
      {!authenticated && (
        <PasswordModal onSuccess={() => setAuthenticated(true)} />
      )}

      {authenticated && (
        <>
          {/* HERO */}
          <Container>
            <HeroSection />
          </Container>

          {/* HOW IT WORKS */}
          <Container>
            <HowItWorks />
          </Container>

          {/* BUY WOODENG TOKENS */}
          <Container>
            <TokenPurchaseSection />
          </Container>

          {/* TRENDING NFTs */}
          <Container>
            <section className="my-16">
              <h2 className="text-3xl font-bold mb-6 text-white">
                Trending NFTs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card p-6 rounded-2xl min-h-[200px]">Card</div>
                <div className="bg-card p-6 rounded-2xl min-h-[200px]">Card</div>
                <div className="bg-card p-6 rounded-2xl min-h-[200px]">Card</div>
              </div>
            </section>
          </Container>

          {/* RECENTLY ADDED */}
          <Container>
            <section className="my-16">
              <h2 className="text-3xl font-bold mb-6 text-white">
                Recently Added
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card p-6 rounded-2xl min-h-[200px]">Card</div>
                <div className="bg-card p-6 rounded-2xl min-h-[200px]">Card</div>
                <div className="bg-card p-6 rounded-2xl min-h-[200px]">Card</div>
              </div>
            </section>
          </Container>

          {/* SOUND MEMES */}
          <Container>
  <SoundMemeSection />
</Container>


          {/* READY TO GET STARTED */}
          <Container>
            <section className="text-center space-y-4 md:space-y-6 my-16">
              <h2 className="text-xl md:text-3xl font-bold text-white">
                Ready to Get Started?
              </h2>
              <p className="text-sm md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Mint your own music NFT and unleash your SPL404 Sound Meme in a
                single click
              </p>
            </section>
          </Container>

          {/* FEATURES GRID */}
<Container>
  <section className="grid grid-cols-1 md:grid-cols-3 gap-6 my-16">
    {[
      {
        icon: Music2,
        title: "Music NFTs",
        description:
          "Transform your music into unique digital assets. Set your own terms, earn royalties, and build direct relationships with fans.",
      },
      {
        icon: Sparkles,
        title: "Sound Memes",
        description:
          "Create viral sound memes as SPL404 NFTs. Leverage the power of social sharing while maintaining ownership and earning potential.",
      },
      {
        icon: Coins,
        title: "Woodeng Token",
        description:
          "Access exclusive features, participate in governance, and earn rewards through our native token ecosystem.",
      },
    ].map((feat, i) => (
      <div
  key={i}
  className="
    border
    border-[#28283b]
    hover:border-2
    hover:border-purple-400
    transition-all duration-200
    rounded-xl
    p-6
    cursor-pointer
    group
  "
>
  <div className="p-2 md:p-3 bg-primary/10 rounded-lg w-fit mb-4 group-hover:bg-primary/20 transition-colors duration-200">
    <feat.icon className="w-6 h-6 text-primary" />
  </div>
  <h3 className="text-lg font-bold mb-2 text-white">{feat.title}</h3>
  <p className="text-sm text-muted-foreground">{feat.description}</p>
</div>

    ))}
  </section>
</Container>



          {/* PARTNER LOGO CAROUSEL */}
          <LogoAnimation />

          {/* FOOTER — full–width */}
          <Footer />
        </>
      )}
    </div>
  );
}
