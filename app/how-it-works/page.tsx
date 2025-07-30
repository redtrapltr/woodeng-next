// app/how-it-works/page.tsx
'use client';

import HowItWorksFull from '@/contexts/components/HowItWorksFull';
import { Footer } from '@/contexts/components/Footer';

export default function HowItWorksRoute() {
  return (
    <>
      <div className="container mx-auto px-6">
        <HowItWorksFull />
      </div>
      <Footer />
    </>
  );
}
