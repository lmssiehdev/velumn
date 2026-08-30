import {
	apiFailure,
	apiSuccess,
	type AcceptedReconciliationJob,
	type ApiResult,
	type BotApiOperations,
	type IndexingFailure,
	type SearchFailure,
} from "@repo/api/contracts";
import type { DBIndexingJob } from "@repo/db/schema/index";
import { apiLogger } from "@repo/logger";
import { Effect, FiberSet, type Scope } from "effect";
import { IndexingRepositoryError } from "../adapters/indexing-repository";
import {
	SearchIndex,
	SearchIndexError,
	SearchNotConfiguredError,
} from "../adapters/search";
import { ReconciliationJobs } from "../indexing/jobs";
import { Readiness } from "../runtime/readiness";

const toIndexingFailure = (cause: unknown): IndexingFailure | undefined => {
	if (cause instanceof IndexingRepositoryError) {
		apiLogger.error("indexing_repository_failed", {
			operation: cause.operation,
		});
		return { code: "repository_unavailable" };
	}
};

const toSearchFailure = (cause: unknown): SearchFailure | undefined => {
	if (cause instanceof SearchNotConfiguredError) {
		return { code: "search_not_configured" };
	}
	if (cause instanceof SearchIndexError) {
		apiLogger.error("search_operation_failed", {
			operation: cause.operation,
			error: cause.cause,
		});
		return { code: "search_unavailable" };
	}
};

const toApiResult = async <Value, Failure>(
	promise: Promise<Value>,
	mapFailure: (cause: unknown) => Failure | undefined,
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
	Scope.Scope | Readiness | ReconciliationJobs | SearchIndex
> =>
	Effect.gen(function* () {
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

		return {
			getReadiness: (signal) => run("bot.api.readiness", readiness.get, signal),
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
			startGuildReconciliation: (guildId, request, signal) => {
				// Durable acceptance is not request-owned after submission starts.
				signal?.throwIfAborted();
				return toApiResult(
					runPromise(
						reconciliationJobs
							.startGuild(guildId, request)
							.pipe(
								Effect.map(toDto),
								Effect.annotateSpans({ "discord.server_id": guildId }),
								Effect.withSpan("bot.api.indexing.start_guild", { root: true }),
							),
					),
					toIndexingFailure,
				);
			},
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
		};
	});
