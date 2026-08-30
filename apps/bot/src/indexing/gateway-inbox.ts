import { randomUUID } from "node:crypto";
import type { DBIndexingGatewayMutation } from "@repo/db/schema/index";
import { Cause, Clock, Context, Effect, Layer, Option, Ref } from "effect";
import {
	GatewayMutationLeaseLostError,
	GatewayMutationRepository,
} from "../adapters/gateway-mutation-repository";
import {
	ErrorCapture,
	type ErrorCaptureService,
} from "../observability/error-capture";
import {
	BotMetrics,
	type GatewayMutationOutcome,
	type IndexMutationKind,
} from "../observability/metrics";
import { normalizeError, safeBoundaryMetadata } from "../observability/policy";
import { Readiness } from "../runtime/readiness";
import { boundedExponentialDelayMs } from "./backoff";
import {
	decodeIndexMutation,
	type IndexingOperationError,
	type IndexSubmission,
} from "./model";
import { indexMutationKind } from "./mutation-metadata";
import {
	IndexingCoordinator,
	type IndexingCoordinatorService,
	IndexingCoordinatorSupervisor,
	submitIndexingAdmission,
} from "./coordinator";
import { retryDispositionFor } from "./retry-policy";

export interface GatewayMutationInboxOptions {
	readonly leaseOwner: string;
	readonly batchSize: number;
	readonly concurrency: number;
	readonly leaseDurationMs: number;
	readonly initialRetryDelayMs: number;
	readonly maximumRetryDelayMs: number;
	readonly maximumAttemptCount: number;
	readonly pollingIntervalMs: number;
}

export const defaultGatewayMutationInboxOptions = (
	leaseOwner = `gateway-${randomUUID()}`,
): GatewayMutationInboxOptions => ({
	leaseOwner,
	batchSize: 64,
	concurrency: 32,
	leaseDurationMs: 300_000,
	initialRetryDelayMs: 500,
	maximumRetryDelayMs: 60_000,
	maximumAttemptCount: 10,
	pollingIntervalMs: 100,
});

const claimMutationTimeout = "5 seconds";
const invalidPayloadErrorCode = "indexing:invalid-payload";
const exhaustedErrorCode = "indexing:attempts-exhausted";

export class GatewayMutationInbox extends Context.Service<
	GatewayMutationInbox,
	{
		readonly enqueue: (submission: IndexSubmission) => Effect.Effect<void>;
	}
>()("velumn/bot/indexing/GatewayMutationInbox") {}

const retryDelay = (
	options: GatewayMutationInboxOptions,
	attemptCount: number,
) =>
	boundedExponentialDelayMs({
		initialDelayMs: options.initialRetryDelayMs,
		maximumDelayMs: options.maximumRetryDelayMs,
		attemptCount,
	});

export const gatewayMutationErrorCode = (
	cause: Cause.Cause<IndexingOperationError>,
): string => {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	const errorCode = Cause.hasDies(cause)
		? "indexing:defect"
		: Cause.hasInterrupts(cause)
			? "indexing:interrupted"
			: error !== undefined
				? `indexing:${error.operation}:${error.classification}`
				: "indexing:unknown";
	return errorCode.slice(0, 128);
};

