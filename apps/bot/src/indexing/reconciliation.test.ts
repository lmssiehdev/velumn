import { assert, describe, it } from "@effect/vitest";
import {
	ChannelType,
	type Collection,
	type Message,
	type Snowflake,
} from "discord.js";
import { Deferred, Effect, Fiber, Ref } from "effect";
import { makeIndexingCoordinator } from "./coordinator";
import type { DiscordHistory } from "./discord-history";
import type { IndexMutation } from "./model";
import {
	type PlannedReconciliationThread,
	type ReconciliationOptions,
	type ReconciliationPlanOperations,
	reconcileDiscordHistory,
} from "./reconciliation";

const coordinatorOptions = {
	queueCapacity: 4,
	maxActivePartitions: 8,
	idleTimeToLive: "1 second" as const,
};

const reconciliationOptions: ReconciliationOptions = {
	maxThreads: 10,
	maxMessages: 1_000,
	threadConcurrency: 2,
};

const scope = {
	_tag: "Channel" as const,
	guildId: "guild",
	channelId: "parent",
};

const as = <A>(value: Parameters<typeof structuredClone>[0]): A => value as A;

const thread = (
	id: string,
	active = true,
	type:
		| ChannelType.PublicThread
		| ChannelType.AnnouncementThread
		| ChannelType.PrivateThread = ChannelType.PublicThread,
): PlannedReconciliationThread => ({
	channel: {
		id,
		type,
	} as PlannedReconciliationThread["channel"],
	guildId: "guild",
	parentChannelId: "parent",
	active,
});

const announcement = (id: string): PlannedReconciliationThread => ({
	channel: {
		id,
		type: ChannelType.GuildAnnouncement,
		isThread: () => false,
	} as PlannedReconciliationThread["channel"],
	guildId: "guild",
	parentChannelId: id,
	active: true,
});

const planner = (
	threads: readonly PlannedReconciliationThread[],
	checkpoint: Snowflake | null = null,
): ReconciliationPlanOperations => ({
	guildInstallationExists: () => Effect.succeed(true),
	getMessageCheckpoint: () => Effect.succeed(checkpoint),
	getSelectionCursor: () => Effect.succeed(null),
	setSelectionCursor: () => Effect.void,
	planThreads: () => Effect.succeed(threads),
});

const messagePage = (ids: readonly string[]) =>
	as<Collection<Snowflake, Message<true>>>(
		new Map(ids.map((id) => [id, { id }])),
	);

const historyFromIds = (
	idsByThread: Readonly<Record<string, readonly string[]>>,
	requests: Array<{ threadId: string; after?: string; limit: number }>,
) => ({
	fetchMessagePage: ({
		channel,
		after,
		limit,
	}: Parameters<DiscordHistory["Service"]["fetchMessagePage"]>[0]) =>
		Effect.sync(() => {
			requests.push({ threadId: channel.id, after, limit });
			const ids = idsByThread[channel.id] ?? [];
			const start = after === undefined ? 0 : ids.indexOf(after) + 1;
			return messagePage(ids.slice(start, start + limit));
		}),
});

const runPaginationCase = (count: number) =>
	Effect.scoped(
		Effect.gen(function* () {
			const mutations: IndexMutation[] = [];
			const coordinator = yield* makeIndexingCoordinator(
				coordinatorOptions,
				(mutation) =>
					Effect.sync(() => mutations.push(mutation)).pipe(Effect.asVoid),
			);
			const requests: Array<{
				threadId: string;
				after?: string;
				limit: number;
			}> = [];
			const ids = Array.from({ length: count }, (_, index) => `${index + 1}`);

			const summary = yield* reconcileDiscordHistory(
				scope,
				reconciliationOptions,
				planner([thread("thread")]),
				historyFromIds({ thread: ids }, requests),
				coordinator,
			);

			assert.equal(summary.status, "succeeded");
			assert.equal(summary.submittedMessages, count);
			assert.equal(
				mutations.filter((mutation) => mutation._tag === "UpsertMessage")
					.length,
				count,
			);
			const expectedRequests = count === 0 ? 1 : Math.floor(count / 100) + 1;
			assert.equal(requests.length, expectedRequests);
			assert.deepEqual(
				requests.map(({ after, limit }) => ({ after, limit })),
				count <= 1
					? [{ after: undefined, limit: 100 }]
					: count === 100
						? [
								{ after: undefined, limit: 100 },
								{ after: "100", limit: 100 },
							]
						: [
								{ after: undefined, limit: 100 },
								{ after: "100", limit: 100 },
							],
			);
		}),
	);

