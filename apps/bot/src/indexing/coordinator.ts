import {
	Cause,
	Clock,
	Context,
	Deferred,
	Effect,
	Exit,
	Fiber,
	FiberSet,
	Layer,
	Pull,
	RcMap,
	Semaphore,
	Scope,
	TxQueue,
	TxRef,
} from "effect";
import * as Duration from "effect/Duration";
import { BotMetrics } from "../observability/metrics";
import type {
	IndexCoordinatorState,
	IndexingOperationError,
	IndexMutation,
	IndexSubmission,
	IndexSubmissionResult,
	IndexTerminalOutcome,
	SubmissionReceipt,
} from "./model";

const admissionRetryDelay = "10 millis";
const gracefulShutdownTimeout = "3 seconds";

export interface IndexingCoordinatorOptions {
	readonly queueCapacity: number;
	readonly maxActivePartitions: number;
	readonly idleTimeToLive: Duration.Input;
}

export type ProcessIndexMutation<E, R = never> = (
	mutation: IndexMutation,
) => Effect.Effect<void, E, R>;

export interface IndexingCoordinatorService<E> {
	readonly submit: (
		submission: IndexSubmission,
	) => Effect.Effect<IndexSubmissionResult<E>>;
	readonly state: Effect.Effect<IndexCoordinatorState>;
	readonly close: Effect.Effect<void>;
}

type IndexAdmissionResult<E> = Exclude<
	IndexSubmissionResult<E>,
	{ readonly _tag: "Overloaded" }
>;

export const submitIndexingAdmission = <E>(
	coordinator: IndexingCoordinatorService<E>,
	submission: IndexSubmission,
): Effect.Effect<IndexAdmissionResult<E>> => {
	const retry = (): Effect.Effect<IndexAdmissionResult<E>> =>
		Effect.suspend(() =>
			coordinator
				.submit(submission)
				.pipe(
					Effect.flatMap((result) =>
						result._tag === "Overloaded"
							? Effect.sleep(admissionRetryDelay).pipe(Effect.andThen(retry()))
							: Effect.succeed(result),
					),
				),
		);

	return retry();
};

interface AcceptedItem<E> {
	readonly submission: IndexSubmission;
	readonly deferred: Deferred.Deferred<IndexTerminalOutcome<E>>;
	readonly lease: Scope.Closeable;
}

interface Worker<E> {
	readonly queue: TxQueue.TxQueue<AcceptedItem<E>, Cause.Done>;
	readonly fiber: Fiber.Fiber<void>;
}

const validateOptions = (options: IndexingCoordinatorOptions) => {
	if (!Number.isInteger(options.queueCapacity) || options.queueCapacity <= 0) {
		throw new RangeError("queueCapacity must be a positive integer");
	}
	if (
		!Number.isInteger(options.maxActivePartitions) ||
		options.maxActivePartitions <= 0
	) {
		throw new RangeError("maxActivePartitions must be a positive integer");
	}
	const idleTimeToLive = Duration.fromInputUnsafe(options.idleTimeToLive);
	if (
		!Duration.isFinite(idleTimeToLive) ||
		Duration.toMillis(idleTimeToLive) <= 0
	) {
		throw new RangeError("idleTimeToLive must be finite and greater than zero");
	}
};

