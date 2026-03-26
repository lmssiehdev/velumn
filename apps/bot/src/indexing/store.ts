import { upsertChannel } from "@repo/db/helpers/channels";
import {
	upsertManyBacklinks,
	upsertManyMessages,
} from "@repo/db/helpers/messages";
import {
	findManyDiscordAccountsById,
	upsertManyDiscordAccounts,
} from "@repo/db/helpers/user";
import { logger } from "@repo/logger";
import {
	ChannelType,
	type GuildTextBasedChannel,
	type Message,
} from "discord.js";
import {
	extractUsersSetFromMessages,
	toDBMessage,
	toDbBacklink,
	toDbChannel,
	toDbUser,
} from "../helpers/convertion";
import { getTheOldestSnowflakeId } from "./helpers";
import {
	extractIndexingContext,
	type IndexingErrorContext,
	logBatchOperation,
	logIndexingError,
} from "./indexing-logger";
import { insertBulkSearchMessages } from "./search";

export async function storeIndexedData(
	messages: Message[],
	channel: GuildTextBasedChannel,
	opts?: {
		force?: boolean;
	},
) {
	const startTime = Date.now();
	const processingErrors: Array<{
		error: Error | unknown;
		context: IndexingErrorContext;
	}> = [];

	if (channel.client.id == null) {
		throw new Error("Received a null client id when indexing");
	}

	if (messages.length === 0) {
		logger.info(
			`No messages to index for channel ${channel.name} ${channel.id}`,
		);
		return;
	}

	logBatchOperation("started", {
		channelId: channel.id,
		threadId: channel.isThread() ? channel.id : undefined,
		guildId: channel.guildId || channel.guild?.id,
		totalMessages: messages.length,
		processedMessages: 0,
		failedMessages: 0,
		processingStage: "store",
	});

	try {
		logger.info(`Upserting channel: ${channel.name} ${channel.id}`);
		const lastIndexedMessageId = getTheOldestSnowflakeId(messages);

		const convertedChannel = await toDbChannel(channel);
		await upsertChannel({
			create: {
				...convertedChannel,
				lastIndexedMessageId,
			},
			update: {
				authorId: convertedChannel.authorId,
				archived: convertedChannel.archived,
				locked: convertedChannel.locked,
				archivedTimestamp: convertedChannel.archivedTimestamp,
				pinned: convertedChannel.pinned,
				...(lastIndexedMessageId === "0" ? {} : { lastIndexedMessageId }),
			},
		});

		if (channel.type !== ChannelType.PublicThread) {
			return;
		}

		// Filter out ignored users
		const filteredMessages = await removeIgnoredUsers(messages);

		// Log filtered messages count for transparency
		const ignoredCount = messages.length - filteredMessages.length;
		if (ignoredCount > 0) {
			logger.info(
				`Filtered ${ignoredCount} messages from ignored users in channel ${channel.id}`,
			);
		}

		const convertedUsers = extractUsersSetFromMessages(filteredMessages);
		const convertedMessages: Awaited<ReturnType<typeof toDBMessage>>[] = [];

		// Process messages individually to capture parsing errors
		for (const message of filteredMessages) {
			try {
				const convertedMessage = await toDBMessage(message);
				convertedMessages.push(convertedMessage);
			} catch (error) {
				const context = extractIndexingContext(message, "parse");
				processingErrors.push({
					error,
					context: {
						...context,
						errorCategory: "parsing",
						retryable: false,
						batchSize: filteredMessages.length,
					},
				});
			}
		}

		logger.info(`Upserting ${convertedUsers.length} discord accounts`);

		try {
			await upsertManyDiscordAccounts(convertedUsers);
		} catch (error) {
			const errorContext: IndexingErrorContext = {
				channelId: channel.id,
				threadId: channel.isThread() ? channel.id : undefined,
				guildId: channel.guildId || channel.guild?.id,
				processingStage: "store",
				errorCategory: "database",
				retryable: true,
				batchSize: convertedUsers.length,
			};

			logIndexingError(error, errorContext, {
				operation: "upsert_discord_accounts",
				accountsCount: convertedUsers.length,
			});
			throw error;
		}

		const botMessages = filteredMessages.filter((x) => x.author.bot);

		const bots = [
			...new Map(botMessages.map((x) => [x.author.id, x.author])).values(),
		];

		if (bots.length > 0) {
			await upsertManyDiscordAccounts(bots.map(toDbUser));
		}

		logger.info(`Upserting ${convertedMessages.length} messages`);
		try {
			await upsertManyMessages(convertedMessages, opts);
		} catch (error) {
			const errorContext: IndexingErrorContext = {
				channelId: channel.id,
				threadId: channel.isThread() ? channel.id : undefined,
				guildId: channel.guildId || channel.guild?.id,
				processingStage: "store",
				errorCategory: "database",
				retryable: true,
				batchSize: convertedMessages.length,
			};

			logIndexingError(error, errorContext, {
				operation: "upsert_messages",
				messagesCount: convertedMessages.length,
			});
			throw error;
		}

		const backlinks = toDbBacklink(convertedMessages);
		await upsertManyBacklinks(backlinks);
		insertBulkSearchMessages(channel, convertedMessages);

		logBatchOperation("completed", {
			channelId: channel.id,
			threadId: channel.isThread() ? channel.id : undefined,
			guildId: channel.guildId || channel.guild?.id,
			totalMessages: messages.length,
			processedMessages: convertedMessages.length,
			failedMessages: processingErrors.length,
			processingStage: "store",
			durationMs: Date.now() - startTime,
		});

		return;
	} catch (error) {
		logBatchOperation("failed", {
			channelId: channel.id,
			threadId: channel.isThread() ? channel.id : undefined,
			guildId: channel.guildId || channel.guild?.id,
			totalMessages: messages.length,
			processedMessages: 0,
			failedMessages: messages.length,
			processingStage: "store",
			durationMs: Date.now() - startTime,
			error: error instanceof Error ? error : new Error(String(error)),
		});

		throw error;
	}
}

async function removeIgnoredUsers(messages: Message[]) {
	const userIds = [...new Set(messages.map((m) => m.author.id))];
	const usersData = await findManyDiscordAccountsById(userIds);

	const userLookup = new Map(usersData.map((x) => [x.id, x.isIgnored]));

	return messages.filter((m) => !userLookup.get(m.author.id));
}
