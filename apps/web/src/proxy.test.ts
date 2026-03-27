import { describe, expect, it } from "bun:test";
import { acceptsMarkdown, getMarkdownThreadRewrite } from "@/proxy";

describe("proxy markdown routing", () => {
	it("detects markdown accept headers", () => {
		expect(acceptsMarkdown("text/html, text/markdown;q=0.9")).toBe(true);
		expect(acceptsMarkdown("text/html,application/xhtml+xml")).toBe(false);
	});

	it("rewrites main-site thread requests for markdown accept", () => {
		expect(
			getMarkdownThreadRewrite(
				"/thread/123/right_slug",
				"velumn.com",
				"text/html, text/markdown;q=0.9",
			),
		).toEqual({ pathname: "/markdown/123" });
	});

	it("rewrites explicit markdown thread URLs on the main site", () => {
		expect(
			getMarkdownThreadRewrite("/thread/123/right_slug.md", "velumn.com", null),
		).toEqual({ pathname: "/markdown/123" });
	});

	it("rewrites explicit markdown thread URLs on custom domains", () => {
		expect(
			getMarkdownThreadRewrite(
				"/thread/123/right_slug.md",
				"docs.example.com",
				null,
			),
		).toEqual({ pathname: "/docs.example.com/markdown/123" });
	});

	it("falls back to the main-site markdown path when host is missing", () => {
		expect(
			getMarkdownThreadRewrite("/thread/123/right_slug.md", null, null),
		).toEqual({ pathname: "/markdown/123" });
	});

	it("ignores normal html thread requests", () => {
		expect(
			getMarkdownThreadRewrite(
				"/thread/123/right_slug",
				"velumn.com",
				"text/html,application/xhtml+xml",
			),
		).toBeNull();
	});
});
