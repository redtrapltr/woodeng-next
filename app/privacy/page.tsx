'use client';

import dynamic from 'next/dynamic';
import { Footer } from '@/contexts/components/Footer';

const Privacy = dynamic(() => import('@/contexts/components/Privacy'), {
  ssr: false,          // the component is large; skip SSR for quicker TTFB
});

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101014] pt-20">
      <main className="flex-1">
        <Privacy />
      </main>
      <Footer />
    </div>
  );
}
