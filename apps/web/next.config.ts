import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['db', 'utils'],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
};

export default nextConfig;
