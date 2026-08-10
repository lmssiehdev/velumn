import {
	getCanonicalThreadsForSitemapRange,
	parseSitemapRange,
} from "@repo/db/helpers/sitemap";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { absoluteUrl } from "@/lib/seo";
import { buildUrlSetXml } from "@/lib/sitemap";
import { LIMIT } from "../route";

export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const range = parseSitemapRange(id);
	if (!range) return new Response("Not found\n", { status: 404 });

	const threads = await getCanonicalThreadsForSitemapRange(range, LIMIT);

	const sitemap = buildUrlSetXml(
		threads.map((thread) => ({
			loc: absoluteUrl(
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
