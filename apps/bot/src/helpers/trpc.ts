import { updateVote } from "@repo/db/helpers/channels";
import type { DBMessageWithRelations } from "@repo/db/schema/discord";
import { apiLogger } from "@repo/logger";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { initTRPC, TRPCError } from "@trpc/server";
import { type Client, RESTJSONErrorCodes } from "discord.js";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import { IndexingRepositoryError } from "../adapters/indexing-repository";
import type { SearchDocument } from "../adapters/search";
import { SearchNotConfiguredError } from "../adapters/search";
import type { BotApiOperations } from "../http/operations";
import {
	ReconciliationJobConflictError,
	ReconciliationJobNotFoundError,
} from "../http/operations";
import {
	consumePublicSearchQuota,
	isRateLimited,
	isSearchRateLimited,
	trackSearch,
	trackVote,
} from "./rate-limit";

interface Context {
	secret?: string;
	ip?: string;
	trustedClientIp?: string;
	operations: BotApiOperations;
}

const t = initTRPC.context<Context>().create();

const indexingUnavailable = <A>(): A => {
	throw new TRPCError({
		code: "SERVICE_UNAVAILABLE",
		message:
			"Indexing is unavailable while the bot indexing pipeline is rebuilt",
	});
};

export interface BotRouterDependencies {
	readonly apiSecret: string;
	readonly discordClient: Client<true>;
}

export const createBotRouter = ({
	apiSecret,
	discordClient,
}: BotRouterDependencies) => {
	const isAuthenticated = t.middleware(({ ctx, next }) => {
		if (ctx.secret !== apiSecret) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Forbidden",
			});
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
	const runIndexingOperation = async <A>(operation: () => Promise<A>) => {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof ReconciliationJobNotFoundError) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						error.resource === "guild"
							? "Guild not found"
							: error.resource === "thread"
								? "Thread not found"
								: "Indexing job not found",
				});
			}
			if (error instanceof ReconciliationJobConflictError) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						error.reason === "unsupported-thread"
							? "Channel is not a supported Discord thread"
							: "Indexing job has already finished",
				});
			}
			if (error instanceof IndexingRepositoryError) {
				apiLogger.error("indexing_repository_failed", {
					operation: error.operation,
				});
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Indexing job storage is unavailable",
				});
			}
			throw error;
		}
	};

	return t.router({
		health: protectedProcedure.query(() => {
			return "OK";
		}),
		reindexServer: protectedProcedure
			.input(
				z.object({
					serverId: snowflake,
				}),
			)
			.mutation(({ input, ctx, signal }) =>
				runIndexingOperation(() =>
					ctx.operations.startGuildReconciliation(
						input.serverId,
						{ trigger: "reindex-server" },
						signal,
					),
				),
			),
		reindexThread: protectedProcedure
			.input(
				z.object({
					serverId: snowflake,
					channelId: snowflake,
				}),
			)
			.mutation(({ input, ctx, signal }) =>
				runIndexingOperation(() =>
					ctx.operations.startThreadReconciliation(
						input.serverId,
						input.channelId,
						signal,
					),
				),
			),
		getIndexingJob: protectedProcedure
			.input(z.object({ jobId }))
			.query(({ input, ctx, signal }) =>
				runIndexingOperation(() =>
					ctx.operations.getReconciliationJob(input.jobId, signal),
				),
			),
		cancelIndexingJob: protectedProcedure
			.input(z.object({ jobId }))
			.mutation(({ input, ctx, signal }) =>
				runIndexingOperation(() =>
					ctx.operations.cancelReconciliationJob(input.jobId, signal),
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
			.mutation(() => indexingUnavailable<DBMessageWithRelations>()),
		isBotInServer: protectedProcedure
			.input(
				z.object({
					serverId: z.string(),
				}),
			)
			.query(async ({ input }) => {
				try {
					const guild = await discordClient.guilds
						.fetch(input.serverId)
						.catch(() => null);

					return !!guild;
				} catch (error: unknown) {
					apiLogger.error("isBotInServer_failed", { error });
					if (
						(error as { code: RESTJSONErrorCodes })?.code ===
						RESTJSONErrorCodes.UnknownGuild
					) {
						return false;
					}
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to check if bot is in server",
						cause: error,
					});
				}
			}),
		meiliHealth: protectedProcedure.query(async ({ ctx, signal }) => {
			try {
				const health = await ctx.operations.getSearchHealth(signal);
				return {
					health: health.status,
					version: health.version,
					numberOfDocuments: health.numberOfDocuments,
					isIndexing: health.isIndexing,
					ip: ctx.ip,
				};
			} catch (error) {
				if (error instanceof SearchNotConfiguredError) {
					throw new TRPCError({
						code: "SERVICE_UNAVAILABLE",
						message: "MeiliSearch is not configured",
					});
				}
				apiLogger.error("meiliHealth_failed", { error });
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to check MeiliSearch health",
					cause: error,
				});
			}
		}),
		search: publicProcedure
			.input(
				z.object({
					serverId: z.string(),
					query: z.string().trim().min(1).max(120),
				}),
			)
			.query(async ({ input, ctx, signal }) => {
				try {
					if (await isSearchRateLimited(ctx.ip)) {
						throw new TRPCError({
							code: "TOO_MANY_REQUESTS",
							message: "You're searching too quickly. Please slow down.",
						});
					}

					await trackSearch(ctx.ip);
					const results = await ctx.operations.search(input, signal);
					return formatSearchResults(results);
				} catch (error) {
					if (error instanceof TRPCError) {
						throw error;
					}
					if (error instanceof SearchNotConfiguredError) {
						throw new TRPCError({
							code: "SERVICE_UNAVAILABLE",
							message: "Search is not configured",
						});
					}

					apiLogger.error("search_messages_failed", {
						error,
						ip: ctx.ip,
						serverId: input.serverId,
						query: input.query,
					});

					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to search messages",
						cause: error,
					});
				}
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

				try {
					const quota = await consumePublicSearchQuota(ctx.trustedClientIp);
					if (!quota.allowed) {
						throw new TRPCError({
							code: "TOO_MANY_REQUESTS",
							message: `Search quota exceeded. Try again in ${quota.retryAfterSeconds} seconds.`,
						});
					}

					const results = await ctx.operations.search(input, signal);
					return formatPublicSearchResults(results);
				} catch (error) {
					if (error instanceof TRPCError) {
						throw error;
					}
					if (error instanceof SearchNotConfiguredError) {
						throw new TRPCError({
							code: "SERVICE_UNAVAILABLE",
							message: "Search is not configured",
						});
					}

					apiLogger.error("public_search_messages_failed", {
						error,
						ip: ctx.trustedClientIp,
						serverId: input.serverId,
						query: input.query,
					});
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to search messages",
					});
				}
			}),
		indexServer: protectedProcedure
			.input(
				z.object({
					serverId: snowflake,
					maxThreads: z.number().int().min(0).max(30).default(15),
				}),
			)
			.mutation(({ input, ctx, signal }) =>
				runIndexingOperation(() =>
					ctx.operations.startGuildReconciliation(
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
				const { threadId } = input;
				const ip = ctx.ip;

				if (await isRateLimited(threadId, ip)) {
					apiLogger.info("rate_limited_ip", { threadId, ip: ip });
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message: "You're voting too quickly. Please slow down.",
					});
				}
				try {
					const result = await updateVote(threadId, input.type);
					if (result.rowCount === 0) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Thread not found",
						});
					}

					await trackVote(threadId, ip);
					return { success: true };
				} catch (error) {
					apiLogger.error("vote_on_thread_failed", {
						error,
						ip,
						...input,
					});
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to vote on thread",
					});
				}
			}),
	});
};

