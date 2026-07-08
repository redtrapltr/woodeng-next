'use client';

import dynamic from 'next/dynamic';

const Privacy = dynamic(() => import('@/contexts/components/Privacy'), {
  ssr: false,
});

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101014] pt-20">
      <main className="flex-1">
        <Privacy />
      </main>
    </div>
  );
}
