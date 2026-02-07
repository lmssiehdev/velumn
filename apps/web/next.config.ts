import type { NextConfig } from "next";
import "./src/utils/env";

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
			{
				source: "/hog/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/hog/:path*",
				destination: "https://us.i.posthog.com/:path*",
			},
		];
	},
	skipTrailingSlashRedirect: true,
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
