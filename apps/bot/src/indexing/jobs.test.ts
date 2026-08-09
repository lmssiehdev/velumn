import { assert, describe, it } from "@effect/vitest";
import type { DBIndexingJob } from "@repo/db/schema/index";
import {
	ChannelType,
	type Collection,
	type GuildBasedChannel,
	type Message,
} from "discord.js";
import { Deferred, Effect } from "effect";
import { IndexingRepository } from "../adapters/indexing-repository";
import { DiscordClient } from "../discord/client";
import { IndexingCoordinator } from "./coordinator";
import {
	DiscordHistory,
	DiscordHistoryMissingError,
	DiscordHistoryPermissionError,
	DiscordHistoryTransientError,
} from "./discord-history";
import {
	conservativeReconciliationJobOptions,
	makeReconciliationJobs,
	makeThreadPlanner,
} from "./jobs";

const as = <A>(value: unknown) => value as A;

const parent = as<
	Parameters<DiscordHistory["Service"]["fetchActiveThreads"]>[0]
>({
	id: "parent",
	guildId: "guild",
	parentId: null,
	name: "Parent",
	type: ChannelType.GuildForum,
	nsfw: false,
	isThread: () => false,
});

const thread = (id: string) =>
	as<Parameters<DiscordHistory["Service"]["fetchMessagePage"]>[0]["channel"]>({
		id,
		guildId: "guild",
		parentId: "parent",
		ownerId: "owner",
		name: id,
		type: ChannelType.PublicThread,
		archived: false,
		locked: false,
		archiveTimestamp: null,
		flags: { has: () => false },
		isThread: () => true,
	});

const job = (id: string, status: DBIndexingJob["status"]): DBIndexingJob => ({
	id,
	kind: "guild_reconciliation",
	status,
	trigger: "manual",
	serverId: "guild",
	channelId: null,
	requestedBy: null,
	idempotencyKey: null,
	summary: null,
	errorCode: null,
	cancellationRequestedAt: null,
	createdAt: new Date(0),
	startedAt: null,
	completedAt: null,
	updatedAt: new Date(0),
});

const makeRepository = (
	overrides: Partial<IndexingRepository["Service"]> = {},
) =>
	IndexingRepository.of({
		upsertChannelMetadata: (input) =>
			Effect.succeed(
				as({
					_tag: "Applied",
					channel: { ...input, indexingEnabled: false },
					observedAt: input.observedAt,
				}),
			),
		deleteChannel: () => Effect.die("unused"),
		upsertGuildMetadata: () => Effect.die("unused"),
		guildInstallationExists: () => Effect.succeed(true),
		deleteGuild: () => Effect.die("unused"),
		updateUserProfile: () => Effect.die("unused"),
		reconcilePermissions: () => Effect.die("unused"),
		createJob: () => Effect.die("unused"),
		getJob: () => Effect.die("unused"),
		startJob: () => Effect.die("unused"),
		completeJob: () => Effect.die("unused"),
		requestJobCancellation: () => Effect.die("unused"),
		repairJobs: () => Effect.succeed([]),
		activeServerIds: () => Effect.succeed([]),
		markServerLeft: () => Effect.succeed(true),
		storedCandidates: () => Effect.succeed([]),
		storedSupportedContainers: () => Effect.succeed([]),
		getCheckpoint: () => Effect.succeed(null),
		upsertCheckpoint: (input) => Effect.succeed(as(input)),
		resetCheckpoint: (input) => Effect.succeed(as(input)),
		sourceFacts: () =>
			Effect.succeed({
				sourceId: "parent",
				serverId: "guild",
				channelType: ChannelType.GuildForum,
				parentChannelType: null,
				indexingEnabled: true,
				nsfw: false,
				botPermissions: null,
				botPermissionsCheckedAt: null,
				serverActive: true,
				privacyAllowed: true,
			}),
		commitMessage: () => Effect.die("unused"),
		deleteMessage: () => Effect.die("unused"),
		deleteThread: () => Effect.die("unused"),
		reconcileThread: () => Effect.die("unused"),
		claim: () => Effect.die("unused"),
		complete: () => Effect.die("unused"),
		defer: () => Effect.die("unused"),
		fail: () => Effect.die("unused"),
		release: () => Effect.die("unused"),
		source: () => Effect.die("unused"),
		...overrides,
	});

