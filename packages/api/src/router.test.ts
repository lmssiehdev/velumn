import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFailure, apiSuccess, type BotApiOperations } from "./contracts";
import type { RateLimiter } from "./rate-limit";
import { botRouter } from "./router";
import { toSearchExcerpt } from "./search-format";

const serverId = "123456789012345678";
const threadId = "223456789012345678";
const jobId = "123e4567-e89b-42d3-a456-426614174000";
const consumeRateLimit = vi.fn<RateLimiter["consume"]>();

const makeOperations = (
	overrides: Partial<BotApiOperations> = {},
): BotApiOperations => ({
	getReadiness: async () => {
		throw new Error("not used");
	},
	search: async () => {
		throw new Error("not used");
	},
	startGuildReconciliation: async () =>
		apiSuccess({ id: jobId, status: "queued" }),
	updateVote: async () => apiSuccess(undefined),
	...overrides,
});

const makeCaller = (
	operations: BotApiOperations,
	context: { secret?: string; trustedClientIp?: string } = {
		secret: "secret",
	},
) =>
	botRouter.createCaller({
		apiSecret: "secret",
		rateLimiter: { consume: consumeRateLimit },
		operations,
		...context,
	});

beforeEach(() => {
	consumeRateLimit.mockReset();
	consumeRateLimit.mockResolvedValue({
		allowed: true,
		retryAfterSeconds: 0,
	});
});

