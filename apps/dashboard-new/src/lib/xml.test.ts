import { describe, expect, it } from "vitest"

import { buildSitemapIndexXml, buildUrlSetXml } from "./xml"

describe("buildUrlSetXml", () => {
  it("escapes XML-sensitive URL characters", () => {
    expect(
      buildUrlSetXml([{ loc: `https://example.com/?a=<&quote="'` }])
    ).toContain("https://example.com/?a=&lt;&amp;quote=&quot;&apos;")
  })

  it("renders optional sitemap metadata", () => {
    const xml = buildUrlSetXml([
      {
        loc: "https://example.com/thread/1",
        lastmod: "2026-08-10T00:00:00.000Z",
        changefreq: "weekly",
      },
    ])

    expect(xml).toContain("<lastmod>2026-08-10T00:00:00.000Z</lastmod>")
    expect(xml).toContain("<changefreq>weekly</changefreq>")
  })
})

describe("buildSitemapIndexXml", () => {
  it("renders escaped sitemap locations", () => {
    const xml = buildSitemapIndexXml([
      { loc: "https://example.com/sitemap.xml/0?source=a&kind=b" },
    ])

    expect(xml).toContain(
      "https://example.com/sitemap.xml/0?source=a&amp;kind=b"
    )
    expect(xml).toContain("<sitemapindex")
  })
})