const discord = (channels: ReadonlyMap<string, unknown>) =>
	DiscordClient.of({
		client: as({
			guilds: {
				cache: new Map([
					[
						"guild",
						{
							id: "guild",
							channels: { cache: channels },
						},
					],
				]),
				fetch: async () => {
					throw new Error("unused");
				},
			},
		}),
		events: as({}),
	});

const history = (
	active = new Map<string, unknown>(),
	archived = new Map<string, unknown>(),
) =>
	DiscordHistory.of({
		fetchGuild: () => Effect.die("unused"),
		fetchGuildChannels: () => Effect.succeed([as(parent)]),
		fetchUser: () => Effect.die("unused"),
		fetchMessage: () => Effect.die("unused"),
		lookupGuildChannelCacheFirst: () => Effect.die("unused"),
		lookupGuildChannelFetchRequired: ({ channelId }) =>
			Effect.succeed(channelId === "stored" ? thread("stored") : as(parent)),
		hydrateMessage: () => Effect.die("unused"),
		resolveThreadStarterReference: () => Effect.die("unused"),
		fetchMessagePage: () =>
			Effect.succeed(new Map() as Collection<string, Message<true>>),
		fetchActiveThreads: () =>
			Effect.succeed(as({ threads: active, hasMore: false })),
		fetchArchivedPublicThreadPage: () =>
			Effect.succeed(as({ threads: archived, hasMore: false })),
		calculateBotPermissionFacts: () =>
			Effect.succeed({
				effectivePermissions: 0n,
				hasViewChannel: true,
				hasReadMessageHistory: true,
			}),
	});

const provide = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	repository: IndexingRepository["Service"],
	discordService: DiscordClient["Service"],
	historyService: DiscordHistory["Service"],
) =>
	effect.pipe(
		Effect.provideService(IndexingRepository, repository),
		Effect.provideService(DiscordClient, discordService),
		Effect.provideService(DiscordHistory, historyService),
	);