const maxResultsPerThread = 2;

interface MatchPosition {
	readonly start: number;
	readonly length: number;
}

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
			(position) =>
				Number.isInteger(position.start) &&
				Number.isInteger(position.length) &&
				position.start >= 0 &&
				position.length > 0 &&
				position.start < value.length,
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
	if (value.length <= maxSearchExcerptLength) {
		return { value, positions };
	}

	const firstMatch = positions?.find(
		(position) => position.start >= 0 && position.start < value.length,
	);
	let start = Math.max(0, (firstMatch?.start ?? 0) - searchExcerptContext);
	let end = Math.min(value.length, start + maxSearchExcerptLength);
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

type PublicSearchSource = {
	readonly hits: ReadonlyArray<
		SearchDocument & {
			readonly _matchesPosition?: Partial<
				Record<"title" | "content", readonly MatchPosition[]>
			>;
		}
	>;
	readonly estimatedTotalHits?: number;
	readonly processingTimeMs: number;
	readonly query: string;
};

export const formatPublicSearchResults = (results: PublicSearchSource) => {
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

const formatSearchResults = <
	Result extends {
		readonly hits: ReadonlyArray<
			SearchDocument & { readonly _formatted?: Partial<SearchDocument> }
		>;
	},
>(
	results: Result,
) => {
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

export const createContext = ({
	req,
	operations,
}: {
	req: Request;
	operations: BotApiOperations;
}): Context => {
	return {
		secret: req.headers.get("x-velumn-secret") || undefined,
		operations,
	};
};
