import {
  bulkFindLatestMessageInChannel,
  findLatestMessageInChannel,
  upsertChannel,
} from '@repo/db/helpers/channels';
import { upsertManyMessages } from '@repo/db/helpers/messages';
import { createBulkServers } from '@repo/db/helpers/servers';
import { upsertManyDiscordAccounts } from '@repo/db/helpers/user';
import {
  type AnyThreadChannel,
  ChannelType,
  type Client,
  type ForumChannel,
  type Guild,
  type GuildTextBasedChannel,
  type Message,
  type NewsChannel,
  type Snowflake,
  type TextBasedChannel,
  type TextChannel,
} from 'discord.js';
import {
  extractUsersSetFromMessages,
  messagesToDBMessagesSet,
  toDbChannel,
  toDbServer,
  toDbUser,
} from '../helpers/convertion';
import { isSnowflakeLargerAsInt } from '../helpers/snowflake';
import { Log } from '../utils/logger';

export type IndexableChannels = NewsChannel | TextChannel | ForumChannel;
export async function indexServers(client: Client) {
  const allGuilds = [...client.guilds.cache.values()];
  const devGuild = allGuilds.find((x) => x.id === '1385955477912948806');
  const guilds = devGuild ? [devGuild] : allGuilds;

  // create a server when the bot gets added to a guild
  // to avoid this
  await createBulkServers(guilds.map((x) => toDbServer(x)));

  for await (const guild of guilds) {
    await indexGuild(guild);
  }
}
export async function indexGuild(guild: Guild) {
  try {
    const channelsCahe = [...guild.channels.cache.values()];

    if (channelsCahe.length === 0) {
      Log('no_channels', guild);
      return;
    }
    for await (const channel of channelsCahe) {
      if (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.GuildForum
      ) {
        await indexRootChannel(channel);
      }
    }
  } catch (error) {
    Log('failed_to_fetch_guild', error, guild);
  }
}

