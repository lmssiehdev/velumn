import { getMainSiteUrl } from "@/lib/domains";

function buildRobotsTxt(sitemapUrl?: string) {
	const lines = [
		"User-Agent: *",
		"Allow: /",
		"Allow: /api/og/*",
		"Disallow: /api/",
	];

	if (sitemapUrl) {
		lines.push("", `Sitemap: ${sitemapUrl}`);
	}

	return `${lines.join("\n")}\n`;
}

export async function GET() {
	if (process.env.VERCEL_ENV !== "production") {
		return new Response("User-Agent: *\nDisallow: /\n", {
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}

	return new Response(buildRobotsTxt(getMainSiteUrl("/sitemap.xml")), {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
