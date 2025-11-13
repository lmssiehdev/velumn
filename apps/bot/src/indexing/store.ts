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
	messagesToDBMessagesSet,
	toDbBacklink,
	toDbChannel,
	toDbUser,
} from "../helpers/convertion";
import { getTheOldestSnowflakeId } from "./helpers";

export async function storeIndexedData(
	messages: Message[],
	channel: GuildTextBasedChannel,
) {
	if (channel.client.id == null) {
		throw new Error("Received a null client id when indexing");
	}

	if (messages.length === 0) {
		logger.info(
			`No messages to index for channel ${channel.name} ${channel.id}`,
		);
	}

	logger.info(`Upserting channel: ${channel.name} ${channel.id}`);
	const lastIndexedMessageId = getTheOldestSnowflakeId(messages);

	const convertedChannel = await toDbChannel(channel);
	await upsertChannel({
		create: {
			...convertedChannel,
			lastIndexedMessageId,
		},
		update: {
			archivedTimestamp: convertedChannel.archivedTimestamp,
			...(lastIndexedMessageId === "0" ? {} : { lastIndexedMessageId }),
		},
	});

	if (channel.type !== ChannelType.PublicThread) {
		return;
	}

	if (messages.length === 0) {
		return;
	}

	// Filter out ignored users
	const filteredMessages = await removeIgnoredUsers(messages);

	// we filter for system messages here
	const convertedUsers = extractUsersSetFromMessages(filteredMessages);
	const convertedMessages = await messagesToDBMessagesSet(filteredMessages);

	logger.info(`Upserting ${convertedUsers.length} discord accounts`);

	await upsertManyDiscordAccounts(convertedUsers);
	const botMessages = filteredMessages.filter((x) => x.author.bot);

	const bots = [
		...new Map(botMessages.map((x) => [x.author.id, x.author])).values(),
	];

	if (bots.length > 0) {
		await upsertManyDiscordAccounts(bots.map(toDbUser));
	}

	logger.info(`Upserting ${convertedMessages.length} messages`);
	await upsertManyMessages(convertedMessages);

	const backlinks = toDbBacklink(convertedMessages);
	await upsertManyBacklinks(backlinks);

	return true;
}

async function removeIgnoredUsers(messages: Message[]) {
	const userIds = [...new Set(messages.map((m) => m.author.id))];
	const usersData = await findManyDiscordAccountsById(userIds);

	const userLookup = new Map(usersData.map((x) => [x.id, x.isIgnored]));

	return messages.filter((m) => !userLookup.get(m.author.id));
}
