import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ['db', 'utils'],
};

export default withAxiom(nextConfig)