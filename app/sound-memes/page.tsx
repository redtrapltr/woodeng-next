// app/sound-memes/page.tsx
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import SoundMemesClient from './SoundMemesClient';

export default function SoundMemesPage() {
  return (
    <Suspense fallback={null}>
      <SoundMemesClient />
    </Suspense>
  );
}
