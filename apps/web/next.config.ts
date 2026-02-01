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
	async rewrites() {
		return [
			{
				source: "/assets/stickers/:stickerId.json",
				destination: "https://cdn.discordapp.com/stickers/:stickerId.json",
			},
		];
	},
	productionBrowserSourceMaps: true,
	transpilePackages: ["db", "utils"],
	typescript: {
		ignoreBuildErrors: true,
	},
	experimental: {
		optimizePackageImports: ["@phosphor-icons/react"],
	},
};

export default nextConfig;
