export type SitemapUrlEntry = {
  loc: string
  lastmod?: string
  changefreq?: string
}

export type SitemapIndexEntry = {
  loc: string
  lastmod?: string
}

export function buildUrlSetXml(urls: readonly SitemapUrlEntry[]) {
  const entries = urls
    .map((entry) => {
      return `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${xmlElement("lastmod", entry.lastmod)}${xmlElement("changefreq", entry.changefreq)}
  </url>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

export function buildSitemapIndexXml(entries: readonly SitemapIndexEntry[]) {
  const sitemaps = entries
    .map(
      (entry) => `  <sitemap>
    <loc>${escapeXml(entry.loc)}</loc>${xmlElement("lastmod", entry.lastmod)}
  </sitemap>`
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>
`
}

function xmlElement(name: string, value: string | undefined) {
  return value ? `\n    <${name}>${escapeXml(value)}</${name}>` : ""
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
