import type {
  AnyThreadChannel,
  Guild,
  GuildTextBasedChannel,
} from 'discord.js';
import { logger } from '@repo/logger';
import type { IndexableChannels } from './helpers';

/**
 * @fileoverview Logger moved to separate file to avoid crowding the indexing code
 * and keep it readable while still having detailed logging.
 */

export function Log<T extends keyof typeof errToLogStringMap>(
  errorType: T,
  ...payload: Parameters<(typeof errToLogStringMap)[T]>
) {
  const fn = errToLogStringMap[errorType] as (...args: typeof payload) => void;
  fn(...payload);
}

const errToLogStringMap = {
  channel_indexing_disabled: (channel: IndexableChannels) => {
    logger.info('Indexing disabled for channel', {
      ...getChannelInfo(channel),
      event: 'channel_indexing_disabled',
    });
  },
  no_channels: (guild: Guild) => {
    logger.info('No channels found', {
      guild: guild.name,
      guildId: guild.id,
      event: 'no_channels',
    });
  },
  failed_to_fetch_guild: (error: unknown, guild: Guild) => {
    logger.error('Failed to fetch guild', {
      guild: guild.name,
      guildId: guild.id,
      event: 'failed_to_fetch_guild',
      error,
    });
  },
  faied_to_index_Thread: (thread: IndexableChannels) => {
    logger.error('Failed to index thread', {
      ...getChannelInfo(thread),
      event: 'faied_to_index_Thread',
    });
  },
  attempting_to_index_channel: (channel: IndexableChannels) => {
    logger.info('Attempting to index channel', {
      ...getChannelInfo(channel),
      event: 'attempting_to_index_channel',
    });
  },
  attempting_to_index_thread: (thread: IndexableChannels) => {
    logger.info('Attempting to index thread', {
      ...getChannelInfo(thread),
      event: 'attempting_to_index_thread',
    });
  },
  failed_to_fetch_active_threads: (
    error: unknown,
    channel: IndexableChannels
  ) => {
    logger.error('Error fetching active threads', {
      ...getChannelInfo(channel),
      event: 'failed_to_fetch_active_threads',
      error,
    });
  },
  log_threads_to_archive_info: (
    archivedThreads: number,
    activeThreads: number,
    thread: IndexableChannels
  ) => {
    const total = archivedThreads + activeThreads;
    logger.info(
      `Threads found - Total: ${total} | Archived: ${archivedThreads} | Active: ${activeThreads}`,
      {
        ...getChannelInfo(thread),
        event: 'log_threads_to_archive_info',
      }
    );
  },
  log_threads_prune_data: (
    totalThreads: number,
    threadsToIndex: number,
    thread: IndexableChannels
  ) => {
    logger.info(`Pruned Threads from ${totalThreads} to ${threadsToIndex}`, {
      ...getChannelInfo(thread),
      event: 'log_threads_prune_data',
    });
  },
  log_fetching_archived_channels: (channel: IndexableChannels) => {
    logger.info('Fetching archived threads', {
      ...getChannelInfo(channel),
      event: 'log_fetching_archived_channels',
    });
  },
  log_starting_indexing_from_message: (
    channel: GuildTextBasedChannel,
    start: string | undefined
  ) => {
    logger.info('Starting indexing from message', {
      start: start ?? 'start',
      until: channel.lastMessageId,
      ...getChannelInfo(channel),
      event: 'log_starting_indexing_from_message',
    });
  },
  log_indexing_complete: (channel: GuildTextBasedChannel) => {
    logger.info('Indexing complete 🎉', {
      ...getChannelInfo(channel),

      event: 'log_indexing_complete',
    });
  },
  bot_cannot_view_channel: (channel: IndexableChannels) => {
    logger.info('Bot cannot view channel', {
      ...getChannelInfo(channel),
      event: 'bot_cannot_view_channel',
    });
  },
  indexing_thread_info: (
    idx: number,
    outOfDateThreadsCount: number,
    thread: AnyThreadChannel,
    channel: IndexableChannels | GuildTextBasedChannel
  ) => {
    logger.info(
      [
        `Indexing ${idx}/${outOfDateThreadsCount}:`,
        `  Thread:  ${thread.id} | ${thread.name}`,
        `  Channel: ${channel.id} | ${channel.name}`,
        `  Server:  ${channel.guildId} | ${channel.guild.name}`,
      ].join('\n')
    );
  },
  log_truncated_out_of_date_threads: (
    threadsToIndex: number,
    outOfDateThreads: number
  ) => {
    logger.info(`Truncated ${outOfDateThreads} threads`, {
      threadsToIndex,
      outOfDateThreads,
      event: 'log_truncated_out_of_date_threads',
    });
  },
} as const;

function getChannelInfo(channel: IndexableChannels | GuildTextBasedChannel) {
  return {
    channel: channel.name,
    channelId: channel.id,
    guild: channel.guild.name,
    guildId: channel.guild.id,
  };
}
