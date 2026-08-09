import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ReconciliationJobs } from "./jobs";
import { layerReconciliationScheduler } from "./scheduler";

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
});
