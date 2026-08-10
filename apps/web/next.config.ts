import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import "./src/utils/env";

const nextConfig: NextConfig = {
	pageExtensions: ["mdx", "ts", "tsx"],
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
				source: "/api/hog/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/api/hog/:path*",
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
		mdxRs: true,
	},
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
