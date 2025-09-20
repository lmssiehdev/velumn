import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['db', 'utils'],
};

export default nextConfig;