const processClaimedMutation = (
	options: GatewayMutationInboxOptions,
	repository: GatewayMutationRepository["Service"],
	coordinator: IndexingCoordinatorService<IndexingOperationError>,
	errorCapture: ErrorCaptureService,
	row: DBIndexingGatewayMutation,
) =>
	Effect.scoped(
		Effect.gen(function* () {
			const processingStartedAt = yield* Clock.currentTimeMillis;
			const generation = row.attemptCount;
			const leaseLost = yield* Ref.make(false);
			const coordinatorOwnsClaim = yield* Ref.make(false);
			const claimSettled = yield* Ref.make(false);
			const metricKind = yield* Ref.make(Option.none<IndexMutationKind>());
			const metricOutcome = yield* Ref.make(
				Option.none<GatewayMutationOutcome>(),
			);
			const setMetricOutcome = (outcome: GatewayMutationOutcome) =>
				Ref.update(metricOutcome, (current) =>
					Option.isSome(current) ? current : Option.some(outcome),
				);
			const setOperationOutcome = (outcome: GatewayMutationOutcome) =>
				setMetricOutcome(outcome).pipe(
					Effect.andThen(Ref.get(metricOutcome)),
					Effect.flatMap((current) =>
						Effect.annotateCurrentSpan({
							"operation.outcome": Option.getOrElse(current, () => outcome),
						}),
					),
				);
			yield* Effect.addFinalizer(() =>
				Effect.all([Ref.get(metricKind), Ref.get(metricOutcome)]).pipe(
					Effect.flatMap(([kind, outcome]) =>
						Option.isSome(kind) && Option.isSome(outcome)
							? Clock.currentTimeMillis.pipe(
									Effect.flatMap((finishedAt) =>
										BotMetrics.recordGatewayMutation({
											kind: kind.value,
											outcome: outcome.value,
											durationMs: finishedAt - processingStartedAt,
										}),
									),
								)
							: Effect.void,
					),
				),
			);
			// Registered before renewal so LIFO cleanup stops renewal before a
			// pre-admission claim is released.
			yield* Effect.addFinalizer(() =>
				Effect.all([
					Ref.get(leaseLost),
					Ref.get(coordinatorOwnsClaim),
					Ref.get(claimSettled),
				]).pipe(
					Effect.flatMap(([lost, coordinatorOwned, settled]) => {
						if (lost || coordinatorOwned || settled) return Effect.void;
						return repository
							.release(row.id, options.leaseOwner, generation)
							.pipe(
								Effect.interruptible,
								Effect.timeoutOption(claimMutationTimeout),
								Effect.flatMap((released) =>
									Option.isNone(released)
										? Effect.logError(
												"Durable gateway mutation claim release timed out",
												{
													metric:
														"indexing_gateway_mutation_claim_release_timed_out",
													mutationId: row.id,
													generation,
												},
											)
										: Effect.void,
								),
							);
					}),
					Effect.catch((error) =>
						error instanceof GatewayMutationLeaseLostError
							? Effect.void
							: Effect.logError(
									"Durable gateway mutation claim release failed",
									{
										metric: "indexing_gateway_mutation_claim_release_failed",
										mutationId: row.id,
										generation,
										...safeBoundaryMetadata(Cause.fail(error), {
											boundary: "gateway_claim_release",
										}),
									},
								),
					),
				),
			);
			const failClaim = (errorCode: string) =>
				repository.fail(row.id, options.leaseOwner, generation, errorCode);
			const decodedMutation = yield* decodeIndexMutation(row.mutation).pipe(
				Effect.map(Option.some),
				Effect.catch((error) =>
					Ref.set(metricKind, Option.some("invalid_payload")).pipe(
						Effect.andThen(setOperationOutcome("failed")),
						Effect.andThen(
							BotMetrics.recordRetry("gateway_processing", "terminal"),
						),
						Effect.andThen(failClaim(invalidPayloadErrorCode)),
						Effect.timeout(claimMutationTimeout),
						Effect.tap(() => Ref.set(claimSettled, true)),
						Effect.andThen(
							errorCapture.captureCause(Cause.fail(error), {
								boundary: "gateway_receipt_recovery",
								operation: "gateway.claimed_process",
								mutationId: String(row.id),
								submissionId: row.submissionId,
							}),
						),
						Effect.as(Option.none()),
					),
				),
			);
			if (Option.isNone(decodedMutation)) return;
			const mutation = decodedMutation.value;
			const kind = indexMutationKind(mutation);
			yield* Ref.set(metricKind, Option.some(kind));
			yield* Effect.annotateCurrentSpan({
				"mutation.type": kind,
				"submission.source": "gateway",
			});
			const submission: IndexSubmission = {
				id: row.submissionId,
				source: "gateway",
				orderingKey: row.orderingKey,
				mutation,
				submittedAt: row.submittedAt.getTime(),
			};
			const mutationIds = (() => {
				switch (submission.mutation._tag) {
					case "UpsertMessage":
					case "DeleteMessage":
						return {
							messageId: submission.mutation.messageId,
							channelId: submission.mutation.channelId,
							threadId: submission.mutation.threadId ?? undefined,
						};
					case "DeleteThread":
					case "ReconcileThread":
						return {
							guildId: submission.mutation.guildId,
							channelId: submission.mutation.parentChannelId,
							threadId: submission.mutation.threadId,
						};
					case "UpsertChannel":
					case "DeleteChannel":
						return {
							guildId: submission.mutation.guildId,
							channelId: submission.mutation.channelId,
						};
					case "InstallGuild":
					case "UpsertGuild":
					case "DeleteGuild":
					case "ReconcileBotMemberPermissions":
					case "ReconcileRolePermissions":
						return { guildId: submission.mutation.guildId };
					case "UpsertUser":
						return {};
				}
			})();
			const renewInterval = Math.max(
				1,
				Math.floor(options.leaseDurationMs / 2),
			);
			const maximumRenewRetryDelay = Math.max(
				1,
				Math.min(options.maximumRetryDelayMs, Math.floor(renewInterval / 2)),
			);
			const initialRenewRetryDelay = Math.min(
				options.initialRetryDelayMs,
				maximumRenewRetryDelay,
			);
			const renewLease = (
				delayMs: number,
				retryDelayMs: number,
			): Effect.Effect<void> =>
				Effect.sleep(delayMs).pipe(
					Effect.andThen(Clock.currentTimeMillis),
					Effect.flatMap((now) =>
						repository.renew(
							row.id,
							options.leaseOwner,
							generation,
							new Date(now + options.leaseDurationMs),
						),
					),
					Effect.matchEffect({
						onFailure: (error) => {
							if (error instanceof GatewayMutationLeaseLostError) {
								return Ref.set(leaseLost, true).pipe(
									Effect.andThen(setOperationOutcome("lease_lost")),
									Effect.andThen(
										Effect.logWarning("Durable gateway mutation lease lost", {
											metric: "indexing_gateway_mutation_lease_lost",
											mutationId: row.id,
											generation,
										}),
									),
								);
							}
							return BotMetrics.recordRetry(
								"gateway_processing",
								"retryable",
							).pipe(
								Effect.andThen(
									Effect.logWarning(
										"Durable gateway mutation lease renewal failed; retrying",
										{
											metric: "indexing_gateway_mutation_lease_renewal_failed",
											mutationId: row.id,
											generation,
											retryDelayMs,
											...safeBoundaryMetadata(Cause.fail(error), {
												boundary: "gateway_lease_renewal",
											}),
										},
									),
								),
								Effect.andThen(
									renewLease(
										retryDelayMs,
										Math.min(retryDelayMs * 2, maximumRenewRetryDelay),
									),
								),
							);
						},
						onSuccess: () => renewLease(renewInterval, initialRenewRetryDelay),
					}),
				);
			yield* Effect.forkScoped(
				renewLease(renewInterval, initialRenewRetryDelay),
			);
			const withCurrentClaim = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
				Ref.get(leaseLost).pipe(
					Effect.flatMap((lost) =>
						lost
							? Effect.void
							: effect.pipe(
									Effect.tapError((error) =>
										error instanceof GatewayMutationLeaseLostError
											? Ref.set(leaseLost, true)
											: Effect.void,
									),
								),
					),
				);
			const mutateCurrentClaim = <E, R>(effect: Effect.Effect<void, E, R>) =>
				Effect.uninterruptibleMask((restore) =>
					restore(
						withCurrentClaim(effect.pipe(Effect.timeout(claimMutationTimeout))),
					).pipe(Effect.andThen(Ref.set(claimSettled, true))),
				);

			yield* Effect.uninterruptibleMask((restore) =>
				restore(
					submitIndexingAdmission<IndexingOperationError>(
						{
							...coordinator,
							submit: (currentSubmission) =>
								coordinator
									.submit(currentSubmission)
									.pipe(
										Effect.tap((result) =>
											result._tag === "Overloaded"
												? BotMetrics.recordRetry(
														"gateway_processing",
														"retryable",
													)
												: Effect.void,
										),
									),
						},
						submission,
					),
				).pipe(
					Effect.flatMap((admission) => {
						if (admission._tag === "Closing") {
							return BotMetrics.recordRetry(
								"gateway_processing",
								"retryable",
							).pipe(
								Effect.andThen(
									restore(
										mutateCurrentClaim(
											Clock.currentTimeMillis.pipe(
												Effect.flatMap((now) =>
													repository.defer(
														row.id,
														options.leaseOwner,
														generation,
														"coordinator-closing",
														new Date(now),
													),
												),
											),
										),
									),
								),
								Effect.andThen(setOperationOutcome("closing")),
							);
						}

						return Ref.set(coordinatorOwnsClaim, true).pipe(
							Effect.andThen(restore(admission.receipt.await)),
							Effect.flatMap((outcome) =>
								Ref.set(coordinatorOwnsClaim, false).pipe(
									Effect.andThen(
										restore(
											Effect.suspend(() => {
												if (outcome._tag === "Completed") {
													return mutateCurrentClaim(
														repository.complete(
															row.id,
															options.leaseOwner,
															generation,
														),
													).pipe(
														Effect.andThen(setOperationOutcome("succeeded")),
													);
												}
												const error = Option.getOrUndefined(
													Cause.findErrorOption(outcome.cause),
												);
												const terminal =
													!Cause.hasDies(outcome.cause) &&
													!Cause.hasInterrupts(outcome.cause) &&
													error !== undefined &&
													retryDispositionFor(error.classification) ===
														"terminal";
												const exhausted =
													generation >= options.maximumAttemptCount;
												const failedPermanently = terminal || exhausted;
												return Effect.gen(function* () {
													yield* BotMetrics.recordRetry(
														"gateway_processing",
														failedPermanently ? "terminal" : "retryable",
													);
													yield* Effect.annotateCurrentSpan({
														"error.type": Cause.hasDies(outcome.cause)
															? "Defect"
															: (error?._tag ?? "UnknownError"),
														"error.classification": Cause.hasDies(outcome.cause)
															? "defect"
															: (error?.classification ?? "unknown"),
														"retry.attempt": generation,
													});
													if (Cause.hasDies(outcome.cause)) {
														yield* errorCapture.captureCause(outcome.cause, {
															boundary: "gateway_receipt_recovery",
															operation: "IndexingCoordinator.settleItem",
															mutationId: String(row.id),
															submissionId: row.submissionId,
															...mutationIds,
														});
													}
													yield* Effect.logWarning(
														"Durable gateway mutation indexing failed",
														{
															metric:
																"indexing_gateway_mutation_indexing_failed",
															mutationId: row.id,
															generation,
															...safeBoundaryMetadata(outcome.cause, {
																boundary: "gateway_mutation_indexing",
															}),
														},
													);
													yield* mutateCurrentClaim(
														failedPermanently
															? failClaim(
																	exhausted
																		? exhaustedErrorCode
																		: gatewayMutationErrorCode(outcome.cause),
																)
															: Clock.currentTimeMillis.pipe(
																	Effect.flatMap((now) =>
																		repository.defer(
																			row.id,
																			options.leaseOwner,
																			generation,
																			gatewayMutationErrorCode(outcome.cause),
																			new Date(
																				now + retryDelay(options, generation),
																			),
																		),
																	),
																),
													);
													if (failedPermanently) {
														yield* setOperationOutcome("failed");
													} else {
														yield* setOperationOutcome("deferred");
													}
												});
											}),
										),
									),
								),
							),
						);
					}),
				),
			).pipe(
				Effect.onExit((exit) => {
					if (exit._tag === "Success") return Effect.void;
					return Ref.get(leaseLost).pipe(
						Effect.flatMap((lost) =>
							setOperationOutcome(
								lost
									? "lease_lost"
									: Cause.hasInterrupts(exit.cause)
										? "closing"
										: "failed",
							),
						),
					);
				}),
			);
		}),
	);

