import { Context, Effect, Layer, Schedule } from "effect";
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
			const repaired = yield* jobs.repairStartup;
			if (repaired.length > 0) {
				yield* Effect.logWarning("Repaired interrupted reconciliation jobs", {
					count: repaired.length,
				});
			}
			if (!options.enabled) return true as const;
			if (options.runOnStartup) yield* jobs.startScheduled();

			const schedule = Schedule.cron(options.cron, options.timeZone);
			let initialTick = true;
			yield* Effect.forkScoped(
				Effect.suspend(() => {
					if (initialTick) {
						initialTick = false;
						return Effect.void;
					}
					return jobs.startScheduled().pipe(
						Effect.tap((job) =>
							Effect.logInfo("Scheduled reconciliation job", { jobId: job.id }),
						),
						Effect.catch((cause) =>
							Effect.logError("Failed to schedule reconciliation job", {
								cause,
							}),
						),
					);
				}).pipe(Effect.repeat(schedule)),
			);
			return true as const;
		}),
	);
