import { randomUUID } from "node:crypto";
import {
	type AnyThreadChannel,
	ChannelType,
	type ClientEvents,
	Events,
	type Guild,
	type GuildMember,
	type Message,
	type PartialGuildMember,
	type PartialMessage,
	type PartialUser,
	type Role,
	type User,
} from "discord.js";
import { Clock, Context, Effect, Layer, Ref, type Scope } from "effect";
import { DiscordConnection } from "../discord/client";
import type { DiscordEvents } from "../discord/events";
import {
	IndexingCoordinator,
	type IndexingCoordinatorService,
	submitIndexingAdmission,
} from "./coordinator";
import { GatewayMutationInbox } from "./gateway-inbox";
import type {
	DiscordId,
	IndexingOperationError,
	IndexMutation,
	IndexSubmission,
} from "./model";
import { contentOrderingKey } from "./reconciliation";

type Coordinator = IndexingCoordinatorService<IndexingOperationError>;
type GuildMessage = Message<true> | PartialMessage<true>;

const installationRetryInitialDelay = 1_000;
const installationRetryMaxDelay = 60_000;

export const channelOrderingKey = (channelId: DiscordId) =>
	`channel:${channelId}`;
export const guildOrderingKey = (guildId: DiscordId) => `guild:${guildId}`;
export const userOrderingKey = (userId: DiscordId) => `user:${userId}`;

const submitMutation = (
	coordinator: Coordinator,
	event: string,
	entityId: DiscordId,
	orderingKey: string,
	mutation: IndexMutation,
	submittedAt: number,
) => {
	const submission: IndexSubmission = {
		id: `gateway:${event}:${entityId}:${submittedAt}:${randomUUID()}`,
		source: "gateway",
		orderingKey,
		mutation,
		submittedAt,
	};

	return coordinator.submit(submission).pipe(
		Effect.flatMap((result) => {
			if (result._tag === "Accepted") {
				// Acceptance only means the coordinator owns this in-memory work.
				return Effect.void;
			}
			if (result._tag === "Overloaded") {
				return Effect.logWarning("Indexing gateway submission overloaded", {
					metric: "indexing_gateway_submission_overloaded",
					event,
					entityId,
					result: result._tag,
				});
			}
			return Effect.logWarning(
				"Indexing gateway submission rejected while closing",
				{
					metric: "indexing_gateway_submission_closing",
					event,
					entityId,
					result: result._tag,
				},
			);
		}),
	);
};

const messageThreadId = (message: GuildMessage): DiscordId | null =>
	message.channel.isThread() ? message.channelId : null;

const submitMessage = (
	coordinator: Coordinator,
	event: string,
	message: Message | PartialMessage,
	_tag: "UpsertMessage" | "DeleteMessage",
) =>
	Effect.gen(function* () {
		if (message.guildId === null) return;
		const observedAt = yield* Clock.currentTimeMillis;
		const guildMessage = message as GuildMessage;
		const threadId = messageThreadId(guildMessage);
		yield* submitMutation(
			coordinator,
			event,
			message.id,
			contentOrderingKey(threadId ?? message.channelId),
			{
				_tag,
				messageId: message.id,
				channelId: message.channelId,
				threadId,
				observedAt,
			},
			observedAt,
		);
	});

const submitThread = (
	coordinator: Coordinator,
	event: string,
	thread: AnyThreadChannel,
	_tag: "ReconcileThread" | "DeleteThread",
) =>
	Effect.gen(function* () {
		const observedAt = yield* Clock.currentTimeMillis;
		if (thread.parentId === null) {
			yield* Effect.logWarning(
				"Skipped thread event without a parent channel",
				{
					metric: "indexing_gateway_event_skipped",
					event,
					threadId: thread.id,
					reason: "missing-parent-channel",
				},
			);
			return;
		}
		const mutation: IndexMutation =
			_tag === "DeleteThread"
				? {
						_tag,
						threadId: thread.id,
						parentChannelId: thread.parentId,
						guildId: thread.guildId,
						observedAt,
					}
				: {
						_tag,
						threadId: thread.id,
						parentChannelId: thread.parentId,
						guildId: thread.guildId,
						requestedAt: observedAt,
						reconcileStarter: true,
					};
		yield* submitMutation(
			coordinator,
			event,
			thread.id,
			contentOrderingKey(thread.id),
			mutation,
			observedAt,
		);
	});

const submitChannel = (
	coordinator: Coordinator,
	event: string,
	channel: ClientEvents["channelDelete"][0],
	_tag: "UpsertChannel" | "DeleteChannel",
) =>
	Effect.gen(function* () {
		if (!("guildId" in channel)) return;
		const observedAt = yield* Clock.currentTimeMillis;
		const mutation: IndexMutation =
			_tag === "DeleteChannel"
				? {
						_tag,
						channelId: channel.id,
						guildId: channel.guildId,
						scope: channel.type === ChannelType.GuildCategory ? "self" : "tree",
						observedAt,
					}
				: {
						_tag,
						channelId: channel.id,
						guildId: channel.guildId,
						observedAt,
					};
		yield* submitMutation(
			coordinator,
			event,
			channel.id,
			channelOrderingKey(channel.id),
			mutation,
			observedAt,
		);
	});

