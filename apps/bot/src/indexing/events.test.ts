import { assert, describe, it } from "@effect/vitest";
import {
	type AnyThreadChannel,
	ChannelType,
	Client,
	type ClientEvents,
	Events,
	type Guild,
	type GuildMember,
	type Message,
	type NonThreadGuildBasedChannel,
	type PartialMessage,
	type Client as ReadyClient,
	type Role,
	type User,
} from "discord.js";
import { Cause, Effect, Exit, Fiber, Logger, Scope } from "effect";
import { TestClock } from "effect/testing";
import { type DiscordEvents, makeDiscordEvents } from "../discord/events";
import type { IndexingCoordinatorService } from "./coordinator";
import {
	channelOrderingKey,
	guildOrderingKey,
	makeIndexingEvents,
	userOrderingKey,
} from "./events";
import type {
	IndexSubmission,
	IndexSubmissionResult,
	IndexTerminalOutcome,
} from "./model";
import { IndexingOperationError } from "./model";
import { contentOrderingKey } from "./reconciliation";

type Handler = (...args: readonly unknown[]) => Effect.Effect<unknown>;

const makeEventHarness = () => {
	const handlers = new Map<string | symbol, Handler>();
	const forkOn = ((event: string | symbol, listener: Handler) =>
		Effect.acquireRelease(
			Effect.sync(() => {
				handlers.set(event, listener);
			}),
			() =>
				Effect.sync(() => {
					handlers.delete(event);
				}),
		)) as DiscordEvents["forkOn"];
	const events: DiscordEvents = {
		on: () => Effect.void,
		once: () => Effect.void,
		forkOn,
	};
	const emit = (event: string | symbol, ...args: readonly unknown[]) => {
		const handler = handlers.get(event);
		if (handler === undefined)
			throw new Error(`No handler for ${String(event)}`);
		return handler(...args);
	};

	return { events, handlers, emit };
};

const makeCoordinator = (
	submissions: IndexSubmission[],
	result: IndexSubmissionResult<IndexingOperationError> = {
		_tag: "Accepted",
		receipt: {
			await: Effect.succeed({
				_tag: "Completed",
				submissionId: "test",
				completedAt: 0,
			}),
		},
	},
): IndexingCoordinatorService<IndexingOperationError> => ({
	submit: (submission) =>
		Effect.sync(() => {
			submissions.push(submission);
			return result;
		}),
	state: Effect.succeed({ accepting: true, outstanding: 0 }),
	close: Effect.void,
});

const message = (
	id: string,
	channelId: string,
	isThread: boolean,
): Message<true> | PartialMessage<true> =>
	({
		id,
		channelId,
		guildId: "guild-1",
		channel: { isThread: () => isThread },
	}) as Message<true>;

const thread = (id: string, parentId: string | null = "channel-1") =>
	({ id, parentId, guildId: "guild-1" }) as AnyThreadChannel;

const readyClient = (...guilds: Guild[]) =>
	({
		guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) },
	}) as ReadyClient<true>;

const failedOutcome = (
	submissionId: string,
): IndexTerminalOutcome<IndexingOperationError> => ({
	_tag: "Failed",
	submissionId,
	failedAt: 0,
	cause: Cause.fail(
		new IndexingOperationError({
			operation: "commit-mutation",
			classification: "database",
			cause: new Error("transient failure"),
		}),
	),
});

