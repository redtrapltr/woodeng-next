// next.config.ts
// (Keep this in the project root)

const nextConfig = {
  reactStrictMode: true,

  // ❶ Skip ESLint during `next build`
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ❷ Skip TypeScript type-checking errors during `next build`
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
