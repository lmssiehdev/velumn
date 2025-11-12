import { getThreadsCountTotal } from '@repo/db/helpers/sitemap';

export const revalidate = 86400;

export const DOMAIN_BASE_URL = 'https://velumn.com';
export const LIMIT = 47_000;

export async function GET() {
  const count = await getThreadsCountTotal();
  const numSitemaps = Math.ceil(count / LIMIT);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: numSitemaps })
      .map(
        (_, i) => `  <sitemap>
  <loc>${DOMAIN_BASE_URL}/sitemap.xml/${i}</loc>
</sitemap>`
      )
      .join('\n')}
</sitemapindex>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
