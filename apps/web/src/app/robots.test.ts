import { afterEach, describe, expect, it } from "bun:test";
import { GET } from "@/app/robots.txt/route";

const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
	process.env.VERCEL_ENV = originalVercelEnv;
});

describe("robots route", () => {
	it("disallows all crawling outside production", async () => {
		process.env.VERCEL_ENV = "preview";

		const response = await GET();

		expect(await response.text()).toBe("User-Agent: *\nDisallow: /\n");
	});

	it("publishes api block rules in production on the main host", async () => {
		process.env.VERCEL_ENV = "production";

		const response = await GET();

		expect(await response.text()).toBe(
			"User-Agent: *\nAllow: /\nAllow: /api/og/*\nDisallow: /api/\n\nSitemap: https://velumn.com/sitemap.xml\n",
		);
	});
});