export const makeIndexingCoordinator = <E, R>(
	options: IndexingCoordinatorOptions,
	processMutation: ProcessIndexMutation<E, R>,
): Effect.Effect<IndexingCoordinatorService<E>, never, Scope.Scope | R> =>
	Effect.gen(function* () {
		yield* Effect.sync(() => validateOptions(options));
		const coordinatorState = yield* TxRef.make<IndexCoordinatorState>({
			accepting: true,
			outstanding: 0,
		});
		const outstandingUpdates = yield* Semaphore.make(1);
		const drained = yield* Deferred.make<void>();
		yield* BotMetrics.setQueueDepth("indexing_outstanding", 0);

		const settleItem = Effect.fn("IndexingCoordinator.settleItem")(function* (
			item: AcceptedItem<E>,
			exit: Exit.Exit<void, E>,
		) {
			return yield* Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const outcome: IndexTerminalOutcome<E> = Exit.isSuccess(exit)
					? {
							_tag: "Completed",
							submissionId: item.submission.id,
							completedAt: now,
						}
					: {
							_tag: "Failed",
							submissionId: item.submission.id,
							failedAt: now,
							cause: exit.cause,
						};

				const isDrained = yield* outstandingUpdates.withPermits(1)(
					TxRef.modify(coordinatorState, (state) => {
						const next = { ...state, outstanding: state.outstanding - 1 };
						return [
							{
								isDrained: !next.accepting && next.outstanding === 0,
								outstanding: next.outstanding,
							},
							next,
						];
					}).pipe(
						Effect.flatMap(({ isDrained, outstanding }) =>
							BotMetrics.setQueueDepth(
								"indexing_outstanding",
								outstanding,
							).pipe(Effect.as(isDrained)),
						),
					),
				);
				yield* Deferred.succeed(item.deferred, outcome);
				if (isDrained) yield* Deferred.succeed(drained, undefined);
			}).pipe(
				Effect.ensuring(Scope.close(item.lease, Exit.void)),
				Effect.uninterruptible,
			);
		});

		const makeWorker = Effect.fn("IndexingCoordinator.makeWorker")(function* (
			_orderingKey: string,
		): Effect.fn.Return<Worker<E>, never, Scope.Scope | R> {
			const queue = yield* TxQueue.bounded<AcceptedItem<E>, Cause.Done>(
				options.queueCapacity,
			);
			const takeAndProcess = Effect.uninterruptibleMask((restore) =>
				restore(TxQueue.take(queue)).pipe(
					Effect.flatMap((item) =>
						restore(processMutation(item.submission.mutation)).pipe(
							Effect.onExit((exit) => settleItem(item, exit)),
							Effect.exit,
							Effect.asVoid,
						),
					),
				),
			);
			const run: Effect.Effect<void, never, R> = Effect.suspend(() =>
				takeAndProcess.pipe(Effect.andThen(run)),
			).pipe(Pull.catchDone(() => Effect.void));
			const fiber = yield* Effect.forkScoped(run);

			return yield* Effect.acquireRelease(
				Effect.succeed({ queue, fiber } satisfies Worker<E>),
				(worker) =>
					Effect.gen(function* () {
						yield* TxQueue.end(worker.queue);
						const queued = yield* TxQueue.clear(worker.queue);
						yield* Fiber.interrupt(worker.fiber);
						yield* Effect.forEach(
							queued,
							(item) => settleItem(item, Exit.interrupt()),
							{ discard: true },
						);
					}),
			);
		});

		const workers = yield* RcMap.make({
			lookup: makeWorker,
			capacity: options.maxActivePartitions,
			idleTimeToLive: options.idleTimeToLive,
		});

		const close = Effect.uninterruptibleMask((restore) =>
			Effect.gen(function* () {
				const alreadyDrained = yield* TxRef.modify(
					coordinatorState,
					(state) => [state.outstanding === 0, { ...state, accepting: false }],
				);
				if (alreadyDrained) yield* Deferred.succeed(drained, undefined);
				yield* restore(Deferred.await(drained));
			}),
		);
		yield* Effect.addFinalizer(() =>
			close.pipe(
				Effect.timeout(gracefulShutdownTimeout),
				Effect.catchTag("TimeoutError", () =>
					TxRef.get(coordinatorState).pipe(
						Effect.flatMap((state) =>
							Effect.logWarning(
								"Timed out waiting for indexing coordinator to drain",
								{ outstanding: state.outstanding },
							),
						),
					),
				),
			),
		);

		const submit = Effect.fn("IndexingCoordinator.submit")(function* (
			submission: IndexSubmission,
		) {
			const accepting = yield* TxRef.get(coordinatorState);
			if (!accepting.accepting) {
				return { _tag: "Closing" } as const;
			}

			return yield* Effect.uninterruptibleMask((restore) =>
				Effect.gen(function* () {
					const lease = yield* Scope.make();
					let transferred = false;
					return yield* Effect.gen(function* () {
						const worker = yield* restore(
							RcMap.get(workers, submission.orderingKey).pipe(
								Scope.provide(lease),
								Effect.catch((error) =>
									Cause.isExceededCapacityError(error)
										? Effect.succeed(undefined)
										: Effect.fail(error),
								),
							),
						);
						if (worker === undefined) {
							return { _tag: "Overloaded" } as const;
						}

						const deferred = yield* Deferred.make<IndexTerminalOutcome<E>>();
						const item: AcceptedItem<E> = { submission, deferred, lease };
						const result = yield* outstandingUpdates.withPermits(1)(
							Effect.gen(function* () {
								const result = yield* Effect.gen(function* () {
									const state = yield* TxRef.get(coordinatorState);
									if (
										!state.accepting ||
										!(yield* TxQueue.isOpen(worker.queue))
									) {
										return { _tag: "Closing" } as const;
									}
									if (yield* TxQueue.isFull(worker.queue)) {
										return { _tag: "Overloaded" } as const;
									}
									if (!(yield* TxQueue.offer(worker.queue, item))) {
										return { _tag: "Closing" } as const;
									}
									const outstanding = state.outstanding + 1;
									yield* TxRef.set(coordinatorState, {
										...state,
										outstanding,
									});
									return { _tag: "Accepted", outstanding } as const;
								}).pipe(Effect.tx);
								if (result._tag === "Accepted") {
									yield* BotMetrics.setQueueDepth(
										"indexing_outstanding",
										result.outstanding,
									);
								}
								return result._tag;
							}),
						);

						if (result !== "Accepted") {
							return { _tag: result } as const;
						}
						transferred = true;
						const receipt: SubmissionReceipt<E> = {
							await: Deferred.await(deferred),
						};
						return { _tag: "Accepted", receipt } as const;
					}).pipe(
						Effect.ensuring(
							Effect.suspend(() =>
								transferred ? Effect.void : Scope.close(lease, Exit.void),
							),
						),
					);
				}),
			);
		});

		return {
			submit,
			state: TxRef.get(coordinatorState),
			close,
		};
	});

