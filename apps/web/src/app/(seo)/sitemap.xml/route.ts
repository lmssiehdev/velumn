import {
	getThreadsCountForServer,
	getThreadsCountTotal,
	getThreadsForServerSitemap,
} from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import { getAllPosts } from "@/app/blog/_lib/posts";
import { getHostUrl, getRequestHostContext } from "@/lib/request-host";
import { absoluteUrl } from "@/lib/seo";
import {
	buildSitemapIndexXml,
	buildStaticSitemapEntries,
	buildUrlSetXml,
} from "@/lib/sitemap";

export const revalidate = 86_400;

export const LIMIT = 47_000;

export async function GET(request: Request) {
	const hostContext = await getRequestHostContext(request.headers.get("host"));

	if (!hostContext) {
		return new Response("Not Found", { status: 404 });
	}

	if (hostContext.type === "tenant") {
		const count = await getThreadsCountForServer(hostContext.server.id);

		if (count <= LIMIT) {
			const threads = await getThreadsForServerSitemap(
				hostContext.server.id,
				0,
				LIMIT,
			);
			const sitemap = buildTenantThreadSitemap(hostContext.host, threads);

			return new Response(sitemap, {
				headers: {
					"Content-Type": "application/xml",
				},
			});
		}

		const numSitemaps = Math.ceil(count / LIMIT);
		const sitemap = buildSitemapIndexXml(
			Array.from({ length: numSitemaps }, (_, index) => ({
				loc: getHostUrl(hostContext.host, `/sitemap.xml/${index}`),
			})),
		);

		return new Response(sitemap, {
			headers: {
				"Content-Type": "application/xml",
			},
		});
	}

	const [count, posts] = await Promise.all([
		getThreadsCountTotal(),
		getAllPosts(),
	]);
	const numSitemaps = Math.ceil(count / LIMIT);
	const staticEntries = buildStaticSitemapEntries(posts);
	const latestStaticLastmod = staticEntries.reduce(
		(latest, entry) => (entry.lastmod > latest ? entry.lastmod : latest),
		staticEntries[0]?.lastmod ?? new Date().toISOString(),
	);
	const threadSitemapEntries = Array.from(
		{ length: numSitemaps },
		(_, index) => ({
			loc: absoluteUrl(`/sitemap.xml/${index}`),
		}),
	);

	const sitemap = buildSitemapIndexXml([
		{
			loc: absoluteUrl("/sitemap.xml/static"),
			lastmod: latestStaticLastmod,
		},
		...threadSitemapEntries,
	]);

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml",
		},
	});
}

function buildTenantThreadSitemap(
	host: string,
	threads: Array<{ id: string; name: string | null }>,
) {
	return buildUrlSetXml(
		threads.map((thread) => ({
			loc: getHostUrl(
				host,
				slugifyThreadUrl({ id: thread.id, name: thread.name ?? thread.id }),
			),
			lastmod: getDateFromSnowflake(thread.id).toISOString(),
			priority: "0.9",
		})),
	);
}
