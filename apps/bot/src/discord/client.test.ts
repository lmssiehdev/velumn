import { assert, describe, it } from "@effect/vitest";
import { Client, Events, type Client as ReadyClient } from "discord.js";
import {
	Deferred,
	Effect,
	Exit,
	Fiber,
	Option,
	Redacted,
	Ref,
	Scope,
	Tracer,
} from "effect";
import { TestClock } from "effect/testing";
import {
	ErrorCapture,
	type ErrorCaptureContext,
} from "../observability/error-capture";
import { makeDiscordClient } from "./client";
import { makeDiscordEvents } from "./events";

const makeTestClient = () => new Client({ intents: [] });

describe("Discord lifecycle", () => {
	it.effect("starts a distinct root trace for each Discord event", () =>
		Effect.gen(function* () {
			const client = makeTestClient();
			const scope = yield* Scope.make();
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});
			const completed = yield* Deferred.make<void>();
			const events = yield* makeDiscordEvents(client).pipe(
				Effect.provideService(Tracer.Tracer, tracer),
				Scope.provide(scope),
			);
			let calls = 0;
			yield* events
				.forkOn(Events.Debug, () =>
					Effect.sync(() => {
						calls += 1;
						return calls;
					}).pipe(
						Effect.flatMap((count) =>
							count === 2
								? Deferred.succeed(completed, undefined)
								: Effect.void,
						),
					),
				)
				.pipe(
					Effect.provideService(Tracer.Tracer, tracer),
					Scope.provide(scope),
				);

			client.emit(Events.Debug, "first");
			client.emit(Events.Debug, "second");
			yield* Deferred.await(completed);
			const roots = spans.filter((span) => span.name === "discord.debug");
			assert.equal(roots.length, 2);
			assert.notEqual(roots[0]?.traceId, roots[1]?.traceId);
			assert.isTrue(roots.every((span) => Option.isNone(span.parent)));

			yield* Scope.close(scope, Exit.void);
			yield* Effect.promise(() => client.destroy());
		}),
	);

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

	it.effect(
		"reports escaped handler causes and keeps the listener active",
		() =>
			Effect.gen(function* () {
				const client = makeTestClient();
				const scope = yield* Scope.make();
				const reported = yield* Deferred.make<ErrorCaptureContext>();
				const events = yield* makeDiscordEvents(client).pipe(
					Effect.provideService(ErrorCapture, {
						captureCause: (_cause, context) =>
							Deferred.succeed(reported, context).pipe(Effect.as(undefined)),
					}),
					Scope.provide(scope),
				);
				let calls = 0;
				yield* events
					.forkOn(Events.MessageCreate, () => {
						calls += 1;
						return calls === 1 ? Effect.die("escaped") : Effect.void;
					})
					.pipe(Scope.provide(scope));

				const message = {
					id: "message-1",
					channelId: "channel-1",
					guildId: "guild-1",
				};
				client.emit(Events.MessageCreate, message as never);
				assert.deepInclude(yield* Deferred.await(reported), {
					boundary: "discord_event_handler",
					operation: "messageCreate",
					messageId: "message-1",
					channelId: "channel-1",
					guildId: "guild-1",
				});
				client.emit(Events.MessageCreate, message as never);
				yield* Effect.yieldNow;
				assert.equal(calls, 2);

				yield* Scope.close(scope, Exit.void);
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

	it.effect("times out a login promise that never settles", () =>
		Effect.gen(function* () {
			const client = makeTestClient();
			const scope = yield* Scope.make();
			let markLoginStarted: () => void = () => {};
			const loginStarted = new Promise<void>((resolve) => {
				markLoginStarted = resolve;
			});
			let destroyed = false;
			client.destroy = async () => {
				destroyed = true;
			};

			const fiber = yield* Effect.forkChild(
				makeDiscordClient(Redacted.make("test-token"), {
					makeClient: () => client,
					login: () => {
						markLoginStarted();
						return new Promise<string>(() => {});
					},
					loginTimeout: "1 second",
				}).pipe(Scope.provide(scope), Effect.exit),
			);

			yield* Effect.promise(() => loginStarted);
			yield* TestClock.adjust("1 second");
			const exit = yield* Fiber.join(fiber);
			assert.isTrue(Exit.isFailure(exit));
			assert.equal(client.listenerCount(Events.ClientReady), 0);
			assert.equal(client.listenerCount(Events.Error), 1);

			yield* Scope.close(scope, Exit.void);
			assert.isTrue(destroyed);
		}),
	);
});
