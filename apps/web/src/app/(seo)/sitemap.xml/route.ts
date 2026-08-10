import {
	encodeSitemapRange,
	getCanonicalSitemapPartitions,
} from "@repo/db/helpers/sitemap";
import { absoluteUrl } from "@/lib/seo";
import { buildSitemapIndexXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export const LIMIT = 47_000;

export async function GET() {
	const partitions = await getCanonicalSitemapPartitions(LIMIT);

	const sitemap = buildSitemapIndexXml([
		{ loc: absoluteUrl("/sitemap.xml/static") },
		...partitions.map((partition) => ({
			loc: absoluteUrl(`/sitemap.xml/${encodeSitemapRange(partition)}`),
		})),
	]);

	return new Response(sitemap, {
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "application/xml",
		},
	});
}
