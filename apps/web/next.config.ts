import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async redirects() {
		return [
			{
				source: "/discord",
				destination: "https://discord.gg/B23gNekHPy",
				permanent: true,
			},
		];
	},
	transpilePackages: ["db", "utils"],
	typescript: {
		ignoreBuildErrors: true,
	},
	experimental: {
		optimizePackageImports: ["@phosphor-icons/react"],
	},
};

export default nextConfig;
