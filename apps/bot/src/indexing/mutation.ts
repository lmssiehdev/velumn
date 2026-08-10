import type {
	IndexingChannelMetadataInput,
	IndexingGuildMetadataInput,
	IndexingSourceFacts,
} from "@repo/db/helpers/indexing";
import {
	ChannelType,
	type Guild,
	type GuildBasedChannel,
	type GuildTextBasedChannel,
	type Message,
} from "discord.js";
import { type Duration, Effect, Layer, Schedule } from "effect";
import {
	type IndexingMessageInput,
	IndexingRepository,
	type IndexingRepositoryError,
} from "../adapters/indexing-repository";
import {
	GuildInstallationRepository,
	type GuildInstallationRepositoryError,
} from "../adapters/repository";
import { BotConfig, type BotEnvironment } from "../config/bot-config";
import { convertResolvedMessage, type JsonValue } from "./conversion";
import {
	IndexMutationProcessor,
	layerIndexMutationProcessor,
} from "./coordinator";
import {
	DiscordHistory,
	type DiscordHistoryError,
	DiscordHistoryMissingError,
	DiscordHistoryPermissionError,
	DiscordHistoryTransientError,
} from "./discord-history";
import {
	type IndexErrorClassification,
	IndexingOperationError,
	type IndexMutation,
} from "./model";
import { decideMessageEligibility, retryDispositionFor } from "./policy";

export interface IndexMutationProcessorOptions {
	readonly maximumRetries: number;
	readonly initialRetryDelay: Duration.Input;
	readonly environment?: BotEnvironment;
	readonly developmentGuildId?: string;
	readonly developmentInstallerUserId?: string;
}

export const defaultIndexMutationProcessorOptions: IndexMutationProcessorOptions =
	{
		maximumRetries: 3,
		initialRetryDelay: "100 millis",
	};

export const makeIndexMutationProcessor = (
	options: IndexMutationProcessorOptions = defaultIndexMutationProcessorOptions,
): Effect.Effect<
	IndexMutationProcessor["Service"],
	never,
	DiscordHistory | GuildInstallationRepository | IndexingRepository
> =>
	Effect.gen(function* () {
		if (
			!Number.isInteger(options.maximumRetries) ||
			options.maximumRetries < 0
		) {
			return yield* Effect.die(
				new RangeError("maximumRetries must be a non-negative integer"),
			);
		}
		const history = yield* DiscordHistory;
		const repository = yield* IndexingRepository;
		const installations = yield* GuildInstallationRepository;

		const processOnce = Effect.fn("IndexMutationProcessor.processOnce")(
			function* (
				mutation: IndexMutation,
			): Effect.fn.Return<void, IndexingOperationError> {
				switch (mutation._tag) {
					case "InstallGuild":
						return yield* processGuildInstallation(
							history,
							installations,
							mutation.guildId,
							mutation.observedAt,
							options,
						);
					case "UpsertMessage":
						return yield* processUpsert(history, repository, mutation);
					case "DeleteMessage":
						yield* repository
							.deleteMessage({
								messageId: mutation.messageId,
								sourceId: mutation.threadId ?? mutation.channelId,
								observedAt: mutation.observedAt,
							})
							.pipe(Effect.mapError(repositoryFailure));
						return;
					case "DeleteThread":
						yield* repository
							.deleteThread({
								threadId: mutation.threadId,
								parentChannelId: mutation.parentChannelId,
								serverId: mutation.guildId,
								observedAt: mutation.observedAt,
							})
							.pipe(Effect.mapError(repositoryFailure));
						return;
					case "ReconcileThread":
						return yield* processThreadReconciliation(
							history,
							repository,
							mutation,
						);
					case "UpsertChannel":
						return yield* processChannelUpsert(history, repository, mutation);
					case "DeleteChannel":
						yield* repository
							.deleteChannel({
								channelId: mutation.channelId,
								serverId: mutation.guildId,
								scope: mutation.scope,
								observedAt: new Date(mutation.observedAt),
							})
							.pipe(Effect.mapError(repositoryFailure));
						return;
					case "UpsertGuild":
						return yield* processGuildUpsert(
							history,
							repository,
							mutation.guildId,
						);
					case "UpsertUser":
						return yield* processUserUpsert(
							history,
							repository,
							mutation.userId,
						);
					case "ReconcileBotMemberPermissions":
						if (mutation.deleted) {
							yield* repository
								.deleteGuild(mutation.guildId, new Date(mutation.observedAt))
								.pipe(Effect.mapError(repositoryFailure));
							return;
						}
						return yield* reconcileGuildPermissions(
							history,
							repository,
							mutation.guildId,
							mutation.observedAt,
						);
					case "ReconcileRolePermissions":
						return yield* reconcileGuildPermissions(
							history,
							repository,
							mutation.guildId,
							mutation.observedAt,
						);
					case "DeleteGuild":
						yield* repository
							.deleteGuild(mutation.guildId, new Date(mutation.observedAt))
							.pipe(Effect.mapError(repositoryFailure));
						return;
					default:
						return yield* Effect.die(
							new TypeError("Unsupported persisted index mutation"),
						);
				}
			},
		);

		return IndexMutationProcessor.of({
			process: (mutation) =>
				processOnce(mutation).pipe(
					Effect.retry({
						times: options.maximumRetries,
						schedule: Schedule.exponential(options.initialRetryDelay),
						while: (error) =>
							retryDispositionFor(error.classification) === "retryable",
					}),
				),
		});
	});

