/* components/Web3Media.tsx ---------------------------------------- */
'use client';

import React, { useEffect, useState } from 'react';

/* -------------------------------------------------- */
/*  Audio : lecture unique (une seule piste à la fois) */
/* -------------------------------------------------- */
let currentAudio: HTMLAudioElement | null = null;        // piste en cours
let releaseCurrent: (() => void) | null = null;          // pour remettre l’état UI

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
  return raw;                      // déjà en https://
}

/* ---------- Image component ------------------------------------- */
export const Web3Image: React.FC<{
  src?: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => {
  const [idx, setIdx] = useState(0);
  const [url, setUrl] = useState(() => toHttp(src));

  /* si la prop change, on repart de zéro */
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
      setUrl('/blank.png'); // fallback final
    }
  };

  return <img src={url} alt={alt} onError={onError} className={className} />;
};

/* ---------- Audio hook ------------------------------------------ */
export function useAudio(src?: string) {
  const [audio] = useState(() => new Audio());
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);

  /* -------- PLAY (coupe la piste précédente) -------- */
  const play = () => {
    if (!src) return;

    /* ① coupe la piste déjà en cours le cas échéant */
    if (currentAudio && currentAudio !== audio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      releaseCurrent?.();                 // remet l’UI de l’ancienne carte
    }

    /* ② prépare/essaye la source */
    const attemptPlay = (gatewayIndex: number) => {
      audio.src = toHttp(src, gatewayIndex);
      audio
        .play()
        .then(() => {
          currentAudio   = audio;
          releaseCurrent = () => setPlaying(false);
          setPlaying(true);
        })
        .catch(() => {
          /* essai passerelle suivante IPFS si échec */
          if (
            (src.startsWith('ipfs://') || looksLikeCid(src)) &&
            gatewayIndex < gateways.length - 1
          ) {
            attemptPlay(gatewayIndex + 1);
          }
        });
    };

    attemptPlay(idx);

    audio.onended = () => {
      setPlaying(false);
      if (currentAudio === audio) {
        currentAudio   = null;
        releaseCurrent = null;
      }
    };
  };

  /* -------- STOP (libère si c’était la piste courante) -------- */
  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);

    if (currentAudio === audio) {
      currentAudio   = null;
      releaseCurrent = null;
    }
  };

  /* Stop when this hook unmounts (e.g., card removed) */
  useEffect(() => {
    return () => {
      if (currentAudio === audio) {
        audio.pause();
        audio.currentTime = 0;
        currentAudio   = null;
        releaseCurrent = null;
      }
    };
  }, [audio]);

  /* Listen for global “stop all” (route change, tab hide, etc.) */
  useEffect(() => {
    const onStopAll = () => stop();
    window.addEventListener('woodeng:audio:stop-all', onStopAll);
    return () => window.removeEventListener('woodeng:audio:stop-all', onStopAll);
  }, []); // stop is stable enough here


  useEffect(() => {
  const handler = () => {
    // stop whatever is currently playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      releaseCurrent?.();
      currentAudio = null;
      releaseCurrent = null;
    }
    setPlaying(false);
  };
  window.addEventListener('woodeng:audio:stop-all', handler);
  return () => window.removeEventListener('woodeng:audio:stop-all', handler);
}, []);


  return { playing, play, stop };
}
