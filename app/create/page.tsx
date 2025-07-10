'use client';

import React from 'react';
import { Music2, Volume2, Sparkles, Siren as Fire, Rocket } from 'lucide-react';
import Link from 'next/link'

export default function CreateNFT() {
  return (
    <div className="min-h-screen py-12 bg-[#181920]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">Create Your NFT</h1>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Musical NFT Option */}
          <Link href="/uploadYourMusic" className="group relative bg-[#171622] hover:bg-[#23253a] border border-[#2b2341] hover:border-[#7356f0] rounded-xl p-6 text-left transition-all duration-300 block">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-[#7356f0]/10 rounded-lg group-hover:bg-[#7356f0]/20 transition-colors">
                <Music2 className="w-7 h-7 text-[#7356f0]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Musical NFT</h3>
                <p className="text-sm text-[#bcbcf0]">Professional music NFT creation</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-[#bcbcf0]">
              <li>• Complete music NFT ecosystem</li>
              <li>• Multiple audio format support</li>
              <li>• Advanced metadata configuration</li>
              <li>• Royalty or AMM settings</li>
              <li>• Collection management</li>
            </ul>
          </Link>

          {/* Sound Meme Option */}
          <Link href="/meme-locker" className="group relative bg-gradient-to-r from-[#FF6B6B] via-[#4ECDC4] to-[#FFE66D] p-[2px] rounded-xl hover:scale-[1.02] transition-all duration-300 block">
            <div className="h-full w-full bg-[#18181b] rounded-xl p-6 text-left relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  {/* Animated spinning glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] rounded-lg animate-spin" style={{ filter: "blur(3px)", opacity: 0.19 }}></div>
                  <div className="relative p-3 bg-[#232422] rounded-lg">
                    <Volume2 className="w-7 h-7 text-[#FFE66D]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent">
                      Sound Meme
                    </h3>
                    {/* Bounce fire and WAGMI in sync */}
                    <Fire className="w-5 h-5 text-[#FF6B6B] animate-bounce-slow" />
                  </div>
                  <p className="text-sm text-[#8d95a5]">Quick SPL404 NFT creation</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-[#5eead4]">
                  <Sparkles className="w-4 h-4 text-[#5eead4]" />
                  <span className="text-white">Simplified minting process</span>
                </li>
                <li className="flex items-center gap-2 text-[#ff72a0]">
                  <Fire className="w-4 h-4 text-[#ff72a0]" />
                  <span className="text-white">Short-form audio/video</span>
                </li>
                <li className="flex items-center gap-2 text-[#ffe066]">
                  <Rocket className="w-4 h-4 text-[#ffe066]" />
                  <span className="text-white">Instant deployment</span>
                </li>
              </ul>
              <div className="absolute -bottom-2 -right-2 bg-[#FFE66D] text-black text-xs font-bold px-4 py-1 rounded-full rotate-12 animate-bounce-slow shadow-lg border-2 border-[#ffe066]">
                WAGMI!
              </div>
            </div>
          </Link>
        </div>
      </div>
      <style jsx global>{`
        /* Slower bounce to sync fire + WAGMI! */
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0);}
          18% { transform: translateY(-12px);}
          32% { transform: translateY(-22px);}
          44% { transform: translateY(-12px);}
          58%, 72% { transform: translateY(0);}
          80% { transform: translateY(-7px);}
          88% { transform: translateY(0);}
        }
        .animate-bounce-slow {
          animation: bounce-slow 2.7s infinite cubic-bezier(.47,0,.53,1.01);
        }
      `}</style>
    </div>
  );
}
