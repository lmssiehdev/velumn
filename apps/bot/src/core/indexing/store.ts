import { upsertChannel } from '@repo/db/helpers/channels';
import { upsertManyMessages } from '@repo/db/helpers/messages';
import { upsertManyDiscordAccounts } from '@repo/db/helpers/user';
import {
  ChannelType,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js';
import {
  extractUsersSetFromMessages,
  messagesToDBMessagesSet,
  toDbChannel,
  toDbUser,
} from '../../helpers/convertion';
import { logger } from '../../helpers/lib/log';
import { getTheOldestSnowflakeId } from './helpers';

export async function storeIndexedData(
  messages: Message[],
  channel: GuildTextBasedChannel
) {
  if (channel.client.id == null) {
    throw new Error('Received a null client id when indexing');
  }

  if (messages.length === 0) {
    logger.info(
      `No messages to index for channel ${channel.name} ${channel.id}`
    );
  }
  if (channel.type !== ChannelType.PublicThread) {
    return;
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
      ...(lastIndexedMessageId === '0' ? {} : { lastIndexedMessageId }),
    },
  });

  if (channel.type !== ChannelType.PublicThread) {
    return;
  }

  // Filter out messages from the system
  const filteredMessages = messages.filter((m) => !m.system);

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

  const _upserted = await upsertManyMessages(convertedMessages);
  // await Search.indexMessageForSearch(upserted);
}
