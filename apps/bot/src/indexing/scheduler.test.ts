import { assert, describe, it } from "@effect/vitest";
import { Cron, Effect, Exit, Layer, Logger, Scope, Tracer } from "effect";
import { TestClock } from "effect/testing";
import { IndexingRepositoryError } from "../adapters/indexing-repository";
import { ErrorCapture } from "../observability/error-capture";
import { ReconciliationJobs, type ReconciliationJobsService } from "./jobs";
import { layerReconciliationScheduler } from "./scheduler";

const jobsLayer = (
	startScheduled: ReconciliationJobsService["startScheduled"] = () =>
		Effect.die("unused"),
) =>
	Layer.succeed(
		ReconciliationJobs,
		ReconciliationJobs.of({
			repairStartup: Effect.succeed([]),
			startGuild: () => Effect.die("unused"),
			startThread: () => Effect.die("unused"),
			startScheduled,
			get: () => Effect.die("unused"),
			cancel: () => Effect.die("unused"),
		}),
	);

describe("reconciliation scheduler", () => {
	it.effect("repairs startup jobs even when recurring work is disabled", () =>
		Effect.gen(function* () {
			let repairs = 0;
			let starts = 0;
			const jobs = Layer.succeed(
				ReconciliationJobs,
				ReconciliationJobs.of({
					repairStartup: Effect.sync(() => {
						repairs += 1;
						return [];
					}),
					startGuild: () => Effect.die("unused"),
					startThread: () => Effect.die("unused"),
					startScheduled: () =>
						Effect.sync(() => {
							starts += 1;
							return null as never;
						}),
					get: () => Effect.die("unused"),
					cancel: () => Effect.die("unused"),
				}),
			);
			yield* Layer.build(
				layerReconciliationScheduler({
					enabled: false,
					cron: "0 3 * * *",
					timeZone: "UTC",
					runOnStartup: false,
				}).pipe(Layer.provide(jobs)),
			).pipe(Effect.scoped);
			assert.equal(repairs, 1);
			assert.equal(starts, 0);
		}),
	);

	it.effect("fails layer acquisition for an invalid cron expression", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				Layer.build(
					layerReconciliationScheduler({
						enabled: true,
						cron: "not a cron",
						timeZone: "UTC",
						runOnStartup: false,
					}).pipe(Layer.provide(jobsLayer())),
				).pipe(Effect.scoped),
			);

			assert.isTrue(Cron.isCronParseError(error));
		}),
	);

	it.effect("cancels recurring work when its scope closes", () =>
		Effect.gen(function* () {
			let starts = 0;
			const scope = yield* Scope.make();
			yield* TestClock.setTime(0);
			yield* Layer.build(
				layerReconciliationScheduler({
					enabled: true,
					cron: "* * * * * *",
					timeZone: "UTC",
					runOnStartup: false,
				}).pipe(
					Layer.provide(
						jobsLayer(() =>
							Effect.sync(() => {
								starts += 1;
								return null as never;
							}),
						),
					),
				),
			).pipe(Scope.provide(scope));

			yield* TestClock.adjust("1 second");
			assert.equal(starts, 1);
			yield* Scope.close(scope, Exit.void);
			yield* TestClock.adjust("10 seconds");
			assert.equal(starts, 1);
		}),
	);

	it.effect("annotates a recovered scheduler tick failure", () =>
		Effect.gen(function* () {
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});
			const scope = yield* Scope.make();
			yield* TestClock.setTime(0);
			yield* Layer.build(
				layerReconciliationScheduler({
					enabled: true,
					cron: "* * * * * *",
					timeZone: "UTC",
					runOnStartup: false,
				}).pipe(
					Layer.provide(
						jobsLayer(() =>
							Effect.fail(
								new IndexingRepositoryError({
									operation: "create-job",
									cause: new Error("database unavailable"),
								}),
							),
						),
					),
				),
			).pipe(
				Scope.provide(scope),
				Effect.provideService(Tracer.Tracer, tracer),
			);
			yield* TestClock.adjust("1 second");
			const tick = spans.find((span) => span.name === "scheduler.tick");
			assert.equal(tick?.attributes.get("operation.outcome"), "recovered");
			assert.equal(
				tick?.attributes.get("error.type"),
				"IndexingRepositoryError",
			);
			assert.equal(tick?.attributes.get("error.classification"), "create-job");
			yield* Scope.close(scope, Exit.void);
		}),
	);

	it.effect("captures unexpected scheduler fiber termination once", () => {
		const logs: string[] = [];
		const reports: string[] = [];
		const logger = Logger.make<unknown, void>(({ message }) => {
			logs.push(String(Array.isArray(message) ? message[0] : message));
		});

		return Effect.gen(function* () {
			const scope = yield* Scope.make();
			yield* TestClock.setTime(0);
			yield* Layer.build(
				layerReconciliationScheduler({
					enabled: true,
					cron: "* * * * * *",
					timeZone: "UTC",
					runOnStartup: false,
				}).pipe(
					Layer.provide(jobsLayer(() => Effect.die("scheduler fiber failed"))),
				),
			).pipe(Scope.provide(scope));

			yield* TestClock.adjust("1 second");
			assert.notInclude(
				logs,
				"Reconciliation scheduler terminated unexpectedly",
			);
			yield* Scope.close(scope, Exit.void);
		}).pipe(
			Effect.provide(Logger.layer([logger])),
			Effect.provideService(ErrorCapture, {
				captureCause: (_cause, context) =>
					Effect.sync(() => {
						reports.push(context.boundary);
						return undefined;
					}),
			}),
			Effect.tap(() =>
				Effect.sync(() => {
					assert.deepEqual(reports, ["scheduler_poll_fiber"]);
				}),
			),
		);
	});
});
