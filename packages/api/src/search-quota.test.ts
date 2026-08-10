import { describe, expect, it, vi } from "vitest";
import { consumePublicSearchQuota, getTrustedClientIp } from "./search-quota";

describe("trusted public search client IP", () => {
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
		expect(
			getTrustedClientIp({
				providedSecret: "secret",
				expectedSecret: "secret",
				propagatedIp: "203.0.113.8, 10.0.0.1",
			}),
		).toBeUndefined();
	});
});

describe("public search quota", () => {
	it("atomically consumes a fixed-window quota with Redis EVAL", async () => {
		const send = vi.fn<(command: string, args: string[]) => Promise<unknown>>(
			async () => [0, 23],
		);
		await expect(
			consumePublicSearchQuota("203.0.113.8", { send }),
		).resolves.toEqual({ allowed: false, retryAfterSeconds: 23 });
		const [command, args] = send.mock.calls[0] ?? [];
		expect(command).toBe("EVAL");
		expect(args?.slice(1)).toEqual([
			"1",
			"search:public:minute:ip:203.0.113.8",
			"60",
			"30",
		]);
	});

	it("fails closed without issuing Redis commands for an invalid IP", async () => {
		const send = vi.fn();
		await expect(
			consumePublicSearchQuota("not-an-ip", { send }),
		).resolves.toEqual({ allowed: false, retryAfterSeconds: 60 });
		expect(send).not.toHaveBeenCalled();
	});
});
