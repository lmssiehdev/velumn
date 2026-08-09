import type { DBIndexingJob } from "@repo/db/schema/index";
import { ChannelType, type Snowflake } from "discord.js";
import { Effect, FiberSet, Schema, type Scope } from "effect";
import { SearchIndex, type SearchQuery } from "../adapters/search";
import { DiscordClient } from "../discord/client";
import { ReconciliationJobs } from "../indexing/jobs";
import { Readiness, type ReadinessState } from "../runtime/readiness";

export type AcceptedReconciliationJob = Pick<DBIndexingJob, "id" | "status">;

export class ReconciliationJobNotFoundError extends Schema.TaggedError<ReconciliationJobNotFoundError>()(
	"ReconciliationJobNotFoundError",
	{ resource: Schema.Literals(["guild", "thread", "job"]) },
) {}

export class ReconciliationJobConflictError extends Schema.TaggedError<ReconciliationJobConflictError>()(
	"ReconciliationJobConflictError",
	{ reason: Schema.Literals(["unsupported-thread", "job-finished"]) },
) {}

export interface BotApiOperations {
	readonly getReadiness: (signal?: AbortSignal) => Promise<ReadinessState>;
	readonly search: (
		input: SearchQuery,
		signal?: AbortSignal,
	) => Promise<Effect.Success<ReturnType<SearchIndex["Service"]["search"]>>>;
	readonly getSearchHealth: (
		signal?: AbortSignal,
	) => Promise<Effect.Success<SearchIndex["Service"]["health"]>>;
	readonly startGuildReconciliation: (
		guildId: Snowflake,
		request: {
			readonly trigger: "index-server" | "reindex-server";
			readonly maxThreads?: number;
		},
		signal?: AbortSignal,
	) => Promise<AcceptedReconciliationJob>;
	readonly startThreadReconciliation: (
		guildId: Snowflake,
		threadId: Snowflake,
		signal?: AbortSignal,
	) => Promise<AcceptedReconciliationJob>;
	readonly getReconciliationJob: (
		jobId: string,
		signal?: AbortSignal,
	) => Promise<AcceptedReconciliationJob>;
	readonly cancelReconciliationJob: (
		jobId: string,
		signal?: AbortSignal,
	) => Promise<AcceptedReconciliationJob>;
}

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
		) => runPromise(effect.pipe(Effect.withSpan(name)), { signal });

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
			return runPromise(effect.pipe(Effect.map(toDto), Effect.withSpan(name)));
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
			search: (input, signal) =>
				run(
					"bot.api.search",
					searchIndex
						.search(input)
						.pipe(
							Effect.annotateSpans({ "discord.server_id": input.serverId }),
						),
					signal,
				),
			getSearchHealth: (signal) =>
				run("bot.api.search_health", searchIndex.health, signal),
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
						const channel = yield* Effect.promise(() =>
							guild.channels.fetch(threadId),
						);
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
				run(
					"bot.api.indexing.get_job",
					requireJob(jobId).pipe(Effect.map(toDto)),
					signal,
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