describe("indexing gateway events", () => {
	it.effect("registers every listener for the lifetime of its scope", () =>
		Effect.gen(function* () {
			const scope = yield* Scope.make();
			const harness = makeEventHarness();
			yield* makeIndexingEvents(harness.events, makeCoordinator([])).pipe(
				Scope.provide(scope),
			);

			assert.deepEqual(
				[...harness.handlers.keys()],
				[
					Events.MessageCreate,
					Events.MessageUpdate,
					Events.MessageDelete,
					Events.MessageBulkDelete,
					Events.ThreadCreate,
					Events.ThreadUpdate,
					Events.ThreadDelete,
					Events.ChannelCreate,
					Events.ChannelUpdate,
					Events.ChannelDelete,
					Events.ClientReady,
					Events.GuildCreate,
					Events.GuildUpdate,
					Events.GuildDelete,
					Events.UserUpdate,
					Events.GuildMemberAdd,
					Events.GuildMemberUpdate,
					Events.GuildMemberRemove,
					Events.GuildRoleCreate,
					Events.GuildRoleUpdate,
					Events.GuildRoleDelete,
				],
			);

			yield* Scope.close(scope, Exit.void);
			assert.equal(harness.handlers.size, 0);
		}),
	);

	it.effect(
		"submits message and thread mutations with canonical ordering",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const submissions: IndexSubmission[] = [];
					const harness = makeEventHarness();
					yield* makeIndexingEvents(
						harness.events,
						makeCoordinator(submissions),
					);
					yield* TestClock.setTime(1_234);

					yield* harness.emit(
						Events.MessageCreate,
						message("message-1", "thread-1", true),
					);
					yield* harness.emit(
						Events.MessageUpdate,
						message("old", "channel-1", false),
						message("message-2", "channel-1", false),
					);
					yield* harness.emit(
						Events.MessageBulkDelete,
						new Map([
							["message-3", message("message-3", "thread-1", true)],
							["message-4", message("message-4", "thread-1", true)],
						]),
						{} as ClientEvents["messageDeleteBulk"][1],
					);
					yield* harness.emit(Events.ThreadCreate, thread("thread-1"), true);
					yield* harness.emit(
						Events.ThreadUpdate,
						thread("old-thread"),
						thread("thread-1"),
					);
					yield* harness.emit(Events.ThreadDelete, thread("thread-1"));

					assert.deepEqual<unknown>(
						submissions.map(({ id, orderingKey, mutation, submittedAt }) => ({
							id: id.replace(/:[0-9a-f-]{36}$/, ""),
							orderingKey,
							mutation,
							submittedAt,
						})),
						[
							{
								id: "gateway:messageCreate:message-1:1234",
								orderingKey: contentOrderingKey("thread-1"),
								mutation: {
									_tag: "UpsertMessage",
									messageId: "message-1",
									channelId: "thread-1",
									threadId: "thread-1",
									observedAt: 1_234,
								},
								submittedAt: 1_234,
							},
							{
								id: "gateway:messageUpdate:message-2:1234",
								orderingKey: contentOrderingKey("channel-1"),
								mutation: {
									_tag: "UpsertMessage",
									messageId: "message-2",
									channelId: "channel-1",
									threadId: null,
									observedAt: 1_234,
								},
								submittedAt: 1_234,
							},
							...[
								["message-3", "message-3"],
								["message-4", "message-4"],
							].map(([id, messageId]) => ({
								id: `gateway:messageDeleteBulk:${id}:1234`,
								orderingKey: contentOrderingKey("thread-1"),
								mutation: {
									_tag: "DeleteMessage",
									messageId,
									channelId: "thread-1",
									threadId: "thread-1",
									observedAt: 1_234,
								},
								submittedAt: 1_234,
							})),
							...[
								["threadCreate", "ReconcileThread"],
								["threadUpdate", "ReconcileThread"],
								["threadDelete", "DeleteThread"],
							].map(([event, tag]) => ({
								id: `gateway:${event}:thread-1:1234`,
								orderingKey: contentOrderingKey("thread-1"),
								mutation:
									tag === "DeleteThread"
										? {
												_tag: tag,
												threadId: "thread-1",
												parentChannelId: "channel-1",
												guildId: "guild-1",
												observedAt: 1_234,
											}
										: {
												_tag: tag,
												threadId: "thread-1",
												parentChannelId: "channel-1",
												guildId: "guild-1",
												requestedAt: 1_234,
												reconcileStarter: true,
											},
								submittedAt: 1_234,
							})),
						],
					);
				}),
			),
	);

	it.effect("assigns distinct identities to same-millisecond events", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const submissions: IndexSubmission[] = [];
				const harness = makeEventHarness();
				yield* makeIndexingEvents(harness.events, makeCoordinator(submissions));
				yield* TestClock.setTime(1_234);
				const created = message("message-1", "thread-1", true);
				yield* harness.emit(Events.MessageCreate, created);
				yield* harness.emit(Events.MessageCreate, created);

				assert.equal(submissions.length, 2);
				assert.notEqual(submissions[0]?.id, submissions[1]?.id);
			}),
		),
	);

	it.effect("marks category deletion as self-only", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const submissions: IndexSubmission[] = [];
				const harness = makeEventHarness();
				yield* makeIndexingEvents(harness.events, makeCoordinator(submissions));
				yield* harness.emit(Events.ChannelDelete, {
					id: "category-1",
					guildId: "guild-1",
					type: ChannelType.GuildCategory,
				} as NonThreadGuildBasedChannel);

				assert.deepEqual(submissions[0]?.mutation, {
					_tag: "DeleteChannel",
					channelId: "category-1",
					guildId: "guild-1",
					scope: "self",
					observedAt: 0,
				});
			}),
		),
	);

	it.effect(
		"persists privacy-affecting events before coordinator admission",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const persisted: IndexSubmission[] = [];
					const coordinatorSubmissions: IndexSubmission[] = [];
					const harness = makeEventHarness();
					yield* makeIndexingEvents(
						harness.events,
						makeCoordinator(coordinatorSubmissions),
						"bot-1",
						(submission) =>
							Effect.sync(() => {
								persisted.push(submission);
							}),
					);
					const guild = { id: "guild-1" } as Guild;

					yield* harness.emit(
						Events.MessageDelete,
						message("message-1", "thread-1", true),
					);
					yield* harness.emit(Events.ThreadDelete, thread("thread-1"));
					yield* harness.emit(Events.ChannelDelete, {
						id: "channel-1",
						guildId: "guild-1",
						type: ChannelType.GuildText,
					} as NonThreadGuildBasedChannel);
					yield* harness.emit(Events.GuildRoleDelete, {
						id: "role-1",
						guild,
					} as Role);

					assert.deepEqual(
						persisted.map(({ mutation }) => mutation._tag),
						[
							"DeleteMessage",
							"DeleteThread",
							"DeleteChannel",
							"ReconcileRolePermissions",
						],
					);
					assert.deepEqual(coordinatorSubmissions, []);
				}),
			),
	);

	it.effect("keeps GuildCreate authorization retries out of the inbox", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const persisted: IndexSubmission[] = [];
				const installations: IndexSubmission[] = [];
				const harness = makeEventHarness();
				const guild = { id: "guild-1" } as Guild;
				yield* makeIndexingEvents(
					harness.events,
					makeCoordinator(installations),
					"bot-1",
					(submission) =>
						Effect.sync(() => {
							persisted.push(submission);
						}),
				);

				yield* harness.emit(Events.GuildCreate, guild);
				yield* harness.emit(Events.GuildUpdate, guild, guild);

				assert.deepEqual(
					installations.map(({ mutation }) => mutation._tag),
					["InstallGuild"],
				);
				assert.deepEqual(
					persisted.map(({ mutation }) => mutation._tag),
					["UpsertGuild"],
				);
			}),
		),
	);

	it.effect("bootstraps every guild cached when the client becomes ready", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const installations: IndexSubmission[] = [];
				const harness = makeEventHarness();
				yield* makeIndexingEvents(
					harness.events,
					makeCoordinator(installations),
				);

				yield* harness.emit(
					Events.ClientReady,
					readyClient({ id: "guild-1" } as Guild, { id: "guild-2" } as Guild),
				);

				assert.deepEqual(
					installations.map(({ mutation }) => mutation),
					[
						{ _tag: "InstallGuild", guildId: "guild-1", observedAt: 0 },
						{ _tag: "InstallGuild", guildId: "guild-2", observedAt: 0 },
					],
				);
			}),
		),
	);

	it.effect("does not acknowledge an event when durable enqueue fails", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const harness = makeEventHarness();
				yield* makeIndexingEvents(
					harness.events,
					makeCoordinator([]),
					"bot-1",
					() => Effect.die("database unavailable"),
				);

				const exit = yield* Effect.exit(
					harness.emit(
						Events.MessageDelete,
						message("message-1", "thread-1", true),
					),
				);

				assert.isTrue(Exit.isFailure(exit));
			}),
		),
	);

	it.effect("classifies metadata events into minimal mutations", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const submissions: IndexSubmission[] = [];
				const harness = makeEventHarness();
				yield* makeIndexingEvents(
					harness.events,
					makeCoordinator(submissions),
					"bot-1",
				);
				yield* TestClock.setTime(9);
				const channel = {
					id: "channel-1",
					guildId: "guild-1",
					type: ChannelType.GuildText,
				} as NonThreadGuildBasedChannel;
				const guild = { id: "guild-1" } as Guild;
				const user = { id: "user-1" } as User;
				const member = { id: "bot-1", guild } as GuildMember;
				const otherMember = { id: "user-1", guild } as GuildMember;
				const role = { id: "role-1", guild } as Role;

				yield* harness.emit(Events.ChannelCreate, channel);
				yield* harness.emit(Events.ChannelUpdate, channel, channel);
				yield* harness.emit(Events.ChannelDelete, channel);
				yield* harness.emit(Events.GuildCreate, guild);
				yield* harness.emit(Events.GuildUpdate, guild, guild);
				yield* harness.emit(Events.GuildDelete, guild);
				yield* harness.emit(Events.UserUpdate, user, user);
				yield* harness.emit(Events.GuildMemberAdd, member);
				yield* harness.emit(Events.GuildMemberUpdate, member, otherMember);
				yield* harness.emit(Events.GuildMemberUpdate, member, member);
				yield* harness.emit(Events.GuildMemberRemove, member);
				yield* harness.emit(Events.GuildRoleCreate, role);
				yield* harness.emit(Events.GuildRoleUpdate, role, role);
				yield* harness.emit(Events.GuildRoleDelete, role);

				assert.deepEqual<unknown>(
					submissions.map(({ orderingKey, mutation }) => ({
						orderingKey,
						mutation,
					})),
					[
						...["UpsertChannel", "UpsertChannel", "DeleteChannel"].map(
							(_tag) => ({
								orderingKey: channelOrderingKey("channel-1"),
								mutation: {
									_tag,
									channelId: "channel-1",
									guildId: "guild-1",
									...(_tag === "DeleteChannel" ? { scope: "tree" } : {}),
									observedAt: 9,
								},
							}),
						),
						...["InstallGuild", "UpsertGuild", "DeleteGuild"].map((_tag) => ({
							orderingKey: guildOrderingKey("guild-1"),
							mutation: { _tag, guildId: "guild-1", observedAt: 9 },
						})),
						{
							orderingKey: userOrderingKey("user-1"),
							mutation: {
								_tag: "UpsertUser",
								userId: "user-1",
								observedAt: 9,
							},
						},
						...[false, false, true].map((deleted) => ({
							orderingKey: guildOrderingKey("guild-1"),
							mutation: {
								_tag: "ReconcileBotMemberPermissions",
								guildId: "guild-1",
								userId: "bot-1",
								deleted,
								observedAt: 9,
							},
						})),
						...[
							["ReconcileRolePermissions", false],
							["ReconcileRolePermissions", false],
							["ReconcileRolePermissions", true],
						].map(([_tag, deleted]) => ({
							orderingKey: guildOrderingKey("guild-1"),
							mutation: {
								_tag,
								guildId: "guild-1",
								roleId: "role-1",
								deleted,
								observedAt: 9,
							},
						})),
					],
				);
			}),
		),
	);

	it.effect(
		"retries GuildCreate overload until it is admitted exactly once",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const harness = makeEventHarness();
					const submissions: IndexSubmission[] = [];
					let attempts = 0;
					let admissions = 0;
					const coordinator = makeCoordinator(submissions);
					const overloadedCoordinator: IndexingCoordinatorService<IndexingOperationError> =
						{
							...coordinator,
							submit: (submission) =>
								Effect.sync(() => {
									submissions.push(submission);
									attempts += 1;
									if (attempts < 3) return { _tag: "Overloaded" } as const;
									admissions += 1;
									return {
										_tag: "Accepted",
										receipt: {
											await: Effect.succeed({
												_tag: "Completed",
												submissionId: submission.id,
												completedAt: 0,
											}),
										},
									} as const;
								}),
						};
					yield* makeIndexingEvents(harness.events, overloadedCoordinator);

					const fiber = yield* Effect.forkChild(
						harness.emit(Events.GuildCreate, { id: "guild-1" } as Guild),
					);
					yield* Effect.yieldNow;
					assert.equal(attempts, 1);
					yield* TestClock.adjust("10 millis");
					assert.equal(attempts, 2);
					yield* TestClock.adjust("10 millis");
					yield* Fiber.join(fiber);

					assert.equal(attempts, 3);
					assert.equal(admissions, 1);
					assert.equal(new Set(submissions.map((item) => item.id)).size, 1);
					assert.isTrue(
						submissions.every((item) => item.mutation._tag === "InstallGuild"),
					);
				}),
			),
	);

	it.effect("stops GuildCreate admission when the coordinator is Closing", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const harness = makeEventHarness();
				let attempts = 0;
				const coordinator = makeCoordinator([]);
				yield* makeIndexingEvents(harness.events, {
					...coordinator,
					submit: () =>
						Effect.sync(() => {
							attempts += 1;
							return attempts === 1
								? ({ _tag: "Overloaded" } as const)
								: ({ _tag: "Closing" } as const);
						}),
				});

				const fiber = yield* Effect.forkChild(
					harness.emit(Events.GuildCreate, { id: "guild-1" } as Guild),
				);
				yield* Effect.yieldNow;
				yield* TestClock.adjust("10 millis");
				yield* Fiber.join(fiber);
				assert.equal(attempts, 2);
				yield* TestClock.adjust("1 second");
				assert.equal(attempts, 2);
			}),
		),
	);

	it.effect(
		"resubmits a failed GuildCreate installation until it completes",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const harness = makeEventHarness();
					const submissions: IndexSubmission[] = [];
					let attempts = 0;
					yield* makeIndexingEvents(harness.events, {
						...makeCoordinator(submissions),
						submit: (submission) =>
							Effect.sync(() => {
								submissions.push(submission);
								attempts += 1;
								return {
									_tag: "Accepted",
									receipt: {
										await: Effect.succeed(
											attempts === 1
												? failedOutcome(submission.id)
												: {
														_tag: "Completed",
														submissionId: submission.id,
														completedAt: 1_000,
													},
										),
									},
								} as const;
							}),
					});

					const fiber = yield* Effect.forkChild(
						harness.emit(Events.GuildCreate, { id: "guild-1" } as Guild),
					);
					yield* Effect.yieldNow;
					assert.equal(attempts, 1);
					yield* TestClock.adjust("999 millis");
					assert.equal(attempts, 1);
					yield* TestClock.adjust("1 milli");
					yield* Fiber.join(fiber);

					assert.equal(attempts, 2);
					assert.equal(new Set(submissions.map(({ id }) => id)).size, 1);
					assert.deepEqual(
						submissions.map(({ submittedAt, mutation }) => ({
							submittedAt,
							observedAt:
								"observedAt" in mutation ? mutation.observedAt : undefined,
						})),
						[
							{ submittedAt: 0, observedAt: 0 },
							{ submittedAt: 0, observedAt: 0 },
						],
					);
				}),
			),
	);

	it.effect(
		"backs off repeated GuildCreate failures without duplicate retry loops",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const harness = makeEventHarness();
					let attempts = 0;
					yield* makeIndexingEvents(harness.events, {
						...makeCoordinator([]),
						submit: (submission) =>
							Effect.sync(() => {
								attempts += 1;
								return {
									_tag: "Accepted",
									receipt: {
										await: Effect.succeed(
											attempts < 9
												? failedOutcome(submission.id)
												: {
														_tag: "Completed",
														submissionId: submission.id,
														completedAt: 183_000,
													},
										),
									},
								} as const;
							}),
					});

					const fiber = yield* Effect.forkChild(
						harness.emit(Events.GuildCreate, { id: "guild-1" } as Guild),
					);
					yield* Effect.yieldNow;
					yield* harness.emit(Events.GuildCreate, {
						id: "guild-1",
					} as Guild);
					assert.equal(attempts, 1);

					for (const [index, delay] of [1, 2, 4, 8, 16, 32, 60, 60].entries()) {
						yield* TestClock.adjust(`${delay} seconds`);
						assert.equal(attempts, index + 2);
					}
					yield* Fiber.join(fiber);
					assert.equal(attempts, 9);
				}),
			),
	);

	it.effect(
		"shares one active retry loop when ready bootstrap overlaps GuildCreate",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const harness = makeEventHarness();
					const submissions: IndexSubmission[] = [];
					let attempts = 0;
					yield* makeIndexingEvents(harness.events, {
						...makeCoordinator(submissions),
						submit: (submission) =>
							Effect.sync(() => {
								submissions.push(submission);
								attempts += 1;
								return {
									_tag: "Accepted",
									receipt: {
										await: Effect.succeed(
											attempts === 1
												? failedOutcome(submission.id)
												: {
														_tag: "Completed",
														submissionId: submission.id,
														completedAt: 1_000,
													},
										),
									},
								} as const;
							}),
					});
					const guild = { id: "guild-1" } as Guild;

					const bootstrap = yield* Effect.forkChild(
						harness.emit(Events.ClientReady, readyClient(guild)),
					);
					yield* Effect.yieldNow;
					assert.equal(attempts, 1);
					yield* harness.emit(Events.GuildCreate, guild);
					assert.equal(attempts, 1);

					yield* TestClock.adjust("1 second");
					yield* Fiber.join(bootstrap);
					assert.equal(attempts, 2);
					assert.equal(new Set(submissions.map(({ id }) => id)).size, 1);
				}),
			),
	);

	it.effect("stops failed GuildCreate resubmission on Closing", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const harness = makeEventHarness();
				let attempts = 0;
				yield* makeIndexingEvents(harness.events, {
					...makeCoordinator([]),
					submit: (submission) =>
						Effect.sync(() => {
							attempts += 1;
							return attempts === 1
								? ({
										_tag: "Accepted",
										receipt: {
											await: Effect.succeed(failedOutcome(submission.id)),
										},
									} as const)
								: ({ _tag: "Closing" } as const);
						}),
				});

				const fiber = yield* Effect.forkChild(
					harness.emit(Events.GuildCreate, { id: "guild-1" } as Guild),
				);
				yield* Effect.yieldNow;
				yield* TestClock.adjust("1 second");
				yield* Fiber.join(fiber);
				assert.equal(attempts, 2);
				yield* TestClock.adjust("1 minute");
				assert.equal(attempts, 2);
			}),
		),
	);

	it.effect(
		"scope shutdown interrupts failed ready bootstrap without a leak",
		() =>
			Effect.gen(function* () {
				const scope = yield* Scope.make();
				const client = new Client({ intents: [] });
				const events = yield* makeDiscordEvents(client, {
					handlerDrainTimeout: "10 millis",
				}).pipe(Scope.provide(scope));
				let attempts = 0;
				const coordinator = makeCoordinator([]);
				yield* makeIndexingEvents(events, {
					...coordinator,
					submit: (submission) =>
						Effect.sync(() => {
							attempts += 1;
							return {
								_tag: "Accepted",
								receipt: {
									await: Effect.succeed(failedOutcome(submission.id)),
								},
							} as const;
						}),
				}).pipe(Scope.provide(scope));

				client.emit(
					Events.ClientReady,
					readyClient({ id: "guild-1" } as Guild),
				);
				yield* Effect.yieldNow;
				assert.equal(attempts, 1);
				const closeFiber = yield* Effect.forkChild(
					Scope.close(scope, Exit.void),
				);
				while (client.listenerCount(Events.ClientReady) > 0) {
					yield* Effect.yieldNow;
				}
				yield* TestClock.adjust("10 millis");
				yield* Fiber.join(closeFiber);
				const attemptsAfterClose = attempts;
				yield* TestClock.adjust("1 second");

				assert.equal(attempts, attemptsAfterClose);
				assert.equal(client.listenerCount(Events.ClientReady), 0);
				assert.equal(client.listenerCount(Events.GuildCreate), 0);
			}),
	);

	it.effect(
		"logs overload and closing without claiming accepted persistence",
		() => {
			const logs: string[] = [];
			const logger = Logger.make<unknown, void>(({ message }) => {
				logs.push(String(Array.isArray(message) ? message[0] : message));
			});

			return Effect.scoped(
				Effect.gen(function* () {
					const acceptedHarness = makeEventHarness();
					yield* makeIndexingEvents(
						acceptedHarness.events,
						makeCoordinator([]),
					);
					yield* acceptedHarness.emit(
						Events.MessageCreate,
						message("accepted", "thread-1", true),
					);

					for (const result of [
						{ _tag: "Overloaded" as const },
						{ _tag: "Closing" as const },
					]) {
						const harness = makeEventHarness();
						const submissions: IndexSubmission[] = [];
						yield* makeIndexingEvents(
							harness.events,
							makeCoordinator(submissions, result),
						);
						const exit = yield* Effect.exit(
							harness.emit(
								Events.MessageCreate,
								message("message-1", "thread-1", true),
							),
						);
						assert.isTrue(Exit.isSuccess(exit));
						assert.equal(submissions.length, 1);
					}

					assert.deepEqual(logs, [
						"Indexing gateway submission overloaded",
						"Indexing gateway submission rejected while closing",
					]);
				}),
			).pipe(Effect.provide(Logger.layer([logger])));
		},
	);
});
