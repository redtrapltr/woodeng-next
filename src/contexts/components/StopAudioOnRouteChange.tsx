// src/contexts/components/StopAudioOnRouteChange.tsx
'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function StopAudioOnRouteChange() {
  const pathname = usePathname();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('woodeng:audio:stop-all'));
  }, [pathname]);

  useEffect(() => {
    const stop = () => window.dispatchEvent(new CustomEvent('woodeng:audio:stop-all'));
    const onVis = () => { if (document.visibilityState === 'hidden') stop(); };
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return null;
}
