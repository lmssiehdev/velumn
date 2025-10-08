import {
  bulkFindLatestMessageInChannel,
  findLatestMessageInChannel,
  upsertChannel,
} from '@repo/db/helpers/channels';
import {
  type AnyThreadChannel,
  ChannelType,
  type GuildTextBasedChannel,
  type Message,
  PermissionFlagsBits,
  type Snowflake,
} from 'discord.js';
import { toDbChannel } from '../../helpers/convertion';
import { logger } from '../../helpers/lib/log';
import { fetchAllMessages, type IndexableChannels } from './helpers';
import { Log } from './logger';
import { storeIndexedData } from './store';

export async function indexRootChannel(channel: IndexableChannels) {
  const botCanViewChannel = channel
    .permissionsFor(channel.client.user)
    ?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
    ]);

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

    await fetchAllArchivedThreads();

    logger.info(
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
      update: {
        channelName: channel.name,
      },
    });

    let threadsIndexed = 0;
    for await (const thread of outOfDateThreads) {
      if (thread.nsfw) {
        continue;
      }
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
      skipIndexingEnabledCheck: true,
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

    if (!opts?.skipIndexingEnabledCheck) {
      // const channelSettings = await findChannelById(channel.isThread() ? channel.parentId! : channel.id);
      // if (!channelSettings?.indexingEnabled) {
      //   Log("channel_indexing_disabled", channel);
      //   return;
      // };
      // start = channelSettings.lastIndexedMessageId ?? undefined;
    }
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
    await storeIndexedData(messages, channel);
    Log('log_indexing_complete', channel);
  } catch (error) {
    logger.info(`Error indexing channel ${channel.name} ${channel.id}`, error);
  }
}
