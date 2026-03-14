import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
	if (process.env.VERCEL_ENV !== "production") {
		return {
			rules: [
				{
					userAgent: "*",
					disallow: ["/"],
				},
			],
		};
	}

	return {
		rules: [
			{
				userAgent: "*",
				allow: ["/", "/api/og/*"],
				disallow: ["/api/"],
			},
		],
		sitemap: absoluteUrl("/sitemap.xml"),
	};
}
