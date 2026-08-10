import {
	apiFailure,
	apiSuccess,
	type ApiResult,
	type AcceptedReconciliationJob,
	type BotApiOperations,
	type IndexingFailure,
	type SearchFailure,
} from "@repo/api/contracts";
import type { DBIndexingJob } from "@repo/db/schema/index";
import { apiLogger } from "@repo/logger";
import { ChannelType } from "discord.js";
import { RESTJSONErrorCodes } from "discord-api-types/v10";
import { Effect, FiberSet, Schema, type Scope } from "effect";
import { IndexingRepositoryError } from "../adapters/indexing-repository";
import {
	SearchIndex,
	SearchIndexError,
	SearchNotConfiguredError,
} from "../adapters/search";
import { DiscordClient } from "../discord/client";
import { ReconciliationJobs } from "../indexing/jobs";
import { Readiness } from "../runtime/readiness";

export class ReconciliationJobNotFoundError extends Schema.TaggedError<ReconciliationJobNotFoundError>()(
	"ReconciliationJobNotFoundError",
	{ resource: Schema.Literals(["guild", "thread", "job"]) },
) {}

export class ReconciliationJobConflictError extends Schema.TaggedError<ReconciliationJobConflictError>()(
	"ReconciliationJobConflictError",
	{ reason: Schema.Literals(["unsupported-thread", "job-finished"]) },
) {}

export class DiscordChannelFetchError extends Schema.TaggedError<DiscordChannelFetchError>()(
	"DiscordChannelFetchError",
	{ cause: Schema.Defect() },
) {}

const isUnknownDiscordChannel = (cause: unknown) =>
	typeof cause === "object" &&
	cause !== null &&
	("code" in cause || "status" in cause) &&
	(("code" in cause && cause.code === RESTJSONErrorCodes.UnknownChannel) ||
		("status" in cause && cause.status === 404));

const toIndexingFailure = (error: unknown): IndexingFailure | undefined => {
	if (error instanceof ReconciliationJobNotFoundError) {
		return {
			code:
				error.resource === "guild"
					? "guild_not_found"
					: error.resource === "thread"
						? "thread_not_found"
						: "job_not_found",
		};
	}
	if (error instanceof ReconciliationJobConflictError) {
		return {
			code:
				error.reason === "unsupported-thread"
					? "unsupported_thread"
					: "job_finished",
		};
	}
	if (error instanceof DiscordChannelFetchError) {
		apiLogger.error("discord_channel_fetch_failed", { error: error.cause });
		return { code: "discord_unavailable" };
	}
	if (error instanceof IndexingRepositoryError) {
		apiLogger.error("indexing_repository_failed", {
			operation: error.operation,
		});
		return { code: "repository_unavailable" };
	}
};

const toSearchFailure = (error: unknown): SearchFailure | undefined => {
	if (error instanceof SearchNotConfiguredError) {
		return { code: "search_not_configured" };
	}
	if (error instanceof SearchIndexError) {
		apiLogger.error("search_operation_failed", {
			operation: error.operation,
			error: error.cause,
		});
		return { code: "search_unavailable" };
	}
};

const toApiResult = async <Value, Failure>(
	promise: Promise<Value>,
	mapFailure: (error: unknown) => Failure | undefined,
): Promise<ApiResult<Value, Failure>> => {
	try {
		return apiSuccess(await promise);
	} catch (error) {
		const failure = mapFailure(error);
		if (failure) return apiFailure(failure);
		throw error;
	}
};

export const makeBotApiOperations = (): Effect.Effect<
	BotApiOperations,
	never,
	Scope.Scope | DiscordClient | Readiness | ReconciliationJobs | SearchIndex
