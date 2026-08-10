import { apiLogger } from "@repo/logger";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { initTRPC, TRPCError } from "@trpc/server";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import type {
	ApiResult,
	BotApiOperations,
	IndexingFailure,
	MatchPosition,
	SearchFailure,
	SearchResult,
	VoteFailure,
} from "./contracts";

interface Context {
	readonly secret?: string;
	readonly ip?: string;
	readonly trustedClientIp?: string;
	readonly operations: BotApiOperations;
}

interface RateLimitOperations {
	readonly consumePublicSearchQuota: (ip: string) => Promise<{
		readonly allowed: boolean;
		readonly retryAfterSeconds: number;
	}>;
	readonly isRateLimited: (threadId: string, ip?: string) => Promise<boolean>;
	readonly isSearchRateLimited: (ip?: string) => Promise<boolean>;
	readonly trackSearch: (ip?: string) => Promise<void>;
	readonly trackVote: (threadId: string, ip?: string) => Promise<void>;
}

export interface BotRouterOptions {
	readonly apiSecret: string;
	readonly rateLimit: RateLimitOperations;
}

const t = initTRPC.context<Context>().create();

const indexingUnavailable = <A>(): A => {
	throw new TRPCError({
		code: "SERVICE_UNAVAILABLE",
		message:
			"Indexing is unavailable while the bot indexing pipeline is rebuilt",
	});
};

const unwrapIndexingResult = <Value>(
	result: ApiResult<Value, IndexingFailure>,
): Value => {
	if (result.ok) return result.value;
	switch (result.failure.code) {
		case "guild_not_found":
			throw new TRPCError({ code: "NOT_FOUND", message: "Guild not found" });
		case "thread_not_found":
			throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
		case "job_not_found":
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Indexing job not found",
			});
		case "unsupported_thread":
			throw new TRPCError({
				code: "CONFLICT",
				message: "Channel is not a supported Discord thread",
			});
		case "job_finished":
			throw new TRPCError({
				code: "CONFLICT",
				message: "Indexing job has already finished",
			});
		case "discord_unavailable":
			throw new TRPCError({
				code: "BAD_GATEWAY",
				message: "Failed to fetch Discord channel",
			});
		case "repository_unavailable":
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Indexing job storage is unavailable",
			});
	}
};

const unwrapSearchResult = <Value>(
	result: ApiResult<Value, SearchFailure>,
	messages: { readonly notConfigured: string; readonly unavailable: string },
): Value => {
	if (result.ok) return result.value;
	switch (result.failure.code) {
		case "search_not_configured":
			throw new TRPCError({
				code: "SERVICE_UNAVAILABLE",
				message: messages.notConfigured,
			});
		case "search_unavailable":
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: messages.unavailable,
			});
	}
};

const unwrapVoteResult = (result: ApiResult<void, VoteFailure>): void => {
	if (result.ok) return;
	switch (result.failure.code) {
		case "thread_not_found":
			throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
		case "repository_unavailable":
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to vote on thread",
			});
	}
};

