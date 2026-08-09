import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { Readiness } from "./readiness";

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

			yield* readiness.setDiscordReady(true);
			assert.isFalse((yield* readiness.get).ready);

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

			yield* readiness.setDiscordReady(false);
			assert.isFalse((yield* readiness.get).ready);
		}).pipe(Effect.provide(Readiness.layer)),
	);
});
