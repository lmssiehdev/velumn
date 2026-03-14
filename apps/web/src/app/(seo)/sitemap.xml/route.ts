import { getThreadsCountTotal } from "@repo/db/helpers/sitemap";
import { getAllPosts } from "@/app/blog/_lib/posts";
import { absoluteUrl } from "@/lib/seo";
import { buildSitemapIndexXml, buildStaticSitemapEntries } from "@/lib/sitemap";

export const revalidate = 86_400;

export const LIMIT = 47_000;

export async function GET() {
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
			lastmod: new Date().toISOString(),
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
