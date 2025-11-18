import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";

const jiti = createJiti(fileURLToPath(import.meta.url));

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti("./src/utils/env");

const nextConfig: NextConfig = {
	transpilePackages: ["db", "utils"],
	typedRoutes: false,
};

export default withAxiom(nextConfig);