export const createBotRouter = ({ apiSecret, rateLimit }: BotRouterOptions) => {
	const isAuthenticated = t.middleware(({ ctx, next }) => {
		if (ctx.secret !== apiSecret) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
		}
		return next();
	});
	const publicProcedure = t.procedure;
	const protectedProcedure = t.procedure.use(isAuthenticated);
	const snowflake = z
		.string()
		.regex(/^\d{17,20}$/, "Invalid Discord snowflake");
	const strictSnowflake = z
		.string()
		.regex(/^[1-9]\d{16,19}$/, "Invalid Discord snowflake")
		.refine(
			(value) => BigInt(value) <= 18_446_744_073_709_551_615n,
			"Invalid Discord snowflake",
		);
	const jobId = z.uuid();

	return t.router({
		health: protectedProcedure.query(() => "OK"),
		reindexServer: protectedProcedure
			.input(z.object({ serverId: snowflake }))
			.mutation(async ({ input, ctx, signal }) =>
				unwrapIndexingResult(
					await ctx.operations.startGuildReconciliation(
						input.serverId,
						{ trigger: "reindex-server" },
						signal,
					),
				),
			),
		reindexThread: protectedProcedure
			.input(z.object({ serverId: snowflake, channelId: snowflake }))
			.mutation(async ({ input, ctx, signal }) =>
				unwrapIndexingResult(
					await ctx.operations.startThreadReconciliation(
						input.serverId,
						input.channelId,
						signal,
					),
				),
			),
		getIndexingJob: protectedProcedure
			.input(z.object({ jobId }))
			.query(async ({ input, ctx, signal }) =>
				unwrapIndexingResult(
					await ctx.operations.getReconciliationJob(input.jobId, signal),
				),
			),
		cancelIndexingJob: protectedProcedure
			.input(z.object({ jobId }))
			.mutation(async ({ input, ctx, signal }) =>
				unwrapIndexingResult(
					await ctx.operations.cancelReconciliationJob(input.jobId, signal),
				),
			),
		getRawMessageData: protectedProcedure
			.input(
				z.object({
					serverId: z.string(),
					channelId: z.string(),
					messageId: z.string(),
				}),
			)
			.mutation(() => indexingUnavailable<unknown>()),
		isBotInServer: protectedProcedure
			.input(z.object({ serverId: z.string() }))
			.query(async ({ input, ctx }) => {
				try {
					return await ctx.operations.isBotInServer(input.serverId);
				} catch (error) {
					apiLogger.error("isBotInServer_failed", { error });
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to check if bot is in server",
						cause: error,
					});
				}
			}),
		meiliHealth: protectedProcedure.query(async ({ ctx, signal }) => {
			const health = unwrapSearchResult(
				await ctx.operations.getSearchHealth(signal),
				{
					notConfigured: "MeiliSearch is not configured",
					unavailable: "Failed to check MeiliSearch health",
				},
			);
			return {
				health: health.status,
				version: health.version,
				numberOfDocuments: health.numberOfDocuments,
				isIndexing: health.isIndexing,
				ip: ctx.ip,
			};
		}),
		search: publicProcedure
			.input(
				z.object({
					serverId: z.string(),
					query: z.string().trim().min(1).max(120),
				}),
			)
			.query(async ({ input, ctx, signal }) => {
				if (await rateLimit.isSearchRateLimited(ctx.ip)) {
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message: "You're searching too quickly. Please slow down.",
					});
				}
				await rateLimit.trackSearch(ctx.ip);
				return formatSearchResults(
					unwrapSearchResult(await ctx.operations.search(input, signal), {
						notConfigured: "Search is not configured",
						unavailable: "Failed to search messages",
					}),
				);
			}),
		searchPublic: protectedProcedure
			.input(
				z.object({
					serverId: strictSnowflake,
					query: z.string().trim().min(1).max(120),
				}),
			)
			.query(async ({ input, ctx, signal }) => {
				if (!ctx.trustedClientIp) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "A trusted client IP is required",
					});
				}
				const quota = await rateLimit.consumePublicSearchQuota(
					ctx.trustedClientIp,
				);
				if (!quota.allowed) {
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message: `Search quota exceeded. Try again in ${quota.retryAfterSeconds} seconds.`,
					});
				}
				return formatPublicSearchResults(
					unwrapSearchResult(await ctx.operations.search(input, signal), {
						notConfigured: "Search is not configured",
						unavailable: "Failed to search messages",
					}),
				);
			}),
		indexServer: protectedProcedure
			.input(
				z.object({
					serverId: snowflake,
					maxThreads: z.number().int().min(0).max(30).default(15),
				}),
			)
			.mutation(async ({ input, ctx, signal }) =>
				unwrapIndexingResult(
					await ctx.operations.startGuildReconciliation(
						input.serverId,
						{ trigger: "index-server", maxThreads: input.maxThreads },
						signal,
					),
				),
			),
		updateVote: publicProcedure
			.input(
				z.object({
					threadId: z.string(),
					type: z.enum(["upvote", "downvote"]),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				if (await rateLimit.isRateLimited(input.threadId, ctx.ip)) {
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message: "You're voting too quickly. Please slow down.",
					});
				}
				unwrapVoteResult(
					await ctx.operations.updateVote(input.threadId, input.type),
				);
				await rateLimit.trackVote(input.threadId, ctx.ip);
				return { success: true };
			}),
	});
};

const maxResultsPerThread = 2;

export interface HighlightSegment {
	readonly value: string;
	readonly highlighted: boolean;
}