export const layerIndexMutationProcessorLive = (
	options: IndexMutationProcessorOptions = defaultIndexMutationProcessorOptions,
) =>
	Layer.effect(
		IndexMutationProcessor,
		Effect.gen(function* () {
			const config = yield* BotConfig;
			return yield* makeIndexMutationProcessor({
				...options,
				environment: config.environment,
				developmentGuildId: config.developmentGuildId,
				developmentInstallerUserId: config.developmentInstallerUserId,
			});
		}),
	);

const processGuildInstallation = Effect.fn(
	"IndexMutationProcessor.processGuildInstallation",
)(function* (
	history: DiscordHistory["Service"],
	installations: GuildInstallationRepository["Service"],
	guildId: string,
	observedAt: number,
	options: IndexMutationProcessorOptions,
): Effect.fn.Return<void, IndexingOperationError> {
	const guild = yield* history
		.fetchGuild(guildId)
		.pipe(Effect.mapError(discordFailure));
	const channels = yield* history
		.fetchGuildChannels(guildId)
		.pipe(Effect.mapError(discordFailure));
	const supported = channels
		.filter(isInstallationMetadataChannel)
		.sort(channelHierarchyOrder);
	const metadata = [];
	for (const channel of supported) {
		const permissions = yield* history.calculateBotPermissionFacts(channel);
		metadata.push(
			toChannelMetadata(channel, permissions.effectivePermissions, observedAt),
		);
	}

	const developmentInstallerUserId =
		options.environment === "development" &&
		options.developmentGuildId === guildId
			? options.developmentInstallerUserId
			: undefined;
	const result = yield* installations
		.complete({
			server: toGuildMetadata(guild),
			channels: metadata.map((channel) => ({
				id: channel.id,
				serverId: channel.serverId,
				parentId: channel.parentId,
				authorId: channel.authorId,
				channelName: channel.channelName,
				position: channel.position,
				nsfw: channel.nsfw,
				botPermissions: channel.botPermissions,
				botPermissionsCheckedAt: channel.botPermissionsCheckedAt,
				type: channel.type,
			})),
			developmentInstallerUserId,
		})
		.pipe(Effect.mapError(installationFailure));

	if (result._tag !== "Unauthorized") return;
	if (options.environment !== "production") {
		yield* Effect.logWarning("Skipped unauthorized non-production guild", {
			guildId,
		});
		return;
	}

	yield* Effect.tryPromise({
		try: () => guild.leave(),
		catch: (cause) =>
			new IndexingOperationError({
				operation: "fetch-source",
				classification: "discord-transient",
				cause,
			}),
	});
});

