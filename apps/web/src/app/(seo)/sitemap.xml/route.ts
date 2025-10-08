import { getThreadsCountTotal } from "@repo/db/helpers/sitemap";

const BASE_URL = "http://localhost:3000";
export const LIMIT = 47000;

export async function GET() {
  const count = await getThreadsCountTotal();
  const numSitemaps = Math.ceil(count / LIMIT);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: numSitemaps })
  .map(
    (_, i) => `  <url>
  <loc>${BASE_URL}/sitemap.xml/${i}</loc>
  <lastmod>${new Date().toISOString()}</lastmod>
</url>`,
  )
  .join("\n")}
</sitemapindex>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
