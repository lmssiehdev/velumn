import { assert, describe, it } from "@effect/vitest";
import {
	ChannelType,
	type Client,
	Collection,
	type FetchedThreads,
	type FetchedThreadsMore,
	type Guild,
	type GuildBasedChannel,
	type GuildTextBasedChannel,
	type Message,
	type MessageReference,
	MessageReferenceType,
	MessageType,
	PermissionFlagsBits,
	PermissionsBitField,
	type TextChannel,
} from "discord.js";
import { Effect } from "effect";
import { DiscordClient } from "../discord/client";
import {
	classifyDiscordHistoryError,
	DiscordHistoryMissingError,
	DiscordHistoryPermissionError,
	DiscordHistoryTransientError,
	DiscordHistoryUnknownError,
	makeDiscordHistory,
} from "./discord-history";

const as = <A>(value: Parameters<typeof structuredClone>[0]): A => value as A;

const makeDiscord = (guilds: Collection<string, Guild> = new Collection()) =>
	DiscordClient.of({
		client: as<Client<true>>({
			guilds: { cache: guilds },
			user: { id: "bot" },
		}),
		events: as<DiscordClient["Service"]["events"]>({}),
	});

const makeGuild = (channels: Collection<string, GuildBasedChannel>) =>
	as<Guild>({ channels: { cache: channels } });

const makeMessage = (override: {
	readonly id: string;
	readonly channelId: string;
	readonly partial?: boolean;
	readonly type?: MessageType;
	readonly reference?: MessageReference | null;
}) =>
	as<Message>({
		partial: false,
		type: MessageType.Default,
		...override,
	});

