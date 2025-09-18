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
  type ThreadChannel,
} from 'discord.js';
import {
  extractUsersSetFromMessages,
  messagesToDBMessagesSet,
  toDbChannel,
  toDbServer,
  toDbUser,
} from '../helpers/convertion';
import { isSnowflakeLargerAsInt } from '../helpers/snowflake';
export async function indexServers(client: Client) {
  const allGuilds = [...client.guilds.cache.values()];
  const devGuild = allGuilds.find((x) => x.id === '1228579842212106302');
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
      Log('no_channels', null, guild);
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
type IndexableChannels = NewsChannel | TextChannel | ForumChannel;

export async function indexRootChannel(channel: IndexableChannels) {
  const botCanViewChannel = channel
    .permissionsFor(channel.client.user)
    ?.has(['ViewChannel', 'ReadMessageHistory']);

  if (!botCanViewChannel) {
    Log('bot_cannot_view_channel', null, channel);
    return;
  }

  Log('attempting_to_index_channel', null, channel);

  if (channel.type === ChannelType.GuildForum) {
    const MAX_NUMBER_OF_THREADS_TO_COLLECT = 5000;
    const threadCutoffId = await findLatestMessageInChannel(channel.id);
    const archivedThreads: AnyThreadChannel[] = [];
    Log('log_fetching_archived_channels', null, channel);
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
      null,
      archivedThreads.length,
      activeThreads.threads.size
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
      archivedThreads.length,
      activeThreads.threads.size,
      threadsToIndex.length
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
      null,
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
        null,
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

    Log('log_starting_indexing_from_message', null, channel, start);

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
          null,
          ++threadsIndexed,
          threadsToIndex.length,
          thread,
          channel
        );
        await indexTextBasedChannel(thread);
      }
    }
    await storeIndexData(messages, channel);
    Log('log_indexing_complete', null, channel);
  } catch (error) {
    console.log(
      `Error indexing channel ${channel.id} | ${channel.name}`,
      error
    );
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
      `No messages to index for channel ${channel.id} | ${channel.name}`
    );
  }

  console.log(`Upserting channel: ${channel.id}`);
  const lastIndexedMessageId =
    messages.sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)).at(0)?.id ??
    '0';

  const convertedChannel = await toDbChannel(channel);
  await upsertChannel({
    create: {
      ...convertedChannel,
    },
    update: {
      archivedTimestamp: convertedChannel.archivedTimestamp,
      lastIndexedMessageId,
    },
  });

  // TODO: test this..
  if (channel.type !== ChannelType.PublicThread) {
    return;
  }

  // Filter out messages from the system
  const filteredMessages = messages.filter((m) => !m.system);

  // Convert to Answer Overflow data types
  const convertedUsers = extractUsersSetFromMessages(filteredMessages);
  const convertedMessages = await messagesToDBMessagesSet(filteredMessages);

  console.log(`Upserting ${convertedUsers.length} discord accounts `);

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

const errToLogStringMap = {
  failed_to_fetch_guild: (guild: Guild) => {
    return `Failed to fetch guild ${guild.name} (${guild.id})`;
  },
  faied_to_index_Thread: (thread: ThreadChannel) => {
    return `Failed to index thread ${thread.name} (${thread.id})`;
  },
  attempting_to_index_guild: (guild: Guild) => {
    return `Attempting to index Guild ${guild.name} (${guild.id})`;
  },
  attempting_to_index_channel: (channel: IndexableChannels) => {
    return `Attempting to index channel ${channel.name} (${channel.id})`;
  },
  attempting_to_index_thread: (thread: ThreadChannel) => {
    return `Attempting to index thread ${thread.name} (${thread.id})`;
  },
  failed_to_fetch_active_threads: (channel: ThreadChannel) => {
    return `Error fetching active threads for channel ${channel.id} ${channel.name} in server ${channel.guildId} ${channel.guild.name}`;
  },
  log_threads_to_archive_info: (
    archivedThreadsCount: number,
    activeThreadsCount: number
  ) => {
    return `Found ${archivedThreadsCount} archived threads and ${
      activeThreadsCount
    } active threads, a total of ${
      archivedThreadsCount + activeThreadsCount
    } threads`;
  },
  log_threads_prune_data: (
    archivedThreadsCount: number,
    activeThreadsCount: number,
    threadsToIndexCount: number
  ) => {
    return `Pruned threads to index from ${
      activeThreadsCount + archivedThreadsCount
    } to ${threadsToIndexCount} threads`;
  },
  log_fetching_archived_channels: (channel: ThreadChannel) => {
    return `Fetching archived threads for channel ${channel.id} ${channel.name} in server ${channel.guildId} ${channel.guild.name}`;
  },
  log_truncated_out_of_date_threads: (
    threadsToIndexCount: number,
    outOfDateThreadsCount: number
  ) => {
    return `Truncated threads to index from ${threadsToIndexCount} to ${
      outOfDateThreadsCount
    } out of date threads, skipped ${
      threadsToIndexCount - outOfDateThreadsCount
    }`;
  },
  indexing_thread_info: (
    idx: number,
    outOfDateThreadsCount: number,
    thread: ThreadChannel,
    channel: ThreadChannel
  ) => {
    return `(${idx}/${outOfDateThreadsCount}) Indexing:
Thread: ${thread.id} | ${thread.name}
Channel: ${channel.id} | ${channel.name}
Server: ${channel.guildId} | ${channel.guild.name}`;
  },
  log_starting_indexing_from_message: (
    channel: ThreadChannel,
    start: string
  ) => {
    return `Indexing channel ${channel.id} | ${channel.name} from message id ${
      start ?? 'beginning'
    } until ${channel.lastMessageId ?? 'unknown'}`;
  },
  log_indexing_complete: (channel: ThreadChannel) => {
    return `Finished writing data, indexing complete for channel ${channel.id} | ${channel.name}`;
  },
  bot_cannot_view_channel: (channel: ThreadChannel) => {
    return `Bot cannot view channel ${channel.id} | ${channel.name} in server ${channel.guildId} | ${channel.guild.name}`;
  },
} as const;

function Log(
  errorType: keyof typeof errToLogStringMap | string,
  error?: unknown,
  ...payload
) {
  if (errorType in errToLogStringMap) {
    console.error(errToLogStringMap[errorType](...payload), error);
    return;
  }

  console.log(errorType);
}
