import { assert, describe, it } from "@effect/vitest";
import { decodeClaimedIndexingGatewayMutation } from "@repo/db/helpers/indexing-gateway-mutation";
import type { DBIndexingGatewayMutation } from "@repo/db/schema/index";
import { Cause, Deferred, Effect, Fiber, Layer, Option, Tracer } from "effect";
import { TestClock } from "effect/testing";
import {
	GatewayMutationLeaseLostError,
	GatewayMutationRepository,
	GatewayMutationRepositoryError,
} from "../adapters/gateway-mutation-repository";
import {
	ErrorCapture,
	type ErrorCaptureContext,
} from "../observability/error-capture";
import { Readiness } from "../runtime/readiness";
import {
	IndexingCoordinator,
	type IndexingCoordinatorService,
	layerIndexingCoordinatorSupervisor,
} from "./coordinator";
import {
	drainGatewayMutationBatch,
	GatewayMutationInbox,
	type GatewayMutationInboxOptions,
	gatewayMutationErrorCode,
	layerGatewayMutationInbox,
} from "./gateway-inbox";
import {
	IndexingOperationError,
	type IndexMutation,
	type IndexTerminalOutcome,
} from "./model";

const options: GatewayMutationInboxOptions = {
	leaseOwner: "test-worker",
	batchSize: 10,
	concurrency: 2,
	leaseDurationMs: 1_000,
	initialRetryDelayMs: 10,
	maximumRetryDelayMs: 100,
	pollingIntervalMs: 10,
};

const row = (
	id: number,
	orderingKey: string,
	mutation: IndexMutation,
	attemptCount = 1,
): DBIndexingGatewayMutation => ({
	id,
	submissionId: `gateway:test:${id}`,
	orderingKey,
	mutation,
	submittedAt: new Date(1_000),
	status: "processing",
	attemptCount,
	nextAttemptAt: new Date(0),
	leaseOwner: options.leaseOwner,
	leaseExpiresAt: new Date(2_000),
	lastErrorCode: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
});

const failed = (
	classification: IndexingOperationError["classification"] = "database",
) =>
	Cause.fail(
		new IndexingOperationError({
			operation: "commit-mutation",
			classification,
			cause: new Error("database outage"),
		}),
	);

const repository = (
	claimed: readonly DBIndexingGatewayMutation[],
	calls: {
		completed: number[];
		deferred: number[];
		deferredCodes: string[];
		order: string[];
		released: number;
		releaseClaims: Array<{ id: number; generation: number }>;
		renewed: number[];
	},
) =>
	GatewayMutationRepository.of({
		enqueue: () => Effect.die("unused"),
		claim: () => Effect.succeed(claimed),
		complete: (id) =>
			Effect.sync(() => {
				calls.completed.push(id);
				calls.order.push(`complete:${id}`);
			}),
		defer: (id, _leaseOwner, _generation, errorCode) =>
			Effect.sync(() => {
				calls.deferred.push(id);
				calls.deferredCodes.push(errorCode);
				calls.order.push(`defer:${id}`);
			}),
		renew: (id) =>
			Effect.sync(() => {
				calls.renewed.push(id);
				calls.order.push(`renew:${id}`);
			}),
		release: (id, _leaseOwner, generation) =>
			Effect.sync(() => {
				calls.released += 1;
				calls.releaseClaims.push({ id, generation });
				calls.order.push(`release:${id}`);
			}),
	});

const coordinator = (
	submit: IndexingCoordinatorService<IndexingOperationError>["submit"],
) =>
	IndexingCoordinator.of({
		submit,
		state: Effect.succeed({ accepting: true, outstanding: 0 }),
		close: Effect.void,
	});