describe("DiscordHistory", () => {
	it.effect(
		"uses cache-first lookup without REST and forces fetch-required lookup",
		() =>
			Effect.gen(function* () {
				const cached = as<GuildBasedChannel>({ id: "channel" });
				const fetched = as<GuildBasedChannel>({ id: "channel" });
				const guild = makeGuild(new Collection([[cached.id, cached]]));
				const discord = makeDiscord(new Collection([["guild", guild]]));
				const forces: boolean[] = [];
				const history = makeDiscordHistory(discord, {
					fetchGuildChannel: async (_guild, _channelId, force, signal) => {
						assert.instanceOf(signal, AbortSignal);
						forces.push(force);
						return fetched;
					},
				});

				assert.strictEqual(
					yield* history.lookupGuildChannelCacheFirst({
						guildId: "guild",
						channelId: "channel",
					}),
					cached,
				);
				assert.strictEqual(
					yield* history.lookupGuildChannelFetchRequired({
						guildId: "guild",
						channelId: "channel",
					}),
					fetched,
				);
				assert.deepEqual(forces, [true]);
			}),
	);

	it.effect("fetches a cache miss and reports a null channel as missing", () =>
		Effect.gen(function* () {
			const guild = makeGuild(new Collection());
			const history = makeDiscordHistory(
				makeDiscord(new Collection([["guild", guild]])),
				{ fetchGuildChannel: async () => null },
			);
			const error = yield* Effect.flip(
				history.lookupGuildChannelCacheFirst({
					guildId: "guild",
					channelId: "missing",
				}),
			);

			assert.instanceOf(error, DiscordHistoryMissingError);
			if (error instanceof DiscordHistoryMissingError) {
				assert.equal(error.entityId, "missing");
			}
		}),
	);

	it.effect("hydrates only partial messages", () =>
		Effect.gen(function* () {
			const full = makeMessage({ id: "full", channelId: "thread" });
			const hydrated = makeMessage({ id: "partial", channelId: "thread" });
			let calls = 0;
			const history = makeDiscordHistory(makeDiscord(), {
				hydrateMessage: async () => {
					calls += 1;
					return hydrated;
				},
			});

			assert.strictEqual(yield* history.hydrateMessage(full), full);
			assert.strictEqual(
				yield* history.hydrateMessage(
					makeMessage({
						id: "partial",
						channelId: "thread",
						partial: true,
					}),
				),
				hydrated,
			);
			assert.equal(calls, 1);
		}),
	);

	it.effect(
		"resolves thread starter content without replacing publication identity",
		() =>
			Effect.gen(function* () {
				const starter = makeMessage({
					id: "starter",
					channelId: "thread",
					type: MessageType.ThreadStarterMessage,
					reference: {
						messageId: "parent-message",
						channelId: "parent",
						guildId: "guild",
						type: MessageReferenceType.Default,
					},
				});
				const parentMessage = makeMessage({
					id: "parent-message",
					channelId: "parent",
				});
				const history = makeDiscordHistory(makeDiscord(), {
					fetchReference: async () => parentMessage,
				});

				assert.deepEqual(
					yield* history.resolveThreadStarterReference(starter),
					{
						message: parentMessage,
						publicationChannelId: "thread",
					},
				);
			}),
	);

	it.effect("fetches exactly one requested message and thread page", () =>
		Effect.gen(function* () {
			const channel = as<GuildTextBasedChannel & TextChannel>({
				id: "channel",
				type: ChannelType.GuildText,
			});
			const messages = new Collection<string, Message<true>>();
			const threads = as<FetchedThreads>({
				threads: new Collection(),
				members: new Collection(),
			});
			const archived = as<FetchedThreadsMore>({ ...threads, hasMore: true });
			const calls: unknown[] = [];
			const history = makeDiscordHistory(makeDiscord(), {
				fetchMessagePage: async (request) => {
					calls.push(request);
					return messages;
				},
				fetchActiveThreads: async (requestChannel) => {
					calls.push(requestChannel);
					return threads;
				},
				fetchArchivedPublicThreads: async (request) => {
					calls.push(request);
					return archived;
				},
			});

			assert.strictEqual(
				yield* history.fetchMessagePage({
					channel,
					after: "cursor",
					limit: 37,
				}),
				messages,
			);
			assert.strictEqual(yield* history.fetchActiveThreads(channel), threads);
			assert.strictEqual(
				yield* history.fetchArchivedPublicThreadPage({
					channel,
					before: "archive-cursor",
					limit: 22,
				}),
				archived,
			);
			assert.deepEqual(calls, [
				{ channel, after: "cursor", limit: 37 },
				channel,
				{ channel, before: "archive-cursor", limit: 22 },
			]);
		}),
	);

	it.effect("returns effective bot history permission facts", () =>
		Effect.gen(function* () {
			const permissions = new PermissionsBitField([
				PermissionFlagsBits.ViewChannel,
			]);
			const channel = as<GuildBasedChannel>({
				permissionsFor: () => permissions,
			});
			const facts =
				yield* makeDiscordHistory(makeDiscord()).calculateBotPermissionFacts(
					channel,
				);

			assert.equal(facts.effectivePermissions, permissions.bitfield);
			assert.isTrue(facts.hasViewChannel);
			assert.isFalse(facts.hasReadMessageHistory);
		}),
	);
});

describe("DiscordHistory error classification", () => {
	it("maps Discord and transport failures to typed indexing errors", () => {
		const context = {
			operation: "fetch-message-page" as const,
			entity: "message" as const,
			entityId: "entity",
		};
		assert.instanceOf(
			classifyDiscordHistoryError({ code: 10_008 }, context),
			DiscordHistoryMissingError,
		);
		assert.instanceOf(
			classifyDiscordHistoryError({ code: 50_013, status: 403 }, context),
			DiscordHistoryPermissionError,
		);
		assert.instanceOf(
			classifyDiscordHistoryError({ status: 503 }, context),
			DiscordHistoryTransientError,
		);
		assert.instanceOf(
			classifyDiscordHistoryError(new Error("unexpected"), context),
			DiscordHistoryUnknownError,
		);
	});
});
