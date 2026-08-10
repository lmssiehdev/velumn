import { Cause, Context, Cron, Effect, Exit, Layer, Schedule } from "effect";
import { ErrorCapture } from "../observability/error-capture";
import { safeBoundaryMetadata } from "../observability/policy";
import { ReconciliationJobs } from "./jobs";

export interface ReconciliationSchedulerOptions {
	readonly enabled: boolean;
	readonly cron: string;
	readonly timeZone?: string;
	readonly runOnStartup: boolean;
}

export const conservativeReconciliationSchedulerOptions: ReconciliationSchedulerOptions =
	{
		enabled: true,
		cron: "0 3 * * *",
		timeZone: "UTC",
		runOnStartup: false,
	};

export class ReconciliationScheduler extends Context.Service<
	ReconciliationScheduler,
	true
>()("velumn/bot/indexing/ReconciliationScheduler") {}

export const layerReconciliationScheduler = (
	options: ReconciliationSchedulerOptions = conservativeReconciliationSchedulerOptions,
) =>
	Layer.effect(
		ReconciliationScheduler,
		Effect.gen(function* () {
			const jobs = yield* ReconciliationJobs;
			const errorCapture = yield* ErrorCapture;
			const repaired = yield* jobs.repairStartup;
			if (repaired.length > 0) {
				yield* Effect.logWarning("Repaired interrupted reconciliation jobs", {
					count: repaired.length,
				});
			}
			if (!options.enabled) return true as const;
			const cron = yield* Effect.fromResult(
				Cron.parse(options.cron, options.timeZone),
			);
			const tick = jobs.startScheduled().pipe(
				Effect.tap((job) =>
					Effect.annotateCurrentSpan({
						"operation.outcome": "completed",
						jobId: job.id,
					}).pipe(
						Effect.andThen(
							Effect.logInfo("Scheduled reconciliation job", {
								jobId: job.id,
							}),
						),
					),
				),
				Effect.tapError((error) =>
					Effect.annotateCurrentSpan({
						"operation.outcome": "recovered",
						"error.type": error._tag,
						"error.classification": error.operation,
					}),
				),
				Effect.withSpan("scheduler.tick", {
					root: true,
					attributes: { "operation.name": "scheduler.tick" },
				}),
				Effect.catch((error) =>
					Effect.logError(
						"Failed to schedule reconciliation job",
						safeBoundaryMetadata(Cause.fail(error), {
							boundary: "scheduler_start_job",
						}),
					),
				),
			);
			if (options.runOnStartup) yield* tick;

			const schedule = Schedule.cron(cron);
			let initialTick = true;
			yield* Effect.forkScoped(
				Effect.suspend(() => {
					if (initialTick) {
						initialTick = false;
						return Effect.void;
					}
					return tick;
				}).pipe(
					Effect.repeat(schedule),
					Effect.onExit((exit) => {
						if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
							return Effect.void;
						}
						const cause = Exit.isFailure(exit)
							? exit.cause
							: Cause.die(new Error("Scheduler completed"));
						return errorCapture
							.captureCause(cause, {
								boundary: "scheduler_poll_fiber",
								operation: "scheduler.poll",
							})
							.pipe(Effect.asVoid);
					}),
				),
			);
			return true as const;
		}),
	);
