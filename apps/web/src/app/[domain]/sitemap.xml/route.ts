import {
	getThreadsCountForServer,
	getThreadsForServerSitemap,
} from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import { getCustomDomainUrl } from "@/lib/domains";
import { buildSitemapIndexXml, buildUrlSetXml } from "@/lib/sitemap";
import { getTenantServerOrNotFound } from "../_lib/tenant";

export const revalidate = 86_400;

export const LIMIT = 47_000;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ domain: string }> },
) {
	const { domain } = await params;
	const { server } = await getTenantServerOrNotFound(domain);
	const count = await getThreadsCountForServer(server.id);

	if (count <= LIMIT) {
		const threads = await getThreadsForServerSitemap(server.id, 0, LIMIT);
		const sitemap = buildUrlSetXml(
			threads.map((thread) => ({
				loc: getCustomDomainUrl(
					server,
					slugifyThreadUrl({ id: thread.id, name: thread.name ?? thread.id }),
				),
				lastmod: getDateFromSnowflake(thread.id).toISOString(),
				priority: "0.9",
			})),
		);

		return new Response(sitemap, {
			headers: {
				"Content-Type": "application/xml",
			},
		});
	}

	const numSitemaps = Math.ceil(count / LIMIT);
	const sitemap = buildSitemapIndexXml(
		Array.from({ length: numSitemaps }, (_, index) => ({
			loc: getCustomDomainUrl(server, `/sitemap.xml/${index}`),
		})),
	);

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml",
		},
	});
}
