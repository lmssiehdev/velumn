import { assert, describe, it } from "@effect/vitest";
import {
	ChannelType,
	Collection,
	type Guild,
	type GuildBasedChannel,
	MessageFlags,
	MessageType,
} from "discord.js";
import { Clock, Effect, Exit, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
	type IndexedMutationResult,
	IndexingRepository,
	IndexingRepositoryError,
	type IndexingRepository as IndexingRepositoryService,
} from "../adapters/indexing-repository";
import {
	GuildInstallationRepository,
	GuildInstallationRepositoryError,
	type GuildInstallationRepository as GuildInstallationRepositoryService,
} from "../adapters/repository";
import { DiscordHistory } from "./discord-history";
import type { IndexMutation } from "./model";
import { makeIndexMutationProcessor } from "./mutation";

const as = <A>(value: unknown): A => value as A;

const sourceFacts = {
	sourceId: "thread",
	serverId: "guild",
	channelType: ChannelType.PublicThread,
	parentChannelType: ChannelType.GuildForum,
	indexingEnabled: true,
	nsfw: false,
	botPermissions: "0",
	botPermissionsCheckedAt: null,
	serverActive: true,
	privacyAllowed: true,
};

const source = {
	id: "thread",
	type: ChannelType.PublicThread,
	parentId: "parent",
	parent: { id: "parent", type: ChannelType.GuildForum, nsfw: false },
	nsfw: false,
	viewable: true,
	isDMBased: () => false,
};

const message = as<Parameters<DiscordHistory["Service"]["hydrateMessage"]>[0]>({
	id: "message",
	guildId: "guild",
	channelId: "thread",
	channel: source,
	type: MessageType.Default,
	flags: { bitfield: BigInt(MessageFlags.SuppressEmbeds) },
	author: {
		id: "author",
		username: "Author",
		avatar: null,
		bot: false,
		globalName: "Author",
		displayAvatarURL: () => "https://cdn.example/avatar.png",
	},
	content: "hello",
	cleanContent: "hello",
	createdTimestamp: 1_000,
	editedTimestamp: null,
	pinned: false,
	applicationId: null,
	thread: null,
	reference: null,
	webhookId: null,
	interactionMetadata: null,
	mentions: {
		users: new Collection(),
		channels: new Collection(),
		roles: new Collection(),
	},
	attachments: new Collection(),
	reactions: { cache: new Collection() },
	components: [],
});

const upsert: IndexMutation = {
	_tag: "UpsertMessage",
	messageId: "message",
	channelId: "thread",
	threadId: "thread",
	observedAt: 2_000,
};

const result = (
	override: Partial<IndexedMutationResult> = {},
): IndexedMutationResult => ({
	affectedRows: 1,
	projectionCount: 1,
	stale: false,
	...override,
});

const makeHistory = (override: Partial<DiscordHistory["Service"]> = {}) =>
	DiscordHistory.of({
		fetchGuild: () => Effect.die("unused"),
		fetchGuildChannels: () => Effect.die("unused"),
		fetchUser: () => Effect.die("unused"),
		fetchMessage: () => Effect.succeed(as(message)),
		lookupGuildChannelCacheFirst: () => Effect.die("unused"),
		lookupGuildChannelFetchRequired: () => Effect.die("unused"),
		hydrateMessage: () => Effect.succeed(as(message)),
		resolveThreadStarterReference: () =>
			Effect.succeed({ message: as(message), publicationChannelId: "thread" }),
		fetchMessagePage: () => Effect.die("unused"),
		fetchActiveThreads: () => Effect.die("unused"),
		fetchArchivedPublicThreadPage: () => Effect.die("unused"),
		calculateBotPermissionFacts: () =>
			Effect.succeed({
				effectivePermissions: 0n,
				hasViewChannel: true,
				hasReadMessageHistory: true,
			}),
		...override,
	});

const makeRepository = (
	override: Partial<IndexingRepositoryService["Service"]> = {},
) =>
	IndexingRepository.of({
		upsertChannelMetadata: () => Effect.die("unused"),
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
		repairJobs: () => Effect.die("unused"),
		activeServerIds: () => Effect.die("unused"),
		markServerLeft: () => Effect.die("unused"),
		storedCandidates: () => Effect.die("unused"),
		storedSupportedContainers: () => Effect.die("unused"),
		getCheckpoint: () => Effect.succeed(null),
		upsertCheckpoint: (input) =>
			Effect.succeed(
				as({
					...input,
					updatedAt: new Date(0),
				}),
			),
		resetCheckpoint: () => Effect.die("unused"),
		sourceFacts: () => Effect.succeed(sourceFacts),
		commitMessage: () =>
			Effect.succeed({
				committedMessageIds: ["message"],
				staleMessageIds: [],
				privacyRejectedMessageIds: [],
				projectionCount: 1,
			}),
		deleteMessage: () => Effect.succeed(result()),
		deleteThread: () => Effect.succeed(result()),
		reconcileThread: () => Effect.succeed(result()),
		claim: () => Effect.succeed([]),
		complete: () => Effect.void,
		defer: () => Effect.void,
		fail: () => Effect.void,
		release: () => Effect.void,
		source: () => Effect.succeed([]),
		...override,
	});

