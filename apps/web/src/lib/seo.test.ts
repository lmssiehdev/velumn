import { describe, expect, it } from "bun:test";
import {
	absoluteUrl,
	buildBlogArticleMetadata,
	buildDefaultOgImage,
	buildDiscussionMetadata,
	buildPageMetadata,
	buildRobots,
} from "@/lib/seo";

describe("seo helpers", () => {
	it("builds standard page metadata with canonical, og, and twitter tags", () => {
		const metadata = buildPageMetadata({
			title: "Pricing for Discord SEO Forum Indexing",
			description: "A complete pricing page description for Velumn.",
			canonicalUrl: absoluteUrl("/pricing"),
		});
		const openGraph = metadata.openGraph as {
			url?: string;
			siteName?: string;
		};
		const twitter = metadata.twitter as {
			card?: string;
			site?: string;
		};

		expect(metadata.alternates?.canonical).toBe("https://velumn.com/pricing");
		expect(openGraph.url).toBe("https://velumn.com/pricing");
		expect(openGraph.siteName).toBe("Velumn");
		expect(twitter.card).toBe("summary_large_image");
		expect(twitter.site).toBe("@velumn");
	});

	it("builds discussion metadata with noindex support", () => {
		const metadata = buildDiscussionMetadata({
			title: "A Demo Thread",
			description: "A trimmed thread description.",
			canonicalUrl: absoluteUrl("/thread/123/a_demo_thread"),
			image: {
				url: absoluteUrl("/og?id=123"),
				alt: "A Demo Thread discussion preview",
			},
			robots: buildRobots({
				index: false,
				follow: true,
			}),
		});
		const openGraph = metadata.openGraph as {
			type?: string;
			images?: Array<{
				url: string;
				alt?: string;
			}>;
		};

		expect(metadata.robots).toEqual({
			index: false,
			follow: true,
		});
		expect(openGraph.type).toBe("article");
		expect(openGraph.images?.[0]).toMatchObject({
			url: "https://velumn.com/og?id=123",
			alt: "A Demo Thread discussion preview",
		});
	});

	it("builds blog article metadata with article timestamps", () => {
		const metadata = buildBlogArticleMetadata({
			title: "Discord search just sucks",
			description: "Why Discord search breaks down as communities scale.",
			canonicalUrl: absoluteUrl("/blog/discord-search-sucks"),
			image: buildDefaultOgImage("Discord search just sucks social preview"),
			publishedTime: "2026-02-01",
			modifiedTime: "2026-02-05",
		});
		const openGraph = metadata.openGraph as {
			type?: string;
			publishedTime?: string;
			modifiedTime?: string;
		};

		expect(openGraph.type).toBe("article");
		expect(openGraph.publishedTime).toBe("2026-02-01");
		expect(openGraph.modifiedTime).toBe("2026-02-05");
	});
});
