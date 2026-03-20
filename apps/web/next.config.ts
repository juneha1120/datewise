import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias['@datewise/shared'] = path.resolve(__dirname, '../../packages/shared/src/index.ts');
    return config;
  },
};
export default nextConfig;
