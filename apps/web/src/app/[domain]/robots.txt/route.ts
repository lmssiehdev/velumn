import { getCustomDomainUrl } from "@/lib/domains";
import { getTenantServerOrNotFound } from "../_lib/tenant";

function buildRobotsTxt(sitemapUrl: string) {
	return `User-Agent: *\nAllow: /\nAllow: /api/og/*\nDisallow: /api/\n\nSitemap: ${sitemapUrl}\n`;
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ domain: string }> },
) {
	if (process.env.VERCEL_ENV !== "production") {
		return new Response("User-Agent: *\nDisallow: /\n", {
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}

	const { domain } = await params;
	const { server } = await getTenantServerOrNotFound(domain);

	return new Response(
		buildRobotsTxt(getCustomDomainUrl(server, "/sitemap.xml")),
		{
			headers: {
				"Content-Type": "text/plain",
			},
		},
	);
}
