import { assert, describe, it } from "@effect/vitest";
import {
	Cause,
	Deferred,
	Effect,
	Exit,
	Fiber,
	Metric,
	Option,
	Scope,
} from "effect";
import { TestClock } from "effect/testing";
import {
	makeIndexingCoordinator,
	submitIndexingAdmission,
} from "./coordinator";
import type {
	IndexMutation,
	IndexSubmission,
	IndexSubmissionResult,
} from "./model";

const mutation = (messageId: string): IndexMutation => ({
	_tag: "UpsertMessage",
	messageId,
	channelId: "channel",
	threadId: null,
	observedAt: 0,
});

const submission = (id: string, orderingKey = "key"): IndexSubmission => ({
	id,
	source: "gateway",
	orderingKey,
	mutation: mutation(id),
	submittedAt: 0,
});

const messageIdOf = (item: IndexMutation): string => {
	assert.equal(item._tag, "UpsertMessage");
	if (item._tag !== "UpsertMessage")
		throw new Error("expected message mutation");
	return item.messageId;
};

const options = {
	queueCapacity: 4,
	maxActivePartitions: 4,
	idleTimeToLive: "1 second" as const,
};

const acceptedReceipt = <E>(result: IndexSubmissionResult<E>) => {
	assert.equal(result._tag, "Accepted");
	if (result._tag !== "Accepted")
		throw new Error("submission was not accepted");
	return result.receipt.await;
};

const indexingQueueDepth = Metric.snapshot.pipe(
	Effect.map((snapshots) => {
		const snapshot = snapshots.find(
			(metric) =>
				metric.id === "velumn_bot_queue_depth" &&
				metric.attributes?.queue === "indexing_outstanding",
		);
		assert.equal(snapshot?.type, "Gauge");
		return snapshot?.type === "Gauge" ? snapshot.state.value : undefined;
	}),
);

