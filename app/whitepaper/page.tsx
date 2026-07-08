'use client';

import dynamic from 'next/dynamic';

/* Lazy-load because the component is huge */
const Whitepaper = dynamic(() => import('@/contexts/components/Whitepaper'), {
  ssr: false,
});

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101014] pt-20">
      <main className="flex-1">
        <Whitepaper />
      </main>
    </div>
  );
}
