import { getAllPosts } from "@/app/blog/_lib/posts";
import { buildStaticSitemapEntries, buildUrlSetXml } from "@/lib/sitemap";

export const revalidate = 86_400;

export async function GET() {
	const posts = await getAllPosts();
	const sitemap = buildUrlSetXml(buildStaticSitemapEntries(posts));

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml",
		},
	});
}
