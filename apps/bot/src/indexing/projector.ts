import { randomUUID } from "node:crypto";
import { Cause, Clock, Context, Effect, Exit, Layer, Option } from "effect";
import {
	IndexingRepository,
	type IndexingRepositoryFailure,
	type MeiliProjection,
} from "../adapters/indexing-repository";
import {
	isSearchNotFoundError,
	type SearchError,
	SearchIndex,
} from "../adapters/search";
import { BotConfig } from "../config/bot-config";
import { ErrorCapture } from "../observability/error-capture";
import {
	BotMetrics,
	type MetricOutcome,
	type ProjectorOperation,
} from "../observability/metrics";
import { normalizeError, safeBoundaryMetadata } from "../observability/policy";
import { Readiness } from "../runtime/readiness";
import { boundedExponentialDelayMs } from "./backoff";

export interface MeiliProjectorOptions {
	readonly leaseOwner: string;
	readonly batchSize: number;
	readonly partitionConcurrency: number;
	readonly leaseDurationMs: number;
	readonly initialRetryDelayMs: number;
	readonly maximumRetryDelayMs: number;
	readonly maximumAttemptCount: number;
}

export type MeiliProjectorError = IndexingRepositoryFailure;

export interface MeiliProjectorPollingOptions extends MeiliProjectorOptions {
	readonly pollingIntervalMs: number;
}

export const defaultMeiliProjectorPollingOptions = (
	leaseOwner = `bot-${randomUUID()}`,
): MeiliProjectorPollingOptions => ({
	leaseOwner,
	batchSize: 100,
	partitionConcurrency: 8,
	leaseDurationMs: 60_000,
	initialRetryDelayMs: 1_000,
	maximumRetryDelayMs: 60_000,
	maximumAttemptCount: 10,
	pollingIntervalMs: 1_000,
});

export interface MeiliProjectorBatchResult {
	readonly claimedCount: number;
	readonly failedCount: number;
}

export class MeiliProjector extends Context.Service<MeiliProjector, true>()(
	"velumn/bot/indexing/MeiliProjector",
) {}

const recordProjectorOperation = <A, E, R>(
	operation: ProjectorOperation,
	effect: Effect.Effect<A, E, R>,
	onSuccess: (value: A) => MetricOutcome,
) =>
	Effect.gen(function* () {
		const startedAt = yield* Clock.currentTimeMillis;
		return yield* effect.pipe(
			Effect.onExit((exit) =>
				Effect.gen(function* () {
					const completedAt = yield* Clock.currentTimeMillis;
					yield* BotMetrics.recordProjectorOperation({
						operation,
						outcome: Exit.isSuccess(exit)
							? onSuccess(exit.value)
							: Cause.hasInterruptsOnly(exit.cause)
								? "cancelled"
								: "failed",
						durationMs: completedAt - startedAt,
					});
				}),
			),
		);
	});

const validateOptions = (options: MeiliProjectorOptions) => {
	for (const [name, value] of Object.entries(options)) {
		if (name === "leaseOwner") continue;
		if (!Number.isInteger(value) || (value as number) <= 0) {
			throw new RangeError(`${name} must be a positive integer`);
		}
	}
	if (!options.leaseOwner) throw new Error("leaseOwner is required");
	if (options.initialRetryDelayMs > options.maximumRetryDelayMs) {
		throw new RangeError(
			"initialRetryDelayMs must not exceed maximumRetryDelayMs",
		);
	}
};

export const projectMeiliBatch = (
	options: MeiliProjectorOptions,
): Effect.Effect<
	MeiliProjectorBatchResult,
	MeiliProjectorError,
	IndexingRepository | SearchIndex
