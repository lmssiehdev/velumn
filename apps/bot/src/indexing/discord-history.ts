import {
	type Client,
	type Collection,
	type FetchedThreads,
	type FetchedThreadsMore,
	type ForumChannel,
	type Guild,
	type GuildBasedChannel,
	type GuildTextBasedChannel,
	type MediaChannel,
	type Message,
	MessageType,
	type NewsChannel,
	PermissionFlagsBits,
	type Snowflake,
	type TextChannel,
	type User,
} from "discord.js";
import { RESTJSONErrorCodes } from "discord-api-types/v10";
import { Context, Effect, Layer, Schema } from "effect";
import {
	type DiscordClient,
	DiscordConnection,
	type DiscordConnectionService,
} from "../discord/client";

export type DiscordHistoryOperation =
	| "fetch-guild"
	| "fetch-guild-channels"
	| "fetch-user"
	| "lookup-guild-channel"
	| "fetch-message"
	| "hydrate-message"
	| "resolve-thread-starter-reference"
	| "fetch-message-page"
	| "fetch-active-threads"
	| "fetch-archived-public-threads"
	| "calculate-permissions";

const operationSchema = Schema.Literals([
	"fetch-guild",
	"fetch-guild-channels",
	"fetch-user",
	"lookup-guild-channel",
	"fetch-message",
	"hydrate-message",
	"resolve-thread-starter-reference",
	"fetch-message-page",
	"fetch-active-threads",
	"fetch-archived-public-threads",
	"calculate-permissions",
]);

export class DiscordHistoryMissingError extends Schema.TaggedError<DiscordHistoryMissingError>()(
	"DiscordHistoryMissingError",
	{
		operation: operationSchema,
		entity: Schema.Literals(["guild", "channel", "message", "user"]),
		entityId: Schema.String,
		cause: Schema.Defect(),
	},
) {}

export class DiscordHistoryPermissionError extends Schema.TaggedError<DiscordHistoryPermissionError>()(
	"DiscordHistoryPermissionError",
	{
		operation: operationSchema,
		cause: Schema.Defect(),
	},
) {}

export class DiscordHistoryTransientError extends Schema.TaggedError<DiscordHistoryTransientError>()(
	"DiscordHistoryTransientError",
	{
		operation: operationSchema,
		cause: Schema.Defect(),
	},
) {}

export class DiscordHistoryUnknownError extends Schema.TaggedError<DiscordHistoryUnknownError>()(
	"DiscordHistoryUnknownError",
	{
		operation: operationSchema,
		cause: Schema.Defect(),
	},
) {}

export type DiscordHistoryError =
	| DiscordHistoryMissingError
	| DiscordHistoryPermissionError
	| DiscordHistoryTransientError
	| DiscordHistoryUnknownError;

export interface GuildChannelLookup {
	readonly guildId: Snowflake;
	readonly channelId: Snowflake;
}

export interface MessagePageRequest {
	readonly channel: GuildTextBasedChannel;
	readonly after?: Snowflake;
	readonly limit: number;
}

export interface MessageLookupRequest {
	readonly channelId: Snowflake;
	readonly messageId: Snowflake;
}

export type ThreadParentChannel =
	| TextChannel
	| NewsChannel
	| ForumChannel
	| MediaChannel;

export interface ArchivedPublicThreadPageRequest {
	readonly channel: ThreadParentChannel;
	readonly before?: Snowflake | Date;
	readonly limit?: number;
}

export interface ResolvedThreadStarterMessage {
	/** The message carrying publishable content, which may live in the parent. */
	readonly message: Message<true>;
	/** The original thread/root identity used for publication and backlinks. */
	readonly publicationChannelId: Snowflake;
}

export interface BotPermissionFacts {
	readonly effectivePermissions: bigint | null;
	readonly hasViewChannel: boolean;
	readonly hasReadMessageHistory: boolean;
}

interface ErrorContext {
	readonly operation: DiscordHistoryOperation;
	readonly entity?: "guild" | "channel" | "message" | "user";
	readonly entityId?: string;
}

interface DiscordErrorShape {
	readonly code?: unknown;
	readonly status?: unknown;
	readonly name?: unknown;
	readonly cause?: unknown;
}

