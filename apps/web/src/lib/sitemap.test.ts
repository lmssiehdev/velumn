import { describe, expect, it } from "bun:test";
import {
	buildSitemapIndexXml,
	buildStaticSitemapEntries,
	buildUrlSetXml,
} from "@/lib/sitemap";

describe("sitemap helpers", () => {
	it("builds static sitemap entries for marketing and blog routes", () => {
		const entries = buildStaticSitemapEntries([
			{
				slug: "discord-search-sucks",
				metadata: {
					title: "Discord search just sucks",
					description: "Description",
					publishedAt: "2026-02-01",
					updatedAt: "2026-02-05",
					thumbnail: "/assets/landing/ss-demo-preview.png",
					thumbnailAlt: "Demo preview",
				},
			},
		]);

		expect(entries.map((entry) => entry.loc)).toEqual([
			"https://velumn.com/",
			"https://velumn.com/pricing",
			"https://velumn.com/oss-program",
			"https://velumn.com/blog",
			"https://velumn.com/blog/discord-search-sucks",
		]);
		expect(entries.at(-1)?.lastmod).toBe("2026-02-05");
	});

	it("renders a valid sitemap index with lastmod entries", () => {
		const xml = buildSitemapIndexXml([
			{
				loc: "https://velumn.com/sitemap.xml/static",
				lastmod: "2026-03-11T00:00:00.000Z",
			},
		]);

		expect(xml).toContain("<sitemapindex");
		expect(xml).toContain("<loc>https://velumn.com/sitemap.xml/static</loc>");
		expect(xml).toContain("<lastmod>2026-03-11T00:00:00.000Z</lastmod>");
	});

	it("omits lastmod in sitemap index when it is unknown", () => {
		const xml = buildSitemapIndexXml([
			{
				loc: "https://velumn.com/sitemap.xml/0",
			},
		]);

		expect(xml).toContain("<loc>https://velumn.com/sitemap.xml/0</loc>");
		expect(xml).not.toContain("<lastmod>");
	});

	it("renders a urlset with optional changefreq and priority", () => {
		const xml = buildUrlSetXml([
			{
				loc: "https://velumn.com/",
				lastmod: "2026-03-11T00:00:00.000Z",
				changefreq: "weekly",
				priority: "1.0",
			},
		]);

		expect(xml).toContain("<urlset");
		expect(xml).toContain("<changefreq>weekly</changefreq>");
		expect(xml).toContain("<priority>1.0</priority>");
	});
});