const processUpsert = Effect.fn("IndexMutationProcessor.processUpsert")(
	function* (
		history: DiscordHistory["Service"],
		repository: IndexingRepository["Service"],
		mutation: Extract<IndexMutation, { readonly _tag: "UpsertMessage" }>,
	): Effect.fn.Return<void, IndexingOperationError> {
		const original = yield* history
			.fetchMessage({
				channelId: mutation.channelId,
				messageId: mutation.messageId,
			})
			.pipe(Effect.mapError(discordFailure));
		if (!original.guildId || original.channel.isDMBased()) {
			return yield* operationFailure(
				"fetch-source",
				"unsupported-entity",
				new Error("Message is not in a guild channel"),
			);
		}

		const resolved = yield* history
			.resolveThreadStarterReference(original)
			.pipe(Effect.mapError(discordFailure));
		const source = original.channel as GuildTextBasedChannel;
		const sourceId = resolved.publicationChannelId;
		const persistedFacts = yield* repository
			.sourceFacts(sourceId)
			.pipe(Effect.mapError(repositoryFailure));
		if (persistedFacts === null) return;
		const permissions = yield* history.calculateBotPermissionFacts(
			source as GuildBasedChannel,
		);
		const parent = "parent" in source ? source.parent : null;
		const facts = sourcePolicyFacts(
			source,
			parent,
			persistedFacts,
			permissions,
		);
		const eligibility = decideMessageEligibility({
			...facts,
			messageType: original.type,
			messageFlags: Number(original.flags.bitfield),
		});

		if (eligibility._tag === "UnsupportedFuture") {
			return yield* operationFailure(
				"convert-message",
				"unsupported-entity",
				new Error(
					`Unsupported Discord message type ${eligibility.messageType}`,
				),
			);
		}
		if (eligibility._tag === "TerminallySkipped") {
			yield* repository
				.deleteMessage({
					messageId: resolved.message.id,
					sourceId,
					observedAt: mutation.observedAt,
				})
				.pipe(Effect.mapError(repositoryFailure));
			yield* repository
				.upsertCheckpoint({
					channelId: sourceId,
					kind: "message_history",
					scanCursor: mutation.messageId,
					commitCursor: mutation.messageId,
					updatedByJobId: null,
				})
				.pipe(Effect.mapError(repositoryFailure));
			return;
		}

		const converted = yield* Effect.try({
			try: () => {
				const message = convertMessage(resolved.message, original, sourceId);
				return {
					...message,
					sourceVersion: Math.max(message.sourceVersion, mutation.observedAt),
				};
			},
			catch: (cause) =>
				new IndexingOperationError({
					operation: "convert-message",
					classification: "conversion",
					cause,
				}),
		});
		const result = yield* repository
			.commitMessage({
				sourceId,
				messages: [converted],
				users: [
					{
						id: resolved.message.author.id,
						displayName: resolved.message.author.username,
						avatar: resolved.message.author.avatar,
						isBot: resolved.message.author.bot,
					},
				],
				checkpoint: {
					channelId: sourceId,
					scanCursor: mutation.messageId,
					commitCursor: mutation.messageId,
				},
			})
			.pipe(Effect.mapError(repositoryFailure));

		// A stale source version and a durable pending projection are both completed
		// authoritative outcomes. The projector owns pending projection completion.
		if (result.privacyRejectedMessageIds.includes(converted.id)) {
			yield* repository
				.deleteMessage({
					messageId: converted.id,
					sourceId,
					observedAt: mutation.observedAt,
				})
				.pipe(Effect.mapError(repositoryFailure));
		}
	},
);

const processGuildUpsert = Effect.fn(
	"IndexMutationProcessor.processGuildUpsert",
)(function* (
	history: DiscordHistory["Service"],
	repository: IndexingRepository["Service"],
	guildId: string,
): Effect.fn.Return<void, IndexingOperationError> {
	const installed = yield* repository
		.guildInstallationExists(guildId)
		.pipe(Effect.mapError(repositoryFailure));
	if (!installed) return;
	const guild = yield* history
		.fetchGuild(guildId)
		.pipe(Effect.mapError(discordFailure));
	const result = yield* repository
		.upsertGuildMetadata(toGuildMetadata(guild))
		.pipe(Effect.mapError(repositoryFailure));
	if (result._tag === "MissingInstallation") return;
});

const processUserUpsert = Effect.fn("IndexMutationProcessor.processUserUpsert")(
	function* (
		history: DiscordHistory["Service"],
		repository: IndexingRepository["Service"],
		userId: string,
	): Effect.fn.Return<void, IndexingOperationError> {
		const user = yield* history
			.fetchUser(userId)
			.pipe(Effect.mapError(discordFailure));
		yield* repository
			.updateUserProfile({
				id: user.id,
				displayName: user.username,
				avatar: user.avatar,
				isBot: user.bot,
			})
			.pipe(Effect.mapError(repositoryFailure));
	},
);