const run = (
	rows: readonly DBIndexingGatewayMutation[],
	repositoryCalls: {
		completed: number[];
		deferred: number[];
		deferredCodes: string[];
		order: string[];
		released: number;
		releaseClaims: Array<{ id: number; generation: number }>;
		renewed: number[];
	},
	service: IndexingCoordinatorService<IndexingOperationError>,
) =>
	drainGatewayMutationBatch(options).pipe(
		Effect.provide(
			Layer.merge(
				Layer.succeed(
					GatewayMutationRepository,
					repository(rows, repositoryCalls),
				),
				Layer.succeed(IndexingCoordinator, service),
			),
		),
	);

const calls = () => ({
	completed: [] as number[],
	deferred: [] as number[],
	deferredCodes: [] as string[],
	order: [] as string[],
	released: 0,
	releaseClaims: [] as Array<{ id: number; generation: number }>,
	renewed: [] as number[],
});

describe("durable gateway mutation inbox", () => {
	it.effect("suppresses empty polls and roots claimed batches", () =>
		Effect.gen(function* () {
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});
			const service = coordinator((submission) =>
				Effect.succeed({
					_tag: "Accepted",
					receipt: {
						await: Effect.succeed({
							_tag: "Completed",
							submissionId: submission.id,
							completedAt: 2_000,
						}),
					},
				}),
			);

			yield* run([], calls(), service).pipe(
				Effect.andThen(run([], calls(), service)),
				Effect.provideService(Tracer.Tracer, tracer),
			);
			assert.deepEqual(spans, []);

			yield* run(
				[
					row(1, "content:thread-1", {
						_tag: "DeleteMessage",
						messageId: "message-1",
						channelId: "thread-1",
						threadId: "thread-1",
						observedAt: 1_000,
					}),
				],
				calls(),
				service,
			).pipe(Effect.provideService(Tracer.Tracer, tracer));

			const root = spans.find((span) => span.name === "gateway.poll");
			const claimed = spans.find(
				(span) => span.name === "gateway.claimed_process",
			);
			assert.isDefined(root);
			assert.isDefined(claimed);
			assert.isTrue(Option.isNone(root?.parent ?? Option.none()));
			assert.equal(Option.getOrUndefined(claimed?.parent)?.spanId, root?.spanId);
			assert.equal(claimed?.traceId, root?.traceId);
			const exportedIds = new Set(spans.map((span) => span.spanId));
			assert.isTrue(
				spans.every((span) => {
					const parent = Option.getOrUndefined(span.parent);
					return !parent || exportedIds.has(parent.spanId);
				}),
			);
		}),
	);

	it.effect("retains a message delete through coordinator overload", () =>
		Effect.gen(function* () {
			let attempts = 0;
			const observed = calls();
			const service = coordinator(() =>
				Effect.sync(() => {
					attempts += 1;
					if (attempts < 3) return { _tag: "Overloaded" as const };
					return {
						_tag: "Accepted" as const,
						receipt: {
							await: Effect.succeed({
								_tag: "Completed" as const,
								submissionId: "gateway:test:1",
								completedAt: 2_000,
							}),
						},
					};
				}),
			);
			const fiber = yield* Effect.forkChild(
				run(
					[
						row(1, "content:thread-1", {
							_tag: "DeleteMessage",
							messageId: "message-1",
							channelId: "thread-1",
							threadId: "thread-1",
							observedAt: 1_000,
						}),
					],
					observed,
					service,
				),
			);
			yield* TestClock.adjust("20 millis");
			yield* Fiber.join(fiber);
			assert.equal(attempts, 3);
			assert.deepEqual(observed.completed, [1]);
			assert.deepEqual(observed.deferred, []);
		}),
	);

	it.effect("defers thread and channel deletes after a database outage", () =>
		Effect.gen(function* () {
			const observed = calls();
			const service = coordinator((submission) =>
				Effect.succeed({
					_tag: "Accepted",
					receipt: {
						await: Effect.succeed({
							_tag: "Failed",
							submissionId: submission.id,
							failedAt: 2_000,
							cause: failed(),
						}),
					},
				}),
			);
			yield* run(
				[
					row(2, "content:thread-1", {
						_tag: "DeleteThread",
						threadId: "thread-1",
						parentChannelId: "channel-1",
						guildId: "guild-1",
						observedAt: 1_000,
					}),
					row(3, "channel:channel-1", {
						_tag: "DeleteChannel",
						channelId: "channel-1",
						guildId: "guild-1",
						scope: "tree",
						observedAt: 1_000,
					}),
				],
				observed,
				service,
			);
			assert.deepEqual(observed.deferred.sort(), [2, 3]);
			assert.deepEqual(observed.deferredCodes, [
				"indexing:commit-mutation:database",
				"indexing:commit-mutation:database",
			]);
			assert.deepEqual(observed.completed, []);
			assert.deepEqual(
				observed.releaseClaims.map(({ id }) => id).sort(),
				[2, 3],
			);
		}),
	);

	it.effect("completes a terminal head so later work can advance", () =>
		Effect.gen(function* () {
			const observed = calls();
			yield* run(
				[
					row(20, "content:thread-1", {
						_tag: "UpsertMessage",
						messageId: "missing",
						channelId: "thread-1",
						threadId: "thread-1",
						observedAt: 1_000,
					}),
				],
				observed,
				coordinator((submission) =>
					Effect.succeed({
						_tag: "Accepted",
						receipt: {
							await: Effect.succeed({
								_tag: "Failed",
								submissionId: submission.id,
								failedAt: 2_000,
								cause: failed("missing-entity"),
							}),
						},
					}),
				),
			);

			assert.deepEqual(observed.completed, [20]);
			assert.deepEqual(observed.deferred, []);
		}),
	);

	it("derives stable typed and fallback persisted error codes", () => {
		assert.equal(
			gatewayMutationErrorCode(failed("database")),
			"indexing:commit-mutation:database",
		);
		assert.equal(
			gatewayMutationErrorCode(Cause.die(new Error("secret defect"))),
			"indexing:defect",
		);
		assert.equal(
			gatewayMutationErrorCode(Cause.interrupt(1)),
			"indexing:interrupted",
		);
		assert.equal(
			gatewayMutationErrorCode(
				Cause.combine(failed("missing-entity"), Cause.die("unexpected")),
			),
			"indexing:defect",
		);
		assert.equal(gatewayMutationErrorCode(Cause.empty), "indexing:unknown");
	});

	it.effect(
		"defers a terminal error when its cause also contains a defect",
		() =>
			Effect.gen(function* () {
				const observed = calls();
				const cause = Cause.combine(
					failed("missing-entity"),
					Cause.die("unexpected"),
				);
				yield* run(
					[
						row(25, "content:thread-1", {
							_tag: "DeleteMessage",
							messageId: "message-1",
							channelId: "thread-1",
							threadId: "thread-1",
							observedAt: 1_000,
						}),
					],
					observed,
					coordinator((submission) =>
						Effect.succeed({
							_tag: "Accepted",
							receipt: {
								await: Effect.succeed({
									_tag: "Failed",
									submissionId: submission.id,
									failedAt: 2_000,
									cause,
								}),
							},
						}),
					),
				);

				assert.deepEqual(observed.completed, []);
				assert.deepEqual(observed.deferred, [25]);
				assert.deepEqual(observed.deferredCodes, ["indexing:defect"]);
			}),
	);

	it.effect(
		"captures a recovered receipt defect once but not a typed failure",
		() =>
			Effect.gen(function* () {
				const observed = calls();
				const contexts: ErrorCaptureContext[] = [];
				const spans: Tracer.NativeSpan[] = [];
				const tracer = Tracer.make({
					span: (spanOptions) => {
						const span = new Tracer.NativeSpan(spanOptions);
						spans.push(span);
						return span;
					},
				});
				const defect = Cause.combine(
					failed("missing-entity"),
					Cause.die(new Error("coordinator defect")),
				);
				yield* run(
					[
						row(25, "content:thread-1", {
							_tag: "DeleteMessage",
							messageId: "message-25",
							channelId: "thread-1",
							threadId: "thread-1",
							observedAt: 1_000,
						}),
						row(26, "content:thread-2", {
							_tag: "DeleteMessage",
							messageId: "message-26",
							channelId: "thread-2",
							threadId: "thread-2",
							observedAt: 1_000,
						}),
					],
					observed,
					coordinator((submission) =>
						Effect.succeed({
							_tag: "Accepted",
							receipt: {
								await: Effect.succeed({
									_tag: "Failed",
									submissionId: submission.id,
									failedAt: 2_000,
									cause: submission.id.endsWith(":25") ? defect : failed(),
								}),
							},
						}),
					),
				).pipe(
					Effect.provideService(ErrorCapture, {
						captureCause: (_cause, context) =>
							Effect.sync(() => {
								contexts.push(context);
								return undefined;
							}),
					}),
					Effect.provideService(Tracer.Tracer, tracer),
				);

				assert.equal(contexts.length, 1);
				assert.deepInclude(contexts[0], {
					boundary: "gateway_receipt_recovery",
					operation: "IndexingCoordinator.settleItem",
					mutationId: "25",
					submissionId: "gateway:test:25",
					messageId: "message-25",
					channelId: "thread-1",
					threadId: "thread-1",
				});
				const defectSpan = spans.find(
					(span) => span.attributes.get("mutationId") === 25,
				);
				const typedSpan = spans.find(
					(span) => span.attributes.get("mutationId") === 26,
				);
				assert.equal(
					defectSpan?.attributes.get("operation.outcome"),
					"deferred",
				);
				assert.equal(
					defectSpan?.attributes.get("error.classification"),
					"defect",
				);
				assert.equal(
					typedSpan?.attributes.get("error.type"),
					"IndexingOperationError",
				);
				assert.deepEqual(observed.deferred.sort(), [25, 26]);
			}),
	);

	it.effect("completes deferred permission revocation after restart", () =>
		Effect.gen(function* () {
			const mutation: IndexMutation = {
				_tag: "ReconcileRolePermissions",
				guildId: "guild-1",
				roleId: "role-1",
				deleted: true,
				observedAt: 1_000,
			};
			const beforeRestart = calls();
			yield* run(
				[row(4, "guild:guild-1", mutation)],
				beforeRestart,
				coordinator((submission) =>
					Effect.succeed({
						_tag: "Accepted",
						receipt: {
							await: Effect.succeed({
								_tag: "Failed",
								submissionId: submission.id,
								failedAt: 2_000,
								cause: failed(),
							}),
						},
					}),
				),
			);
			assert.deepEqual(beforeRestart.deferred, [4]);

			const afterRestart = calls();
			yield* run(
				[row(4, "guild:guild-1", mutation, 2)],
				afterRestart,
				coordinator((submission) =>
					Effect.succeed({
						_tag: "Accepted",
						receipt: {
							await: Effect.succeed({
								_tag: "Completed",
								submissionId: submission.id,
								completedAt: 3_000,
							}),
						},
					}),
				),
			);
			assert.deepEqual(afterRestart.completed, [4]);
			assert.equal(afterRestart.released, 1);
		}),
	);

	it.effect("keeps polling and completes pg-driver-shaped claims", () => {
		let claimCount = 0;
		const observed = calls();
		const claimed = decodeClaimedIndexingGatewayMutation({
			id: "24",
			submissionId: "gateway:test:24",
			orderingKey: "content:thread-1",
			mutation: JSON.stringify({
				_tag: "DeleteMessage",
				messageId: "message-1",
				channelId: "thread-1",
				threadId: "thread-1",
				observedAt: 1_000,
			}),
			submittedAt: "2026-08-09 12:34:56.789",
			status: "processing",
			attemptCount: "1",
			nextAttemptAt: "2026-08-09 12:34:56",
			leaseOwner: options.leaseOwner,
			leaseExpiresAt: "2026-08-09 12:40:00",
			lastErrorCode: null,
			createdAt: "2026-08-09 12:30:00",
			updatedAt: "2026-08-09 12:34:56.789",
		});
		const base = repository([], observed);
		const pollingRepository = GatewayMutationRepository.of({
			...base,
			claim: () =>
				Effect.sync(() => {
					claimCount += 1;
					return claimCount === 1 ? [claimed] : [];
				}),
		});
		const layer = layerGatewayMutationInbox(options).pipe(
			Layer.provide(
				Layer.merge(
					Layer.succeed(GatewayMutationRepository, pollingRepository),
					Layer.mergeAll(
						Layer.succeed(
							IndexingCoordinator,
							coordinator((submission) =>
								Effect.succeed({
									_tag: "Accepted",
									receipt: {
										await: Effect.succeed({
											_tag: "Completed",
											submissionId: submission.id,
											completedAt: submission.submittedAt,
										}),
									},
								}),
							),
						),
						layerIndexingCoordinatorSupervisor,
						Readiness.layer,
					),
				),
			),
		);

		return Effect.gen(function* () {
			yield* GatewayMutationInbox;
			yield* Effect.yieldNow;
			assert.deepEqual(observed.completed, [24]);
			yield* TestClock.adjust(`${options.pollingIntervalMs} millis`);
			yield* Effect.yieldNow;
			assert.isAtLeast(claimCount, 2);
		}).pipe(Effect.provide(layer), Effect.scoped);
	});

	it.effect("renews a claim while accepted coordinator work is pending", () =>
		Effect.gen(function* () {
			const observed = calls();
			const service = coordinator((submission) =>
				Effect.succeed({
					_tag: "Accepted",
					receipt: {
						await: Effect.sleep("1500 millis").pipe(
							Effect.as({
								_tag: "Completed" as const,
								submissionId: submission.id,
								completedAt: 2_500,
							}),
						),
					},
				}),
			);
			const fiber = yield* Effect.forkChild(
				run(
					[
						row(5, "content:thread-1", {
							_tag: "DeleteMessage",
							messageId: "message-1",
							channelId: "thread-1",
							threadId: "thread-1",
							observedAt: 1_000,
						}),
					],
					observed,
					service,
				),
			);
			yield* Effect.yieldNow;
			yield* TestClock.adjust("1200 millis");
			assert.deepEqual(observed.renewed, [5, 5]);
			yield* TestClock.adjust("300 millis");
			yield* Fiber.join(fiber);

			assert.deepEqual(observed.completed, [5]);
		}),
	);

	it.effect("does not release an admitted claim during shutdown", () =>
		Effect.gen(function* () {
			const observed = calls();
			const admitted = yield* Deferred.make<void>();
			const receipt =
				yield* Deferred.make<IndexTerminalOutcome<IndexingOperationError>>();
			const fiber = yield* Effect.forkChild(
				run(
					[
						row(21, "content:thread-1", {
							_tag: "DeleteMessage",
							messageId: "message-1",
							channelId: "thread-1",
							threadId: "thread-1",
							observedAt: 1_000,
						}),
					],
					observed,
					coordinator((_submission) =>
						Deferred.succeed(admitted, undefined).pipe(
							Effect.as({
								_tag: "Accepted" as const,
								receipt: { await: Deferred.await(receipt) },
							}),
						),
					),
				),
			);

			yield* Deferred.await(admitted);
			const interrupt = yield* Effect.forkChild(Fiber.interrupt(fiber));
			yield* Effect.yieldNow;
			assert.equal(observed.released, 0);

			yield* Deferred.succeed(receipt, {
				_tag: "Completed",
				submissionId: "gateway:test:21",
				completedAt: 2_000,
			});
			yield* Fiber.join(interrupt);
			assert.deepEqual(observed.completed, [21]);
			assert.equal(observed.released, 1);
			assert.isBelow(
				observed.order.indexOf("complete:21"),
				observed.order.indexOf("release:21"),
			);
		}),
	);

	it.effect("stops after renewal reports lease loss", () =>
		Effect.gen(function* () {
			const observed = calls();
			const base = repository(
				[
					row(23, "content:thread-1", {
						_tag: "DeleteMessage",
						messageId: "message-1",
						channelId: "thread-1",
						threadId: "thread-1",
						observedAt: 1_000,
					}),
				],
				observed,
			);
			const lostRepository = GatewayMutationRepository.of({
				...base,
				renew: (id) =>
					Effect.sync(() => observed.renewed.push(id)).pipe(
						Effect.andThen(
							Effect.fail(
								new GatewayMutationLeaseLostError({
									operation: "renew",
									mutationId: id,
								}),
							),
						),
					),
			});
			const service = coordinator((submission) =>
				Effect.succeed({
					_tag: "Accepted",
					receipt: {
						await: Effect.sleep("1500 millis").pipe(
							Effect.as({
								_tag: "Completed" as const,
								submissionId: submission.id,
								completedAt: 2_500,
							}),
						),
					},
				}),
			);
			const fiber = yield* Effect.forkChild(
				drainGatewayMutationBatch(options).pipe(
					Effect.provide(
						Layer.merge(
							Layer.succeed(GatewayMutationRepository, lostRepository),
							Layer.succeed(IndexingCoordinator, service),
						),
					),
				),
			);
			yield* TestClock.adjust("1500 millis");
			yield* Fiber.join(fiber);

			assert.deepEqual(observed.renewed, [23]);
			assert.deepEqual(observed.completed, []);
			assert.deepEqual(observed.deferred, []);
			assert.deepEqual(observed.releaseClaims, []);
		}),
	);

	it.effect(
		"retries enqueue after a database outage until it is stored",
		() => {
			let attempts = 0;
			const observed = calls();
			const service = repository([], observed);
			const retryingRepository = GatewayMutationRepository.of({
				...service,
				enqueue: () =>
					Effect.suspend(() => {
						attempts += 1;
						return attempts === 1
							? Effect.fail(
									new GatewayMutationRepositoryError({
										operation: "enqueue",
										cause: new Error("offline"),
									}),
								)
							: Effect.succeed(
									row(22, "content:thread-1", {
										_tag: "DeleteMessage",
										messageId: "message-1",
										channelId: "thread-1",
										threadId: "thread-1",
										observedAt: 1_000,
									}),
								);
					}),
			});
			const layer = layerGatewayMutationInbox(options).pipe(
				Layer.provide(
					Layer.merge(
						Layer.succeed(GatewayMutationRepository, retryingRepository),
						Layer.mergeAll(
							Layer.succeed(
								IndexingCoordinator,
								coordinator(() => Effect.die("unused")),
							),
							layerIndexingCoordinatorSupervisor,
							Readiness.layer,
						),
					),
				),
			);

			return Effect.gen(function* () {
				const inbox = yield* GatewayMutationInbox;
				const fiber = yield* Effect.forkChild(
					inbox.enqueue({
						id: "gateway:test:22",
						source: "gateway",
						orderingKey: "content:thread-1",
						mutation: {
							_tag: "DeleteMessage",
							messageId: "message-1",
							channelId: "thread-1",
							threadId: "thread-1",
							observedAt: 1_000,
						},
						submittedAt: 1_000,
					}),
				);
				yield* Effect.yieldNow;
				assert.equal(attempts, 1);
				yield* TestClock.adjust("10 millis");
				yield* Fiber.join(fiber);
				assert.equal(attempts, 2);
			}).pipe(Effect.provide(layer), Effect.scoped);
		},
	);
});
