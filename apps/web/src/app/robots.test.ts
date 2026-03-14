import { afterEach, describe, expect, it } from "bun:test";
import robots from "@/app/robots";

const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
	process.env.VERCEL_ENV = originalVercelEnv;
});

describe("robots route", () => {
	it("disallows all crawling outside production", () => {
		process.env.VERCEL_ENV = "preview";

		expect(robots()).toEqual({
			rules: [
				{
					userAgent: "*",
					disallow: ["/"],
				},
			],
		});
	});

	it("publishes sitemap and api block rules in production", () => {
		process.env.VERCEL_ENV = "production";

		expect(robots()).toEqual({
			rules: [
				{
					userAgent: "*",
					allow: ["/", "/api/og/*"],
					disallow: ["/api/"],
				},
			],
			sitemap: "https://velumn.com/sitemap.xml",
		});
	});
});
