// C:\Users\burgu\woodeng-next\app\staking\page.tsx
export const metadata = {
  title: 'Staking • Woodeng',
  description: 'Stake WOODENG to earn fee revenues.',
};

import ClientBoundary from './ClientBoundary';

export default function StakingPage() {
  return (
    <main className="pt-[calc(var(--header-h,80px)+48px)] px-6 md:px-10 lg:px-14 xl:px-20">
      <ClientBoundary />
    </main>
  );
}
