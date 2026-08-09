import type { Client, ClientEvents } from "discord.js";
import { type Duration, Effect, FiberSet, type Scope } from "effect";

export interface DiscordEvents {
	readonly on: <Event extends DiscordEvent>(
		event: Event,
		listener: (...args: ClientEvents[Event]) => void,
	) => Effect.Effect<void, never, Scope.Scope>;
	readonly once: <Event extends DiscordEvent>(
		event: Event,
		listener: (...args: ClientEvents[Event]) => void,
	) => Effect.Effect<void, never, Scope.Scope>;
	readonly forkOn: <Event extends DiscordEvent, A, E, R>(
		event: Event,
		listener: (...args: ClientEvents[Event]) => Effect.Effect<A, E, R>,
	) => Effect.Effect<void, never, Scope.Scope | R>;
}

type DiscordEvent = Extract<keyof ClientEvents, string | symbol>;

interface DiscordEventsOptions {
	readonly handlerDrainTimeout?: Duration.Input;
}

export const makeDiscordEvents = (
	client: Client,
	options: DiscordEventsOptions = {},
): Effect.Effect<DiscordEvents, never, Scope.Scope> =>
	Effect.gen(function* () {
		const handlerDrainTimeout = options.handlerDrainTimeout ?? "3 seconds";

		const on: DiscordEvents["on"] = (event, listener) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					client.on(event, listener);
				}),
				() =>
					Effect.sync(() => {
						client.removeListener(event, listener);
					}),
			);

		const once: DiscordEvents["once"] = (event, listener) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					client.once(event, listener);
				}),
				() =>
					Effect.sync(() => {
						client.removeListener(event, listener);
					}),
			);

		const forkOn = <Event extends DiscordEvent, A, E, R>(
			event: Event,
			listener: (...args: ClientEvents[Event]) => Effect.Effect<A, E, R>,
		): Effect.Effect<void, never, Scope.Scope | R> =>
			Effect.gen(function* () {
				const fibers = yield* FiberSet.make<unknown, never>();
				const runFork = yield* FiberSet.runtime(fibers)<R>();

				const wrappedListener = (...args: ClientEvents[Event]) => {
					runFork(
						Effect.suspend(() => listener(...args)).pipe(
							Effect.catchCause((cause) =>
								Effect.logError("Unhandled Discord event handler failure", {
									event: String(event),
									cause,
								}),
							),
						),
					);
				};

				yield* Effect.acquireRelease(
					Effect.sync(() => {
						client.on(event, wrappedListener);
					}),
					() =>
						Effect.gen(function* () {
							client.removeListener(event, wrappedListener);
							yield* FiberSet.awaitEmpty(fibers).pipe(
								Effect.timeout(handlerDrainTimeout),
								Effect.catchTag("TimeoutError", () =>
									Effect.logWarning(
										"Timed out draining Discord event handlers",
										{ event: String(event) },
									),
								),
							);
						}),
				);
			});

		return { on, once, forkOn };
	});