const processChannelUpsert = Effect.fn(
	"IndexMutationProcessor.processChannelUpsert",
)(function* (
	history: DiscordHistory["Service"],
	repository: IndexingRepository["Service"],
	mutation: Extract<IndexMutation, { readonly _tag: "UpsertChannel" }>,
): Effect.fn.Return<void, IndexingOperationError> {
	const installed = yield* repository
		.guildInstallationExists(mutation.guildId)
		.pipe(Effect.mapError(repositoryFailure));
	if (!installed) return;
	yield* upsertChannelHierarchy(
		history,
		repository,
		mutation.guildId,
		mutation.channelId,
		mutation.observedAt,
	);
});

const processThreadReconciliation = Effect.fn(
	"IndexMutationProcessor.processThreadReconciliation",
)(function* (
	history: DiscordHistory["Service"],
	repository: IndexingRepository["Service"],
	mutation: Extract<IndexMutation, { readonly _tag: "ReconcileThread" }>,
): Effect.fn.Return<void, IndexingOperationError> {
	const installed = yield* repository
		.guildInstallationExists(mutation.guildId)
		.pipe(Effect.mapError(repositoryFailure));
	if (!installed) return;
	const channel = yield* upsertChannelHierarchy(
		history,
		repository,
		mutation.guildId,
		mutation.threadId,
		mutation.requestedAt,
	);
	if (
		channel === null ||
		!channel.isThread() ||
		channel.parentId !== mutation.parentChannelId
	) {
		return;
	}
	yield* repository
		.reconcileThread(mutation)
		.pipe(Effect.mapError(repositoryFailure));
	if (mutation.reconcileStarter) {
		yield* processUpsert(history, repository, {
			_tag: "UpsertMessage",
			messageId: mutation.threadId,
			channelId: mutation.threadId,
			threadId: mutation.threadId,
			observedAt: mutation.requestedAt,
		});
	}
});

const upsertChannelHierarchy = Effect.fn(
	"IndexMutationProcessor.upsertChannelHierarchy",
)(function* (
	history: DiscordHistory["Service"],
	repository: IndexingRepository["Service"],
	guildId: string,
	channelId: string,
	observedAt: number,
): Effect.fn.Return<GuildBasedChannel | null, IndexingOperationError> {
	const channel = yield* history
		.lookupGuildChannelFetchRequired({
			guildId,
			channelId,
		})
		.pipe(Effect.mapError(discordFailure));
	if (!isSupportedMetadataChannel(channel)) return null;

	const guildResult = yield* repository
		.upsertGuildMetadata(toGuildMetadata(channel.guild))
		.pipe(Effect.mapError(repositoryFailure));
	if (guildResult._tag === "MissingInstallation") return null;
	const hierarchy: GuildBasedChannel[] = [channel];
	let parentId = channel.parentId;
	while (parentId) {
		const parent = yield* history
			.lookupGuildChannelFetchRequired({
				guildId,
				channelId: parentId,
			})
			.pipe(Effect.mapError(discordFailure));
		if (!isSupportedMetadataChannel(parent)) break;
		hierarchy.push(parent);
		parentId = parent.parentId;
	}
	for (const current of hierarchy.reverse()) {
		const permissions = yield* history.calculateBotPermissionFacts(current);
		const result = yield* repository
			.upsertChannelMetadata(
				toChannelMetadata(
					current,
					permissions.effectivePermissions,
					observedAt,
				),
			)
			.pipe(Effect.mapError(repositoryFailure));
		if (result._tag !== "Applied") return null;
	}
	return channel;
});

