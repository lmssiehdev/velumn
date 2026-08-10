import {
	getTenantThreadsForSitemapRange,
	parseSitemapRange,
} from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getCustomDomainUrl } from "@/lib/domains";
import { buildUrlSetXml } from "@/lib/sitemap";
import { getTenantServerOrNotFound } from "../../_lib/tenant";
import { LIMIT } from "../route";

export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ domain: string; id: string }> },
) {
	const { domain, id } = await params;
	const range = parseSitemapRange(id);
	if (!range) return new Response("Not found\n", { status: 404 });
	const { server } = await getTenantServerOrNotFound(domain);
	const threads = await getTenantThreadsForSitemapRange(
		server.id,
		range,
		LIMIT,
	);

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
