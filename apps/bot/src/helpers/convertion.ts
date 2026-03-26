import {
	type DBSnapshotSchema,
	dbAttachmentsSchema,
	embedSchema,
	internalLinksSchema,
	type MessageMetadataSchema,
	messageMetadataSchema,
	pollSchema,
	type RowsSchema,
	rowsSchema,
	snapShotSchema,
	stickerSchema,
} from "@repo/db/helpers/validation";
import type {
	DBChannel,
	DBMessage,
	DBMessageWithRelations,
	DBServerInsert,
	DBThreadBacklink,
	DBUser,
} from "@repo/db/schema/index";
import {
	type APIMessageComponentEmoji,
	ChannelFlags,
	ChannelType,
	ComponentType,
	type Emoji,
	type Guild,
	type GuildBasedChannel,
	type GuildChannel,
	type Message,
	MessageFlags,
	type MessageSnapshot,
	MessageType,
	type ThreadChannel,
	type TopLevelComponent,
	type User,
} from "discord.js";
import z from "zod";
import { logParsingError } from "../indexing/indexing-logger";
import { MessageLinkRegex } from "./regex";

export async function toDbChannel(
	channel: GuildChannel | GuildBasedChannel | ThreadChannel,
) {
	if (!channel.guild) {
		throw new Error("Channel is not in a guild");
	}

	const authorId = channel.isThread()
		? (await channel.fetchOwner())?.id
		: undefined;

	const convertedChannel: DBChannel = {
		id: channel.id,
		channelName: channel.name,
		authorId: authorId ?? null,
		serverId: channel.guild.id,
		parentId: channel.isThread() ? channel.parentId : null,
		archived: channel.isThread() ? (channel.archived ?? false) : false,
		locked: channel.isThread() ? (channel.locked ?? false) : false,
		archivedTimestamp:
			channel.isThread() && channel.archiveTimestamp
				? channel.archiveTimestamp
				: null,
		lastIndexedMessageId: null,
		type: channel.type,
		indexingEnabled: false,
		pinned: channel.isThread() && channel.flags.has(ChannelFlags.Pinned),
		downvotes: 0,
		upvotes: 0,
	};

	return convertedChannel;
}

export function toDbUser(user: User) {
	return {
		id: user.id,
		displayName: user.username,
		avatar: user.avatar,
		isBot: user.bot,
		anonymizeName: false,
		isIgnored: false,
	} satisfies DBUser;
}

//
// Message
//

function toDbPoll(message: Message) {
	if (!message.poll) {
		return null;
	}

	const { success, data, error } = pollSchema.safeParse(message.poll);
	if (!success) {
		console.error(
			"Failed to parse poll data:",
			error.issues.map((x) => x.message),
		);

		if (message.guildId) {
			logParsingError(error, "poll", {
				messageId: message.id,
				channelId: message.channelId,
				guildId: message.guildId,
				threadId: message.channel.isThread() ? message.channel.id : undefined,
				validationErrors: error.issues.map(
					(x) => `${x.path.join(".")}: ${x.message}`,
				),
			});
		}

		return null;
	}
	return data;
}

async function toDbInternalLink(message: Message | MessageSnapshot) {
	if (!message.content) {
		return [];
	}

	const groupSchema = z.object({
		original: z.string(),
		guildId: z.string(),
		channelId: z.string(),
		messageId: z.string().optional(),
	});

	const validGroups = [...message.content.matchAll(MessageLinkRegex)].flatMap(
		(m) => {
			const parsed = groupSchema.safeParse({ original: m[0], ...m.groups });
			return parsed.success && message.guildId === parsed.data.guildId
				? [parsed.data]
				: [];
		},
	);

	if (validGroups.length === 0) {
		return [];
	}

	const internalLinks = await Promise.all(
		validGroups.map(async (g) => {
			try {
				const channel = await message.client.channels.fetch(g.channelId);
				if (!channel?.isTextBased() || channel.isDMBased()) {
					return null;
				}
				if (!("messages" in channel)) {
					return null;
				}
				const fetchedMessage = g.messageId
					? await channel.messages.fetch(g.messageId)
					: null;

				const data = {
					original: g.original,
					guild: {
						id: channel.guildId,
						name: channel.guild.name,
					},
					channel: {
						parent: {
							name: channel.parent?.name,
							type: channel.parent?.type,
							parentId: channel.parent?.id,
						},
						id: channel.id,
						type: channel.type,
						name: channel.name,
					},
					message: fetchedMessage?.id,
				} satisfies z.infer<typeof internalLinksSchema>;

				return internalLinksSchema.parse(data);
			} catch (error) {
				console.error("Failed to fetch channel/message:", error);
				if (message.guildId) {
					logParsingError(error, "metadata", {
						messageId: message.id,
						channelId: message.channelId,
						guildId: message.guildId,
						threadId: message.channel?.isThread()
							? message.channel.id
							: undefined,
						rawData: {
							original: g.original,
							channelId: g.channelId,
							messageId: g.messageId,
						},
					});
				}

				return null;
			}
		}),
	);
	return internalLinks.filter((x) => x !== null) ?? [];
}

