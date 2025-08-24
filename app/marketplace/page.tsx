// Server component (no 'use client' needed here)
import MarketplaceClient from './MarketplaceClient';

export const dynamic = 'force-dynamic'; // keep if you need fresh data

export default function Page() {
  return <MarketplaceClient />;
}
