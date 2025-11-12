// app/meme-locker/page.tsx  (Server Component)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import MemeLockerClient from './MemeLockerClient';

export default function Page() {
  return <MemeLockerClient />;
}
