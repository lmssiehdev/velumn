import { getThreadsForServerSitemap } from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import { getCustomDomainUrl } from "@/lib/domains";
import { buildUrlSetXml } from "@/lib/sitemap";
import { getTenantServerOrNotFound } from "../../_lib/tenant";
import { LIMIT } from "../route";

export const revalidate = 86_400;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ domain: string; id: string }> },
) {
	const { domain, id } = await params;
	const start = Number(id) * LIMIT;
	const { server } = await getTenantServerOrNotFound(domain);
	const threads = await getThreadsForServerSitemap(server.id, start, LIMIT);

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