export class IndexMutationProcessor extends Context.Service<
	IndexMutationProcessor,
	{
		readonly process: ProcessIndexMutation<IndexingOperationError>;
	}
>()("bot/indexing/IndexMutationProcessor") {}

export class IndexingCoordinator extends Context.Service<
	IndexingCoordinator,
	IndexingCoordinatorService<IndexingOperationError>
>()("bot/indexing/IndexingCoordinator") {}

export class IndexingCoordinatorSupervisor extends Context.Service<
	IndexingCoordinatorSupervisor,
	{
		readonly fork: <A, R>(
			effect: Effect.Effect<A, never, R>,
		) => Effect.Effect<Fiber.Fiber<A>, never, R>;
	}
>()("bot/indexing/IndexingCoordinatorSupervisor") {}

export const layerIndexMutationProcessor = (
	process: ProcessIndexMutation<IndexingOperationError>,
) => Layer.succeed(IndexMutationProcessor, { process });

// Building this dependency first makes LIFO shutdown settle coordinator receipts
// before interrupting dependent fibers that may be waiting for those receipts.
export const layerIndexingCoordinatorSupervisor = Layer.effect(
	IndexingCoordinatorSupervisor,
	Effect.gen(function* () {
		const fibers = yield* FiberSet.make<unknown, never>();
		return IndexingCoordinatorSupervisor.of({
			fork: (effect) => FiberSet.run(fibers, effect),
		});
	}),
);

export const layerIndexingCoordinator = (options: IndexingCoordinatorOptions) =>
	Layer.effect(
		IndexingCoordinator,
		Effect.gen(function* () {
			const processor = yield* IndexMutationProcessor;
			return yield* makeIndexingCoordinator(options, processor.process);
		}),
	).pipe(Layer.provideMerge(layerIndexingCoordinatorSupervisor));
