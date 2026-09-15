// app/sound-memes/page.tsx
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import SoundMemesGate from './SoundMemesGate';

export default function SoundMemesPage() {
  return (
    <Suspense fallback={null}>
      <SoundMemesGate />
    </Suspense>
  );
}
