import { randomUUID } from "node:crypto";
import type { DBIndexingGatewayMutation } from "@repo/db/schema/index";
import {
	Cause,
	Clock,
	Context,
	Effect,
	Fiber,
	Layer,
	Option,
	Ref,
} from "effect";
import {
	GatewayMutationLeaseLostError,
	GatewayMutationRepository,
} from "../adapters/gateway-mutation-repository";
import { Readiness } from "../runtime/readiness";
import {
	IndexingCoordinator,
	type IndexingCoordinatorService,
	submitIndexingAdmission,
} from "./coordinator";
import type {
	IndexingOperationError,
	IndexMutation,
	IndexSubmission,
} from "./model";
import { retryDispositionFor } from "./policy";

export interface GatewayMutationInboxOptions {
	readonly leaseOwner: string;
	readonly batchSize: number;
	readonly concurrency: number;
	readonly leaseDurationMs: number;
	readonly initialRetryDelayMs: number;
	readonly maximumRetryDelayMs: number;
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
	pollingIntervalMs: 100,
});

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
	Math.min(
		options.maximumRetryDelayMs,
		options.initialRetryDelayMs *
			2 ** Math.min(30, Math.max(0, attemptCount - 1)),
	);

export const gatewayMutationErrorCode = (
	cause: Cause.Cause<IndexingOperationError>,
): string => {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	const errorCode =
		error !== undefined
			? `indexing:${error.operation}:${error.classification}`
			: Cause.hasDies(cause)
				? "indexing:defect"
				: Cause.hasInterrupts(cause)
					? "indexing:interrupted"
					: "indexing:unknown";
	return errorCode.slice(0, 128);
};

const processClaimedMutation = (
	options: GatewayMutationInboxOptions,
	repository: GatewayMutationRepository["Service"],
	coordinator: IndexingCoordinatorService<IndexingOperationError>,
	row: DBIndexingGatewayMutation,
) =>
	Effect.scoped(
		Effect.gen(function* () {
			const generation = row.attemptCount;
			const leaseLost = yield* Ref.make(false);
			// Registered before the renewal fiber so LIFO scope cleanup stops renewal
			// before making the final fenced release attempt.
			yield* Effect.addFinalizer(() =>
				Ref.get(leaseLost).pipe(
					Effect.flatMap((lost) =>
						lost
							? Effect.void
							: repository.release(row.id, options.leaseOwner, generation),
					),
					Effect.catch((error) =>
						error instanceof GatewayMutationLeaseLostError
							? Effect.void
							: Effect.logError(
									"Durable gateway mutation claim release failed",
									{
										metric: "indexing_gateway_mutation_claim_release_failed",
										mutationId: row.id,
										generation,
										error,
									},
								),
					),
				),
			);
			const submission: IndexSubmission = {
				id: row.submissionId,
				source: "gateway",
				orderingKey: row.orderingKey,
				mutation: row.mutation as IndexMutation,
				submittedAt: row.submittedAt.getTime(),
			};
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
									Effect.andThen(
										Effect.logWarning("Durable gateway mutation lease lost", {
											metric: "indexing_gateway_mutation_lease_lost",
											mutationId: row.id,
											generation,
										}),
									),
								);
							}
							return Effect.logWarning(
								"Durable gateway mutation lease renewal failed; retrying",
								{
									metric: "indexing_gateway_mutation_lease_renewal_failed",
									mutationId: row.id,
									generation,
									retryDelayMs,
									error,
								},
							).pipe(
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
			const renewalFiber = yield* Effect.forkScoped(
				renewLease(renewInterval, initialRenewRetryDelay),
			);
			const withCurrentClaim = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
				Fiber.interrupt(renewalFiber).pipe(
					Effect.andThen(Ref.get(leaseLost)),
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

			yield* submitIndexingAdmission(coordinator, submission).pipe(
				Effect.flatMap((admission) => {
					if (admission._tag === "Closing") {
						return withCurrentClaim(
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
						);
					}

					return admission.receipt.await.pipe(
						Effect.flatMap((outcome) => {
							if (outcome._tag === "Completed") {
								return withCurrentClaim(
									repository.complete(row.id, options.leaseOwner, generation),
								);
							}
							const cause = Cause.pretty(outcome.cause);
							const error = Option.getOrUndefined(
								Cause.findErrorOption(outcome.cause),
							);
							return Effect.logWarning(
								"Durable gateway mutation indexing failed",
								{
									metric: "indexing_gateway_mutation_indexing_failed",
									mutationId: row.id,
									generation,
									cause,
								},
							).pipe(
								Effect.andThen(
									withCurrentClaim(
										error !== undefined &&
											retryDispositionFor(error.classification) === "terminal"
											? repository.complete(
													row.id,
													options.leaseOwner,
													generation,
												)
											: Clock.currentTimeMillis.pipe(
													Effect.flatMap((now) =>
														repository.defer(
															row.id,
															options.leaseOwner,
															generation,
															gatewayMutationErrorCode(outcome.cause),
															new Date(now + retryDelay(options, generation)),
														),
													),
												),
									),
								),
							);
						}),
						// Once accepted, the coordinator owns the mutation. Keep the DB claim
						// until its receipt and terminal row mutation have both settled.
						Effect.uninterruptible,
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
		const now = yield* Clock.currentTimeMillis;
		const rows = yield* repository.claim({
			leaseOwner: options.leaseOwner,
			leaseExpiresAt: new Date(now + options.leaseDurationMs),
			limit: options.batchSize,
			now: new Date(now),
		});
		yield* Effect.forEach(
			rows,
			(row) =>
				processClaimedMutation(options, repository, coordinator, row).pipe(
					Effect.catch((error) =>
						Effect.logError("Durable gateway mutation processing failed", {
							metric: "indexing_gateway_mutation_processing_failed",
							mutationId: row.id,
							error,
						}),
					),
				),
			{ concurrency: options.concurrency, discard: true },
		);
		return rows.length;
	}).pipe(
		Effect.catch((error) =>
			Effect.logError("Durable gateway mutation poll failed", {
				metric: "indexing_gateway_mutation_poll_failed",
				error,
			}).pipe(Effect.as(0)),
		),
	);

export const layerGatewayMutationInbox = (
	options: GatewayMutationInboxOptions = defaultGatewayMutationInboxOptions(),
) =>
	Layer.effect(
		GatewayMutationInbox,
		Effect.gen(function* () {
			for (const [name, value] of Object.entries(options)) {
				if (name === "leaseOwner") continue;
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
			const readiness = yield* Readiness;
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
			yield* Effect.forkScoped(
				poll.pipe(
					Effect.onExit((exit) =>
						readiness.setGatewayMutationInboxReady(false).pipe(
							Effect.andThen(
								exit._tag === "Success" || !Cause.hasInterruptsOnly(exit.cause)
									? Effect.logError(
											"Durable gateway mutation poll fiber stopped unexpectedly",
											{
												metric: "indexing_gateway_mutation_poll_fiber_stopped",
												cause:
													exit._tag === "Failure"
														? Cause.pretty(exit.cause)
														: "poll completed",
											},
										)
									: Effect.void,
							),
						),
					),
				),
				{ startImmediately: true },
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
												? Effect.logWarning(
														"Gateway mutation enqueue failed; retrying",
														{
															metric: "indexing_gateway_mutation_enqueue_retry",
															submissionId: submission.id,
															delayMs,
															error,
														},
													).pipe(
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
												: Effect.logWarning(
														"Stopped gateway mutation enqueue during coordinator shutdown",
														{
															metric:
																"indexing_gateway_mutation_enqueue_closing",
															submissionId: submission.id,
														},
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
