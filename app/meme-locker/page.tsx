// app/meme-locker/page.tsx  (Server Component)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import CreateGate from '../create/CreateGate';

export default function Page() {
  return <CreateGate />;
}
