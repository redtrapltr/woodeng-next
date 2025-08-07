'use client';

import FAQ from '@/contexts/components/FAQ';          // default export
import { Footer } from '@/contexts/components/Footer'; // named export

export default function FaqPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#101014] pt-20">
      <main className="flex-1">
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