describe("Discord reconciliation", () => {
	it.effect(
		"quietly skips a missing guild installation and succeeds after installation",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					let installed = false;
					let planningCalls = 0;
					let historyCalls = 0;
					const mutations: IndexMutation[] = [];
					const coordinator = yield* makeIndexingCoordinator(
						coordinatorOptions,
						(mutation) =>
							Effect.sync(() => mutations.push(mutation)).pipe(Effect.asVoid),
					);
					const plan: ReconciliationPlanOperations = {
						...planner([thread("thread")]),
						guildInstallationExists: () => Effect.succeed(installed),
						planThreads: () =>
							Effect.sync(() => {
								planningCalls += 1;
								return [thread("thread")];
							}),
					};
					const history = as<
						Pick<DiscordHistory["Service"], "fetchMessagePage">
					>({
						fetchMessagePage: () =>
							Effect.sync(() => {
								historyCalls += 1;
								return messagePage([]);
							}),
					});

					const missing = yield* reconcileDiscordHistory(
						scope,
						reconciliationOptions,
						plan,
						history,
						coordinator,
					);
					assert.equal(missing.status, "succeeded");
					assert.equal(missing.plannedThreads, 0);
					assert.isEmpty(missing.failures);
					assert.equal(planningCalls, 0);
					assert.equal(historyCalls, 0);
					assert.isEmpty(mutations);

					installed = true;
					const authorized = yield* reconcileDiscordHistory(
						scope,
						reconciliationOptions,
						plan,
						history,
						coordinator,
					);
					assert.equal(authorized.status, "succeeded");
					assert.equal(planningCalls, 1);
					assert.equal(historyCalls, 1);
					assert.deepEqual(
						mutations.map(({ _tag }) => _tag),
						["ReconcileThread"],
					);
				}),
			),
	);

	for (const count of [0, 1, 100, 101]) {
		it.effect(`paginates ${count} messages in pages of 100`, () =>
			runPaginationCase(count),
		);
	}

	it.effect("resumes message history after the durable scan checkpoint", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const mutations: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.sync(() => mutations.push(mutation)).pipe(Effect.asVoid),
				);
				const requests: Array<{
					threadId: string;
					after?: string;
					limit: number;
				}> = [];

				const summary = yield* reconcileDiscordHistory(
					scope,
					reconciliationOptions,
					planner([thread("thread")], "2"),
					historyFromIds({ thread: ["1", "2", "3"] }, requests),
					coordinator,
				);

				assert.equal(summary.submittedMessages, 1);
				assert.deepEqual(requests, [
					{ threadId: "thread", after: "2", limit: 100 },
				]);
				assert.deepEqual(
					mutations.flatMap((mutation) =>
						mutation._tag === "UpsertMessage" ? [mutation.messageId] : [],
					),
					["3"],
				);
			}),
		),
	);

	it.effect("repairs opted-in root announcement message history", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const mutations: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.sync(() => mutations.push(mutation)).pipe(Effect.asVoid),
				);

				const summary = yield* reconcileDiscordHistory(
					{ _tag: "Guild", guildId: "guild" },
					reconciliationOptions,
					planner([announcement("announcements")]),
					historyFromIds({ announcements: ["1"] }, []),
					coordinator,
				);

				assert.equal(summary.status, "succeeded");
				assert.lengthOf(mutations, 1);
				const mutation = mutations[0];
				assert.equal(mutation?._tag, "UpsertMessage");
				if (mutation?._tag === "UpsertMessage") {
					assert.equal(mutation.messageId, "1");
					assert.equal(mutation.channelId, "announcements");
					assert.isNull(mutation.threadId);
				}
			}),
		),
	);

	it.effect("applies the thread cap after active-first planning", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const mutations: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.sync(() => mutations.push(mutation)).pipe(Effect.asVoid),
				);
				const requests: Array<{
					threadId: string;
					after?: string;
					limit: number;
				}> = [];

				const summary = yield* reconcileDiscordHistory(
					scope,
					{ ...reconciliationOptions, maxThreads: 1 },
					planner([
						thread("active-announcement", false),
						thread("archived", false),
						thread("active-announcement", true, ChannelType.AnnouncementThread),
					]),
					historyFromIds({}, requests),
					coordinator,
				);

				assert.equal(summary.status, "partial");
				assert.isTrue(summary.threadCapReached);
				assert.equal(summary.plannedThreads, 2);
				assert.deepEqual(
					mutations.flatMap((mutation) =>
						mutation._tag === "ReconcileThread" ? [mutation.threadId] : [],
					),
					["active-announcement"],
				);
			}),
		),
	);

	it.effect(
		"rotates capped active candidates and eventually repairs stored threads",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const runs: string[][] = [];
					let selectionCursor: Snowflake | null = null;
					const rotatingPlanner: ReconciliationPlanOperations = {
						guildInstallationExists: () => Effect.succeed(true),
						getMessageCheckpoint: () => Effect.succeed(null),
						getSelectionCursor: () => Effect.succeed(selectionCursor),
						setSelectionCursor: (_anchorChannelId, threadId) =>
							Effect.sync(() => {
								selectionCursor = threadId;
							}),
						planThreads: () =>
							Effect.succeed([
								thread("active-1"),
								thread("active-2"),
								thread("active-3"),
								thread("stored", false),
							]),
					};
					const coordinator = yield* makeIndexingCoordinator(
						coordinatorOptions,
						(mutation) =>
							Effect.sync(() => {
								if (mutation._tag === "ReconcileThread") {
									runs.at(-1)?.push(mutation.threadId);
								}
							}),
					);

					for (let run = 0; run < 3; run++) {
						runs.push([]);
						yield* reconcileDiscordHistory(
							scope,
							{ ...reconciliationOptions, maxThreads: 2 },
							rotatingPlanner,
							historyFromIds({}, []),
							coordinator,
						);
					}

					assert.deepEqual(runs, [
						["active-1", "active-2"],
						["active-3", "stored"],
						["active-1", "active-2"],
					]);
				}),
			),
	);

	it.effect("finishes active threads before starting stored candidates", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const activeStarted = yield* Deferred.make<void>();
				const releaseActive = yield* Deferred.make<void>();
				const processed: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.gen(function* () {
							processed.push(mutation);
							if (
								mutation._tag === "UpsertMessage" &&
								mutation.threadId === "active"
							) {
								yield* Deferred.succeed(activeStarted, undefined);
								yield* Deferred.await(releaseActive);
							}
						}),
				);
				const requests: Array<{
					threadId: string;
					after?: string;
					limit: number;
				}> = [];
				const fiber = yield* Effect.forkChild(
					reconcileDiscordHistory(
						scope,
						{ ...reconciliationOptions, threadConcurrency: 4 },
						planner([thread("stored", false), thread("active")]),
						historyFromIds({ active: ["1"], stored: ["2"] }, requests),
						coordinator,
					),
				);

				yield* Deferred.await(activeStarted);
				assert.isFalse(
					processed.some(
						(mutation) =>
							mutation._tag === "ReconcileThread" &&
							mutation.threadId === "stored",
					),
				);
				yield* Deferred.succeed(releaseActive, undefined);
				const summary = yield* Fiber.join(fiber);

				assert.equal(summary.status, "succeeded");
				assert.deepEqual(
					processed.map((mutation) => mutation._tag),
					[
						"ReconcileThread",
						"UpsertMessage",
						"ReconcileThread",
						"UpsertMessage",
					],
				);
			}),
		),
	);

	it.effect("uses the canonical content key for thread and message work", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const orderingKeys: string[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					() => Effect.void,
				);
				const summary = yield* reconcileDiscordHistory(
					scope,
					reconciliationOptions,
					planner([thread("thread")]),
					historyFromIds({ thread: ["1"] }, []),
					{
						...coordinator,
						submit: (submission) => {
							orderingKeys.push(submission.orderingKey);
							return coordinator.submit(submission);
						},
					},
				);

				assert.equal(summary.status, "succeeded");
				assert.deepEqual(orderingKeys, ["channel:thread", "channel:thread"]);
			}),
		),
	);

	it.effect("bounds concurrent thread history reads", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					() => Effect.void,
				);
				const twoStarted = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const started = yield* Ref.make(0);
				const history = as<Pick<DiscordHistory["Service"], "fetchMessagePage">>(
					{
						fetchMessagePage: () =>
							Effect.gen(function* () {
								const count = yield* Ref.updateAndGet(
									started,
									(value) => value + 1,
								);
								if (count === 2) yield* Deferred.succeed(twoStarted, undefined);
								yield* Deferred.await(release);
								return messagePage([]);
							}),
					},
				);
				const fiber = yield* Effect.forkChild(
					reconcileDiscordHistory(
						scope,
						{ ...reconciliationOptions, threadConcurrency: 2 },
						planner([thread("1"), thread("2"), thread("3")]),
						history,
						coordinator,
					),
				);

				yield* Deferred.await(twoStarted);
				assert.equal(yield* Ref.get(started), 2);
				yield* Deferred.succeed(release, undefined);
				const summary = yield* Fiber.join(fiber);

				assert.equal(summary.succeededThreads, 3);
				assert.equal(yield* Ref.get(started), 3);
			}),
		),
	);

	it.effect("filters unsupported, duplicate, and out-of-scope candidates", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const processed: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.sync(() => processed.push(mutation)).pipe(Effect.asVoid),
				);
				const wrongGuild = { ...thread("wrong-guild"), guildId: "other" };
				const wrongParent = {
					...thread("wrong-parent"),
					parentChannelId: "other",
				};

				const summary = yield* reconcileDiscordHistory(
					scope,
					reconciliationOptions,
					planner([
						thread("public"),
						thread("announcement", true, ChannelType.AnnouncementThread),
						thread("private", true, ChannelType.PrivateThread),
						thread("public"),
						wrongGuild,
						wrongParent,
					]),
					historyFromIds({}, []),
					coordinator,
				);

				assert.equal(summary.plannedThreads, 2);
				assert.deepEqual(
					processed.flatMap((mutation) =>
						mutation._tag === "ReconcileThread" ? [mutation.threadId] : [],
					),
					["public", "announcement"],
				);
			}),
		),
	);

	it.effect("reports planning failure without attempting work", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					() => Effect.void,
				);
				const summary = yield* reconcileDiscordHistory(
					scope,
					reconciliationOptions,
					{
						guildInstallationExists: () => Effect.succeed(true),
						getMessageCheckpoint: () => Effect.succeed(null),
						getSelectionCursor: () => Effect.succeed(null),
						setSelectionCursor: () => Effect.void,
						planThreads: () => Effect.fail("planning failed"),
					},
					historyFromIds({}, []),
					coordinator,
				);

				assert.equal(summary.status, "failed");
				assert.equal(summary.attemptedThreads, 0);
				assert.equal(summary.failures[0]?.stage, "plan-threads");
			}),
		),
	);

	it.effect("continues after an independent message page failure", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const processed: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.sync(() => processed.push(mutation)).pipe(Effect.asVoid),
				);
				const history = as<Pick<DiscordHistory["Service"], "fetchMessagePage">>(
					{
						fetchMessagePage: ({ channel }: { channel: { id: string } }) =>
							channel.id === "bad"
								? Effect.fail("history failed")
								: Effect.succeed(messagePage(["1"])),
					},
				);

				const summary = yield* reconcileDiscordHistory(
					scope,
					reconciliationOptions,
					planner([thread("bad"), thread("good")]),
					history,
					coordinator,
				);

				assert.equal(summary.status, "partial");
				assert.equal(summary.succeededThreads, 1);
				assert.equal(summary.failedThreads, 1);
				assert.equal(summary.failures[0]?.stage, "fetch-message-page");
				assert.isTrue(
					processed.some(
						(mutation) =>
							mutation._tag === "UpsertMessage" && mutation.threadId === "good",
					),
				);
			}),
		),
	);

	it.effect("stops at the message cap without requesting a partial page", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const mutations: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) =>
						Effect.sync(() => mutations.push(mutation)).pipe(Effect.asVoid),
				);
				const requests: Array<{
					threadId: string;
					after?: string;
					limit: number;
				}> = [];
				const ids = Array.from({ length: 101 }, (_, index) => `${index + 1}`);

				const summary = yield* reconcileDiscordHistory(
					scope,
					{ ...reconciliationOptions, maxMessages: 50 },
					planner([thread("thread")]),
					historyFromIds({ thread: ids }, requests),
					coordinator,
				);

				assert.equal(summary.status, "partial");
				assert.isTrue(summary.messageCapReached);
				assert.equal(summary.submittedMessages, 50);
				assert.deepEqual(requests, [
					{ threadId: "thread", after: undefined, limit: 100 },
				]);
				assert.equal(
					mutations.filter((mutation) => mutation._tag === "UpsertMessage")
						.length,
					50,
				);
			}),
		),
	);

	it.effect("continues other threads after a terminal receipt failure", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const processed: IndexMutation[] = [];
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					(mutation) => {
						processed.push(mutation);
						return mutation._tag === "UpsertMessage" &&
							mutation.threadId === "bad"
							? Effect.fail("repository receipt failed")
							: Effect.void;
					},
				);
				const requests: Array<{
					threadId: string;
					after?: string;
					limit: number;
				}> = [];

				const summary = yield* reconcileDiscordHistory(
					scope,
					reconciliationOptions,
					planner([thread("bad"), thread("good")]),
					historyFromIds({ bad: ["1"], good: ["2"] }, requests),
					coordinator,
				);

				assert.equal(summary.status, "partial");
				assert.equal(summary.succeededThreads, 1);
				assert.equal(summary.failedThreads, 1);
				assert.equal(summary.failures[0]?.threadId, "bad");
				assert.equal(summary.failures[0]?.stage, "upsert-message");
				assert.isTrue(
					processed.some(
						(mutation) =>
							mutation._tag === "UpsertMessage" && mutation.threadId === "good",
					),
				);
			}),
		),
	);

	it.effect("propagates cancellation without fetching another page", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const coordinator = yield* makeIndexingCoordinator(
					coordinatorOptions,
					() => Effect.void,
				);
				const fetchStarted = yield* Deferred.make<void>();
				const fetchCancelled = yield* Deferred.make<void>();
				let fetches = 0;
				const history = as<Pick<DiscordHistory["Service"], "fetchMessagePage">>(
					{
						fetchMessagePage: () =>
							Effect.gen(function* () {
								fetches += 1;
								yield* Deferred.succeed(fetchStarted, undefined);
								return yield* Effect.never;
							}).pipe(
								Effect.onInterrupt(() =>
									Deferred.succeed(fetchCancelled, undefined),
								),
							),
					},
				);
				const fiber = yield* Effect.forkChild(
					reconcileDiscordHistory(
						scope,
						reconciliationOptions,
						planner([thread("thread")]),
						history,
						coordinator,
					),
				);

				yield* Deferred.await(fetchStarted);
				yield* Fiber.interrupt(fiber);

				assert.isTrue(yield* Deferred.isDone(fetchCancelled));
				assert.equal(fetches, 1);
			}),
		),
	);
});