describe("indexing coordinator", () => {
	it.effect("publishes authoritative outstanding queue depth", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const started = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const coordinator = yield* makeIndexingCoordinator(options, () =>
					Deferred.succeed(started, undefined).pipe(
						Effect.andThen(Deferred.await(release)),
					),
				);

				assert.equal(yield* indexingQueueDepth, 0);
				const first = yield* coordinator.submit(submission("depth-1"));
				yield* Deferred.await(started);
				assert.equal(yield* indexingQueueDepth, 1);
				const second = yield* coordinator.submit(submission("depth-2"));
				assert.equal(yield* indexingQueueDepth, 2);

				yield* Deferred.succeed(release, undefined);
				yield* Effect.all([acceptedReceipt(first), acceptedReceipt(second)]);
				assert.equal(yield* indexingQueueDepth, 0);
			}),
		),
	);

	it.effect("processes concurrent submissions for one key in exact order", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const firstStarted = yield* Deferred.make<void>();
				const releaseFirst = yield* Deferred.make<void>();
				const order: Array<string> = [];
				let active = 0;
				let maximumActive = 0;
				const coordinator = yield* makeIndexingCoordinator(options, (item) =>
					Effect.gen(function* () {
						active += 1;
						maximumActive = Math.max(maximumActive, active);
						order.push(messageIdOf(item));
						if (messageIdOf(item) === "1") {
							yield* Deferred.succeed(firstStarted, undefined);
							yield* Deferred.await(releaseFirst);
						}
						active -= 1;
					}),
				);

				const first = yield* coordinator.submit(submission("1"));
				yield* Deferred.await(firstStarted);
				const queued = yield* Effect.all(
					[
						coordinator.submit(submission("2")),
						coordinator.submit(submission("3")),
					],
					{ concurrency: "unbounded" },
				);
				yield* Deferred.succeed(releaseFirst, undefined);
				yield* Effect.all([
					acceptedReceipt(first),
					...queued.map(acceptedReceipt),
				]);

				assert.deepEqual(order, ["1", "2", "3"]);
				assert.equal(maximumActive, 1);
			}),
		),
	);

	it.effect("runs independent keys independently", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const aStarted = yield* Deferred.make<void>();
				const releaseA = yield* Deferred.make<void>();
				const completed: Array<string> = [];
				const coordinator = yield* makeIndexingCoordinator(options, (item) =>
					Effect.gen(function* () {
						if (messageIdOf(item) === "a") {
							yield* Deferred.succeed(aStarted, undefined);
							yield* Deferred.await(releaseA);
						}
						completed.push(messageIdOf(item));
					}),
				);

				const a = yield* coordinator.submit(submission("a", "a"));
				yield* Deferred.await(aStarted);
				const b = yield* coordinator.submit(submission("b", "b"));
				const bOutcome = yield* acceptedReceipt(b);
				assert.equal(bOutcome._tag, "Completed");
				assert.deepEqual(completed, ["b"]);

				yield* Deferred.succeed(releaseA, undefined);
				yield* acceptedReceipt(a);
				assert.deepEqual(completed, ["b", "a"]);
			}),
		),
	);

	it.effect(
		"reports queue overload and closing without accepting more work",
		() =>
			Effect.gen(function* () {
				const scope = yield* Scope.make();
				const started = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const coordinator = yield* makeIndexingCoordinator(
					{ ...options, queueCapacity: 1 },
					() =>
						Effect.gen(function* () {
							yield* Deferred.succeed(started, undefined);
							yield* Deferred.await(release);
						}),
				).pipe(Scope.provide(scope));

				const first = yield* coordinator.submit(submission("1"));
				yield* Deferred.await(started);
				const second = yield* coordinator.submit(submission("2"));
				assert.equal(second._tag, "Accepted");
				assert.deepEqual(yield* coordinator.submit(submission("3")), {
					_tag: "Overloaded",
				});

				const closeFiber = yield* Effect.forkChild(coordinator.close);
				const awaitClosing: Effect.Effect<void> = Effect.suspend(() =>
					coordinator.state.pipe(
						Effect.flatMap((state) =>
							state.accepting
								? Effect.yieldNow.pipe(Effect.andThen(awaitClosing))
								: Effect.void,
						),
					),
				);
				yield* awaitClosing;
				assert.deepEqual(yield* coordinator.submit(submission("4")), {
					_tag: "Closing",
				});
				yield* Deferred.succeed(release, undefined);
				yield* acceptedReceipt(first);
				if (second._tag === "Accepted") yield* second.receipt.await;
				yield* Fiber.join(closeFiber);
				yield* Scope.close(scope, Exit.void);
			}),
	);

	it.effect("backpressures admission until queue capacity is available", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const firstStarted = yield* Deferred.make<void>();
				const releaseFirst = yield* Deferred.make<void>();
				const processed: string[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					{ ...options, queueCapacity: 1 },
					(item) =>
						Effect.gen(function* () {
							processed.push(messageIdOf(item));
							if (messageIdOf(item) === "1") {
								yield* Deferred.succeed(firstStarted, undefined);
								yield* Deferred.await(releaseFirst);
							}
						}),
				);

				const first = yield* coordinator.submit(submission("1"));
				yield* Deferred.await(firstStarted);
				const second = yield* coordinator.submit(submission("2"));
				const admissionFiber = yield* Effect.forkChild(
					submitIndexingAdmission(coordinator, submission("3")),
				);
				yield* Effect.yieldNow;
				assert.equal((yield* coordinator.state).outstanding, 2);

				yield* Deferred.succeed(releaseFirst, undefined);
				yield* TestClock.adjust("10 millis");
				const admitted = yield* Fiber.join(admissionFiber);
				assert.equal(admitted._tag, "Accepted");
				if (admitted._tag === "Accepted") yield* admitted.receipt.await;
				yield* Effect.all([acceptedReceipt(first), acceptedReceipt(second)]);
				assert.deepEqual(processed, ["1", "2", "3"]);
			}),
		),
	);

	it.effect("terminates backpressured admission when closing begins", () =>
		Effect.gen(function* () {
			const scope = yield* Scope.make();
			const started = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const coordinator = yield* makeIndexingCoordinator(
				{ ...options, queueCapacity: 1 },
				() =>
					Deferred.succeed(started, undefined).pipe(
						Effect.andThen(Deferred.await(release)),
					),
			).pipe(Scope.provide(scope));
			const first = yield* coordinator.submit(submission("1"));
			yield* Deferred.await(started);
			const second = yield* coordinator.submit(submission("2"));
			const admissionFiber = yield* Effect.forkChild(
				submitIndexingAdmission(coordinator, submission("3")),
			);
			yield* Effect.yieldNow;
			const closeFiber = yield* Effect.forkChild(coordinator.close);
			yield* Effect.yieldNow;
			yield* TestClock.adjust("10 millis");
			assert.deepEqual(yield* Fiber.join(admissionFiber), { _tag: "Closing" });

			yield* Deferred.succeed(release, undefined);
			yield* Effect.all([acceptedReceipt(first), acceptedReceipt(second)]);
			yield* Fiber.join(closeFiber);
			yield* Scope.close(scope, Exit.void);
		}),
	);

	it.effect("interrupting backpressured admission leaves no queued work", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const started = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const processed: string[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					{ ...options, queueCapacity: 1 },
					(item) =>
						Effect.gen(function* () {
							processed.push(messageIdOf(item));
							if (messageIdOf(item) === "1") {
								yield* Deferred.succeed(started, undefined);
								yield* Deferred.await(release);
							}
						}),
				);
				const first = yield* coordinator.submit(submission("1"));
				yield* Deferred.await(started);
				const second = yield* coordinator.submit(submission("2"));
				const admissionFiber = yield* Effect.forkChild(
					submitIndexingAdmission(coordinator, submission("never-admitted")),
				);
				yield* Effect.yieldNow;
				yield* Fiber.interrupt(admissionFiber);
				yield* Deferred.succeed(release, undefined);
				yield* Effect.all([acceptedReceipt(first), acceptedReceipt(second)]);
				yield* TestClock.adjust("1 second");

				assert.deepEqual(processed, ["1", "2"]);
				assert.equal((yield* coordinator.state).outstanding, 0);
			}),
		),
	);

	it.effect("preserves failures in receipts and keeps the worker alive", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const coordinator = yield* makeIndexingCoordinator(options, (item) =>
					messageIdOf(item) === "bad"
						? Effect.fail("worker failed")
						: messageIdOf(item) === "defect"
							? Effect.die("worker defect")
							: Effect.void,
				);
				const failed = yield* coordinator.submit(submission("bad"));
				const defect = yield* coordinator.submit(submission("defect"));
				const succeeded = yield* coordinator.submit(submission("good"));

				const failedOutcome = yield* acceptedReceipt(failed);
				const defectOutcome = yield* acceptedReceipt(defect);
				const succeededOutcome = yield* acceptedReceipt(succeeded);
				assert.equal(failedOutcome._tag, "Failed");
				if (failedOutcome._tag === "Failed") {
					assert.equal(
						Option.getOrUndefined(Cause.findErrorOption(failedOutcome.cause)),
						"worker failed",
					);
				}
				assert.equal(defectOutcome._tag, "Failed");
				if (defectOutcome._tag === "Failed") {
					assert.isTrue(Cause.hasDies(defectOutcome.cause));
				}
				assert.equal(succeededOutcome._tag, "Completed");
				assert.equal((yield* coordinator.state).outstanding, 0);
			}),
		),
	);

	it.effect(
		"settles accepted work when its mutation scope is forcibly interrupted",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const mutationScope = yield* Deferred.make<Scope.Closeable>();
					const coordinator = yield* makeIndexingCoordinator(
						options,
						(item) => {
							if (messageIdOf(item) !== "interrupt") return Effect.void;
							return Effect.gen(function* () {
								const scope = yield* Scope.make();
								const fiber = yield* Effect.forkScoped(Effect.never).pipe(
									Scope.provide(scope),
								);
								yield* Deferred.succeed(mutationScope, scope);
								return yield* Fiber.join(fiber);
							});
						},
					);

					const interrupted = yield* coordinator.submit(
						submission("interrupt"),
					);
					const scope = yield* Deferred.await(mutationScope);
					yield* Scope.close(scope, Exit.interrupt());
					const interruptedOutcome = yield* acceptedReceipt(interrupted);
					assert.equal(interruptedOutcome._tag, "Failed");
					if (interruptedOutcome._tag === "Failed") {
						assert.isTrue(Cause.hasInterrupts(interruptedOutcome.cause));
					}

					const next = yield* coordinator.submit(submission("next"));
					assert.equal((yield* acceptedReceipt(next))._tag, "Completed");
					assert.equal((yield* coordinator.state).outstanding, 0);
				}),
			),
	);

	it.effect("scope shutdown closes intake and drains accepted work", () =>
		Effect.gen(function* () {
			const scope = yield* Scope.make();
			const started = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const completed = yield* Deferred.make<void>();
			const coordinator = yield* makeIndexingCoordinator(options, () =>
				Deferred.succeed(started, undefined).pipe(
					Effect.andThen(Deferred.await(release)),
					Effect.andThen(Deferred.succeed(completed, undefined)),
				),
			).pipe(Scope.provide(scope));
			const accepted = yield* coordinator.submit(submission("shutdown"));
			yield* Deferred.await(started);

			const closeFiber = yield* Effect.forkChild(Scope.close(scope, Exit.void));
			const awaitClosing: Effect.Effect<void> = Effect.suspend(() =>
				coordinator.state.pipe(
					Effect.flatMap((state) =>
						state.accepting
							? Effect.yieldNow.pipe(Effect.andThen(awaitClosing))
							: Effect.void,
					),
				),
			);
			yield* awaitClosing;
			assert.equal(
				(yield* coordinator.submit(submission("late")))._tag,
				"Closing",
			);
			yield* TestClock.adjust("2 seconds");
			assert.isUndefined(closeFiber.pollUnsafe());

			yield* Deferred.succeed(release, undefined);
			assert.equal((yield* acceptedReceipt(accepted))._tag, "Completed");
			yield* Fiber.join(closeFiber);
			assert.isTrue(yield* Deferred.isDone(completed));
		}),
	);

	it.effect("scope shutdown interrupts workers after the drain deadline", () =>
		Effect.gen(function* () {
			const scope = yield* Scope.make();
			const started = yield* Deferred.make<void>();
			const interrupted = yield* Deferred.make<void>();
			const coordinator = yield* makeIndexingCoordinator(options, () =>
				Deferred.succeed(started, undefined).pipe(
					Effect.andThen(Effect.never),
					Effect.ensuring(Deferred.succeed(interrupted, undefined)),
				),
			).pipe(Scope.provide(scope));
			const active = yield* coordinator.submit(submission("active"));
			yield* Deferred.await(started);
			const queued = yield* coordinator.submit(submission("queued"));

			const closeFiber = yield* Effect.forkChild(Scope.close(scope, Exit.void));
			const awaitClosing: Effect.Effect<void> = Effect.suspend(() =>
				coordinator.state.pipe(
					Effect.flatMap((state) =>
						state.accepting
							? Effect.yieldNow.pipe(Effect.andThen(awaitClosing))
							: Effect.void,
					),
				),
			);
			yield* awaitClosing;
			assert.isFalse(yield* Deferred.isDone(interrupted));

			yield* TestClock.adjust("3 seconds");
			yield* Fiber.join(closeFiber);
			assert.isTrue(yield* Deferred.isDone(interrupted));

			const activeOutcome = yield* acceptedReceipt(active);
			const queuedOutcome = yield* acceptedReceipt(queued);
			assert.equal(activeOutcome._tag, "Failed");
			assert.equal(queuedOutcome._tag, "Failed");
			if (activeOutcome._tag === "Failed") {
				assert.isTrue(Cause.hasInterrupts(activeOutcome.cause));
			}
			if (queuedOutcome._tag === "Failed") {
				assert.isTrue(Cause.hasInterrupts(queuedOutcome.cause));
			}
			assert.equal((yield* coordinator.state).outstanding, 0);
		}),
	);

	it.effect("evicts idle workers and releases partition capacity", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const firstStarted = yield* Deferred.make<void>();
				const releaseFirst = yield* Deferred.make<void>();
				const coordinator = yield* makeIndexingCoordinator(
					{ ...options, maxActivePartitions: 1 },
					(item) =>
						messageIdOf(item) === "a"
							? Deferred.succeed(firstStarted, undefined).pipe(
									Effect.andThen(Deferred.await(releaseFirst)),
								)
							: Effect.void,
				);

				const first = yield* coordinator.submit(submission("a", "a"));
				yield* Deferred.await(firstStarted);
				assert.equal(
					(yield* coordinator.submit(submission("b", "b")))._tag,
					"Overloaded",
				);
				yield* Deferred.succeed(releaseFirst, undefined);
				yield* acceptedReceipt(first);
				yield* TestClock.adjust("1 second");
				yield* Effect.yieldNow;

				const afterEviction = yield* coordinator.submit(submission("b", "b"));
				assert.equal(afterEviction._tag, "Accepted");
				yield* acceptedReceipt(afterEviction);
			}),
		),
	);
});