const reconcileGuildPermissions = Effect.fn(
	"IndexMutationProcessor.reconcileGuildPermissions",
)(function* (
	history: DiscordHistory["Service"],
	repository: IndexingRepository["Service"],
	guildId: string,
	observedAt: number,
): Effect.fn.Return<void, IndexingOperationError> {
	const installed = yield* repository
		.guildInstallationExists(guildId)
		.pipe(Effect.mapError(repositoryFailure));
	if (!installed) return;
	const guild = yield* history
		.fetchGuild(guildId)
		.pipe(Effect.mapError(discordFailure));
	const channels = yield* history
		.fetchGuildChannels(guildId)
		.pipe(Effect.mapError(discordFailure));
	const guildResult = yield* repository
		.upsertGuildMetadata(toGuildMetadata(guild))
		.pipe(Effect.mapError(repositoryFailure));
	if (guildResult._tag === "MissingInstallation") return;
	const supported = channels
		.filter(isSupportedMetadataChannel)
		.sort(channelHierarchyOrder);
	for (const channel of supported) {
		const permissions = yield* history.calculateBotPermissionFacts(channel);
		const checkedAt = new Date(observedAt);
		const upserted = yield* repository
			.upsertChannelMetadata(
				toChannelMetadata(
					channel,
					permissions.effectivePermissions,
					observedAt,
				),
			)
			.pipe(Effect.mapError(repositoryFailure));
		if (upserted._tag === "MissingInstallation") return;
		if (upserted._tag === "Deleted") continue;
		if (!channel.isThread()) {
			yield* repository
				.reconcilePermissions({
					channelId: channel.id,
					serverId: guildId,
					botPermissions: permissions.effectivePermissions?.toString() ?? null,
					checkedAt,
					includeDescendants: true,
				})
				.pipe(Effect.mapError(repositoryFailure));
		}
	}
});

const supportedMetadataTypes = new Set<ChannelType>([
	ChannelType.GuildCategory,
	ChannelType.GuildText,
	ChannelType.GuildForum,
	ChannelType.GuildAnnouncement,
	ChannelType.PublicThread,
	ChannelType.AnnouncementThread,
]);

const installationMetadataTypes = new Set<ChannelType>([
	ChannelType.GuildCategory,
	ChannelType.GuildText,
	ChannelType.GuildForum,
	ChannelType.GuildAnnouncement,
]);

const isSupportedMetadataChannel = (
	channel: GuildBasedChannel,
): channel is GuildBasedChannel => supportedMetadataTypes.has(channel.type);

const isInstallationMetadataChannel = (
	channel: GuildBasedChannel,
): channel is GuildBasedChannel => installationMetadataTypes.has(channel.type);

const channelHierarchyOrder = (
	left: GuildBasedChannel,
	right: GuildBasedChannel,
) => metadataDepth(left) - metadataDepth(right);

const metadataDepth = (channel: GuildBasedChannel) =>
	channel.type === ChannelType.GuildCategory ? 0 : channel.isThread() ? 2 : 1;

const toGuildMetadata = (guild: Guild): IndexingGuildMetadataInput => ({
	id: guild.id,
	name: guild.name,
	description: guild.description,
	memberCount: guild.memberCount,
	icon: guild.icon,
});

const toChannelMetadata = (
	channel: GuildBasedChannel,
	effectivePermissions: bigint | null,
	observedAt: number,
): IndexingChannelMetadataInput => ({
	id: channel.id,
	serverId: channel.guildId,
	parentId: channel.parentId,
	authorId: channel.isThread() ? channel.ownerId : null,
	channelName: "name" in channel ? channel.name : null,
	position: "rawPosition" in channel ? channel.rawPosition : 0,
	nsfw: "nsfw" in channel ? channel.nsfw : false,
	botPermissions: effectivePermissions?.toString() ?? null,
	botPermissionsCheckedAt: new Date(observedAt),
	observedAt: new Date(observedAt),
	archived: channel.isThread() ? (channel.archived ?? false) : false,
	locked: channel.isThread() ? (channel.locked ?? false) : false,
	archivedTimestamp: channel.isThread() ? channel.archiveTimestamp : null,
	type: channel.type,
	availableTags:
		channel.type === ChannelType.GuildForum
			? {
					_tag: "Replace",
					items: channel.availableTags.map((tag) => ({
						id: tag.id,
						name: tag.name,
						moderated: tag.moderated,
						emojiId: tag.emoji?.id ?? null,
						emojiName: tag.emoji?.name ?? null,
					})),
				}
			: { _tag: "NotFetched" },
	appliedTagIds: channel.isThread()
		? { _tag: "Replace", items: channel.appliedTags }
		: { _tag: "NotFetched" },
});

const sourcePolicyFacts = (
	source: GuildTextBasedChannel,
	parent: GuildBasedChannel | null,
	persisted: IndexingSourceFacts | null,
	permissions: {
		readonly hasViewChannel: boolean;
		readonly hasReadMessageHistory: boolean;
	},
) => ({
	channelType: source.type,
	parentChannelType: parent?.type ?? null,
	indexingEnabled: persisted?.indexingEnabled ?? false,
	nsfw:
		("nsfw" in source && source.nsfw) ||
		(parent !== null && "nsfw" in parent && parent.nsfw) ||
		(persisted?.nsfw ?? false),
	viewable: source.viewable,
	hasViewChannel: permissions.hasViewChannel,
	hasReadMessageHistory: permissions.hasReadMessageHistory,
	privacyAllowed:
		(persisted?.serverActive ?? false) && (persisted?.privacyAllowed ?? false),
});