/**
 * used to extract somehelpful metadata required by the UI to render messages.
 */
export async function toDbMetadata(
	message: Message | MessageSnapshot,
): Promise<MessageMetadataSchema | null> {
	const { users, channels, roles } = message.mentions;
	const internalLinks = await toDbInternalLink(message);

	const { success, data, error } = messageMetadataSchema.safeParse({
		users,
		channels,
		roles,
		internalLinks,
	});
	if (!success) {
		if (message.guildId) {
			logParsingError(error, "metadata", {
				messageId: message.id,
				channelId: message.channelId,
				guildId: message.guildId as string,
				threadId: message.channel?.isThread() ? message.channel.id : undefined,
				validationErrors: error.issues.map(
					(x) => `${x.path.join(".")}: ${x.message}`,
				),
			});
		}
		return null;
	}
	return data;
}
function toDbReactions(message: Message): DBMessage["reactions"] {
	if (!message.guild) {
		return null;
	}

	const dbReactions: DBMessage["reactions"] = [];
	const reactions = message.reactions.cache.values();

	// TODO: check if we need to fetch the reactions..
	for (const reaction of reactions) {
		if (!reaction.emoji.name) {
			continue;
		}

		const isServerEmoji = reaction.emoji.id
			? Boolean(message.guild.emojis.cache.get(reaction.emoji.id))
			: true;

		dbReactions.push({
			id: reaction.emoji.id,
			name: reaction.emoji.name,
			animated: reaction.emoji.animated ?? false,
			count: reaction.count,
			messageId: message.id,
			isServerEmoji,
		});
	}

	return dbReactions;
}

export function toDbDiscordComponents(
	components: TopLevelComponent[],
): DBMessage["components"] {
	if (!components?.length) {
		return null;
	}

	const rowsData: RowsSchema[] = [];

	for (const component of components) {
		if (component.type !== ComponentType.ActionRow) {
			continue;
		}

		const data = {
			type: component.type,
			components: component.components
				.map((c) => {
					if (c.type !== ComponentType.Button) {
						return null;
					}
					return {
						type: c.type,
						style: c.style,
						disabled: c.disabled,
						label: c.label,
						emoji: getEmojiData(c.emoji),
						url: c.url,
					};
				})
				.filter((x) => x !== null),
		} satisfies RowsSchema;

		const parsedData = rowsSchema.safeParse(data);

		if (!parsedData.success) {
			// @TODO: better log
			console.warn("Failed to parse row:", data, parsedData.error);
			continue;
		}

		rowsData.push(parsedData.data);
	}

	return rowsData.length ? rowsData : null;
}

export async function toDBMessage(
	message: Message,
): Promise<DBMessageWithRelations> {
	let fullMessage =
		message.type === MessageType.ThreadStarterMessage
			? await message.fetchReference()
			: message;
	if (fullMessage.partial) {
		fullMessage = await fullMessage.fetch();
	}
	if (!fullMessage.guildId) {
		throw new Error("Message is not in a guild");
	}

	const [metadata, snapshot] = await Promise.all([
		toDbMetadata(fullMessage),
		toDBSnapshot(fullMessage),
	]);

	const convertedMessage: DBMessageWithRelations = {
		id: fullMessage.id,
		cleanContent: fullMessage.cleanContent,
		content: fullMessage.content,
		channelId: fullMessage.channelId,
		parentChannelId: fullMessage.channel.isThread()
			? fullMessage.channel.parentId
			: null,
		reactions: toDbReactions(fullMessage),
		attachments: toDbAttachments(fullMessage),
		embeds: toDbEmbeds(fullMessage),
		applicationId: message.applicationId,
		// interactionId: message.interaction?.id ?? null,
		pinned: fullMessage.pinned,
		type: fullMessage.type,
		webhookId: fullMessage.webhookId,
		referenceId: fullMessage.reference?.messageId ?? null,
		authorId: fullMessage.author.id,
		serverId: fullMessage.guildId,
		// questionId: null,
		childThreadId: fullMessage.thread?.id ?? null,
		stickers: toDbStickers(fullMessage),
		poll: toDbPoll(fullMessage),
		metadata,
		snapshot,
		isIgnored: false,
		primaryChannelId: message.channelId,
		starterMessage:
			message.type === MessageType.ThreadStarterMessage ||
			fullMessage.channel.id === fullMessage.id,
		components: toDbDiscordComponents(fullMessage.components),
	};
	return convertedMessage;
}

export function extractUsersSetFromMessages(messages: Message[]) {
	const users = new Map<string, DBUser>();
	for (const msg of messages) {
		if (msg.system) {
			continue;
		}
		users.set(msg.author.id, toDbUser(msg.author));
	}
	return Array.from(users.values());
}

export async function messagesToDBMessagesSet(messages: Message[]) {
	const systemMessageIds = new Set(
		messages.filter((x) => x.system).map((x) => x.id),
	);

	const uniqueMessages = new Map<string, Message>();
	for (const msg of messages) {
		uniqueMessages.set(msg.id, msg);
	}

	const dbMessages = await Promise.all(
		Array.from(uniqueMessages.values()).map(toDBMessage),
	);
	return dbMessages.filter((x) => !systemMessageIds.has(x.id));
}

