import { assert, describe, it } from "@effect/vitest";
import { Client, Events, type Client as ReadyClient } from "discord.js";
import { Deferred, Effect, Exit, Fiber, Redacted, Ref, Scope } from "effect";
import { makeDiscordClient } from "./client";
import { makeDiscordEvents } from "./events";

const makeTestClient = () => new Client({ intents: [] });

describe("Discord lifecycle", () => {
	it.effect("removes plain listeners when their scope closes", () =>
		Effect.gen(function* () {
			const client = makeTestClient();
			const scope = yield* Scope.make();
			const events = yield* makeDiscordEvents(client).pipe(
				Scope.provide(scope),
			);
			let calls = 0;

			yield* events
				.on(Events.Debug, () => {
					calls += 1;
				})
				.pipe(Scope.provide(scope));

			client.emit(Events.Debug, "before close");
			assert.strictEqual(calls, 1);

			yield* Scope.close(scope, Exit.void);
			client.emit(Events.Debug, "after close");
			assert.strictEqual(calls, 1);
			yield* Effect.promise(() => client.destroy());
		}),
	);

	it.effect("drains active effectful listeners before closing", () =>
		Effect.gen(function* () {
			const client = makeTestClient();
			const scope = yield* Scope.make();
			const events = yield* makeDiscordEvents(client).pipe(
				Scope.provide(scope),
			);
			const started = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const completed = yield* Ref.make(false);

			yield* events
				.forkOn(Events.Debug, () =>
					Effect.gen(function* () {
						yield* Deferred.succeed(started, undefined);
						yield* Deferred.await(release);
						yield* Ref.set(completed, true);
					}),
				)
				.pipe(Scope.provide(scope));

			client.emit(Events.Debug, "drain");
			yield* Deferred.await(started);
			const closeFiber = yield* Effect.forkChild(Scope.close(scope, Exit.void));
			yield* Effect.yieldNow;
			yield* Deferred.succeed(release, undefined);
			yield* Fiber.join(closeFiber);

			assert.isTrue(yield* Ref.get(completed));
			yield* Effect.promise(() => client.destroy());
		}),
	);

	it.effect("destroys the Discord client when its scope closes", () =>
		Effect.gen(function* () {
			const client = makeTestClient();
			const scope = yield* Scope.make();
			let destroyed = false;
			client.destroy = async () => {
				destroyed = true;
			};

			const service = yield* makeDiscordClient(Redacted.make("test-token"), {
				makeClient: () => client,
				login: async (loginClient) => {
					queueMicrotask(() => {
						loginClient.emit(
							Events.ClientReady,
							loginClient as ReadyClient<true>,
						);
					});
					return "test-token";
				},
			}).pipe(Scope.provide(scope));

			assert.strictEqual(service.client, client);
			assert.isFalse(destroyed);

			yield* Scope.close(scope, Exit.void);
			assert.isTrue(destroyed);
		}),
	);
});
