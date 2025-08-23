import { Suspense } from 'react';
import MarketplaceClient from './Client';

export const dynamic = 'force-dynamic'; // optional
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading marketplace…</div>}>
      <MarketplaceClient />
    </Suspense>
  );
}