export const toHighlightSegments = (
	value: string,
	positions: readonly MatchPosition[] | undefined,
): HighlightSegment[] => {
	const ranges = (positions ?? [])
		.filter(
			({ start, length }) =>
				Number.isInteger(start) &&
				Number.isInteger(length) &&
				start >= 0 &&
				length > 0 &&
				start < value.length,
		)
		.map(({ start, length }) => ({
			start,
			end: Math.min(value.length, start + length),
		}))
		.sort((left, right) => left.start - right.start);
	const merged: Array<{ start: number; end: number }> = [];
	for (const range of ranges) {
		const previous = merged.at(-1);
		if (previous && range.start <= previous.end) {
			previous.end = Math.max(previous.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}
	const segments: HighlightSegment[] = [];
	let cursor = 0;
	for (const range of merged) {
		if (range.start > cursor) {
			segments.push({
				value: value.slice(cursor, range.start),
				highlighted: false,
			});
		}
		segments.push({
			value: value.slice(range.start, range.end),
			highlighted: true,
		});
		cursor = range.end;
	}
	if (cursor < value.length) {
		segments.push({ value: value.slice(cursor), highlighted: false });
	}
	return segments;
};

const maxSearchExcerptLength = 240;
const searchExcerptContext = 72;

export const toSearchExcerpt = (
	value: string,
	positions: readonly MatchPosition[] | undefined,
) => {
	if (value.length <= maxSearchExcerptLength) return { value, positions };
	const firstMatch = positions?.find(
		(position) => position.start >= 0 && position.start < value.length,
	);
	let start = Math.max(0, (firstMatch?.start ?? 0) - searchExcerptContext);
	const end = Math.min(value.length, start + maxSearchExcerptLength);
	if (end - start < maxSearchExcerptLength) {
		start = Math.max(0, end - maxSearchExcerptLength);
	}
	const prefix = start > 0 ? "…" : "";
	const suffix = end < value.length ? "…" : "";
	const adjustedPositions = (positions ?? []).flatMap((position) => {
		const matchStart = Math.max(position.start, start);
		const matchEnd = Math.min(position.start + position.length, end);
		return matchEnd > matchStart
			? [
					{
						start: prefix.length + matchStart - start,
						length: matchEnd - matchStart,
					},
				]
			: [];
	});
	return {
		value: `${prefix}${value.slice(start, end)}${suffix}`,
		positions: adjustedPositions,
	};
};

export const formatPublicSearchResults = (results: SearchResult) => {
	const threadCounts = new Map<string, number>();
	const hits = results.hits
		.filter((hit) => {
			const count = threadCounts.get(hit.threadId) ?? 0;
			if (count >= maxResultsPerThread) return false;
			threadCounts.set(hit.threadId, count + 1);
			return true;
		})
		.map((hit) => {
			const content = toSearchExcerpt(
				hit.content,
				hit._matchesPosition?.content,
			);
			return {
				id: hit.id,
				threadId: hit.threadId,
				title: hit.title,
				channelName: hit.channelName,
				content: content.value,
				isThreadStarter: hit.isThreadStarter,
				timestamp: hit.timestamp,
				threadUrl:
					slugifyThreadUrl({ id: hit.threadId, name: hit.title }) +
					(hit.isThreadStarter ? "" : `#${hit.id}`),
				highlights: {
					title: toHighlightSegments(hit.title, hit._matchesPosition?.title),
					content: toHighlightSegments(content.value, content.positions),
				},
			};
		});
	return {
		hits,
		estimatedTotalHits: results.estimatedTotalHits ?? results.hits.length,
		processingTimeMs: results.processingTimeMs,
		query: results.query,
	};
};

const formatSearchResults = (results: SearchResult) => {
	const threadCounts = new Map<string, number>();
	return {
		...results,
		hits: results.hits
			.filter((hit) => {
				const count = threadCounts.get(hit.threadId) ?? 0;
				if (count >= maxResultsPerThread) return false;
				threadCounts.set(hit.threadId, count + 1);
				return true;
			})
			.map((hit) => ({
				...hit._formatted,
				threadUrl:
					slugifyThreadUrl({ id: hit.threadId, name: hit.title }) +
					(hit.isThreadStarter ? "" : `#${hit.id}`),
				sanitizedName: DOMPurify.sanitize(hit._formatted?.title ?? "", {
					ALLOWED_TAGS: ["mark"],
					ALLOWED_ATTR: [],
				}),
				sanitizedContent: DOMPurify.sanitize(hit._formatted?.content ?? "", {
					ALLOWED_TAGS: ["mark"],
					ALLOWED_ATTR: [],
				}),
			})),
	};
};

export type BotRouter = ReturnType<typeof createBotRouter>;