describe("reconciliation jobs", () => {
	it.effect("plans active, archived, then stored supported threads", () => {
		const active = thread("active");
		const archived = thread("archived");
		const repository = makeRepository({
			storedCandidates: () =>
				Effect.succeed([
					{
						guildId: "guild",
						parentChannelId: "parent",
						threadId: "stored",
					},
				]),
		});
		return provide(
			Effect.gen(function* () {
				const planner = yield* makeThreadPlanner(
					conservativeReconciliationJobOptions,
				);
				const planned = yield* planner.planThreads({
					_tag: "Guild",
					guildId: "guild",
				});
				assert.deepEqual(
					planned.map(({ channel, active }) => [channel.id, active]),
					[
						["active", true],
						["archived", false],
						["stored", false],
					],
				);
			}),
			repository,
			discord(new Map([["parent", parent]])),
			history(
				new Map([[active.id, active]]),
				new Map([[archived.id, archived]]),
			),
		);
	});

	it.effect("resumes archived discovery from its durable parent cursor", () => {
		const cursors: Array<string | Date | undefined> = [];
		const updates: string[] = [];
		const archived = thread("archived");
		const repository = makeRepository({
			getCheckpoint: (_channelId, kind) =>
				Effect.succeed(
					kind === "archived_thread_discovery"
						? as({ scanCursor: "cursor-1" })
						: null,
				),
			upsertCheckpoint: (input) => {
				updates.push(input.scanCursor ?? "");
				return Effect.succeed(as(input));
			},
		});
		const pagedHistory = DiscordHistory.of({
			...history(),
			fetchArchivedPublicThreadPage: (request) => {
				cursors.push(request.before);
				return Effect.succeed(
					as({ threads: new Map([[archived.id, archived]]), hasMore: true }),
				);
			},
		});

		return provide(
			Effect.gen(function* () {
				const planner = yield* makeThreadPlanner({
					...conservativeReconciliationJobOptions,
					maxArchivedPagesPerParent: 1,
				});
				yield* planner.planThreads({ _tag: "Guild", guildId: "guild" });
				assert.deepEqual(cursors, ["cursor-1"]);
				assert.deepEqual(updates, ["archived"]);
			}),
			repository,
			discord(new Map([["parent", parent]])),
			pagedHistory,
		);
	});

	it.effect(
		"tombstones a stored thread only after an authoritative 404",
		() => {
			const deleted: unknown[] = [];
			const repository = makeRepository({
				storedCandidates: () =>
					Effect.succeed([
						{
							guildId: "guild",
							parentChannelId: "parent",
							threadId: "missing",
						},
					]),
				deleteThread: (input) =>
					Effect.sync(() => {
						deleted.push(input);
						return {
							affectedRows: 0,
							projectionCount: 1,
							stale: false,
						};
					}),
			});
			const missingHistory = DiscordHistory.of({
				...history(),
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					channelId === "missing"
						? Effect.fail(
								new DiscordHistoryMissingError({
									operation: "lookup-guild-channel",
									entity: "channel",
									entityId: channelId,
									cause: { status: 404 },
								}),
							)
						: Effect.succeed(as<GuildBasedChannel>(parent)),
			});
			return provide(
				Effect.gen(function* () {
					const planner = yield* makeThreadPlanner(
						conservativeReconciliationJobOptions,
					);
					yield* planner.planThreads({ _tag: "Guild", guildId: "guild" });
					assert.lengthOf(deleted, 1);
					assert.equal(as<{ serverId: string }>(deleted[0]).serverId, "guild");
				}),
				repository,
				discord(new Map([["parent", parent]])),
				missingHistory,
			);
		},
	);

	it.effect(
		"does not tombstone a stored thread on permission or transient failures",
		() => {
			let deletes = 0;
			const repository = makeRepository({
				storedCandidates: () =>
					Effect.succeed([
						{
							guildId: "guild",
							parentChannelId: "parent",
							threadId: "hidden",
						},
					]),
				deleteThread: () => {
					deletes += 1;
					return Effect.die("must not delete");
				},
			});
			const failures = [
				new DiscordHistoryPermissionError({
					operation: "lookup-guild-channel",
					cause: { status: 403 },
				}),
				new DiscordHistoryTransientError({
					operation: "lookup-guild-channel",
					cause: { status: 503 },
				}),
			];
			let failureIndex = 0;
			const unavailableHistory = DiscordHistory.of({
				...history(),
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					channelId === "hidden"
						? Effect.fail(failures[failureIndex++]!)
						: Effect.succeed(as<GuildBasedChannel>(parent)),
			});
			return provide(
				Effect.gen(function* () {
					const planner = yield* makeThreadPlanner(
						conservativeReconciliationJobOptions,
					);
					for (const _failure of failures) {
						const outcome = yield* Effect.exit(
							planner.planThreads({ _tag: "Guild", guildId: "guild" }),
						);
						assert.isTrue(outcome._tag === "Failure");
					}
					assert.equal(deletes, 0);
				}),
				repository,
				discord(new Map([["parent", parent]])),
				unavailableHistory,
			);
		},
	);

	it.effect(
		"repairs stored containers missing from the authoritative guild set",
		() => {
			const deleted: string[] = [];
			const repository = makeRepository({
				storedSupportedContainers: () =>
					Effect.succeed([
						{ id: "gone", parentId: null, type: ChannelType.GuildForum },
					]),
				deleteChannel: (input) =>
					Effect.sync(() => {
						deleted.push(input.channelId);
						return {
							affectedRows: 0,
							projectionCount: 1,
							stale: false,
						};
					}),
			});
			return provide(
				Effect.gen(function* () {
					const planner = yield* makeThreadPlanner(
						conservativeReconciliationJobOptions,
					);
					yield* planner.planThreads({ _tag: "Guild", guildId: "guild" });
					assert.deepEqual(deleted, ["gone"]);
				}),
				repository,
				discord(new Map([["parent", parent]])),
				history(),
			);
		},
	);

	it.effect(
		"plans a targeted archived thread without scanning archive pages",
		() => {
			const target = { ...thread("target"), archived: true };
			let archiveFetches = 0;
			const targetedHistory = DiscordHistory.of({
				...history(),
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					Effect.succeed(channelId === "target" ? as(target) : as(parent)),
				fetchArchivedPublicThreadPage: () => {
					archiveFetches += 1;
					return Effect.die("targeted reconciliation must not scan archives");
				},
			});

			return provide(
				Effect.gen(function* () {
					const planner = yield* makeThreadPlanner(
						conservativeReconciliationJobOptions,
					);
					const planned = yield* planner.planThreads({
						_tag: "Thread",
						guildId: "guild",
						channelId: "parent",
						threadId: "target",
					});
					assert.deepEqual(
						planned.map(({ channel, active }) => [channel.id, active]),
						[["target", false]],
					);
					assert.equal(archiveFetches, 0);
				}),
				makeRepository(),
				discord(new Map([["parent", parent]])),
				targetedHistory,
			);
		},
	);

	it.effect(
		"persists terminal status after coordinator receipts complete",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const completed = yield* Deferred.make<DBIndexingJob>();
					let stored = job("job", "queued");
					const repository = makeRepository({
						createJob: () => Effect.succeed(stored),
						startJob: () =>
							Effect.sync(() => {
								stored = { ...stored, status: "running" };
								return stored;
							}),
						completeJob: (_id, result) =>
							Effect.gen(function* () {
								stored = {
									...stored,
									status: result.status,
									summary: result.summary ?? null,
								};
								yield* Deferred.succeed(completed, stored);
								return stored;
							}),
						getJob: () => Effect.succeed(stored),
					});
					const coordinator = IndexingCoordinator.of({
						submit: (submission) =>
							Effect.succeed({
								_tag: "Accepted",
								receipt: {
									await: Effect.succeed({
										_tag: "Completed",
										submissionId: submission.id,
										completedAt: 1,
									}),
								},
							}),
						state: Effect.succeed({ accepting: true, outstanding: 0 }),
						close: Effect.void,
					});
					const service = yield* provide(
						makeReconciliationJobs({
							...conservativeReconciliationJobOptions,
							maxArchivedPagesPerParent: 0,
						}),
						repository,
						discord(new Map([["parent", parent]])),
						history(),
					).pipe(Effect.provideService(IndexingCoordinator, coordinator));
					const started = yield* service.startGuild("guild");
					assert.equal(started.id, "job");
					const terminal = yield* Deferred.await(completed);
					assert.equal(terminal.status, "succeeded");
					assert.deepEqual(terminal.summary, {
						planned: 0,
						processed: 0,
						committed: 0,
						skipped: 0,
						failed: 0,
						projectionsPending: 0,
					});
				}),
			),
	);

	it.effect("persists cancellation and interrupts the scoped job fiber", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const fetchStarted = yield* Deferred.make<void>();
				const cancelled = yield* Deferred.make<void>();
				let stored = job("cancel-job", "queued");
				const repository = makeRepository({
					createJob: () => Effect.succeed(stored),
					startJob: () =>
						Effect.sync(() => {
							stored = { ...stored, status: "running" };
							return stored;
						}),
					requestJobCancellation: () =>
						Effect.sync(() => {
							stored = { ...stored, cancellationRequestedAt: new Date() };
							return stored;
						}),
					completeJob: (_id, result) =>
						Effect.gen(function* () {
							stored = { ...stored, status: result.status };
							if (result.status === "cancelled") {
								yield* Deferred.succeed(cancelled, undefined);
							}
							return stored;
						}),
					getJob: () => Effect.succeed(stored),
				});
				const active = thread("active");
				const blockingHistory = DiscordHistory.of({
					...history(new Map([[active.id, active]])),
					fetchMessagePage: () =>
						Deferred.succeed(fetchStarted, undefined).pipe(
							Effect.andThen(Effect.never),
						),
				});
				const coordinator = IndexingCoordinator.of({
					submit: (submission) =>
						Effect.succeed({
							_tag: "Accepted",
							receipt: {
								await: Effect.succeed({
									_tag: "Completed",
									submissionId: submission.id,
									completedAt: 1,
								}),
							},
						}),
					state: Effect.succeed({ accepting: true, outstanding: 0 }),
					close: Effect.void,
				});
				const service = yield* provide(
					makeReconciliationJobs({
						...conservativeReconciliationJobOptions,
						maxArchivedPagesPerParent: 0,
					}),
					repository,
					discord(new Map([["parent", parent]])),
					blockingHistory,
				).pipe(Effect.provideService(IndexingCoordinator, coordinator));

				yield* service.startGuild("guild");
				yield* Deferred.await(fetchStarted);
				const terminal = yield* service.cancel("cancel-job");
				yield* Deferred.await(cancelled);
				assert.equal(terminal?.status, "cancelled");
				assert.isNotNull(terminal?.cancellationRequestedAt);
			}),
		),
	);

	it.effect("persists cancellation while a job waits for the semaphore", () =>
		Effect.scoped(
			Effect.gen(function* () {
				const firstStarted = yield* Deferred.make<void>();
				const secondCancelled = yield* Deferred.make<void>();
				const jobs = new Map([
					["first", job("first", "queued")],
					["second", job("second", "queued")],
				]);
				let nextJob = 0;
				const repository = makeRepository({
					createJob: () => {
						const id = nextJob++ === 0 ? "first" : "second";
						return Effect.succeed(jobs.get(id)!);
					},
					startJob: (id) =>
						Effect.sync(() => {
							const current = jobs.get(id)!;
							const running = { ...current, status: "running" as const };
							jobs.set(id, running);
							return running;
						}),
					requestJobCancellation: (id) =>
						Effect.sync(() => {
							const current = jobs.get(id)!;
							const requested = {
								...current,
								cancellationRequestedAt: new Date(),
							};
							jobs.set(id, requested);
							return requested;
						}),
					completeJob: (id, result) =>
						Effect.gen(function* () {
							const completed = { ...jobs.get(id)!, status: result.status };
							jobs.set(id, completed);
							if (id === "second" && result.status === "cancelled") {
								yield* Deferred.succeed(secondCancelled, undefined);
							}
							return completed;
						}),
					getJob: (id) => Effect.succeed(jobs.get(id) ?? null),
				});
				const active = thread("active");
				const blockingHistory = DiscordHistory.of({
					...history(new Map([[active.id, active]])),
					fetchMessagePage: () =>
						Deferred.succeed(firstStarted, undefined).pipe(
							Effect.andThen(Effect.never),
						),
				});
				const coordinator = IndexingCoordinator.of({
					submit: (submission) =>
						Effect.succeed({
							_tag: "Accepted",
							receipt: {
								await: Effect.succeed({
									_tag: "Completed",
									submissionId: submission.id,
									completedAt: 1,
								}),
							},
						}),
					state: Effect.succeed({ accepting: true, outstanding: 0 }),
					close: Effect.void,
				});
				const service = yield* provide(
					makeReconciliationJobs({
						...conservativeReconciliationJobOptions,
						maxArchivedPagesPerParent: 0,
					}),
					repository,
					discord(new Map([["parent", parent]])),
					blockingHistory,
				).pipe(Effect.provideService(IndexingCoordinator, coordinator));

				yield* service.startGuild("guild");
				yield* Deferred.await(firstStarted);
				yield* service.startGuild("guild");
				const terminal = yield* service.cancel("second");
				yield* Deferred.await(secondCancelled);
				assert.equal(terminal?.status, "cancelled");
				assert.isNull(jobs.get("second")?.startedAt);
			}),
		),
	);
});