> =>
	Effect.gen(function* () {
		const discord = yield* DiscordClient;
		const readiness = yield* Readiness;
		const reconciliationJobs = yield* ReconciliationJobs;
		const searchIndex = yield* SearchIndex;
		const runPromise = yield* FiberSet.makeRuntimePromise();
		const run = <A, E>(
			name: string,
			effect: Effect.Effect<A, E>,
			signal?: AbortSignal,
		) =>
			runPromise(effect.pipe(Effect.withSpan(name, { root: true })), {
				signal,
			});

		const toDto = (job: DBIndexingJob): AcceptedReconciliationJob => ({
			id: job.id,
			status: job.status,
		});
		const runAccepted = <E>(
			name: string,
			effect: Effect.Effect<DBIndexingJob, E>,
			signal?: AbortSignal,
		) => {
			// Starting a durable job is not request-owned work. Honor cancellation only
			// before submission, then always report the persisted acceptance result.
			signal?.throwIfAborted();
			return toApiResult(
				runPromise(
					effect.pipe(Effect.map(toDto), Effect.withSpan(name, { root: true })),
				),
				toIndexingFailure,
			);
		};

		const requireJob = (jobId: string) =>
			reconciliationJobs
				.get(jobId)
				.pipe(
					Effect.flatMap((job) =>
						job
							? Effect.succeed(job)
							: Effect.fail(
									new ReconciliationJobNotFoundError({ resource: "job" }),
								),
					),
				);

		return {
			getReadiness: (signal) => run("bot.api.readiness", readiness.get, signal),
			isBotInServer: (serverId) =>
				run(
					"bot.api.is_bot_in_server",
					Effect.promise(async () =>
						Boolean(
							await discord.client.guilds.fetch(serverId).catch(() => null),
						),
					),
				),
			updateVote: (threadId, type) =>
				run(
					"bot.api.update_vote",
					Effect.promise(async () => {
						try {
							const { updateVote } = await import("@repo/db/helpers/channels");
							return ((await updateVote(threadId, type)).rowCount ?? 0) > 0
								? apiSuccess(undefined)
								: apiFailure({ code: "thread_not_found" as const });
						} catch (error) {
							apiLogger.error("vote_repository_failed", { error, threadId });
							return apiFailure({ code: "repository_unavailable" as const });
						}
					}),
				),
			search: (input, signal) =>
				toApiResult(
					run(
						"bot.api.search",
						searchIndex
							.search(input)
							.pipe(
								Effect.annotateSpans({ "discord.server_id": input.serverId }),
							),
						signal,
					),
					toSearchFailure,
				),
			getSearchHealth: (signal) =>
				toApiResult(
					run("bot.api.search_health", searchIndex.health, signal),
					toSearchFailure,
				),
			startGuildReconciliation: (guildId, request, signal) =>
				runAccepted(
					"bot.api.indexing.start_guild",
					reconciliationJobs
						.startGuild(guildId, request)
						.pipe(Effect.annotateSpans({ "discord.server_id": guildId })),
					signal,
				),
			startThreadReconciliation: (guildId, threadId, signal) =>
				runAccepted(
					"bot.api.indexing.start_thread",
					Effect.gen(function* () {
						const guild = discord.client.guilds.cache.get(guildId);
						if (!guild) {
							return yield* new ReconciliationJobNotFoundError({
								resource: "guild",
							});
						}
						const channel = yield* Effect.tryPromise({
							try: () => guild.channels.fetch(threadId),
							catch: (cause) =>
								isUnknownDiscordChannel(cause)
									? new ReconciliationJobNotFoundError({ resource: "thread" })
									: new DiscordChannelFetchError({ cause }),
						});
						if (!channel) {
							return yield* new ReconciliationJobNotFoundError({
								resource: "thread",
							});
						}
						if (
							(channel.type !== ChannelType.PublicThread &&
								channel.type !== ChannelType.AnnouncementThread) ||
							!channel.parentId
						) {
							return yield* new ReconciliationJobConflictError({
								reason: "unsupported-thread",
							});
						}
						return yield* reconciliationJobs.startThread(
							guildId,
							channel.parentId,
							threadId,
							{ trigger: "reindex-thread" },
						);
					}).pipe(
						Effect.annotateSpans({
							"discord.server_id": guildId,
							"discord.thread_id": threadId,
						}),
					),
					signal,
				),
			getReconciliationJob: (jobId, signal) =>
				toApiResult(
					run(
						"bot.api.indexing.get_job",
						requireJob(jobId).pipe(Effect.map(toDto)),
						signal,
					),
					toIndexingFailure,
				),
			cancelReconciliationJob: (jobId, signal) =>
				runAccepted(
					"bot.api.indexing.cancel_job",
					Effect.gen(function* () {
						const current = yield* requireJob(jobId);
						if (current.status !== "queued" && current.status !== "running") {
							return yield* new ReconciliationJobConflictError({
								reason: "job-finished",
							});
						}
						const cancelled = yield* reconciliationJobs.cancel(jobId);
						if (!cancelled) {
							return yield* new ReconciliationJobNotFoundError({
								resource: "job",
							});
						}
						return cancelled;
					}),
					signal,
				),
		};
	});
