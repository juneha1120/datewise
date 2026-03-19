import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ['@datewise/shared'],
};
export default nextConfig;
