import {
	encodeSitemapRange,
	getTenantSitemapPartitions,
	getTenantThreadsForSitemapRange,
} from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getCustomDomainUrl } from "@/lib/domains";
import { buildSitemapIndexXml, buildUrlSetXml } from "@/lib/sitemap";
import { getTenantServerOrNotFound } from "../_lib/tenant";

export const dynamic = "force-dynamic";

export const LIMIT = 47_000;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ domain: string }> },
) {
	const { domain } = await params;
	const { server } = await getTenantServerOrNotFound(domain);
	const partitions = await getTenantSitemapPartitions(server.id, LIMIT);

	if (partitions.length <= 1) {
		const threads = partitions[0]
			? await getTenantThreadsForSitemapRange(server.id, partitions[0], LIMIT)
			: [];
		const sitemap = buildUrlSetXml(
			threads.map((thread) => ({
				loc: getCustomDomainUrl(
					server,
					slugifyThreadUrl({ id: thread.id, name: thread.name ?? thread.id }),
				),
				priority: "0.9",
			})),
		);

		return new Response(sitemap, {
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "application/xml",
			},
		});
	}

	const sitemap = buildSitemapIndexXml(
		partitions.map((partition) => ({
			loc: getCustomDomainUrl(
				server,
				`/sitemap.xml/${encodeSitemapRange(partition)}`,
			),
		})),
	);

	return new Response(sitemap, {
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "application/xml",
		},
	});
}
