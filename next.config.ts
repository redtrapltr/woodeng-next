// next.config.ts
// (Keep this in the project root)

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ❶ Skip ESLint during `next build`
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ❷ Skip TypeScript type-checking errors during `next build`
  typescript: {
    ignoreBuildErrors: true,
  },

  // ❸ Add CORS/streaming headers for audio served via /ipfs/*
  async headers() {
    return [
      {
        source: '/ipfs/:path*',
        headers: [
          // allow cross-origin <audio> playback
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          // allow seeking; Safari relies on this
          { key: 'Accept-Ranges', value: 'bytes' },
          // (optional) encourage caching of immutable IPFS content
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
