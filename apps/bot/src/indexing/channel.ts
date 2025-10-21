import {
  bulkFindLatestMessageInChannel,
  findChannelById,
  findLatestMessageInChannel,
  upsertChannel,
} from '@repo/db/helpers/channels';
import {
  type AnyThreadChannel,
  ChannelType,
  PermissionFlagsBits,
  type PublicThreadChannel,
  type Snowflake,
} from 'discord.js';
import { toDbChannel } from '../helpers/convertion';
import { fetchAllMessages, type IndexableChannels } from './helpers';
import { Log } from './logger';
import { storeIndexedData } from './store';
import { logger } from '@repo/logger';

const MAX_NUMBER_OF_THREADS_TO_COLLECT = 3000;

const canBotViewChannel = (channel: IndexableChannels | PublicThreadChannel) =>
  channel
    .permissionsFor(channel.client.user)
    ?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
    ]);

export async function indexChannel(channel: IndexableChannels) {
  if (
    channel.type !== ChannelType.GuildForum &&
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement
  )
    return;

  if (!canBotViewChannel(channel)) {
    Log('bot_cannot_view_channel', channel);
    return;
  }

  if (channel.nsfw || !channel.viewable) {
    return;
  }

  const channelSettings = await findChannelById(channel.id);
  if (
    !channelSettings?.indexingEnabled &&
    process.env.NODE_ENV != 'development'
  ) {
    Log('channel_indexing_disabled', channel);
    return;
  }

  Log('attempting_to_index_channel', channel);

  // save non thread channels
  await upsertChannel({
    create: {
      ...(await toDbChannel(channel)),
    },
    update: {
      channelName: channel.name,
    },
  });

  const archivedThreads = await fetchAllArchivedThreads(channel);

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

  // archived threads are sorted by archive timestamp from newest to oldest so we reverse them
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
      return true;
    }
    return BigInt(lookup) < BigInt(x.lastMessageId ?? x.id);
  });

  Log(
    'log_truncated_out_of_date_threads',
    threadsToIndex.length,
    outOfDateThreads.length
  );

  let threadsIndexed = 0;
  for await (const thread of outOfDateThreads) {
    Log(
      'indexing_thread_info',
      ++threadsIndexed,
      outOfDateThreads.length,
      thread,
      channel
    );
    await indexThread(thread, {
      fromMessageId: threadMessageLookup.get(thread.id)?.toString(),
    });
  }
}

export async function indexThread(
  channel: PublicThreadChannel,
  opts?: {
    fromMessageId?: Snowflake;
    skipIndexingEnabledCheck?: boolean;
  }
) {
  if (channel.isDMBased() || !channel.viewable || !canBotViewChannel(channel)) {
    return;
  }
  try {
    let start = opts?.fromMessageId;
    if (!start) {
      start = await findLatestMessageInChannel(channel.id);
    }
    const messages = await fetchAllMessages(channel, {
      start,
    });
    await storeIndexedData(messages, channel);
    Log('log_indexing_complete', channel);
  } catch (error) {
    logger.error(`Error indexing channel ${channel.name} ${channel.id}`, {
      error,
    });
  }
}

async function fetchAllArchivedThreads(channel: IndexableChannels) {
  Log('log_fetching_archived_channels', channel);

  const threadCutoffId = await findLatestMessageInChannel(channel.id);
  const archivedThreads: AnyThreadChannel[] = [];

  await recursiveFetch();

  logger.info(
    `Fetched ${archivedThreads.length} archived threads for channel ${channel.id} ${channel.name} in server ${channel.guildId} ${channel.guild.name}`
  );

  return archivedThreads;

  async function recursiveFetch(before?: number | string) {
    const fetched = await channel.threads.fetchArchived({
      type: 'public',
      before,
    });

    const last = fetched.threads.last();
    const isLastThreadOlderThanCutoff =
      last && threadCutoffId && BigInt(last.id) < BigInt(threadCutoffId);

    archivedThreads.push(...fetched.threads.values());

    if (archivedThreads.length > MAX_NUMBER_OF_THREADS_TO_COLLECT) {
      return;
    }

    if (
      !fetched.hasMore ||
      !last ||
      fetched.threads.size === 0 ||
      isLastThreadOlderThanCutoff
    ) {
      return;
    }
    await recursiveFetch(last.id);
  }
}