const missingCodes = new Set<unknown>([
	RESTJSONErrorCodes.UnknownGuild,
	RESTJSONErrorCodes.UnknownChannel,
	RESTJSONErrorCodes.UnknownMessage,
]);
const permissionCodes = new Set<unknown>([
	RESTJSONErrorCodes.MissingAccess,
	RESTJSONErrorCodes.MissingPermissions,
]);
const transientCodes = new Set<unknown>([
	"ECONNRESET",
	"ECONNREFUSED",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ETIMEDOUT",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_HEADERS_TIMEOUT",
	"UND_ERR_SOCKET",
]);

const errorShape = (cause: unknown): DiscordErrorShape =>
	typeof cause === "object" && cause !== null
		? (cause as DiscordErrorShape)
		: {};

export const classifyDiscordHistoryError = (
	cause: unknown,
	context: ErrorContext,
): DiscordHistoryError => {
	const error = errorShape(cause);
	if (
		(missingCodes.has(error.code) || error.status === 404) &&
		context.entity &&
		context.entityId
	) {
		return new DiscordHistoryMissingError({
			operation: context.operation,
			entity: context.entity,
			entityId: context.entityId,
			cause,
		});
	}
	if (permissionCodes.has(error.code) || error.status === 403) {
		return new DiscordHistoryPermissionError({
			operation: context.operation,
			cause,
		});
	}
	if (
		error.status === 408 ||
		error.status === 429 ||
		(typeof error.status === "number" && error.status >= 500) ||
		transientCodes.has(error.code) ||
		transientCodes.has(errorShape(error.cause).code)
	) {
		return new DiscordHistoryTransientError({
			operation: context.operation,
			cause,
		});
	}
	return new DiscordHistoryUnknownError({
		operation: context.operation,
		cause,
	});
};

export interface DiscordHistoryOperations {
	readonly fetchGuild: (
		client: Client<true>,
		guildId: Snowflake,
		signal: AbortSignal,
	) => Promise<Guild>;
	readonly fetchGuildChannel: (
		guild: Guild,
		channelId: Snowflake,
		force: boolean,
		signal: AbortSignal,
	) => Promise<GuildBasedChannel | null>;
	readonly fetchGuildChannels: (
		guild: Guild,
		signal: AbortSignal,
	) => Promise<readonly GuildBasedChannel[]>;
	readonly fetchUser: (
		client: Client<true>,
		userId: Snowflake,
		signal: AbortSignal,
	) => Promise<User>;
	readonly hydrateMessage: (
		message: Message,
		signal: AbortSignal,
	) => Promise<Message>;
	readonly fetchMessage: (
		client: Client<true>,
		request: MessageLookupRequest,
		signal: AbortSignal,
	) => Promise<Message>;
	readonly fetchReference: (
		message: Message,
		signal: AbortSignal,
	) => Promise<Message>;
	readonly fetchMessagePage: (
		request: MessagePageRequest,
		signal: AbortSignal,
	) => Promise<Collection<Snowflake, Message<true>>>;
	readonly fetchActiveThreads: (
		channel: ThreadParentChannel,
		signal: AbortSignal,
	) => Promise<FetchedThreads>;
	readonly fetchArchivedPublicThreads: (
		request: ArchivedPublicThreadPageRequest,
		signal: AbortSignal,
	) => Promise<FetchedThreadsMore>;
}

// discord.js manager and Message methods used here do not accept AbortSignal in
// v14.27. The signal is still part of injected operations so cancellable
// implementations can honor interruption; default REST requests may finish in
// the background after the Effect is interrupted.
const defaultOperations: DiscordHistoryOperations = {
	fetchGuild: (client, guildId) => client.guilds.fetch(guildId),
	fetchGuildChannel: (guild, channelId, force) =>
		guild.channels.fetch(channelId, { cache: true, force }),
	fetchGuildChannels: async (guild) => {
		const [channels, activeThreads] = await Promise.all([
			guild.channels.fetch(),
			guild.channels.fetchActiveThreads(),
		]);
		return [
			...[...channels.values()].filter((channel) => channel !== null),
			...activeThreads.threads.values(),
		];
	},
	fetchUser: (client, userId) => client.users.fetch(userId, { force: true }),
	hydrateMessage: (message) => message.fetch(),
	fetchMessage: async (client, request) => {
		const channel =
			client.channels.cache.get(request.channelId) ??
			(await client.channels.fetch(request.channelId));
		if (!channel?.isTextBased() || !("messages" in channel)) {
			const error = new Error("Message channel is unavailable");
			Object.assign(error, { status: 404 });
			throw error;
		}
		return channel.messages.fetch(request.messageId);
	},
	fetchReference: (message) => message.fetchReference(),
	fetchMessagePage: ({ channel, after, limit }) =>
		channel.messages.fetch({ after, limit }),
	fetchActiveThreads: (channel) => channel.threads.fetchActive(),
	fetchArchivedPublicThreads: ({ channel, before, limit }) =>
		channel.threads.fetchArchived({ type: "public", before, limit }),
};

