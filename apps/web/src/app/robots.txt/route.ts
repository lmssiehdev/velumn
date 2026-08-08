const BLOCK_ALL = "User-Agent: *\nDisallow: /\n";
const PRODUCTION_ROBOTS =
	"User-Agent: *\nAllow: /\nAllow: /api/og/*\nDisallow: /api/\n\nSitemap: https://velumn.com/sitemap.xml\n";

export async function GET() {
	return new Response(
		process.env.VERCEL_ENV === "production" ? PRODUCTION_ROBOTS : BLOCK_ALL,
		{
			headers: {
				"Content-Type": "text/plain",
			},
		},
	);
}
