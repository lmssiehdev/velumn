import { assert, describe, it } from "@effect/vitest";
import { Effect, Metric } from "effect";
import { Readiness } from "./readiness";

const readinessGauge = (component: string) =>
	Metric.snapshot.pipe(
		Effect.map((snapshots) => {
			const snapshot = snapshots.find(
				(metric) =>
					metric.id === "velumn_bot_readiness" &&
					metric.attributes?.component === component,
			);
			assert.equal(snapshot?.type, "Gauge");
			return snapshot?.type === "Gauge" ? snapshot.state.value : undefined;
		}),
	);

describe("Readiness", () => {
	it.effect("is ready only when every required subsystem is ready", () =>
		Effect.gen(function* () {
			const readiness = yield* Readiness;

			assert.deepEqual(yield* readiness.get, {
				ready: false,
				discord: false,
				commands: false,
				http: false,
				indexingCoordinator: false,
				gatewayMutationInbox: false,
				projector: false,
			});
			assert.equal(yield* readinessGauge("discord"), 0);
			assert.equal(yield* readinessGauge("service"), 0);

			yield* readiness.setDiscordReady(true);
			assert.isFalse((yield* readiness.get).ready);
			assert.equal(yield* readinessGauge("discord"), 1);
			assert.equal(yield* readinessGauge("service"), 0);

			yield* readiness.setCommandsReady(true);
			assert.isFalse((yield* readiness.get).ready);

			yield* readiness.setHttpReady(true);
			assert.isFalse((yield* readiness.get).ready);

			yield* readiness.setIndexingCoordinatorReady(true);
			assert.isFalse((yield* readiness.get).ready);

			yield* readiness.setGatewayMutationInboxReady(true);
			assert.isFalse((yield* readiness.get).ready);

			yield* readiness.setProjectorReady(true);
			assert.deepEqual(yield* readiness.get, {
				ready: true,
				discord: true,
				commands: true,
				http: true,
				indexingCoordinator: true,
				gatewayMutationInbox: true,
				projector: true,
			});
			assert.equal(yield* readinessGauge("projector"), 1);
			assert.equal(yield* readinessGauge("service"), 1);

			yield* readiness.setDiscordReady(false);
			assert.isFalse((yield* readiness.get).ready);
			assert.equal(yield* readinessGauge("discord"), 0);
			assert.equal(yield* readinessGauge("service"), 0);
		}).pipe(Effect.provide(Readiness.layer)),
	);
});
