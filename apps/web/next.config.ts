import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['db', 'utils'],
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
};

export default nextConfig;
