'use client';

import dynamic from 'next/dynamic';

/* lazy-load because the file is very big */
const Terms = dynamic(() => import('@/contexts/components/Terms'), {
  ssr: false,
});

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101014] pt-20">
      <main className="flex-1">
        <Terms />
      </main>
    </div>
  );
}
