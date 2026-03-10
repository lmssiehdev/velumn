import type { MetadataRoute } from "next";

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
		// !! TODO: add sitemap
		// sitemap: 'https://acme.com/sitemap.xml',
	};
}