const convertMessage = (
	message: Message<true>,
	original: Message<true>,
	publicationChannelId: string,
): IndexingMessageInput => {
	const source = original.channel;
	const reference = message.reference;
	const interaction = message.interactionMetadata;
	return convertResolvedMessage({
		id: message.id,
		guildId: message.guildId,
		channelId: message.channelId,
		publicationChannelId,
		parentChannelId: "parentId" in source ? source.parentId : null,
		authorId: message.author.id,
		content: message.content,
		cleanContent: message.cleanContent || null,
		type: original.type,
		createdTimestamp: message.createdTimestamp,
		editedTimestamp: message.editedTimestamp,
		flags: Number(message.flags.bitfield),
		pinned: message.pinned,
		applicationId: message.applicationId,
		childThreadId: original.thread?.id ?? null,
		reference: reference
			? {
					type: reference.type,
					messageId: reference.messageId ?? null,
					channelId: reference.channelId,
					guildId: reference.guildId ?? null,
				}
			: null,
		webhook: message.webhookId
			? {
					id: message.webhookId,
					type: null,
					displayName: message.author.username,
					avatarUrl: message.author.displayAvatarURL(),
				}
			: null,
		interaction: interaction
			? {
					id: interaction.id,
					type: interaction.type,
					applicationId: message.applicationId,
				}
			: null,
		mentions: {
			users: Object.fromEntries(
				message.mentions.users.map((user) => [
					user.id,
					{ username: user.username, globalName: user.globalName },
				]),
			),
			channels: Object.fromEntries(
				message.mentions.channels.map((channel) => [
					channel.id,
					{
						name: ("name" in channel ? channel.name : null) ?? "",
						type: channel.type,
					},
				]),
			),
			roles: Object.fromEntries(
				message.mentions.roles.map((role) => [
					role.id,
					{ name: role.name, color: role.color },
				]),
			),
		},
		attachments: message.attachments.map((attachment) => ({
			id: attachment.id,
			filename: attachment.name,
			contentType: attachment.contentType,
			size: attachment.size,
			sourceUrl: attachment.url,
		})),
		reactions: message.reactions.cache.map((reaction) => ({
			emojiId: reaction.emoji.id,
			emojiName: reaction.emoji.name ?? "",
			animated: reaction.emoji.animated ?? false,
			count: reaction.count,
		})),
		components: message.components.map(
			(component) =>
				component.toJSON() as unknown as JsonValue as { type: number },
		),
	});
};

const discordFailure = (error: DiscordHistoryError) =>
	new IndexingOperationError({
		operation:
			error.operation === "fetch-message-page"
				? "fetch-message-page"
				: "fetch-source",
		classification: discordClassification(error),
		cause: error,
	});

const discordClassification = (
	error: DiscordHistoryError,
): IndexErrorClassification => {
	if (error instanceof DiscordHistoryTransientError) return "discord-transient";
	if (error instanceof DiscordHistoryPermissionError)
		return "discord-permission";
	if (error instanceof DiscordHistoryMissingError) return "missing-entity";
	return "partial-fetch";
};

const repositoryFailure = (error: IndexingRepositoryError) =>
	new IndexingOperationError({
		operation: "commit-mutation",
		classification: isSourcePolicyError(error.cause)
			? "privacy-rejection"
			: "database",
		cause: error,
	});

const installationFailure = (error: GuildInstallationRepositoryError) =>
	new IndexingOperationError({
		operation: "commit-mutation",
		classification: "database",
		cause: error,
	});

const isSourcePolicyError = (cause: unknown): boolean =>
	typeof cause === "object" &&
	cause !== null &&
	"name" in cause &&
	cause.name === "IndexingSourcePolicyError";

const operationFailure = (
	operation: IndexingOperationError["operation"],
	classification: IndexingOperationError["classification"],
	cause: unknown,
) =>
	Effect.fail(new IndexingOperationError({ operation, classification, cause }));

// Kept as a compatibility-free convenience for layer composition sites.
export const mutationProcessorLayer = layerIndexMutationProcessor;
