// app/profile/page.tsx  (Server Component wrapper)
// Route segment config must live in a Server Component file.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import ProfileClient from './ProfileClient';

export default function Page() {
  return <ProfileClient />;
}
