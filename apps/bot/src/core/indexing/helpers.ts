import type {
  ForumChannel,
  Message,
  NewsChannel,
  TextBasedChannel,
  TextChannel,
} from 'discord.js';
import { isSnowflakeLargerAsInt } from '../../helpers/snowflake';

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

export async function fetchAllMessages(
  channel: TextBasedChannel,
  opts: {
    start?: string;
    limit?: string;
  } = {}
) {
  if (channel.isDMBased()) {
    throw new Error('Cannot fetch messages from a DM channel');
  }
  const MAX_NUMBER_OF_MESSAGES_TO_COLLECT = 20_000;
  const { start, limit = MAX_NUMBER_OF_MESSAGES_TO_COLLECT } = opts;
  if (channel.lastMessageId && start === channel.lastMessageId) {
    return [];
  }

  const messages: Message[] = [];
  let lastMessage: Message | undefined;
  let approximateThreadMessageCount = 0;
  const asyncMessageFetch = async (after: string) => {
    await channel.messages.fetch({ limit: 100, after }).then((messagePage) => {
      const sortedMessagesById = sortMessagesById([...messagePage.values()]);
      messages.push(...sortedMessagesById.values());
      // Update our message pointer to be last message in page of messages
      lastMessage =
        sortedMessagesById.length > 0 ? sortedMessagesById.at(-1) : undefined;
      for (const msg of sortedMessagesById) {
        if (msg.thread) {
          approximateThreadMessageCount += msg.thread.messageCount ?? 0;
        }
      }
    });
    if (
      lastMessage &&
      (limit === undefined ||
        messages.length + approximateThreadMessageCount < Number(limit))
    ) {
      await asyncMessageFetch(lastMessage.id);
    }
  };

  await asyncMessageFetch(start ?? '0');
  return messages.slice(0, Number(limit));
}