> => {
	const poll = Effect.gen(function* () {
		yield* Effect.sync(() => validateOptions(options));
		const repository = yield* IndexingRepository;
		const search = yield* SearchIndex;
		const errorCapture = yield* ErrorCapture;
		const now = yield* Clock.currentTimeMillis;
		const rows = yield* repository
			.claim({
				leaseOwner: options.leaseOwner,
				leaseExpiresAt: new Date(now + options.leaseDurationMs),
				limit: options.batchSize,
				now: new Date(now),
			})
			.pipe(
				Effect.catch((error) => {
					const normalized = normalizeError(error);
					return Effect.fail(error).pipe(
						Effect.tapCause((cause) =>
							errorCapture.captureCause(cause, {
								boundary: "projector_poll_attempt",
								operation: "projector.poll",
							}),
						),
						Effect.withSpan("projector.poll", {
							root: true,
							attributes: {
								"operation.name": "projector.poll",
								"operation.outcome": "failed",
								"error.type": normalized.type,
								"error.classification": normalized.typedOperation,
							},
						}),
					);
				}),
			);
		if (rows.length === 0) return { claimedCount: 0, failedCount: 0 };

		return yield* Effect.gen(function* () {
			const partitions = new Map<string, MeiliProjection[]>();
			for (const row of rows) {
				const partition = partitions.get(row.partitionKey);
				if (partition) partition.push(row);
				else partitions.set(row.partitionKey, [row]);
			}
			const partitionFailedCounts = yield* Effect.forEach(
				partitions.values(),
				(rows) =>
					Effect.reduce(
						[...rows].sort((left, right) => left.id - right.id),
						() => ({ continuePartition: true, failedCount: 0 }),
						(state, row) =>
							state.continuePartition
								? recordProjectorOperation(
										"project",
										processProjection(options, repository, search, row).pipe(
											Effect.tap((disposition) =>
												disposition === "deferred"
													? BotMetrics.recordRetry("projector", "retryable")
													: disposition === "failed"
														? BotMetrics.recordRetry("projector", "terminal")
														: Effect.void,
											),
											Effect.onExit((exit) =>
												Effect.annotateCurrentSpan({
													"operation.outcome": Exit.isSuccess(exit)
														? exit.value
														: Cause.hasInterruptsOnly(exit.cause)
															? "cancelled"
															: "failed",
												}),
											),
										),
										(disposition) =>
											disposition === "completed" ? "succeeded" : disposition,
									).pipe(
										Effect.withSpan("projector.projection", {
											attributes: {
												"operation.name": "projector.projection",
												"projection.operation": row.operation,
												"retry.attempt": row.attemptCount,
											},
										}),
										Effect.map((disposition) => ({
											continuePartition: disposition !== "deferred",
											failedCount:
												state.failedCount + (disposition === "failed" ? 1 : 0),
										})),
									)
								: Effect.succeed(state),
					),
				{
					concurrency: options.partitionConcurrency,
				},
			);
			const result = {
				claimedCount: rows.length,
				failedCount: partitionFailedCounts.reduce(
					(total, partition) => total + partition.failedCount,
					0,
				),
			};
			yield* Effect.annotateCurrentSpan({
				"batch.claimed_count": result.claimedCount,
				"batch.failed_count": result.failedCount,
				"operation.outcome": result.failedCount > 0 ? "failed" : "completed",
			});
			return result;
		}).pipe(
			Effect.tapCause((cause) =>
				errorCapture.captureCause(cause, {
					boundary: "projector_poll_attempt",
					operation: "projector.poll",
				}),
			),
			Effect.withSpan("projector.poll", {
				root: true,
				attributes: {
					"operation.name": "projector.poll",
					"batch.claimed_count": rows.length,
				},
			}),
		);
	}).pipe(
		Effect.onExit((sourceExit) =>
			Effect.gen(function* () {
				const repository = yield* IndexingRepository;
				const errorCapture = yield* ErrorCapture;
				const releaseExit = yield* repository.release(options.leaseOwner).pipe(
					Effect.tapCause((cause) =>
						errorCapture.captureCause(cause, {
							boundary: "projector_poll_attempt",
							operation: "projector.release",
						}),
					),
					Effect.exit,
				);
				if (Exit.isSuccess(sourceExit) && Exit.isFailure(releaseExit)) {
					return yield* Effect.failCause(releaseExit.cause);
				}
			}),
		),
	);
	return recordProjectorOperation("poll", poll, (result) =>
		result.claimedCount === 0
			? "skipped"
			: result.failedCount > 0
				? "failed"
				: "succeeded",
	);
};

const processProjection = (
	options: MeiliProjectorOptions,
	repository: IndexingRepository["Service"],
	search: SearchIndex["Service"],
	projection: MeiliProjection,
) =>
	mutationFor(repository, search, projection).pipe(
		Effect.matchEffect({
			onFailure: (error) =>
				failureDisposition(options, repository, projection, false, error),
			onSuccess: ({ mutation, deletion }) =>
				(mutation ?? Effect.void).pipe(
					Effect.matchEffect({
						onSuccess: () =>
							repository
								.complete(projection.id, options.leaseOwner)
								.pipe(Effect.as("completed" as const)),
						onFailure: (error) =>
							failureDisposition(
								options,
								repository,
								projection,
								deletion,
								error,
							),
					}),
				),
		}),
	);

const failureDisposition = (
	options: MeiliProjectorOptions,
	repository: IndexingRepository["Service"],
	projection: MeiliProjection,
	deletion: boolean,
	error: SearchError | IndexingRepositoryFailure,
) => {
	const code = errorCode(error);
	const annotate = (outcome: "completed" | "failed" | "deferred") =>
		Effect.annotateCurrentSpan({
			"operation.outcome": outcome,
			"error.type": error._tag,
			"error.classification": code,
			"retry.classification": outcome,
			"retry.attempt": projection.attemptCount,
		});
	if (deletion && isSearchNotFoundError(error)) {
		return repository
			.complete(projection.id, options.leaseOwner)
			.pipe(
				Effect.andThen(annotate("completed")),
				Effect.as("completed" as const),
			);
	}
	if (
		!deletion &&
		(error._tag === "SearchNotConfiguredError" ||
			projection.attemptCount >= options.maximumAttemptCount)
	) {
		return repository
			.fail(projection.id, options.leaseOwner, code)
			.pipe(Effect.andThen(annotate("failed")), Effect.as("failed" as const));
	}
	return Clock.currentTimeMillis.pipe(
		Effect.flatMap((now) =>
			repository.defer(
				projection.id,
				options.leaseOwner,
				code,
				new Date(now + retryDelay(options, projection.attemptCount)),
			),
		),
		Effect.andThen(annotate("deferred")),
		Effect.as("deferred" as const),
	);
};

