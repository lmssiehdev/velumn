import { TRPCError } from "@trpc/server";
import { Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { IndexingRepositoryError } from "../adapters/indexing-repository";
import type { BotApiOperations } from "../http/operations";
import {
	ReconciliationJobConflictError,
	ReconciliationJobNotFoundError,
} from "../http/operations";
import { consumePublicSearchQuota } from "./rate-limit";
import { createBotRouter, toSearchExcerpt } from "./trpc";

vi.mock("@repo/db/helpers/channels", () => ({ updateVote: vi.fn() }));
vi.mock("./rate-limit", () => ({
	consumePublicSearchQuota: vi.fn(),
	isRateLimited: vi.fn(),
	isSearchRateLimited: vi.fn(),
	trackSearch: vi.fn(),
	trackVote: vi.fn(),
}));

const serverId = "123456789012345678";
const threadId = "223456789012345678";
const jobId = "123e4567-e89b-42d3-a456-426614174000";

const makeOperations = (
	overrides: Partial<BotApiOperations> = {},
): BotApiOperations => ({
	getReadiness: async () => {
		throw new Error("not used");
	},
	search: async () => {
		throw new Error("not used");
	},
	getSearchHealth: async () => {
		throw new Error("not used");
	},
	startGuildReconciliation: async () => ({ id: jobId, status: "queued" }),
	startThreadReconciliation: async () => ({ id: jobId, status: "queued" }),
	getReconciliationJob: async () => ({ id: jobId, status: "running" }),
	cancelReconciliationJob: async () => ({ id: jobId, status: "cancelled" }),
	...overrides,
});

const makeCaller = (
	operations: BotApiOperations,
	context: { secret?: string; trustedClientIp?: string } = {
		secret: "secret",
	},
) =>
	createBotRouter({
		apiSecret: "secret",
		discordClient: new Client({ intents: [] }) as Client<true>,
	}).createCaller({ ...context, operations });

describe("indexing tRPC procedures", () => {
	it("returns the accepted job from both server procedure names", async () => {
		const start = vi.fn(async () => ({ id: jobId, status: "queued" as const }));
		const caller = makeCaller(
			makeOperations({ startGuildReconciliation: start }),
		);

		await expect(caller.indexServer({ serverId })).resolves.toEqual({
			id: jobId,
			status: "queued",
		});
		await expect(caller.reindexServer({ serverId })).resolves.toEqual({
			id: jobId,
			status: "queued",
		});
		expect(start).toHaveBeenNthCalledWith(
			1,
			serverId,
			{ trigger: "index-server", maxThreads: 15 },
			undefined,
		);
		expect(start).toHaveBeenNthCalledWith(
			2,
			serverId,
			{ trigger: "reindex-server" },
			undefined,
		);
	});

	it("preserves the reindexThread input and returns its accepted job", async () => {
		const start = vi.fn(async () => ({ id: jobId, status: "queued" as const }));
		const caller = makeCaller(
			makeOperations({ startThreadReconciliation: start }),
		);

		await expect(
			caller.reindexThread({ serverId, channelId: threadId }),
		).resolves.toEqual({ id: jobId, status: "queued" });
		expect(start).toHaveBeenCalledWith(serverId, threadId, undefined);
	});

	it("rejects malformed snowflakes before calling the operations boundary", async () => {
		const start = vi.fn(async () => ({ id: jobId, status: "queued" as const }));
		const caller = makeCaller(
			makeOperations({ startGuildReconciliation: start }),
		);

		await expect(
			caller.indexServer({ serverId: "not-a-snowflake" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(start).not.toHaveBeenCalled();
	});

	it("maps typed job failures without exposing repository causes", async () => {
		const notFound = makeCaller(
			makeOperations({
				getReconciliationJob: async () => {
					throw new ReconciliationJobNotFoundError({ resource: "job" });
				},
			}),
		);
		const conflict = makeCaller(
			makeOperations({
				cancelReconciliationJob: async () => {
					throw new ReconciliationJobConflictError({
						reason: "job-finished",
					});
				},
			}),
		);
		const repository = makeCaller(
			makeOperations({
				startGuildReconciliation: async () => {
					throw new IndexingRepositoryError({
						operation: "create-job",
						cause: new Error("raw database diagnostics"),
					});
				},
			}),
		);

		await expect(notFound.getIndexingJob({ jobId })).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Indexing job not found",
		});
		await expect(conflict.cancelIndexingJob({ jobId })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Indexing job has already finished",
		});
		try {
			await repository.indexServer({ serverId });
			expect.unreachable("expected repository failure");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect(error).toMatchObject({
				code: "INTERNAL_SERVER_ERROR",
				message: "Indexing job storage is unavailable",
			});
			expect((error as TRPCError).cause).toBeUndefined();
		}
	});
});

describe("public search gateway tRPC procedure", () => {
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
		const unauthenticated = makeCaller(operations, {
			secret: "wrong",
			trustedClientIp: "203.0.113.4",
		});
		const missingIp = makeCaller(operations);

		await expect(
			unauthenticated.searchPublic({ serverId, query: "effect" }),
		).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden" });
		await expect(
			missingIp.searchPublic({ serverId, query: "effect" }),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "A trusted client IP is required",
		});
		expect(consumePublicSearchQuota).not.toHaveBeenCalled();
	});

	it("rejects malformed Discord snowflakes before consuming quota", async () => {
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
		expect(consumePublicSearchQuota).not.toHaveBeenCalled();
	});

	it("maps atomic quota rejection without calling search", async () => {
		vi.mocked(consumePublicSearchQuota).mockResolvedValueOnce({
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
		expect(consumePublicSearchQuota).toHaveBeenCalledWith("203.0.113.4");
		expect(search).not.toHaveBeenCalled();
	});

	it("returns only the safe DTO and plain highlight segments", async () => {
		vi.mocked(consumePublicSearchQuota).mockResolvedValueOnce({
			allowed: true,
			retryAfterSeconds: 0,
		});
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
			_formatted: {
				title: '<img src=x onerror="alert(1)">',
			},
			providerOnly: "must not leak",
		};
		const caller = makeCaller(
			makeOperations({
				search: async () => ({
					hits: [
						hit,
						{ ...hit, id: "423456789012345678" },
						{ ...hit, id: "523456789012345678" },
					],
					offset: 0,
					limit: 15,
					estimatedTotalHits: 3,
					processingTimeMs: 2,
					query: "effect",
				}),
			}),
			{ secret: "secret", trustedClientIp: "203.0.113.4" },
		);

		const result = await caller.searchPublic({ serverId, query: "effect" });

		expect(result).toEqual({
			hits: [
				{
					id: "323456789012345678",
					threadId,
					title: "Effect search",
					channelName: "help",
					content: "Use Effect safely",
					isThreadStarter: false,
					timestamp: 123,
					threadUrl: `/thread/${threadId}/effect_search#323456789012345678`,
					highlights: {
						title: [
							{ value: "Effect", highlighted: true },
							{ value: " search", highlighted: false },
						],
						content: [
							{ value: "Use ", highlighted: false },
							{ value: "Effect", highlighted: true },
							{ value: " safely", highlighted: false },
						],
					},
				},
				expect.objectContaining({ id: "423456789012345678" }),
			],
			estimatedTotalHits: 3,
			processingTimeMs: 2,
			query: "effect",
		});
		expect(JSON.stringify(result)).not.toContain("_formatted");
		expect(JSON.stringify(result)).not.toContain("providerOnly");
		expect(JSON.stringify(result)).not.toContain("<img");
	});
});
