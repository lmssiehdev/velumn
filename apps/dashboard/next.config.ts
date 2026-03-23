import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";
import "./src/utils/env";

const nextConfig: NextConfig = {
	transpilePackages: ["db", "utils", "logger"],
	typedRoutes: false,
};

export default withAxiom(nextConfig);
