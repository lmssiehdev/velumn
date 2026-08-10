import { getAllPosts } from "@/app/blog/_lib/posts";
import { buildStaticSitemapEntries, buildUrlSetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
	const posts = await getAllPosts();
	const sitemap = buildUrlSetXml(buildStaticSitemapEntries(posts));

	return new Response(sitemap, {
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "application/xml",
		},
	});
}