const tryDiscord = <A>(
	context: ErrorContext,
	tryOperation: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A, DiscordHistoryError> =>
	Effect.tryPromise({
		try: tryOperation,
		catch: (cause) => classifyDiscordHistoryError(cause, context),
	});

export const makeDiscordHistory = (
	discord: DiscordClient["Service"] | DiscordConnectionService,
	overrides: Partial<DiscordHistoryOperations> = {},
): DiscordHistory["Service"] => {
	const client = discord.client as Client<true>;
	const operations: DiscordHistoryOperations = {
		...defaultOperations,
		...overrides,
	};
	const fetchGuildCached = (guildId: Snowflake) => {
		const cached = client.guilds.cache.get(guildId);
		return cached
			? Effect.succeed(cached)
			: tryDiscord(
					{
						operation: "lookup-guild-channel",
						entity: "guild",
						entityId: guildId,
					},
					(signal) => operations.fetchGuild(client, guildId, signal),
				);
	};

	const lookupGuildChannel = (
		request: GuildChannelLookup,
		force: boolean,
	): Effect.Effect<GuildBasedChannel, DiscordHistoryError> =>
		Effect.gen(function* () {
			const guild = yield* fetchGuildCached(request.guildId);
			if (!force) {
				const cached = guild.channels.cache.get(request.channelId);
				if (cached) return cached;
			}
			const channel = yield* tryDiscord(
				{
					operation: "lookup-guild-channel",
					entity: "channel",
					entityId: request.channelId,
				},
				(signal) =>
					operations.fetchGuildChannel(guild, request.channelId, force, signal),
			);
			return yield* channel
				? Effect.succeed(channel)
				: Effect.fail(
						new DiscordHistoryMissingError({
							operation: "lookup-guild-channel",
							entity: "channel",
							entityId: request.channelId,
							cause: null,
						}),
					);
		});

	const hydrateMessage = (
		message: Message,
	): Effect.Effect<Message<true>, DiscordHistoryError> => {
		if (!message.partial) return Effect.succeed(message as Message<true>);
		return tryDiscord(
			{
				operation: "hydrate-message",
				entity: "message",
				entityId: message.id,
			},
			(signal) => operations.hydrateMessage(message, signal),
		).pipe(Effect.map((hydrated) => hydrated as Message<true>));
	};

	return DiscordHistory.of({
		fetchGuild: (guildId) =>
			tryDiscord(
				{ operation: "fetch-guild", entity: "guild", entityId: guildId },
				(signal) => operations.fetchGuild(client, guildId, signal),
			),
		fetchGuildChannels: (guildId) =>
			tryDiscord(
				{ operation: "fetch-guild", entity: "guild", entityId: guildId },
				(signal) => operations.fetchGuild(client, guildId, signal),
			).pipe(
				Effect.flatMap((guild) =>
					tryDiscord(
						{
							operation: "fetch-guild-channels",
							entity: "guild",
							entityId: guildId,
						},
						(signal) => operations.fetchGuildChannels(guild, signal),
					),
				),
			),
		fetchUser: (userId) =>
			tryDiscord(
				{ operation: "fetch-user", entity: "user", entityId: userId },
				(signal) => operations.fetchUser(client, userId, signal),
			),
		fetchMessage: (request) =>
			tryDiscord(
				{
					operation: "fetch-message",
					entity: "message",
					entityId: request.messageId,
				},
				(signal) => operations.fetchMessage(client, request, signal),
			).pipe(Effect.flatMap(hydrateMessage)),
		lookupGuildChannelCacheFirst: (request) =>
			lookupGuildChannel(request, false),
		lookupGuildChannelFetchRequired: (request) =>
			lookupGuildChannel(request, true),
		hydrateMessage,
		resolveThreadStarterReference: (message) =>
			Effect.gen(function* () {
				const publicationChannelId = message.channelId;
				const hydrated = yield* hydrateMessage(message);
				if (hydrated.type !== MessageType.ThreadStarterMessage) {
					return { message: hydrated, publicationChannelId };
				}
				const referenced = yield* tryDiscord(
					{
						operation: "resolve-thread-starter-reference",
						entity: "message",
						entityId: hydrated.reference?.messageId ?? hydrated.id,
					},
					(signal) => operations.fetchReference(hydrated, signal),
				);
				return {
					message: yield* hydrateMessage(referenced),
					publicationChannelId,
				};
			}),
		fetchMessagePage: (request) =>
			tryDiscord(
				{
					operation: "fetch-message-page",
					entity: "channel",
					entityId: request.channel.id,
				},
				(signal) => operations.fetchMessagePage(request, signal),
			),
		fetchActiveThreads: (channel) =>
			tryDiscord(
				{
					operation: "fetch-active-threads",
					entity: "channel",
					entityId: channel.id,
				},
				(signal) => operations.fetchActiveThreads(channel, signal),
			),
		fetchArchivedPublicThreadPage: (request) =>
			tryDiscord(
				{
					operation: "fetch-archived-public-threads",
					entity: "channel",
					entityId: request.channel.id,
				},
				(signal) => operations.fetchArchivedPublicThreads(request, signal),
			),
		calculateBotPermissionFacts: (channel) =>
			Effect.sync(() => {
				const permissions = channel.permissionsFor(client.user);
				return {
					effectivePermissions: permissions?.bitfield ?? null,
					hasViewChannel:
						permissions?.has(PermissionFlagsBits.ViewChannel) ?? false,
					hasReadMessageHistory:
						permissions?.has(PermissionFlagsBits.ReadMessageHistory) ?? false,
				};
			}),
	});
};

export class DiscordHistory extends Context.Service<
	DiscordHistory,
	{
		readonly fetchGuild: (
			guildId: Snowflake,
		) => Effect.Effect<Guild, DiscordHistoryError>;
		readonly fetchGuildChannels: (
			guildId: Snowflake,
		) => Effect.Effect<readonly GuildBasedChannel[], DiscordHistoryError>;
		readonly fetchUser: (
			userId: Snowflake,
		) => Effect.Effect<User, DiscordHistoryError>;
		readonly fetchMessage: (
			request: MessageLookupRequest,
		) => Effect.Effect<Message<true>, DiscordHistoryError>;
		readonly lookupGuildChannelCacheFirst: (
			request: GuildChannelLookup,
		) => Effect.Effect<GuildBasedChannel, DiscordHistoryError>;
		readonly lookupGuildChannelFetchRequired: (
			request: GuildChannelLookup,
		) => Effect.Effect<GuildBasedChannel, DiscordHistoryError>;
		readonly hydrateMessage: (
			message: Message,
		) => Effect.Effect<Message<true>, DiscordHistoryError>;
		readonly resolveThreadStarterReference: (
			message: Message,
		) => Effect.Effect<ResolvedThreadStarterMessage, DiscordHistoryError>;
		readonly fetchMessagePage: (
			request: MessagePageRequest,
		) => Effect.Effect<
			Collection<Snowflake, Message<true>>,
			DiscordHistoryError
		>;
		readonly fetchActiveThreads: (
			channel: ThreadParentChannel,
		) => Effect.Effect<FetchedThreads, DiscordHistoryError>;
		readonly fetchArchivedPublicThreadPage: (
			request: ArchivedPublicThreadPageRequest,
		) => Effect.Effect<FetchedThreadsMore, DiscordHistoryError>;
		readonly calculateBotPermissionFacts: (
			channel: GuildBasedChannel,
		) => Effect.Effect<BotPermissionFacts>;
	}
>()("velumn/bot/indexing/DiscordHistory") {
	static readonly layer = Layer.effect(
		DiscordHistory,
		Effect.gen(function* () {
			const discord = yield* DiscordConnection;
			return makeDiscordHistory(discord);
		}),
	);
}
