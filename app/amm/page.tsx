/* eslint-disable react-hooks/exhaustive-deps */
// app/amm/page.tsx
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import AMMClient from './AMMClient';

export default function AMMPage() {
  return (
    <Suspense fallback={null}>
      <AMMClient />
    </Suspense>
  );
}

