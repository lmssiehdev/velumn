import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";

const nextConfig: NextConfig = {
	transpilePackages: ["db", "utils"],
	typedRoutes: false,
};

export default withAxiom(nextConfig);
