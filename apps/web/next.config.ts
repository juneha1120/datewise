import path from 'node:path';
import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(path.resolve(__dirname, '../..'));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? '',
  },
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias['@datewise/shared'] = path.resolve(__dirname, '../../packages/shared/src/index.ts');
    return config;
  },
};
export default nextConfig;