const makeInstallationRepository = (
	override: Partial<GuildInstallationRepositoryService["Service"]> = {},
) =>
	GuildInstallationRepository.of({
		complete: () => Effect.succeed({ _tag: "Unauthorized" }),
		...override,
	});

const run = (
	mutation: IndexMutation,
	repository: IndexingRepositoryService["Service"],
	history = makeHistory(),
	installations = makeInstallationRepository(),
	options: Parameters<typeof makeIndexMutationProcessor>[0] = {
		maximumRetries: 2,
		initialRetryDelay: "100 millis",
	},
) =>
	Effect.gen(function* () {
		const processor = yield* makeIndexMutationProcessor(options);
		yield* processor.process(mutation);
	}).pipe(
		Effect.provide(
			Layer.mergeAll(
				Layer.succeed(DiscordHistory, history),
				Layer.succeed(IndexingRepository, repository),
				Layer.succeed(GuildInstallationRepository, installations),
			),
		),
	);

describe("IndexMutationProcessor", () => {
	it.effect("does not silently accept an unknown persisted mutation", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				run(
					{ _tag: "FutureMutation" } as unknown as IndexMutation,
					makeRepository(),
				),
			);
			assert.isTrue(Exit.isFailure(exit));
		}),
	);

	it.effect("fetches, converts, and commits an upsert", () => {
		const commits: unknown[] = [];
		return run(
			upsert,
			makeRepository({
				commitMessage: (input) => {
					commits.push(input);
					return Effect.succeed({
						committedMessageIds: ["message"],
						staleMessageIds: [],
						privacyRejectedMessageIds: [],
						projectionCount: 1,
					});
				},
			}),
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					assert.lengthOf(commits, 1);
					const commit = as<{
						messages: Array<{
							content: string;
							publicationChannelId: string;
							sourceVersion: number;
						}>;
					}>(commits[0]);
					assert.equal(commit.messages[0]?.content, "hello");
					assert.equal(commit.messages[0]?.publicationChannelId, "thread");
					assert.equal(commit.messages[0]?.sourceVersion, upsert.observedAt);
				}),
			),
		);
	});

	it.effect(
		"routes message and thread deletes to authoritative operations",
		() => {
			const calls: string[] = [];
			const repository = makeRepository({
				deleteMessage: () => {
					calls.push("message");
					return Effect.succeed(result());
				},
				deleteThread: () => {
					calls.push("thread");
					return Effect.succeed(result());
				},
			});
			return Effect.gen(function* () {
				yield* run(
					{
						_tag: "DeleteMessage",
						messageId: "message",
						channelId: "thread",
						threadId: "thread",
						observedAt: 1,
					},
					repository,
				);
				yield* run(
					{
						_tag: "DeleteThread",
						threadId: "thread",
						parentChannelId: "parent",
						guildId: "guild",
						observedAt: 2,
					},
					repository,
				);
				assert.deepEqual(calls, ["message", "thread"]);
			});
		},
	);

	it.effect("terminally skips current policy and privacy rejections", () => {
		let commits = 0;
		let deletes = 0;
		const skippedPolicy = makeRepository({
			sourceFacts: () =>
				Effect.succeed({ ...sourceFacts, indexingEnabled: false }),
			commitMessage: () => {
				commits += 1;
				return Effect.die("must not commit");
			},
			deleteMessage: () => {
				deletes += 1;
				return Effect.succeed(result());
			},
		});
		const privacyRejected = makeRepository({
			commitMessage: () =>
				Effect.succeed({
					committedMessageIds: [],
					staleMessageIds: [],
					privacyRejectedMessageIds: ["message"],
					projectionCount: 0,
				}),
			deleteMessage: () => {
				deletes += 1;
				return Effect.succeed(result());
			},
		});
		return Effect.gen(function* () {
			yield* run(upsert, skippedPolicy);
			yield* run(upsert, privacyRejected);
			assert.equal(commits, 0);
			assert.equal(deletes, 2);
		});
	});

	it.effect("retries typed database failures on the TestClock schedule", () => {
		let attempts = 0;
		const repository = makeRepository({
			sourceFacts: () => {
				attempts += 1;
				return attempts === 1
					? Effect.fail(
							new IndexingRepositoryError({
								operation: "source-facts",
								cause: "temporary",
							}),
						)
					: Effect.succeed(sourceFacts);
			},
		});
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(run(upsert, repository));
			yield* Effect.yieldNow;
			assert.equal(attempts, 1);
			yield* TestClock.adjust("100 millis");
			yield* Fiber.join(fiber);
			assert.equal(attempts, 2);
		});
	});

	it.effect("accepts a stale reconciliation as a completed outcome", () => {
		let reconciled = false;
		return run(
			{
				_tag: "ReconcileThread",
				threadId: "thread",
				parentChannelId: "parent",
				guildId: "guild",
				requestedAt: 1,
			},
			makeRepository({
				upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
				upsertChannelMetadata: (input) =>
					Effect.succeed(
						as({
							_tag: "Applied",
							channel: { ...input, indexingEnabled: false },
							observedAt: input.observedAt,
						}),
					),
				reconcileThread: () => {
					reconciled = true;
					return Effect.succeed(
						result({ affectedRows: 0, projectionCount: 0, stale: true }),
					);
				},
			}),
			makeHistory({
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					Effect.succeed(
						as({
							id: channelId,
							guildId: "guild",
							guild: {
								id: "guild",
								name: "Guild",
								description: null,
								memberCount: 1,
								icon: null,
							},
							parentId: channelId === "thread" ? "parent" : null,
							type:
								channelId === "thread"
									? ChannelType.PublicThread
									: ChannelType.GuildForum,
							name: channelId,
							nsfw: false,
							availableTags: [],
							appliedTags: [],
							isThread: () => channelId === "thread",
						}),
					),
			}),
		).pipe(Effect.tap(() => Effect.sync(() => assert.isTrue(reconciled))));
	});

	for (const parentEnabled of [true, false]) {
		it.effect(
			`persists an absent created thread under an ${parentEnabled ? "enabled" : "disabled"} parent`,
			() => {
				const metadata: string[] = [];
				let reconciliations = 0;
				let commits = 0;
				let deletes = 0;
				let threadMetadataReady = false;
				const guild = as<Guild>({
					id: "guild",
					name: "Guild",
					description: null,
					memberCount: 1,
					icon: null,
				});
				const parent = as<GuildBasedChannel>({
					id: "parent",
					guild,
					guildId: "guild",
					parentId: null,
					type: ChannelType.GuildForum,
					name: "Parent",
					nsfw: false,
					availableTags: [],
					isThread: () => false,
				});
				const created = as<GuildBasedChannel>({
					id: "thread",
					guild,
					guildId: "guild",
					parentId: "parent",
					type: ChannelType.PublicThread,
					name: "Created",
					ownerId: "owner",
					archived: false,
					locked: false,
					archiveTimestamp: null,
					appliedTags: [],
					isThread: () => true,
				});
				const repository = makeRepository({
					upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
					upsertChannelMetadata: (input) =>
						Effect.sync(() => {
							metadata.push(input.id);
							if (input.id === "thread") threadMetadataReady = true;
							return as({
								_tag: "Applied",
								channel: {
									...input,
									indexingEnabled:
										input.id === "parent" ? parentEnabled : false,
								},
								observedAt: input.observedAt,
							});
						}),
					reconcileThread: () =>
						Effect.sync(() => {
							reconciliations += 1;
							return result();
						}),
					sourceFacts: () =>
						Effect.succeed(
							threadMetadataReady
								? { ...sourceFacts, indexingEnabled: parentEnabled }
								: null,
						),
					commitMessage: () =>
						Effect.sync(() => {
							commits += 1;
							return {
								committedMessageIds: ["message"],
								staleMessageIds: [],
								privacyRejectedMessageIds: [],
								projectionCount: 1,
							};
						}),
					deleteMessage: () =>
						Effect.sync(() => {
							deletes += 1;
							return result();
						}),
				});
				const history = makeHistory({
					lookupGuildChannelFetchRequired: ({ channelId }) =>
						Effect.succeed(channelId === "thread" ? created : parent),
				});

				return Effect.gen(function* () {
					// Discord can deliver the starter before ThreadCreate metadata exists.
					yield* run(upsert, repository, history);
					yield* run(
						{
							_tag: "ReconcileThread",
							threadId: "thread",
							parentChannelId: "parent",
							guildId: "guild",
							requestedAt: 10,
							reconcileStarter: true,
						},
						repository,
						history,
					);
					assert.deepEqual(metadata, ["parent", "thread"]);
					assert.equal(reconciliations, 1);
					assert.equal(commits, parentEnabled ? 1 : 0);
					assert.equal(deletes, parentEnabled ? 0 : 1);
				});
			},
		);
	}

	it.effect("persists ThreadUpdate state before reconciliation", () => {
		const metadata: Array<
			Parameters<
				IndexingRepositoryService["Service"]["upsertChannelMetadata"]
			>[0]
		> = [];
		let reconciled = false;
		const guild = as<Guild>({
			id: "guild",
			name: "Guild",
			description: null,
			memberCount: 1,
			icon: null,
		});
		const parent = as<GuildBasedChannel>({
			id: "parent",
			guild,
			guildId: "guild",
			parentId: null,
			type: ChannelType.GuildForum,
			name: "Parent",
			nsfw: false,
			availableTags: [
				{ id: "tag", name: "Tag", moderated: false, emoji: null },
			],
			isThread: () => false,
		});
		const updated = as<GuildBasedChannel>({
			id: "thread",
			guild,
			guildId: "guild",
			parentId: "parent",
			type: ChannelType.PublicThread,
			name: "Updated",
			ownerId: "owner",
			archived: true,
			locked: true,
			archiveTimestamp: 123,
			appliedTags: ["tag"],
			isThread: () => true,
		});
		return run(
			{
				_tag: "ReconcileThread",
				threadId: "thread",
				parentChannelId: "parent",
				guildId: "guild",
				requestedAt: 20,
			},
			makeRepository({
				upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
				upsertChannelMetadata: (input) =>
					Effect.sync(() => {
						metadata.push(input);
						return as({
							_tag: "Applied",
							channel: { ...input, indexingEnabled: input.id === "parent" },
							observedAt: input.observedAt,
						});
					}),
				reconcileThread: () =>
					Effect.sync(() => {
						reconciled = true;
						return result();
					}),
			}),
			makeHistory({
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					Effect.succeed(channelId === "thread" ? updated : parent),
				calculateBotPermissionFacts: () =>
					Effect.succeed({
						effectivePermissions: 7n,
						hasViewChannel: true,
						hasReadMessageHistory: true,
					}),
			}),
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					assert.deepEqual(
						metadata.map(({ id }) => id),
						["parent", "thread"],
					);
					assert.deepInclude(metadata[0], {
						botPermissions: "7",
						availableTags: {
							_tag: "Replace",
							items: [
								{
									id: "tag",
									name: "Tag",
									moderated: false,
									emojiId: null,
									emojiName: null,
								},
							],
						},
					});
					assert.deepInclude(metadata[1], {
						archived: true,
						locked: true,
						archivedTimestamp: 123,
						appliedTagIds: { _tag: "Replace", items: ["tag"] },
					});
					assert.isTrue(reconciled);
				}),
			),
		);
	});

	it.effect("skips thread metadata before installation authorization", () => {
		let historyCalls = 0;
		let upserts = 0;
		return run(
			{
				_tag: "ReconcileThread",
				threadId: "thread",
				parentChannelId: "parent",
				guildId: "guild",
				requestedAt: 1,
			},
			makeRepository({
				guildInstallationExists: () => Effect.succeed(false),
				upsertChannelMetadata: () =>
					Effect.sync(() => {
						upserts += 1;
						return as({ _tag: "Applied" });
					}),
			}),
			makeHistory({
				lookupGuildChannelFetchRequired: () =>
					Effect.sync(() => {
						historyCalls += 1;
						return as({});
					}),
			}),
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					assert.equal(historyCalls, 0);
					assert.equal(upserts, 0);
				}),
			),
		);
	});

	it.effect("does not revive a tombstoned thread from a stale create", () => {
		const attempted: string[] = [];
		let reconciled = false;
		const guild = as<Guild>({
			id: "guild",
			name: "Guild",
			description: null,
			memberCount: 1,
			icon: null,
		});
		const channel = (id: string) =>
			as<GuildBasedChannel>({
				id,
				guild,
				guildId: "guild",
				parentId: id === "thread" ? "parent" : null,
				type:
					id === "thread" ? ChannelType.PublicThread : ChannelType.GuildForum,
				name: id,
				nsfw: false,
				availableTags: [],
				appliedTags: [],
				isThread: () => id === "thread",
			});
		return run(
			{
				_tag: "ReconcileThread",
				threadId: "thread",
				parentChannelId: "parent",
				guildId: "guild",
				requestedAt: 20,
			},
			makeRepository({
				upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
				upsertChannelMetadata: (input) =>
					Effect.sync(() => {
						attempted.push(input.id);
						return input.id === "thread"
							? {
									_tag: "Deleted" as const,
									containerId: input.id,
									deletedAt: new Date(10),
									observedAt: input.observedAt,
								}
							: as({
									_tag: "Applied",
									channel: { ...input, indexingEnabled: true },
									observedAt: input.observedAt,
								});
					}),
				reconcileThread: () =>
					Effect.sync(() => {
						reconciled = true;
						return result();
					}),
			}),
			makeHistory({
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					Effect.succeed(channel(channelId)),
			}),
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					assert.deepEqual(attempted, ["parent", "thread"]);
					assert.isFalse(reconciled);
				}),
			),
		);
	});

	it.effect(
		"persists onboarding parents while leaving active threads to the requested job",
		() => {
			const inputs: unknown[] = [];
			let left = false;
			const guild = as<Guild>({
				id: "guild",
				name: "Guild",
				description: "Description",
				memberCount: 42,
				icon: "icon",
				leave: async () => {
					left = true;
					return guild;
				},
			});
			const category = as<GuildBasedChannel>({
				id: "category",
				guildId: "guild",
				type: ChannelType.GuildCategory,
				name: "Category",
				parentId: null,
				rawPosition: 0,
				isThread: () => false,
			});
			const forum = as<GuildBasedChannel>({
				id: "forum",
				guildId: "guild",
				type: ChannelType.GuildForum,
				name: "Forum",
				parentId: "category",
				rawPosition: 1,
				nsfw: false,
				availableTags: [],
				isThread: () => false,
			});
			const activeThread = as<GuildBasedChannel>({
				id: "active-thread",
				guildId: "guild",
				type: ChannelType.PublicThread,
				name: "Active thread",
				parentId: "forum",
				isThread: () => true,
			});

			return run(
				{ _tag: "InstallGuild", guildId: "guild", observedAt: 10 },
				makeRepository(),
				makeHistory({
					fetchGuild: () => Effect.succeed(guild),
					fetchGuildChannels: () =>
						Effect.succeed([activeThread, forum, category]),
					calculateBotPermissionFacts: () =>
						Effect.succeed({
							effectivePermissions: 7n,
							hasViewChannel: true,
							hasReadMessageHistory: true,
						}),
				}),
				makeInstallationRepository({
					complete: (input) =>
						Effect.sync(() => {
							inputs.push(input);
							return { _tag: "Installed", installerUserId: "user" } as const;
						}),
				}),
				{
					maximumRetries: 0,
					initialRetryDelay: "1 millis",
					environment: "production",
				},
			).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						assert.isFalse(left);
						const input = as<{
							channels: Array<{ id: string; botPermissions: string | null }>;
						}>(inputs[0]);
						assert.deepEqual(
							input.channels.map(({ id }) => id),
							["category", "forum"],
						);
						assert.equal(input.channels[1]?.botPermissions, "7");
						assert.notProperty(input, "now");
					}),
				),
			);
		},
	);

	it.effect(
		"rejects a queued installation consumed after its invite expires",
		() => {
			let left = 0;
			const guild = as<Guild>({
				id: "guild",
				name: "Guild",
				description: null,
				memberCount: 1,
				icon: null,
				leave: async () => {
					left += 1;
					return guild;
				},
			});
			const history = makeHistory({
				fetchGuild: () => Effect.sleep("31 minutes").pipe(Effect.as(guild)),
				fetchGuildChannels: () => Effect.succeed([]),
			});
			const installations = makeInstallationRepository({
				complete: (input) =>
					Clock.currentTimeMillis.pipe(
						Effect.map((consumedAt) => {
							assert.notProperty(input, "now");
							return consumedAt > 30 * 60 * 1_000
								? ({ _tag: "Unauthorized" } as const)
								: ({ _tag: "Installed", installerUserId: "user" } as const);
						}),
					),
			});

			return Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					run(
						{ _tag: "InstallGuild", guildId: "guild", observedAt: 0 },
						makeRepository(),
						history,
						installations,
						{
							maximumRetries: 0,
							initialRetryDelay: "1 millis",
							environment: "production",
						},
					),
				);
				yield* TestClock.adjust("31 minutes");
				yield* Fiber.join(fiber);
				assert.equal(left, 1);
			});
		},
	);

	it.effect("cannot authorize an expired invite on installation retry", () => {
		let attempts = 0;
		let left = 0;
		const guild = as<Guild>({
			id: "guild",
			name: "Guild",
			description: null,
			memberCount: 1,
			icon: null,
			leave: async () => {
				left += 1;
				return guild;
			},
		});
		const installations = makeInstallationRepository({
			complete: (input) =>
				Effect.gen(function* () {
					attempts += 1;
					assert.notProperty(input, "now");
					const consumedAt = yield* Clock.currentTimeMillis;
					if (attempts === 1) {
						return yield* Effect.fail(
							new GuildInstallationRepositoryError({
								operation: "complete-installation",
								cause: "serialization failure",
							}),
						);
					}
					return consumedAt >= 30 * 60 * 1_000
						? ({ _tag: "Unauthorized" } as const)
						: ({ _tag: "Installed", installerUserId: "user" } as const);
				}),
		});

		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(
				run(
					{ _tag: "InstallGuild", guildId: "guild", observedAt: 0 },
					makeRepository(),
					makeHistory({
						fetchGuild: () => Effect.succeed(guild),
						fetchGuildChannels: () => Effect.succeed([]),
					}),
					installations,
					{
						maximumRetries: 1,
						initialRetryDelay: "30 minutes",
						environment: "production",
					},
				),
			);
			yield* Effect.yieldNow;
			assert.equal(attempts, 1);
			yield* TestClock.adjust("30 minutes");
			yield* Fiber.join(fiber);
			assert.equal(attempts, 2);
			assert.equal(left, 1);
		});
	});

	it.effect("leaves an unauthorized production guild", () => {
		let left = 0;
		const guild = as<Guild>({
			id: "guild",
			name: "Guild",
			description: null,
			memberCount: 1,
			icon: null,
			leave: async () => {
				left += 1;
				return guild;
			},
		});
		return run(
			{ _tag: "InstallGuild", guildId: "guild", observedAt: 1 },
			makeRepository(),
			makeHistory({
				fetchGuild: () => Effect.succeed(guild),
				fetchGuildChannels: () => Effect.succeed([]),
			}),
			makeInstallationRepository(),
			{
				maximumRetries: 0,
				initialRetryDelay: "1 millis",
				environment: "production",
			},
		).pipe(Effect.tap(() => Effect.sync(() => assert.equal(left, 1))));
	});

	it.effect("applies the configured development guild policy", () => {
		let fallbackUser: string | undefined;
		return run(
			{ _tag: "InstallGuild", guildId: "dev-guild", observedAt: 1 },
			makeRepository(),
			makeHistory({
				fetchGuild: () =>
					Effect.succeed(
						as<Guild>({
							id: "dev-guild",
							name: "Dev",
							description: null,
							memberCount: 1,
							icon: null,
						}),
					),
				fetchGuildChannels: () => Effect.succeed([]),
			}),
			makeInstallationRepository({
				complete: (input) =>
					Effect.sync(() => {
						fallbackUser = input.developmentInstallerUserId;
						return { _tag: "Installed", installerUserId: "developer" } as const;
					}),
			}),
			{
				maximumRetries: 0,
				initialRetryDelay: "1 millis",
				environment: "development",
				developmentGuildId: "dev-guild",
				developmentInstallerUserId: "developer",
			},
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => assert.equal(fallbackUser, "developer")),
			),
		);
	});

	it.effect("accepts an authorized rejoin without a pending invite", () => {
		let completed = false;
		return run(
			{ _tag: "InstallGuild", guildId: "guild", observedAt: 1 },
			makeRepository(),
			makeHistory({
				fetchGuild: () =>
					Effect.succeed(
						as<Guild>({
							id: "guild",
							name: "Guild",
							description: null,
							memberCount: 1,
							icon: null,
						}),
					),
				fetchGuildChannels: () => Effect.succeed([]),
			}),
			makeInstallationRepository({
				complete: (input) =>
					Effect.sync(() => {
						assert.isUndefined(input.developmentInstallerUserId);
						completed = true;
						return { _tag: "Rejoined" } as const;
					}),
			}),
			{
				maximumRetries: 0,
				initialRetryDelay: "1 millis",
				environment: "production",
			},
		).pipe(Effect.tap(() => Effect.sync(() => assert.isTrue(completed))));
	});

	it.effect(
		"fails installation atomically and does not leave the guild",
		() => {
			const persisted: string[] = [];
			let left = false;
			const guild = as<Guild>({
				id: "guild",
				name: "Guild",
				description: null,
				memberCount: 1,
				icon: null,
				leave: async () => {
					left = true;
					return guild;
				},
			});
			return Effect.exit(
				run(
					{ _tag: "InstallGuild", guildId: "guild", observedAt: 1 },
					makeRepository(),
					makeHistory({
						fetchGuild: () => Effect.succeed(guild),
						fetchGuildChannels: () => Effect.succeed([]),
					}),
					makeInstallationRepository({
						complete: () =>
							Effect.fail(
								new GuildInstallationRepositoryError({
									operation: "complete-installation",
									cause: "transaction rolled back",
								}),
							),
					}),
					{
						maximumRetries: 0,
						initialRetryDelay: "1 millis",
						environment: "production",
					},
				),
			).pipe(
				Effect.tap((exit) =>
					Effect.sync(() => {
						assert.isTrue(Exit.isFailure(exit));
						assert.deepEqual(persisted, []);
						assert.isFalse(left);
					}),
				),
			);
		},
	);

	it.effect(
		"does not authorize metadata events around a failed installation",
		() => {
			let installed = false;
			let authorizeNextInstall = false;
			let serverCreations = 0;
			let guildUpdates = 0;
			let channelUpserts = 0;
			const guild = as<Guild>({
				id: "guild",
				name: "Guild",
				description: null,
				memberCount: 1,
				icon: null,
			});
			const channel = as<GuildBasedChannel>({
				id: "channel",
				guild,
				guildId: "guild",
				type: ChannelType.GuildText,
				name: "Channel",
				parentId: null,
				rawPosition: 0,
				nsfw: false,
				isThread: () => false,
			});
			const repository = makeRepository({
				guildInstallationExists: () => Effect.succeed(installed),
				upsertGuildMetadata: () =>
					Effect.sync(() => {
						if (!installed) {
							return {
								_tag: "MissingInstallation" as const,
								serverId: "guild",
							};
						}
						guildUpdates += 1;
						return { _tag: "Updated" as const };
					}),
				upsertChannelMetadata: (input) =>
					Effect.sync(() => {
						channelUpserts += 1;
						return as({
							_tag: "Applied",
							channel: { ...input, indexingEnabled: false },
							observedAt: input.observedAt,
						});
					}),
			});
			const history = makeHistory({
				fetchGuild: () => Effect.succeed(guild),
				fetchGuildChannels: () => Effect.succeed([]),
				lookupGuildChannelFetchRequired: () => Effect.succeed(channel),
			});
			const installations = makeInstallationRepository({
				complete: () =>
					Effect.suspend(() => {
						if (!authorizeNextInstall) {
							return Effect.fail(
								new GuildInstallationRepositoryError({
									operation: "complete-installation",
									cause: "transaction rolled back",
								}),
							);
						}
						installed = true;
						serverCreations += 1;
						return Effect.succeed({
							_tag: "Installed" as const,
							installerUserId: "user",
						});
					}),
			});
			const options = {
				maximumRetries: 0,
				initialRetryDelay: "1 millis" as const,
				environment: "production" as const,
			};

			return Effect.gen(function* () {
				yield* run(
					{ _tag: "UpsertGuild", guildId: "guild", observedAt: 1 },
					repository,
					history,
					installations,
					options,
				);
				yield* run(
					{
						_tag: "UpsertChannel",
						channelId: "channel",
						guildId: "guild",
						observedAt: 2,
					},
					repository,
					history,
					installations,
					options,
				);
				const failedInstall = yield* Effect.exit(
					run(
						{ _tag: "InstallGuild", guildId: "guild", observedAt: 3 },
						repository,
						history,
						installations,
						options,
					),
				);

				assert.isTrue(Exit.isFailure(failedInstall));
				assert.isFalse(installed);
				assert.equal(serverCreations, 0);
				assert.equal(guildUpdates, 0);
				assert.equal(channelUpserts, 0);

				authorizeNextInstall = true;
				yield* run(
					{ _tag: "InstallGuild", guildId: "guild", observedAt: 4 },
					repository,
					history,
					installations,
					options,
				);
				yield* run(
					{ _tag: "UpsertGuild", guildId: "guild", observedAt: 5 },
					repository,
					history,
					installations,
					options,
				);
				yield* run(
					{
						_tag: "UpsertChannel",
						channelId: "channel",
						guildId: "guild",
						observedAt: 6,
					},
					repository,
					history,
					installations,
					options,
				);

				assert.isTrue(installed);
				assert.equal(serverCreations, 1);
				assert.equal(guildUpdates, 2);
				assert.equal(channelUpserts, 1);
			});
		},
	);

	it.effect("persists authoritative channel, guild, and user metadata", () => {
		const guild = as<Guild>({
			id: "guild",
			name: "Guild",
			description: "Description",
			memberCount: 42,
			icon: "icon",
		});
		const category = as({
			id: "category",
			guild,
			guildId: "guild",
			type: ChannelType.GuildCategory,
			name: "Category",
			parentId: null,
			rawPosition: 1,
			isThread: () => false,
		});
		const forum = as({
			id: "forum",
			guild,
			guildId: "guild",
			type: ChannelType.GuildForum,
			name: "Forum",
			parentId: "category",
			rawPosition: 2,
			nsfw: false,
			availableTags: [
				{ id: "tag", name: "Tag", moderated: false, emoji: { name: "x" } },
			],
			isThread: () => false,
		});
		const thread = as({
			id: "thread",
			guild,
			guildId: "guild",
			type: ChannelType.PublicThread,
			name: "Thread",
			parentId: "forum",
			ownerId: "owner",
			archived: true,
			locked: false,
			archiveTimestamp: 10,
			appliedTags: ["tag"],
			isThread: () => true,
		});
		const channels = new Map([
			["category", category],
			["forum", forum],
			["thread", thread],
		]);
		const metadata: Array<
			Parameters<
				IndexingRepositoryService["Service"]["upsertChannelMetadata"]
			>[0]
		> = [];
		const guilds: unknown[] = [];
		const users: unknown[] = [];
		const deletes: unknown[] = [];
		const repository = makeRepository({
			upsertChannelMetadata: (input) =>
				Effect.sync(() => {
					metadata.push(input);
					return as({
						_tag: "Applied",
						channel: { ...input, indexingEnabled: false },
						observedAt: input.observedAt,
					});
				}),
			upsertGuildMetadata: (input) =>
				Effect.sync(() => {
					guilds.push(input);
					return { _tag: "Updated" as const };
				}),
			updateUserProfile: (input) =>
				Effect.sync(() => {
					users.push(input);
					return null;
				}),
			deleteChannel: (input) =>
				Effect.sync(() => {
					deletes.push(input);
					return result();
				}),
		});
		const history = makeHistory({
			lookupGuildChannelFetchRequired: ({ channelId }) =>
				Effect.succeed(as(channels.get(channelId))),
			fetchGuild: () => Effect.succeed(guild),
			fetchUser: () =>
				Effect.succeed(
					as({ id: "user", username: "User", avatar: null, bot: false }),
				),
			calculateBotPermissionFacts: () =>
				Effect.succeed({
					effectivePermissions: 7n,
					hasViewChannel: true,
					hasReadMessageHistory: true,
				}),
		});
		return Effect.gen(function* () {
			yield* run(
				{
					_tag: "UpsertChannel",
					channelId: "thread",
					guildId: "guild",
					observedAt: 5,
				},
				repository,
				history,
			);
			yield* run(
				{
					_tag: "DeleteChannel",
					channelId: "forum",
					guildId: "guild",
					scope: "tree",
					observedAt: 6,
				},
				repository,
				history,
			);
			yield* run(
				{ _tag: "UpsertGuild", guildId: "guild", observedAt: 7 },
				repository,
				history,
			);
			yield* run(
				{ _tag: "UpsertUser", userId: "user", observedAt: 8 },
				repository,
				history,
			);
			assert.deepEqual(
				metadata.map(({ id }) => id),
				["category", "forum", "thread"],
			);
			assert.equal(metadata[2]?.botPermissions, "7");
			assert.deepEqual(metadata[2]?.appliedTagIds, {
				_tag: "Replace",
				items: ["tag"],
			});
			assert.lengthOf(guilds, 2);
			assert.lengthOf(users, 1);
			assert.deepEqual(deletes, [
				{
					channelId: "forum",
					serverId: "guild",
					scope: "tree",
					observedAt: new Date(6),
				},
			]);
		});
	});

	it.effect(
		"preserves a reparented child when category deletion is processed first",
		() => {
			const guild = as<Guild>({
				id: "guild",
				name: "Guild",
				description: null,
				memberCount: 1,
				icon: null,
			});
			const child = as<GuildBasedChannel>({
				id: "channel",
				guild,
				guildId: "guild",
				type: ChannelType.GuildText,
				name: "Channel",
				parentId: null,
				rawPosition: 1,
				nsfw: false,
				isThread: () => false,
			});
			const deletes: unknown[] = [];
			const metadata: unknown[] = [];
			const repository = makeRepository({
				deleteChannel: (input) =>
					Effect.sync(() => {
						deletes.push(input);
						return result();
					}),
				upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
				upsertChannelMetadata: (input) =>
					Effect.sync(() => {
						metadata.push(input);
						return as({
							_tag: "Applied",
							channel: { ...input, indexingEnabled: false },
							observedAt: input.observedAt,
						});
					}),
			});
			const history = makeHistory({
				lookupGuildChannelFetchRequired: () => Effect.succeed(child),
				calculateBotPermissionFacts: () =>
					Effect.succeed({
						effectivePermissions: 1n,
						hasViewChannel: true,
						hasReadMessageHistory: true,
					}),
			});

			return Effect.gen(function* () {
				yield* run(
					{
						_tag: "DeleteChannel",
						channelId: "category",
						guildId: "guild",
						scope: "self",
						observedAt: 10,
					},
					repository,
					history,
				);
				yield* run(
					{
						_tag: "UpsertChannel",
						channelId: "channel",
						guildId: "guild",
						observedAt: 11,
					},
					repository,
					history,
				);

				assert.equal((deletes[0] as { readonly scope: string }).scope, "self");
				assert.equal(
					(metadata[0] as { readonly parentId: string | null }).parentId,
					null,
				);
			});
		},
	);

	it.effect("stops a hierarchy upsert at a tombstoned ancestor", () => {
		const guild = as<Guild>({
			id: "guild",
			name: "Guild",
			description: null,
			memberCount: 1,
			icon: null,
		});
		const category = as({
			id: "category",
			guild,
			guildId: "guild",
			type: ChannelType.GuildCategory,
			name: "Category",
			parentId: null,
			rawPosition: 0,
			isThread: () => false,
		});
		const channel = as({
			id: "channel",
			guild,
			guildId: "guild",
			type: ChannelType.GuildText,
			name: "Channel",
			parentId: "category",
			rawPosition: 1,
			nsfw: false,
			isThread: () => false,
		});
		const attempted: string[] = [];
		return run(
			{
				_tag: "UpsertChannel",
				channelId: "channel",
				guildId: "guild",
				observedAt: 20,
			},
			makeRepository({
				upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
				upsertChannelMetadata: (input) =>
					Effect.sync(() => {
						attempted.push(input.id);
						return {
							_tag: "Deleted" as const,
							containerId: input.id,
							deletedAt: new Date(10),
							observedAt: input.observedAt,
						};
					}),
			}),
			makeHistory({
				lookupGuildChannelFetchRequired: ({ channelId }) =>
					Effect.succeed(
						(channelId === "category"
							? category
							: channel) as GuildBasedChannel,
					),
			}),
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => assert.deepEqual(attempted, ["category"])),
			),
		);
	});

	it.effect(
		"reconciles effective permissions and ignores unsupported channels",
		() => {
			const guild = as<Guild>({
				id: "guild",
				name: "Guild",
				description: null,
				memberCount: 1,
				icon: null,
			});
			const root = as({
				id: "root",
				guild,
				guildId: "guild",
				type: ChannelType.GuildText,
				name: "Root",
				parentId: null,
				rawPosition: 0,
				nsfw: false,
				isThread: () => false,
			});
			const unsupported = as({
				id: "voice",
				guild,
				guildId: "guild",
				type: ChannelType.GuildVoice,
				parentId: null,
				isThread: () => false,
			});
			const diagnostics: unknown[] = [];
			let channelUpserts = 0;
			const repository = makeRepository({
				upsertGuildMetadata: () => Effect.succeed({ _tag: "Updated" }),
				upsertChannelMetadata: (input) =>
					Effect.sync(() => {
						channelUpserts += 1;
						return as({
							_tag: "Applied",
							channel: { ...input, indexingEnabled: false },
							observedAt: input.observedAt,
						});
					}),
				reconcilePermissions: (input) =>
					Effect.sync(() => {
						diagnostics.push(input);
						return 1;
					}),
			});
			const history = makeHistory({
				fetchGuild: () => Effect.succeed(guild),
				fetchGuildChannels: () =>
					Effect.succeed([root, unsupported] as readonly GuildBasedChannel[]),
				lookupGuildChannelFetchRequired: () =>
					Effect.succeed(unsupported as GuildBasedChannel),
				calculateBotPermissionFacts: () =>
					Effect.succeed({
						effectivePermissions: 9n,
						hasViewChannel: true,
						hasReadMessageHistory: true,
					}),
			});
			return Effect.gen(function* () {
				yield* run(
					{
						_tag: "ReconcileRolePermissions",
						guildId: "guild",
						roleId: "role",
						deleted: false,
						observedAt: 11,
					},
					repository,
					history,
				);
				yield* run(
					{
						_tag: "UpsertChannel",
						channelId: "voice",
						guildId: "guild",
						observedAt: 12,
					},
					repository,
					history,
				);
				assert.equal(channelUpserts, 1);
				const diagnostic = as<{
					channelId: string;
					botPermissions: string;
					includeDescendants: boolean;
				}>(diagnostics[0]);
				assert.equal(diagnostic.channelId, "root");
				assert.equal(diagnostic.botPermissions, "9");
				assert.isTrue(diagnostic.includeDescendants);
			});
		},
	);

	it.effect("persists a missed guild leave", () => {
		let observedAt: Date | undefined;
		return run(
			{ _tag: "DeleteGuild", guildId: "guild", observedAt: 123 },
			makeRepository({
				deleteGuild: (_guildId, date) =>
					Effect.sync(() => {
						observedAt = date;
						return result();
					}),
			}),
		).pipe(
			Effect.tap(() =>
				Effect.sync(() => assert.equal(observedAt?.getTime(), 123)),
			),
		);
	});

	it.effect(
		"completes after durable commit while projection remains pending",
		() =>
			run(
				upsert,
				makeRepository({
					commitMessage: () =>
						Effect.succeed({
							committedMessageIds: ["message"],
							staleMessageIds: [],
							privacyRejectedMessageIds: [],
							projectionCount: 1,
						}),
				}),
			),
	);
});