const submitGuild = (
	coordinator: Coordinator,
	event: string,
	guild: Guild,
	_tag: "UpsertGuild" | "DeleteGuild",
) =>
	Effect.gen(function* () {
		const observedAt = yield* Clock.currentTimeMillis;
		yield* submitMutation(
			coordinator,
			event,
			guild.id,
			guildOrderingKey(guild.id),
			{ _tag, guildId: guild.id, observedAt },
			observedAt,
		);
	});

const submitGuildInstallation = (coordinator: Coordinator, guild: Guild) =>
	Effect.gen(function* () {
		const observedAt = yield* Clock.currentTimeMillis;
		const submission: IndexSubmission = {
			id: `gateway:${Events.GuildCreate}:${guild.id}:${observedAt}:${randomUUID()}`,
			source: "gateway",
			orderingKey: guildOrderingKey(guild.id),
			mutation: { _tag: "InstallGuild", guildId: guild.id, observedAt },
			submittedAt: observedAt,
		};

		const submitUntilCompleted = (retryDelay: number): Effect.Effect<void> =>
			Effect.suspend(() =>
				submitIndexingAdmission(coordinator, submission).pipe(
					Effect.flatMap((result) => {
						if (result._tag === "Closing") return Effect.void;

						return result.receipt.await.pipe(
							Effect.flatMap((outcome) => {
								if (outcome._tag === "Completed") return Effect.void;

								return Effect.logWarning(
									"Guild installation failed; scheduling another attempt",
									{
										metric: "indexing_guild_installation_retry",
										guildId: guild.id,
										retryDelay,
										cause: outcome.cause,
									},
								).pipe(
									Effect.andThen(Effect.sleep(retryDelay)),
									Effect.andThen(
										submitUntilCompleted(
											Math.min(retryDelay * 2, installationRetryMaxDelay),
										),
									),
								);
							}),
						);
					}),
				),
			);

		yield* submitUntilCompleted(installationRetryInitialDelay);
	});

const submitUser = (
	coordinator: Coordinator,
	event: string,
	user: User | PartialUser,
) =>
	Effect.gen(function* () {
		const observedAt = yield* Clock.currentTimeMillis;
		yield* submitMutation(
			coordinator,
			event,
			user.id,
			userOrderingKey(user.id),
			{ _tag: "UpsertUser", userId: user.id, observedAt },
			observedAt,
		);
	});

const submitMemberPermissions = (
	coordinator: Coordinator,
	event: string,
	member: GuildMember | PartialGuildMember,
	deleted: boolean,
) =>
	Effect.gen(function* () {
		const observedAt = yield* Clock.currentTimeMillis;
		yield* submitMutation(
			coordinator,
			event,
			member.id,
			guildOrderingKey(member.guild.id),
			{
				_tag: "ReconcileBotMemberPermissions",
				guildId: member.guild.id,
				userId: member.id,
				deleted,
				observedAt,
			},
			observedAt,
		);
	});

const submitRolePermissions = (
	coordinator: Coordinator,
	event: string,
	role: Role,
	deleted: boolean,
) =>
	Effect.gen(function* () {
		const observedAt = yield* Clock.currentTimeMillis;
		yield* submitMutation(
			coordinator,
			event,
			role.id,
			guildOrderingKey(role.guild.id),
			{
				_tag: "ReconcileRolePermissions",
				guildId: role.guild.id,
				roleId: role.id,
				deleted,
				observedAt,
			},
			observedAt,
		);
	});