export const drainGatewayMutationBatch = (
	options: GatewayMutationInboxOptions,
): Effect.Effect<
	number,
	never,
	GatewayMutationRepository | IndexingCoordinator
> =>
	Effect.gen(function* () {
		const repository = yield* GatewayMutationRepository;
		const coordinator = yield* IndexingCoordinator;
		const errorCapture = yield* ErrorCapture;
		const now = yield* Clock.currentTimeMillis;
		const rows = yield* repository.claim({
			leaseOwner: options.leaseOwner,
			leaseExpiresAt: new Date(now + options.leaseDurationMs),
			limit: options.batchSize,
			now: new Date(now),
		});
		if (rows.length === 0) return 0;
		yield* Effect.gen(function* () {
			const succeeded = yield* Effect.forEach(
				rows,
				(row) =>
					processClaimedMutation(
						options,
						repository,
						coordinator,
						errorCapture,
						row,
					).pipe(
						Effect.withSpan("gateway.claimed_process", {
							attributes: {
								"operation.name": "gateway.claimed_process",
								mutationId: row.id,
								submissionId: row.submissionId,
								"retry.attempt": row.attemptCount,
							},
						}),
						Effect.as(true),
						Effect.catch((error) =>
							Effect.logError("Durable gateway mutation processing failed", {
								metric: "indexing_gateway_mutation_processing_failed",
								mutationId: row.id,
								...safeBoundaryMetadata(Cause.fail(error), {
									boundary: "gateway_mutation_processing",
								}),
							}).pipe(Effect.as(false)),
						),
					),
				{ concurrency: options.concurrency },
			);
			const failedCount = succeeded.filter((value) => !value).length;
			yield* Effect.annotateCurrentSpan({
				"batch.failed_count": failedCount,
				"operation.outcome": failedCount > 0 ? "failed" : "completed",
			});
		}).pipe(
			Effect.withSpan("gateway.poll", {
				root: true,
				attributes: {
					"operation.name": "gateway.poll",
					"batch.claimed_count": rows.length,
				},
			}),
		);
		return rows.length;
	}).pipe(
		Effect.catch((error) => {
			const normalized = normalizeError(error);
			return Effect.gen(function* () {
				const errorCapture = yield* ErrorCapture;
				yield* errorCapture.captureCause(Cause.fail(error), {
					boundary: "gateway_poll_attempt",
					operation: "gateway.poll",
				});
				yield* Effect.logError("Durable gateway mutation poll failed", {
					metric: "indexing_gateway_mutation_poll_failed",
					...safeBoundaryMetadata(Cause.fail(error), {
						boundary: "gateway_poll_attempt",
					}),
				});
				return yield* Effect.fail(error);
			}).pipe(
				Effect.withSpan("gateway.poll", {
					root: true,
					attributes: {
						"operation.name": "gateway.poll",
						"operation.outcome": "failed",
						"error.type": normalized.type,
						"error.classification": normalized.typedOperation,
					},
				}),
				Effect.catch(() => Effect.succeed(0)),
			);
		}),
	);

