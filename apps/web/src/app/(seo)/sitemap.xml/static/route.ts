import { getAllPosts } from "@/app/blog/_lib/posts";
import { getRequestHostContext } from "@/lib/request-host";
import { buildStaticSitemapEntries, buildUrlSetXml } from "@/lib/sitemap";

export const revalidate = 86_400;

export async function GET(request: Request) {
	const hostContext = await getRequestHostContext(request.headers.get("host"));

	if (!hostContext) {
		return new Response("Not Found", { status: 404 });
	}

	if (hostContext.type === "tenant") {
		return new Response("Not Found", { status: 404 });
	}

	const posts = await getAllPosts();
	const sitemap = buildUrlSetXml(buildStaticSitemapEntries(posts));

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml",
		},
	});
}
