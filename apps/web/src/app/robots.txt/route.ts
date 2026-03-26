import { getMainSiteUrl } from "@/lib/domains";
import { getHostUrl, getRequestHostContext } from "@/lib/request-host";

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

export async function GET(request: Request) {
	if (process.env.VERCEL_ENV !== "production") {
		return new Response("User-Agent: *\nDisallow: /\n", {
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}

	const hostContext = await getRequestHostContext(request.headers.get("host"));

	if (!hostContext) {
		return new Response("Not Found", { status: 404 });
	}

	const sitemapUrl =
		hostContext.type === "tenant"
			? getHostUrl(hostContext.host, "/sitemap.xml")
			: getMainSiteUrl("/sitemap.xml");

	return new Response(buildRobotsTxt(sitemapUrl), {
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