const mutationFor = (
	repository: IndexingRepository["Service"],
	search: SearchIndex["Service"],
	projection: MeiliProjection,
): Effect.Effect<
	{
		readonly mutation: Effect.Effect<void, SearchError> | undefined;
		readonly deletion: boolean;
	},
	IndexingRepositoryFailure
> => {
	switch (projection.operation) {
		case "message_upsert":
			return repository.source(projection).pipe(
				Effect.map((documents) => ({
					mutation:
						documents.length > 0
							? search.addDocuments(documents)
							: search.deleteMessages([projection.entityId]),
					deletion: documents.length === 0,
				})),
			);
		case "container_refresh":
			return repository.source(projection).pipe(
				Effect.map((documents) => ({
					mutation:
						documents.length > 0
							? search.updateDocuments(documents)
							: search.deleteThread(projection.entityId),
					deletion: documents.length === 0,
				})),
			);
		case "rebuild":
			return repository.source(projection).pipe(
				Effect.map((documents) => ({
					mutation:
						documents.length > 0 ? search.addDocuments(documents) : undefined,
					deletion: false,
				})),
			);
		case "message_delete":
			return Effect.succeed({
				mutation: search.deleteMessages([projection.entityId]),
				deletion: true,
			});
		case "container_delete":
			return Effect.succeed({
				mutation: search.deleteThread(projection.entityId),
				deletion: true,
			});
		case "server_delete":
			return Effect.succeed({ mutation: undefined, deletion: true });
	}
};

const retryDelay = (options: MeiliProjectorOptions, attemptCount: number) =>
	boundedExponentialDelayMs({
		initialDelayMs: options.initialRetryDelayMs,
		maximumDelayMs: options.maximumRetryDelayMs,
		attemptCount,
	});

const errorCode = (error: SearchError | IndexingRepositoryFailure) =>
	error._tag === "SearchNotConfiguredError"
		? error._tag
		: `${error._tag}:${error.operation}`;

export const layerMeiliProjector = (
	options: MeiliProjectorPollingOptions = defaultMeiliProjectorPollingOptions(),
) =>
	Layer.effect(
		MeiliProjector,
		Effect.gen(function* () {
			yield* Effect.sync(() => validateOptions(options));
			if (
				!Number.isInteger(options.pollingIntervalMs) ||
				options.pollingIntervalMs <= 0
			) {
				return yield* Effect.die(
					new RangeError("pollingIntervalMs must be a positive integer"),
				);
			}
			const config = yield* BotConfig;
			const readiness = yield* Readiness;
			const errorCapture = yield* ErrorCapture;
			yield* readiness.setProjectorReady(true);
			yield* Effect.addFinalizer(() => readiness.setProjectorReady(false));

			if (Option.isSome(config.meilisearch)) {
				const poll: Effect.Effect<
					void,
					never,
					IndexingRepository | SearchIndex
				> = Effect.suspend(() =>
					projectMeiliBatch(options).pipe(
						Effect.tapError((error) =>
							Effect.logError(
								"Meili projector poll failed",
								safeBoundaryMetadata(Cause.fail(error), {
									boundary: "projector_poll_attempt",
								}),
							),
						),
						Effect.catch(() =>
							Effect.succeed({ claimedCount: 0, failedCount: 0 }),
						),
						Effect.tap(({ failedCount }) =>
							failedCount > 0
								? Effect.logError(
										"Meili projector batch marked projections failed",
										{
											failedCount,
										},
									)
								: Effect.void,
						),
						Effect.flatMap(({ claimedCount }) =>
							claimedCount < options.batchSize
								? Effect.sleep(options.pollingIntervalMs)
								: Effect.yieldNow,
						),
						Effect.andThen(poll),
					),
				);
				yield* Effect.forkScoped(
					poll.pipe(
						Effect.onExit((exit) =>
							readiness.setProjectorReady(false).pipe(
								Effect.andThen(
									exit._tag === "Success" ||
										!Cause.hasInterruptsOnly(exit.cause)
										? errorCapture
												.captureCause(
													exit._tag === "Failure"
														? exit.cause
														: Cause.die(new Error("Projector poll completed")),
													{
														boundary: "projector_poll_fiber",
														operation: "projector.poll",
													},
												)
												.pipe(Effect.asVoid)
										: Effect.void,
								),
							),
						),
					),
					{ startImmediately: true },
				);
			} else {
				yield* Effect.logInfo(
					"Meili projector disabled because Meilisearch is not configured",
				);
			}

			return true as const;
		}),
	);