export const makeIndexingEvents = (
	events: DiscordEvents,
	installationCoordinator: Coordinator,
	botUserId?: DiscordId,
	enqueue?: (submission: IndexSubmission) => Effect.Effect<void>,
): Effect.Effect<void, never, Scope.Scope> =>
	Effect.gen(function* () {
		const coordinator: Coordinator = enqueue
			? {
					...installationCoordinator,
					submit: (submission) =>
						enqueue(submission).pipe(
							Effect.as({
								_tag: "Accepted" as const,
								receipt: {
									await: Effect.succeed({
										_tag: "Completed" as const,
										submissionId: submission.id,
										completedAt: submission.submittedAt,
									}),
								},
							}),
						),
				}
			: installationCoordinator;
		const installingGuilds = yield* Ref.make(new Set<DiscordId>());
		const installGuild = (guild: Guild) =>
			Effect.gen(function* () {
				const started = yield* Ref.modify(installingGuilds, (guildIds) => {
					if (guildIds.has(guild.id)) return [false, guildIds] as const;
					const next = new Set(guildIds);
					next.add(guild.id);
					return [true, next] as const;
				});
				if (!started) return;

				yield* submitGuildInstallation(installationCoordinator, guild).pipe(
					Effect.ensuring(
						Ref.update(installingGuilds, (guildIds) => {
							const next = new Set(guildIds);
							next.delete(guild.id);
							return next;
						}),
					),
				);
			});
		const submitIfBotMember = (
			event: string,
			member: GuildMember | PartialGuildMember,
			deleted: boolean,
		) => {
			const currentBotUserId = botUserId ?? member.client.user.id;
			return member.id === currentBotUserId
				? submitMemberPermissions(coordinator, event, member, deleted)
				: Effect.void;
		};
		const installReadyGuilds = (ready: ClientEvents["clientReady"][0]) =>
			Effect.forEach(ready.guilds.cache.values(), installGuild, {
				concurrency: "unbounded",
				discard: true,
			});

		yield* events.forkOn(Events.MessageCreate, (message) =>
			submitMessage(
				coordinator,
				Events.MessageCreate,
				message,
				"UpsertMessage",
			),
		);
		yield* events.forkOn(Events.MessageUpdate, (_oldMessage, message) =>
			submitMessage(
				coordinator,
				Events.MessageUpdate,
				message,
				"UpsertMessage",
			),
		);
		yield* events.forkOn(Events.MessageDelete, (message) =>
			submitMessage(
				coordinator,
				Events.MessageDelete,
				message,
				"DeleteMessage",
			),
		);
		yield* events.forkOn(Events.MessageBulkDelete, (messages) =>
			Effect.forEach(
				messages.values(),
				(message) =>
					submitMessage(
						coordinator,
						Events.MessageBulkDelete,
						message,
						"DeleteMessage",
					),
				{ discard: true },
			),
		);

		yield* events.forkOn(Events.ThreadCreate, (thread) =>
			submitThread(coordinator, Events.ThreadCreate, thread, "ReconcileThread"),
		);
		yield* events.forkOn(Events.ThreadUpdate, (_oldThread, thread) =>
			submitThread(coordinator, Events.ThreadUpdate, thread, "ReconcileThread"),
		);
		yield* events.forkOn(Events.ThreadDelete, (thread) =>
			submitThread(coordinator, Events.ThreadDelete, thread, "DeleteThread"),
		);

		yield* events.forkOn(Events.ChannelCreate, (channel) =>
			submitChannel(
				coordinator,
				Events.ChannelCreate,
				channel,
				"UpsertChannel",
			),
		);
		yield* events.forkOn(Events.ChannelUpdate, (_oldChannel, channel) =>
			submitChannel(
				coordinator,
				Events.ChannelUpdate,
				channel,
				"UpsertChannel",
			),
		);
		yield* events.forkOn(Events.ChannelDelete, (channel) =>
			submitChannel(
				coordinator,
				Events.ChannelDelete,
				channel,
				"DeleteChannel",
			),
		);

		yield* events.forkOn(Events.ClientReady, installReadyGuilds);
		yield* events.forkOn(Events.GuildCreate, installGuild);
		yield* events.forkOn(Events.GuildUpdate, (_oldGuild, guild) =>
			submitGuild(coordinator, Events.GuildUpdate, guild, "UpsertGuild"),
		);
		yield* events.forkOn(Events.GuildDelete, (guild) =>
			submitGuild(coordinator, Events.GuildDelete, guild, "DeleteGuild"),
		);

		yield* events.forkOn(Events.UserUpdate, (_oldUser, user) =>
			submitUser(coordinator, Events.UserUpdate, user),
		);
		yield* events.forkOn(Events.GuildMemberAdd, (member) =>
			submitIfBotMember(Events.GuildMemberAdd, member, false),
		);
		yield* events.forkOn(Events.GuildMemberUpdate, (_oldMember, member) =>
			submitIfBotMember(Events.GuildMemberUpdate, member, false),
		);
		yield* events.forkOn(Events.GuildMemberRemove, (member) =>
			submitIfBotMember(Events.GuildMemberRemove, member, true),
		);
		yield* events.forkOn(Events.GuildRoleCreate, (role) =>
			submitRolePermissions(coordinator, Events.GuildRoleCreate, role, false),
		);
		yield* events.forkOn(Events.GuildRoleUpdate, (_oldRole, role) =>
			submitRolePermissions(coordinator, Events.GuildRoleUpdate, role, false),
		);
		yield* events.forkOn(Events.GuildRoleDelete, (role) =>
			submitRolePermissions(coordinator, Events.GuildRoleDelete, role, true),
		);
	});

export class IndexingEvents extends Context.Service<IndexingEvents, true>()(
	"velumn/bot/indexing/IndexingEvents",
) {}

export const layerIndexingEvents = () =>
	Layer.effect(
		IndexingEvents,
		Effect.gen(function* () {
			const discord = yield* DiscordConnection;
			const coordinator = yield* IndexingCoordinator;
			const inbox = yield* GatewayMutationInbox;
			yield* makeIndexingEvents(
				discord.events,
				coordinator,
				undefined,
				inbox.enqueue,
			);
			return true as const;
		}),
	);