//
// Server
//

export function toDbServer(guild: Guild) {
	const convertedServer: DBServerInsert = {
		id: guild.id,
		name: guild.name,
		description: guild.description,
		memberCount: guild.memberCount,
		icon: guild.icon,
	};
	return convertedServer;
}

//
// Backlinks
//
export function toDbBacklink(messages: DBMessage[]): DBThreadBacklink[] {
	return messages.flatMap((msg) => {
		const internalLinks = msg.metadata?.internalLinks ?? [];

		return internalLinks
			.filter(
				(link) =>
					link.channel.type === ChannelType.PublicThread &&
					link.channel.id !== msg.channelId,
			)
			.map((link) => ({
				fromMessageId: msg.id,
				fromThreadId: msg.channelId,
				toThreadId: link.channel.id,
			}));
	});
}

//
// Helpers
//
export function getEmojiData(emoji: Emoji | APIMessageComponentEmoji | null) {
	if (!emoji) {
		return null;
	}
	return {
		id: emoji.id,
		name: emoji.name,
		animated: emoji.animated ?? false,
	};
}

function toDbEmbeds(message: Message | MessageSnapshot) {
	return message.embeds.flatMap((e) => {
		const result = embedSchema.safeParse(e.data);
		if (!result.success) {
			if (message.guildId) {
				logParsingError(result.error, "embed", {
					messageId: message.id,
					channelId: message.channelId,
					guildId: message.guildId as string,
					threadId: message.channel?.isThread()
						? message.channel.id
						: undefined,
					validationErrors: result.error.issues.map(
						(x) => `${x.path.join(".")}: ${x.message}`,
					),
					rawData: {
						type: e.data.type,
						title: e.data.title?.substring(0, 100),
						description: e.data.description?.substring(0, 100),
					},
				});
			}

			return [];
		}
		return [result.data];
	});
}

function toDbAttachments(message: Message | MessageSnapshot) {
	return message.attachments
		.map((attachment) => {
			const attachmentData = {
				id: attachment.id,
				url: attachment.url,
				messageId: message.id!,
				proxyURL: attachment.proxyURL,
				name: attachment.name ?? "",
				size: attachment.size,
				height: attachment.height,
				width: attachment.width,
				contentType: attachment.contentType,
				description: attachment.description,
				isSnapshot: false,
			};

			const result = dbAttachmentsSchema.safeParse(attachmentData);
			if (!result.success) {
				if (message.guildId) {
					logParsingError(result.error, "attachment", {
						messageId: message.id,
						channelId: message.channelId,
						guildId: message.guildId as string,
						threadId: message.channel?.isThread()
							? message.channel.id
							: undefined,
						validationErrors: result.error.issues.map(
							(x) => `${x.path.join(".")}: ${x.message}`,
						),
						rawData: {
							filename: attachment.name,
							contentType: attachment.contentType,
							size: attachment.size,
						},
					});
				}

				return null;
			}
			return result.data;
		})
		.filter(
			(attachment): attachment is NonNullable<typeof attachment> =>
				attachment !== null,
		);
}

export async function toDBSnapshot(
	message: Message,
): Promise<DBSnapshotSchema | null> {
	if (!message.flags?.has(MessageFlags.HasSnapshot)) {
		return null;
	}
	const snapshot = message.messageSnapshots.first();
	if (!snapshot) {
		return null;
	}

	const snapshotWithMetadata = {
		...snapshot,
		components: toDbDiscordComponents(snapshot.components),
		attachments: snapshot.attachments.map((x) => ({
			...x,
			messageId: message.id,
			isSnapshot: true,
		})),
	};

	const { success, data, error } =
		snapShotSchema.safeParse(snapshotWithMetadata);

	if (!success) {
		if (message.guildId) {
			logParsingError(error, "snapshot", {
				messageId: message.id,
				channelId: message.channelId,
				guildId: message.guildId as string,
				threadId: message.channel?.isThread() ? message.channel.id : undefined,
				validationErrors: error.issues.map(
					(x) => `${x.path.join(".")}: ${x.message}`,
				),
			});
		}

		return null;
	}

	return {
		...data,
		metadata: await toDbMetadata(snapshot),
		forwardedInMessageId: message.id,
	};
}

function toDbStickers(message: Message) {
	if (!message.stickers?.size) {
		return null;
	}

	const parsed = stickerSchema.safeParse(message.stickers);
	if (!parsed.success) {
		console.error("Failed to parse stickers:", parsed.error);
		if (message.guildId) {
			logParsingError(parsed.error, "sticker", {
				messageId: message.id,
				channelId: message.channelId,
				guildId: message.guildId as string,
				threadId: message.channel?.isThread() ? message.channel.id : undefined,
				validationErrors: parsed.error.issues.map(
					(x) => `${x.path.join(".")}: ${x.message}`,
				),
			});
		}

		return null;
	}
	return parsed.data;
}
