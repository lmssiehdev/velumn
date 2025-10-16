import {
  type ForumChannel,
  type Message,
  MessageType,
  type NewsChannel,
  type PublicThreadChannel,
  type TextBasedChannel,
  type TextChannel,
} from 'discord.js';
import { isSnowflakeLargerAsInt } from '../helpers/snowflake';

export type IndexableChannels = NewsChannel | TextChannel | ForumChannel;

export function sortMessagesById<T extends Message>(messages: T[]) {
  return messages.sort((a, b) => isSnowflakeLargerAsInt(a.id, b.id));
}

export function getTheOldestSnowflakeId<T extends { id: string }>(
  messages: T[]
) {
  if (messages.length === 0) {
    return '0';
  }
  const sortedMessages = messages.sort((a, b) => {
    const bigA = BigInt(a.id);
    const bigB = BigInt(b.id);
    if (bigA < bigB) {
      return -1;
    }
    if (bigA > bigB) {
      return 1;
    }
    return 0;
  });
  return sortedMessages[0].id;
}

const MAX_NUMBER_OF_MESSAGES_TO_COLLECT = 20_000;

export async function fetchAllMessages(
  channel: PublicThreadChannel,
  opts: {
    start?: string;
  } = {}
) {
  const limit = MAX_NUMBER_OF_MESSAGES_TO_COLLECT;
  const { start } = opts;

  if (start === channel?.lastMessageId) {
    return [];
  }

  const messages: Message[] = [];
  const fetchMessagesRecursively = async (after?: string) => {
    const messagePage = await channel.messages.fetch({ limit: 100, after });
    const sortedMessages = sortMessagesById([...messagePage.values()]);

    messages.push(...sortedMessages);

    const lastMessage =
      sortedMessages.length > 0
        ? sortedMessages[sortedMessages.length - 1]
        : undefined;

    for (const message of sortedMessages) {
      if (message.type !== MessageType.ThreadStarterMessage) continue;
      messages.push(await message.fetchReference());
    }

    // Continue if we have a last message and haven't hit the limit
    const shouldContinue = lastMessage && messages.length < limit;
    if (shouldContinue) {
      await fetchMessagesRecursively(lastMessage.id);
    }
  };

  await fetchMessagesRecursively(start);
  return messages.slice(0, limit);
}