export async function indexRootChannel(channel: IndexableChannels) {
  const botCanViewChannel = channel
    .permissionsFor(channel.client.user)
    ?.has(['ViewChannel', 'ReadMessageHistory']);

  if (!botCanViewChannel) {
    Log('bot_cannot_view_channel', channel);
    return;
  }

  Log('attempting_to_index_channel', channel);

  if (channel.type === ChannelType.GuildForum) {
    const MAX_NUMBER_OF_THREADS_TO_COLLECT = 5000;
    const threadCutoffId = await findLatestMessageInChannel(channel.id);
    const archivedThreads: AnyThreadChannel[] = [];

    Log('log_fetching_archived_channels', channel);

    const fetchAllArchivedThreads = async (before?: number | string) => {
      const fetched = await channel.threads.fetchArchived({
        type: 'public',
        before,
      });

      const last = fetched.threads.last();
      const isLastThreadOlderThanCutoff =
        last && threadCutoffId && BigInt(last.id) < BigInt(threadCutoffId);

      archivedThreads.push(...fetched.threads.values());

      if (
        !fetched.hasMore ||
        !last ||
        fetched.threads.size === 0 ||
        isLastThreadOlderThanCutoff
      ) {
        return;
      }
      await fetchAllArchivedThreads(last.id);
    };

    // Fetching all archived threads is very expensive, so only do it on the very first indexing pass
    if (process.env.NODE_ENV === 'test') {
      const data = await channel.threads.fetchArchived({
        type: 'public',
        fetchAll: true,
      });
      archivedThreads.push(...data.threads.values());
    } else {
      await fetchAllArchivedThreads();
    }

    console.log(
      `Fetched ${archivedThreads.length} archived threads for channel ${channel.id} ${channel.name} in server ${channel.guildId} ${channel.guild.name}`
    );

    const activeThreads = await channel.threads.fetchActive().catch((error) => {
      Log('failed_to_fetch_active_threads', error, channel);
      return {
        threads: new Map(),
        hasMore: false,
      };
    });

    Log(
      'log_threads_to_archive_info',
      archivedThreads.length,
      activeThreads.threads.size,
      channel
    );

    // archived threads are sorted by archive timestamp from newest to oldest  so we reverse them
    const threadsToIndex = [
      ...archivedThreads.reverse(),
      ...activeThreads.threads.values(),
    ]
      .filter(
        (x) => x.type === ChannelType.PublicThread && x.parentId === channel.id
      )
      .slice(0, MAX_NUMBER_OF_THREADS_TO_COLLECT);

    Log(
      'log_threads_prune_data',
      archivedThreads.length + activeThreads.threads.size,
      threadsToIndex.length,
      channel
    );

    const mostRecentlyIndexedMessages = await bulkFindLatestMessageInChannel(
      threadsToIndex.map((x) => x.id)
    );
    const threadMessageLookup = new Map<string, string | null>(
      mostRecentlyIndexedMessages.map((x) => [x.channelId, x.latestMessageId])
    );
    const outOfDateThreads = threadsToIndex.filter((x) => {
      const lookup = threadMessageLookup.get(x.id);
      if (!lookup) {
        return true; // either undefined or null, either way we need to index
      }
      return BigInt(lookup) < BigInt(x.lastMessageId ?? x.id);
    });

    Log(
      'log_truncated_out_of_date_threads',
      threadsToIndex.length,
      outOfDateThreads.length
    );

    // @hack: forums channels weren't getting inserted; look in this;
    upsertChannel({
      create: {
        ...(await toDbChannel(channel)),
      },
      update: {},
    });

    let threadsIndexed = 0;
    for await (const thread of outOfDateThreads) {
      Log(
        'indexing_thread_info',
        ++threadsIndexed,
        outOfDateThreads.length,
        thread,
        channel
      );
      await indexTextBasedChannel(thread, {
        fromMessageId: threadMessageLookup.get(thread.id)?.toString(),
      });
    }
  } else {
    /*
      Handles indexing of text channels and news channels
      Text channels and news channels have messages in them, so we have to fetch the messages
      We also add any threads we find to the threads array
      Threads can be found from normal messages or system create messages
      TODO: Handle threads without any parent messages in the channel, unsure if possible
      */
    await indexTextBasedChannel(channel, {
      // skipIndexingEnabledCheck: true,
    });
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor this later
export async function indexTextBasedChannel(
  channel: GuildTextBasedChannel,
  opts?: {
    fromMessageId?: Snowflake;
    skipIndexingEnabledCheck?: boolean;
  }
) {
  if (channel.isDMBased() || !channel.viewable) {
    return;
  }

  try {
    let start = opts?.fromMessageId;

    if (!start) {
      start = await findLatestMessageInChannel(channel.id);
    }

    Log('log_starting_indexing_from_message', channel, start);

    let messages: Message[] = [];
    if (
      channel.type === ChannelType.PublicThread ||
      channel.type === ChannelType.AnnouncementThread
    ) {
      messages = await fetchAllMessages(channel, {
        start,
      });
    } else {
      messages = await fetchAllMessages(channel, {
        start,
      });
      const threadsToIndex: AnyThreadChannel[] = [];
      for (const message of messages) {
        const thread = message.thread;
        if (
          thread &&
          (thread.type === ChannelType.PublicThread ||
            thread.type === ChannelType.AnnouncementThread)
        ) {
          threadsToIndex.push(thread);
        }
      }

      let threadsIndexed = 0;
      for await (const thread of threadsToIndex) {
        Log(
          'indexing_thread_info',
          ++threadsIndexed,
          threadsToIndex.length,
          thread,
          channel
        );
        await indexTextBasedChannel(thread);
      }
    }
    await storeIndexData(messages, channel);
    Log('log_indexing_complete', channel);
  } catch (error) {
    console.log(`Error indexing channel ${channel.name} ${channel.id}`, error);
  }
}

async function storeIndexData(
  messages: Message[],
  channel: GuildTextBasedChannel
) {
  if (channel.client.id == null) {
    throw new Error('Received a null client id when indexing');
  }

  if (messages.length === 0) {
    console.log(
      `No messages to index for channel ${channel.name} ${channel.id}`
    );
  }

  console.log(`Upserting channel: ${channel.name} ${channel.id}`);
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

  // TODO: test this..
  if (channel.type !== ChannelType.PublicThread) {
    return;
  }

  // Filter out messages from the system
  const filteredMessages = messages.filter((m) => !m.system);

  const convertedUsers = extractUsersSetFromMessages(filteredMessages);
  const convertedMessages = await messagesToDBMessagesSet(filteredMessages);

  console.log(`Upserting ${convertedUsers.length} discord accounts`);

  await upsertManyDiscordAccounts(convertedUsers);
  const botMessages = filteredMessages.filter((x) => x.author.bot);

  const bots = [
    ...new Map(botMessages.map((x) => [x.author.id, x.author])).values(),
  ];

  if (bots.length > 0) {
    await upsertManyDiscordAccounts(bots.map(toDbUser));
  }

  console.log(`Upserting ${convertedMessages.length} messages`);

  const _upserted = await upsertManyMessages(convertedMessages);
  // await Search.indexMessageForSearch(upserted);
}

async function fetchAllMessages(
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
