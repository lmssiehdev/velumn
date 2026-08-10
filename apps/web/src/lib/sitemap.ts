import type { PostMetadata } from "@/app/blog/_lib/posts";
import { absoluteUrl } from "@/lib/seo";

export type SitemapUrlEntry = {
	loc: string;
	lastmod?: string;
	changefreq?: string;
	priority?: string;
};

type SitemapIndexEntry = {
	loc: string;
	lastmod?: string;
};

type BlogSitemapPost = {
	slug: string;
	metadata: PostMetadata;
};

function xmlEscape(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export function buildUrlSetXml(entries: SitemapUrlEntry[]) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(entry) => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>${
			entry.lastmod
				? `
    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`
				: ""
		}${
			entry.changefreq
				? `
    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`
				: ""
		}${
			entry.priority
				? `
    <priority>${xmlEscape(entry.priority)}</priority>`
				: ""
		}
  </url>`,
	)
	.join("\n")}
</urlset>`;
}

export function buildSitemapIndexXml(entries: SitemapIndexEntry[]) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(entry) => `  <sitemap>
    <loc>${xmlEscape(entry.loc)}</loc>
			${entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ""}
  </sitemap>`,
	)
	.join("\n")}
</sitemapindex>`;
}

export function buildStaticSitemapEntries(
	posts: BlogSitemapPost[],
): SitemapUrlEntry[] {
	return [
		{
			loc: absoluteUrl("/"),
			changefreq: "weekly",
			priority: "1.0",
		},
		{
			loc: absoluteUrl("/pricing"),
			changefreq: "monthly",
			priority: "0.8",
		},
		{
			loc: absoluteUrl("/oss-program"),
			changefreq: "monthly",
			priority: "0.8",
		},
		{
			loc: absoluteUrl("/oss-program"),
			lastmod: now,
			changefreq: "monthly",
			priority: "0.8",
		},
		{
			loc: absoluteUrl("/blog"),
			changefreq: "weekly",
			priority: "0.7",
		},
		...posts.map((post) => ({
			loc: absoluteUrl(`/blog/${post.slug}`),
			lastmod: post.metadata.updatedAt ?? post.metadata.publishedAt,
			changefreq: "monthly",
			priority: "0.6",
		})),
	];
}