describe("indexServer", () => {
	it("submits a durable indexing job", async () => {
		const start = vi.fn(async () =>
			apiSuccess({ id: jobId, status: "queued" as const }),
		);
		const caller = makeCaller(
			makeOperations({ startGuildReconciliation: start }),
		);

		await expect(caller.indexServer({ serverId })).resolves.toEqual({
			id: jobId,
			status: "queued",
		});
		expect(start).toHaveBeenCalledWith(
			serverId,
			{ trigger: "index-server", maxThreads: 15 },
			undefined,
		);
	});

	it("validates input before calling the operation", async () => {
		const start = vi.fn<BotApiOperations["startGuildReconciliation"]>();
		const caller = makeCaller(
			makeOperations({ startGuildReconciliation: start }),
		);

		await expect(
			caller.indexServer({ serverId: "not-a-snowflake" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(start).not.toHaveBeenCalled();
	});

	it("maps storage failures without exposing their cause", async () => {
		const caller = makeCaller(
			makeOperations({
				startGuildReconciliation: async () =>
					apiFailure({ code: "repository_unavailable" }),
			}),
		);

		await expect(caller.indexServer({ serverId })).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: "Indexing job storage is unavailable",
		});
	});
});

describe("updateVote", () => {
	it("applies hourly and per-thread limits before recording a vote", async () => {
		const updateVote = vi.fn(async () => apiSuccess(undefined));
		const caller = makeCaller(makeOperations({ updateVote }), {
			secret: "secret",
			trustedClientIp: "203.0.113.4",
		});

		await expect(
			caller.updateVote({ threadId, type: "upvote" }),
		).resolves.toEqual({ success: true });
		expect(consumeRateLimit).toHaveBeenNthCalledWith(1, {
			key: "vote:hour:203.0.113.4",
			limit: 5,
			windowMs: 3_600_000,
			message: expect.any(Function),
		});
		expect(consumeRateLimit).toHaveBeenNthCalledWith(2, {
			key: `vote:thread:${threadId}:203.0.113.4`,
			limit: 1,
			windowMs: 3_600_000,
			message: expect.any(Function),
		});
		expect(updateVote).toHaveBeenCalledWith(threadId, "upvote");
	});

	it("requires a trusted client and stops exhausted requests", async () => {
		const operations = makeOperations();
		await expect(
			makeCaller(operations).updateVote({ threadId, type: "upvote" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		consumeRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfterSeconds: 120,
		});
		const updateVote = vi.fn<BotApiOperations["updateVote"]>();
		const caller = makeCaller(makeOperations({ updateVote }), {
			secret: "secret",
			trustedClientIp: "203.0.113.4",
		});
		await expect(
			caller.updateVote({ threadId, type: "downvote" }),
		).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
		expect(updateVote).not.toHaveBeenCalled();
	});
});

describe("searchPublic", () => {
	it("crops long excerpts around the first match", () => {
		const content = `${"before ".repeat(80)}needle${" after".repeat(80)}`;
		const excerpt = toSearchExcerpt(content, [
			{ start: content.indexOf("needle"), length: "needle".length },
		]);

		expect(excerpt.value.length).toBeLessThanOrEqual(242);
		expect(excerpt.value).toContain("needle");
		expect(excerpt.value.startsWith("…")).toBe(true);
		expect(excerpt.value.endsWith("…")).toBe(true);
	});

	it("requires authentication and a trusted propagated client IP", async () => {
		const operations = makeOperations();
		await expect(
			makeCaller(operations, {
				secret: "wrong",
				trustedClientIp: "203.0.113.4",
			}).searchPublic({ serverId, query: "effect" }),
		).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden" });
		await expect(
			makeCaller(operations).searchPublic({ serverId, query: "effect" }),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "A trusted client IP is required",
		});
		expect(consumeRateLimit).not.toHaveBeenCalled();
	});

	it("validates input before consuming quota", async () => {
		const caller = makeCaller(makeOperations(), {
			secret: "secret",
			trustedClientIp: "203.0.113.4",
		});
		await expect(
			caller.searchPublic({
				serverId: "18446744073709551616",
				query: "effect",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(consumeRateLimit).not.toHaveBeenCalled();
	});

	it("rejects exhausted quotas before searching", async () => {
		consumeRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfterSeconds: 37,
		});
		const search = vi.fn<BotApiOperations["search"]>();
		const caller = makeCaller(makeOperations({ search }), {
			secret: "secret",
			trustedClientIp: "203.0.113.4",
		});

		await expect(
			caller.searchPublic({ serverId, query: "effect" }),
		).rejects.toMatchObject({
			code: "TOO_MANY_REQUESTS",
			message: "Search quota exceeded. Try again in 37 seconds.",
		});
		expect(search).not.toHaveBeenCalled();
	});

	it("maps typed search failures", async () => {
		const caller = makeCaller(
			makeOperations({
				search: async () => apiFailure({ code: "search_not_configured" }),
			}),
			{ secret: "secret", trustedClientIp: "203.0.113.4" },
		);
		await expect(
			caller.searchPublic({ serverId, query: "effect" }),
		).rejects.toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			message: "Search is not configured",
		});
	});

	it("returns only the safe public DTO", async () => {
		const hit = {
			id: "323456789012345678",
			title: "Effect search",
			channelName: "help",
			content: "Use Effect safely",
			serverId,
			threadId,
			isThreadStarter: false,
			timestamp: 123,
			_matchesPosition: {
				title: [{ start: 0, length: 6 }],
				content: [{ start: 4, length: 6 }],
			},
			providerOnly: "must not leak",
		};
		const caller = makeCaller(
			makeOperations({
				search: async () =>
					apiSuccess({
						hits: [
							hit,
							{ ...hit, id: "423456789012345678" },
							{ ...hit, id: "523456789012345678" },
						],
						estimatedTotalHits: 3,
						processingTimeMs: 2,
						query: "effect",
					}),
			}),
			{ secret: "secret", trustedClientIp: "203.0.113.4" },
		);

		const result = await caller.searchPublic({ serverId, query: "effect" });
		expect(result.hits).toHaveLength(2);
		expect(result.hits[0]).toMatchObject({
			id: hit.id,
			threadUrl: `/thread/${threadId}/effect_search#${hit.id}`,
			highlights: {
				title: expect.arrayContaining([{ value: "Effect", highlighted: true }]),
			},
		});
		expect(JSON.stringify(result)).not.toContain("providerOnly");
	});
});
