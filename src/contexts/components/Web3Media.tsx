/* components/Web3Media.tsx ---------------------------------------- */
import React, { useEffect, useState } from 'react';

/* ---------- gateway helpers ------------------------------------- */
const gateways = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://nftstorage.link/ipfs/${cid}`,
];

function looksLikeCid(x?: string) {
  return !!x && /^[a-z0-9]{46,59}$/i.test(x);
}

function toHttp(raw?: string, g = 0): string {
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return gateways[g](raw.slice(7));
  if (raw.startsWith('ar://'))   return `https://arweave.net/${raw.slice(5)}`;
  if (looksLikeCid(raw))         return gateways[g](raw);
  return raw;                      // already https://
}

/* ---------- Image component ------------------------------------- */
export const Web3Image: React.FC<{
  src?: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => {
  const [idx, setIdx]   = useState(0);
  const [url, setUrl]   = useState(() => toHttp(src));

  /* every time the *source* prop changes, reset */
  useEffect(() => {
    setIdx(0);
    setUrl(toHttp(src));
  }, [src]);

  const onError = () => {
    if ((src?.startsWith('ipfs://') || looksLikeCid(src)) && idx < gateways.length - 1) {
      const next = idx + 1;
      setIdx(next);
      setUrl(toHttp(src, next));
    } else {
      setUrl('/blank.png');        // final fallback
    }
  };

  return <img src={url} alt={alt} onError={onError} className={className} />;
};

/* ---------- Audio hook ------------------------------------------ */
export function useAudio(src?: string) {
  const [audio]   = useState(() => new Audio());
  const [playing, setPlaying] = useState(false);
  const [idx,     setIdx]     = useState(0);

  const play = () => {
    if (!src) return;
    audio.src = toHttp(src, idx);
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        if ((src.startsWith('ipfs://') || looksLikeCid(src)) && idx < gateways.length - 1) {
          const next = idx + 1;
          setIdx(next);
          audio.src = toHttp(src, next);
          audio.play().then(() => setPlaying(true)).catch(() => {});
        }
      });

    audio.onended = () => setPlaying(false);
  };

  const stop = () => {
    audio.pause();
    setPlaying(false);
  };

  return { playing, play, stop };
}
