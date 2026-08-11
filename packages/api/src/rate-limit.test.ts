import { describe, expect, it, vi } from "vitest";
import { getTrustedClientIp, makeRateLimiter, normalizeIp } from "./rate-limit";

describe("Redis rate limiter", () => {
	it("enforces a fixed window and returns its remaining TTL", async () => {
		const incr = vi
			.fn<(key: string) => Promise<number>>()
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(2)
			.mockResolvedValueOnce(3);
		const expire = vi.fn(async () => 1);
		const send = vi.fn(async () => 42);
		const limiter = makeRateLimiter({ incr, expire, send });
		const input = { key: "search:203.0.113.8", limit: 2, windowMs: 60_000 };

		await expect(limiter.consume(input)).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		await expect(limiter.consume(input)).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		await expect(limiter.consume(input)).resolves.toEqual({
			allowed: false,
			retryAfterSeconds: 42,
		});
		expect(expire).toHaveBeenCalledWith(input.key, 60);
		expect(send).toHaveBeenCalledWith("TTL", [input.key]);
	});

	it("repairs a missing expiry", async () => {
		const expire = vi.fn(async () => 1);
		const limiter = makeRateLimiter({
			incr: async () => 6,
			expire,
			send: async () => -1,
		});

		await expect(
			limiter.consume({ key: "vote:ip", limit: 5, windowMs: 3_600_000 }),
		).resolves.toEqual({ allowed: false, retryAfterSeconds: 3_600 });
		expect(expire).toHaveBeenCalledWith("vote:ip", 3_600);
	});
});

describe("trusted client IP", () => {
	it("accepts only a valid propagated IP accompanied by the API secret", () => {
		expect(
			getTrustedClientIp({
				providedSecret: "secret",
				expectedSecret: "secret",
				propagatedIp: " ::ffff:203.0.113.8 ",
			}),
		).toBe("203.0.113.8");
		expect(
			getTrustedClientIp({
				providedSecret: "wrong",
				expectedSecret: "secret",
				propagatedIp: "203.0.113.8",
			}),
		).toBeUndefined();
		expect(normalizeIp("203.0.113.8, 10.0.0.1")).toBeUndefined();
	});
});
