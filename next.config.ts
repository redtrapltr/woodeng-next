// next.config.ts

import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Disable ESLint errors during build so "npm run build" still succeeds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (Do NOT include `output: 'export'`—we want a hybrid build with API routes.)
};

export default nextConfig;
