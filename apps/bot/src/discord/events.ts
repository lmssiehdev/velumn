import type { Client, ClientEvents } from "discord.js";
import {
	Cause,
	Clock,
	Duration,
	Effect,
	Exit,
	FiberSet,
	Option,
	Schema,
	type Scope,
} from "effect";
import {
	ErrorCapture,
	type ErrorCaptureContext,
} from "../observability/error-capture";
import {
	BotMetrics,
	type DiscordEventCategory,
} from "../observability/metrics";

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

const discordEventCategory = (event: string): DiscordEventCategory => {
	const name = event.toLowerCase();
	if (name.includes("message")) return "message";
	if (name.includes("channel")) return "channel";
	if (name.includes("thread")) return "thread";
	if (name.includes("member")) return "member";
	if (name.includes("role")) return "role";
	if (name.includes("guild")) return "guild";
	if (name.includes("interaction")) return "interaction";
	return "other";
};

const discordEventIdCandidateSchema = Schema.Struct({
	id: Schema.optional(Schema.String),
	guildId: Schema.optional(Schema.String),
	channelId: Schema.optional(Schema.String),
	parentId: Schema.optional(Schema.String),
	threadId: Schema.optional(Schema.String),
	messageId: Schema.optional(Schema.String),
	guild: Schema.optional(Schema.Struct({ id: Schema.String })),
});
const decodeDiscordEventIdCandidate = Schema.decodeUnknownOption(
	discordEventIdCandidateSchema,
);

const discordEventIds = (
	event: string,
	args: readonly unknown[],
): Omit<ErrorCaptureContext, "boundary" | "operation"> => {
	let candidate: typeof discordEventIdCandidateSchema.Type | undefined;
	for (const value of [...args].reverse()) {
		const parsed = decodeDiscordEventIdCandidate(value);
		if (Option.isSome(parsed)) {
			candidate = parsed.value;
			break;
		}
	}
	if (!candidate) return {};
	const guildId = candidate.guildId ?? candidate.guild?.id;
	const channelId = candidate.channelId ?? candidate.parentId;
	const explicitThreadId = candidate.threadId;
	const explicitMessageId = candidate.messageId;
	const id = candidate.id;
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
		guildId: resolvedGuildId,
		channelId: resolvedChannelId,
		threadId,
		messageId,
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
					const category = discordEventCategory(operation);
					const ids = discordEventIds(operation, args);
					runFork(
						Clock.currentTimeNanos.pipe(
							Effect.flatMap((startedAt) =>
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
										attributes: {
											"operation.name": operation,
											"discord.event.category": category,
											...ids,
										},
									}),
									Effect.onExit((exit) =>
										Clock.currentTimeNanos.pipe(
											Effect.flatMap((finishedAt) =>
												BotMetrics.recordDiscordEvent({
													category,
													outcome: Exit.isSuccess(exit)
														? "succeeded"
														: Cause.hasInterruptsOnly(exit.cause)
															? "cancelled"
															: "failed",
													durationMs: Duration.toMillis(
														Duration.nanos(finishedAt - startedAt),
													),
												}),
											),
										),
									),
								),
							),
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
