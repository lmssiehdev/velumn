import type { Client, ClientEvents } from "discord.js";
import { type Duration, Effect, FiberSet, type Scope } from "effect";
import {
	ErrorCapture,
	type ErrorCaptureContext,
} from "../observability/error-capture";

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

const explicitString = (value: unknown, key: string): string | undefined => {
	if (typeof value !== "object" || value === null) return undefined;
	try {
		const field = Reflect.get(value, key);
		return typeof field === "string" && field.length > 0 ? field : undefined;
	} catch {
		return undefined;
	}
};

const explicitField = (value: unknown, key: string): unknown => {
	if (typeof value !== "object" || value === null) return undefined;
	try {
		return Reflect.get(value, key);
	} catch {
		return undefined;
	}
};

const discordEventIds = (
	event: string,
	args: readonly unknown[],
): Omit<ErrorCaptureContext, "boundary" | "operation"> => {
	const candidate = [...args]
		.reverse()
		.find((value) => typeof value === "object" && value !== null);
	if (!candidate) return {};
	const guildId =
		explicitString(candidate, "guildId") ??
		explicitString(explicitField(candidate, "guild"), "id");
	const channelId =
		explicitString(candidate, "channelId") ??
		explicitString(candidate, "parentId");
	const explicitThreadId = explicitString(candidate, "threadId");
	const explicitMessageId = explicitString(candidate, "messageId");
	const id = explicitString(candidate, "id");
	const messageId = event.startsWith("message")
		? (explicitMessageId ?? id)
		: explicitMessageId;
	const threadId = event.startsWith("thread")
		? (explicitThreadId ?? id)
		: explicitThreadId;
	const resolvedChannelId = event.startsWith("channel")
		? (channelId ?? id)
		: channelId;
	const resolvedGuildId = event.startsWith("guild") ? (guildId ?? id) : guildId;
	return {
		...(resolvedGuildId ? { guildId: resolvedGuildId } : {}),
		...(resolvedChannelId ? { channelId: resolvedChannelId } : {}),
		...(threadId ? { threadId } : {}),
		...(messageId ? { messageId } : {}),
	};
};

export const makeDiscordEvents = (
	client: Client,
	options: DiscordEventsOptions = {},
): Effect.Effect<DiscordEvents, never, Scope.Scope> =>
	Effect.gen(function* () {
		const handlerDrainTimeout = options.handlerDrainTimeout ?? "3 seconds";
		const errorCapture = yield* ErrorCapture;

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
					const operation = String(event);
					const ids = discordEventIds(operation, args);
					runFork(
						Effect.suspend(() => listener(...args)).pipe(
							Effect.tapCause((cause) =>
								errorCapture
									.captureCause(cause, {
										boundary: "discord_event_handler",
										operation,
										...ids,
									})
									.pipe(Effect.asVoid),
							),
							Effect.withSpan(`discord.${operation}`, {
								root: true,
								attributes: { "operation.name": operation, ...ids },
							}),
							Effect.catchCause(() => Effect.void),
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
