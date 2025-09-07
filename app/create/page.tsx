'use client';

import React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Music2, Volume2, Sparkles, Siren as Fire, Rocket } from 'lucide-react';

/* ───────────────── Swipe deck for mobile (auto-height) ───────────────── */
function SwipeDeck({ items }: { items: React.ReactNode[] }) {
  const [[page, direction], setPage] = React.useState<[number, number]>([0, 0]);
  const index = ((page % items.length) + items.length) % items.length;

  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = React.useState<number | 'auto'>('auto');

  React.useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () => setCardHeight(el.offsetHeight || 'auto');
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  const paginate = (dir: number) => setPage(([p]) => [p + dir, dir]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.98 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.98 }),
  };

  return (
    <div className="relative w-full">
      <div
        className="relative"
        style={{ height: cardHeight === 'auto' ? undefined : cardHeight, transition: 'height .22s ease' }}
      >
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 400, damping: 35, opacity: { duration: 0.15 } }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              const { offset, velocity } = info;
              const swipe = Math.abs(offset.x) * velocity.x;
              if (offset.x < -80 || swipe < -800) paginate(1);
              else if (offset.x > 80 || swipe > 800) paginate(-1);
            }}
            className="mx-auto my-3 w-[90%] sm:w-[86%] cursor-grab active:cursor-grabbing"
          >
            <div ref={cardRef}>{items[index]}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* dots */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to item ${i + 1}`}
            onClick={() => setPage([i, i > index ? 1 : -1])}
            className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'bg-[#FFE66D]' : 'bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function CreateNFT() {
  /* ─────────── Card: Musical NFT ─────────── */
  const MusicalCard = (
    <Link
      href="/uploadYourMusic"
      className={`
        group relative block md:h-full overflow-hidden rounded-2xl border border-[#2b2341] bg-[#171622]
        p-5 sm:p-6 text-left transition-all
        shadow-[0_8px_24px_rgba(0,0,0,0.25)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7356f0]
        focus-visible:ring-offset-2 focus-visible:ring-offset-[#181920]
        motion-safe:hover:bg-[#23253a] motion-safe:hover:border-[#7356f0]
        active:scale-[0.99]
      `}
    >
      <div className="flex flex-col gap-3 md:h-full md:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="rounded-xl bg-[#7356f0]/10 p-3 transition-colors group-hover:bg-[#7356f0]/20">
            <Music2 className="h-6 w-6 sm:h-7 sm:w-7 text-[#7356f0]" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-white">Musical NFT</h3>
            <p className="text-xs sm:text-sm text-[#bcbcf0]">Professional music NFT creation</p>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-[#bcbcf0]">
          <li>• Complete music NFT ecosystem</li>
          <li>• Multiple audio format support</li>
          <li>• Advanced metadata configuration</li>
          <li>• Royalty or AMM settings</li>
          <li>• Collection management</li>
        </ul>
      </div>
    </Link>
  );

  /* ─────────── Card: Sound Meme ─────────── */
  const MemeCard = (
    <Link
      href="/meme-locker"
      className={`
        group relative block md:h-full overflow-hidden rounded-2xl p-[2px]
        bg-gradient-to-r from-[#FF6B6B] via-[#4ECDC4] to-[#FFE66D]
        motion-safe:hover:scale-[1.01] transition-transform
        shadow-[0_8px_24px_rgba(0,0,0,0.25)]
        active:scale-[0.99]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE66D]
        focus-visible:ring-offset-2 focus-visible:ring-offset-[#181920]
      `}
    >
      <div className="relative rounded-2xl bg-[#18181b] p-5 sm:p-6 text-left md:h-full md:flex md:flex-col md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3 sm:gap-4">
            <div className="relative">
              {/* Animated spinning glow (motion-safe) */}
              <div
                aria-hidden
                className={`
                  pointer-events-none absolute inset-0 rounded-lg
                  bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4]
                  opacity-20 blur-[3px]
                  motion-safe:animate-[spin_7s_linear_infinite]
                `}
              />
              <div className="relative rounded-lg bg-[#232422] p-3">
                <Volume2 className="h-6 w-6 sm:h-7 sm:w-7 text-[#FFE66D]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent">
                  Sound Meme
                </h3>
                <Fire className="h-4 w-4 sm:h-5 sm:w-5 text-[#FF6B6B] animate-bounce-slow" />
              </div>
              <p className="text-xs sm:text-sm text-[#8d95a5]">Quick SPL404 NFT creation</p>
            </div>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-[#5eead4]">
              <Sparkles className="h-4 w-4 text-[#5eead4]" />
              <span className="text-white">Simplified minting process</span>
            </li>
            <li className="flex items-center gap-2 text-[#ff72a0]">
              <Fire className="h-4 w-4 text-[#ff72a0]" />
              <span className="text-white">Short-form audio/video</span>
            </li>
            <li className="flex items-center gap-2 text-[#ffe066]">
              <Rocket className="h-4 w-4 text-[#ffe066]" />
              <span className="text-white">Instant deployment</span>
            </li>
          </ul>
        </div>

        {/* Badge inside bounds so it never affects height */}
        <div
          className={`
            absolute bottom-2 right-2 rounded-full border-2 border-[#ffe066]
            bg-[#FFE66D] px-3 py-1 text-[10px] sm:text-xs font-bold text-black
            rotate-12 shadow-lg
            animate-bounce-slow
          `}
        >
          WAGMI!
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#181920] pt-[calc(116px+env(safe-area-inset-top))] md:pt-[calc(148px+env(safe-area-inset-top))] pb-10 sm:pb-14 md:pb-20">


      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h1 className="text-balance text-2xl sm:text-3xl md:text-4xl font-bold mb-5 sm:mb-8 text-white">
          Pick a creation type
        </h1>

        {/* MOBILE: swipe (one card on screen, Sound Meme first) */}
        <div className="md:hidden">
          <SwipeDeck items={[MemeCard, MusicalCard]} />
        </div>

        {/* DESKTOP/TABLET: 2-column grid */}
        <div className="hidden md:grid grid-cols-2 gap-4 sm:gap-6 items-stretch">
          {MusicalCard}
          {MemeCard}
        </div>
      </div>

      {/* Global styles (prefer-reduced-motion aware) */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-bounce-slow {
            animation: none !important;
          }
        }
        @keyframes bounce-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          18% {
            transform: translateY(-10px);
          }
          32% {
            transform: translateY(-18px);
          }
          44% {
            transform: translateY(-10px);
          }
          58%,
          72% {
            transform: translateY(0);
          }
          80% {
            transform: translateY(-6px);
          }
          88% {
            transform: translateY(0);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2.7s infinite cubic-bezier(0.47, 0, 0.53, 1.01);
        }
      `}</style>
    </div>
  );
}
