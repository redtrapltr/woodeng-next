'use client';

import dynamic from 'next/dynamic';

/* Lazy-load the big component */
const Cookies = dynamic(() => import('@/contexts/components/Cookies'), {
  ssr: false,
});

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101014] pt-20">
      <main className="flex-1">
        <Cookies />
      </main>
    </div>
  );
}
