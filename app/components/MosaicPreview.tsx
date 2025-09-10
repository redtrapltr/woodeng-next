'use client';
import React from 'react';
const toHttp = (u?: string | null) => u ? u.replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/') : '';

export default function MosaicPreview({
  images, aspect = 'video', overlay,
}: { images: string[]; aspect?: 'video'|'square'; overlay?: { title?: string; subtitle?: string } }) {
  const aspectClass = aspect === 'square' ? 'aspect-square' : 'aspect-video';
  const imgs = (images || []).map(toHttp).filter(Boolean);
  const gridCols = Math.min(4, Math.ceil(Math.sqrt(Math.min(imgs.length, 16))));
  return (
    <div className={`relative w-full ${aspectClass} overflow-hidden rounded-xl bg-gray-800`}>
      {imgs.length <= 1 ? (
        imgs[0] ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-b from-gray-700 to-gray-900" />
      ) : (
        <div className="w-full h-full grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
          {imgs.slice(0, 16).map((src, i) => (
            <div key={i} className="border border-gray-900">
              <img src={src} alt={`#${i+1}`} className="w-full h-full object-cover" />
            </div>
          ))}
          {imgs.length > 16 && (
            <div className="absolute bottom-2 right-2 text-xs bg-black/60 px-2 py-1 rounded">+{imgs.length-16}</div>
          )}
        </div>
      )}
      {(overlay?.title || overlay?.subtitle) && (
        <div className="absolute left-4 bottom-4">
          {overlay?.title && <div className="text-white text-xl md:text-2xl font-semibold">{overlay.title}</div>}
          {overlay?.subtitle && <div className="text-white/80 text-sm">{overlay.subtitle}</div>}
        </div>
      )}
    </div>
  );
}
