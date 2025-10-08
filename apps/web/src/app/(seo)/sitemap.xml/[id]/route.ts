import { getThreadsForSitemap } from '@repo/db/helpers/sitemap';
import { getDateFromSnowflake } from '@repo/utils/helpers/snowflake';
import { LIMIT } from '../route';

const BASE_URL = 'http://localhost:3000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const start = Number(id) * LIMIT;

  const threads = await getThreadsForSitemap(start, LIMIT);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${threads
  .map(
    (thread) => `  <url>
    <loc>${BASE_URL}/thread/${thread.id}</loc>
    <lastmod>${getDateFromSnowflake(thread.id).toISOString()}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
