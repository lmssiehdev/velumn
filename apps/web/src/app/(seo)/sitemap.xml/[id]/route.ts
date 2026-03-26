import {
	getThreadsForServerSitemap,
	getThreadsForSitemap,
} from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import { getHostUrl, getRequestHostContext } from "@/lib/request-host";
import { absoluteUrl } from "@/lib/seo";
import { buildUrlSetXml } from "@/lib/sitemap";
import { LIMIT } from "../route";

export const revalidate = 86_400;

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const start = Number(id) * LIMIT;
	const hostContext = await getRequestHostContext(request.headers.get("host"));

	if (!hostContext) {
		return new Response("Not Found", { status: 404 });
	}

	if (hostContext.type === "tenant") {
		const threads = await getThreadsForServerSitemap(
			hostContext.server.id,
			start,
			LIMIT,
		);

		const sitemap = buildUrlSetXml(
			threads.map((thread) => ({
				loc: getHostUrl(
					hostContext.host,
					slugifyThreadUrl({
						id: thread.id,
						name: thread.name ?? thread.id,
					}),
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

	const threads = await getThreadsForSitemap(start, LIMIT);

	const sitemap = buildUrlSetXml(
		threads.map((thread) => ({
			loc: absoluteUrl(
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