export const layerGatewayMutationInbox = (
	options: GatewayMutationInboxOptions = defaultGatewayMutationInboxOptions(),
) =>
	Layer.effect(
		GatewayMutationInbox,
		Effect.gen(function* () {
			for (const [name, value] of Object.entries(options)) {
				if (name === "leaseOwner") continue;
				if (value === undefined) continue;
				if (!Number.isInteger(value) || (value as number) <= 0) {
					return yield* Effect.die(
						new RangeError(`${name} must be a positive integer`),
					);
				}
			}
			if (!options.leaseOwner) {
				return yield* Effect.die(new Error("leaseOwner is required"));
			}

			const repository = yield* GatewayMutationRepository;
			const coordinator = yield* IndexingCoordinator;
			const supervisor = yield* IndexingCoordinatorSupervisor;
			const readiness = yield* Readiness;
			const errorCapture = yield* ErrorCapture;
			const poll: Effect.Effect<
				void,
				never,
				GatewayMutationRepository | IndexingCoordinator
			> = Effect.suspend(() =>
				drainGatewayMutationBatch(options).pipe(
					Effect.flatMap((claimedCount) =>
						claimedCount < options.batchSize
							? Effect.sleep(options.pollingIntervalMs)
							: Effect.yieldNow,
					),
					Effect.andThen(poll),
				),
			);
			yield* readiness.setGatewayMutationInboxReady(true);
			yield* supervisor.fork(
				poll.pipe(
					Effect.onExit((exit) =>
						readiness.setGatewayMutationInboxReady(false).pipe(
							Effect.andThen(
								exit._tag === "Success" || !Cause.hasInterruptsOnly(exit.cause)
									? errorCapture
											.captureCause(
												exit._tag === "Failure"
													? exit.cause
													: Cause.die(new Error("Gateway poll completed")),
												{
													boundary: "gateway_poll_fiber",
													operation: "gateway.poll",
												},
											)
											.pipe(Effect.asVoid)
									: Effect.void,
							),
						),
					),
				),
			);
			return GatewayMutationInbox.of({
				enqueue: (submission) => {
					const enqueue = (delayMs: number): Effect.Effect<void> =>
						repository
							.enqueue({
								submissionId: submission.id,
								orderingKey: submission.orderingKey,
								mutation: submission.mutation,
								submittedAt: new Date(submission.submittedAt),
							})
							.pipe(
								Effect.asVoid,
								Effect.catch((error) =>
									coordinator.state.pipe(
										Effect.flatMap((state) =>
											state.accepting
												? BotMetrics.recordRetry(
														"gateway_enqueue",
														"retryable",
													).pipe(
														Effect.andThen(
															Effect.logWarning(
																"Gateway mutation enqueue failed; retrying",
																{
																	metric:
																		"indexing_gateway_mutation_enqueue_retry",
																	delayMs,
																	...safeBoundaryMetadata(Cause.fail(error), {
																		boundary: "gateway_enqueue",
																	}),
																},
															),
														),
														Effect.andThen(Effect.sleep(delayMs)),
														Effect.andThen(
															enqueue(
																Math.min(
																	delayMs * 2,
																	options.maximumRetryDelayMs,
																),
															),
														),
													)
												: BotMetrics.recordRetry(
														"gateway_enqueue",
														"terminal",
													).pipe(
														Effect.andThen(
															Effect.logWarning(
																"Stopped gateway mutation enqueue during coordinator shutdown",
																{
																	metric:
																		"indexing_gateway_mutation_enqueue_closing",
																	boundary: "gateway_enqueue_closing",
																},
															),
														),
													),
										),
									),
								),
							);
					return enqueue(options.initialRetryDelayMs);
				},
			});
		}),
	);
