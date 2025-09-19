import { container } from '@sapphire/framework';
import type {
  AnyThreadChannel,
  Guild,
  GuildTextBasedChannel,
} from 'discord.js';
import type { IndexableChannels } from '../core/indexing';

/**
 * @fileoverview Logger moved to separate file to avoid crowding the main indexing file
 * and keep the code readable while keeping rigorous logging.
 */

const errToLogStringMap = {
  no_channels: (guild: Guild) => {
    container.logger.info('No channels found', {
      guild: guild.name,
      guildId: guild.id,
      event: 'no_channels',
    });
  },
  failed_to_fetch_guild: (error: Error, guild: Guild) => {
    container.logger.error('Failed to fetch guild', {
      guild: guild.name,
      guildId: guild.id,
      event: 'failed_to_fetch_guild',
      error,
    });
  },
  faied_to_index_Thread: (thread: IndexableChannels) => {
    container.logger.error('Failed to index thread', {
      thread: thread.name,
      threadId: thread.id,
      event: 'faied_to_index_Thread',
    });
  },
  attempting_to_index_channel: (channel: IndexableChannels) => {
    container.logger.info('Attempting to index channel', {
      channel: channel.name,
      channelId: channel.id,
      event: 'attempting_to_index_channel',
    });
  },
  attempting_to_index_thread: (thread: IndexableChannels) => {
    container.logger.info('Attempting to index thread', {
      thread: thread.name,
      threadId: thread.id,
      event: 'attempting_to_index_thread',
    });
  },
  failed_to_fetch_active_threads: (error, channel: IndexableChannels) => {
    container.logger.error('Error fetching active threads', {
      channel: channel.name,
      channelId: channel.id,
      guild: channel.guild.name,
      guildId: channel.guildId,
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
    container.logger.info(
      `Threads found - Total: ${total} | Archived: ${archivedThreads} | Active: ${activeThreads}`,
      {
        thread: thread.name,
        threadId: thread.id,
        guild: thread.guild.name,
        guildId: thread.guildId,
        event: 'log_threads_to_archive_info',
      }
    );
  },
  log_threads_prune_data: (
    totalThreads: number,
    threadsToIndex: number,
    thread: IndexableChannels
  ) => {
    container.logger.info(
      `Pruned Threads from ${totalThreads} to ${threadsToIndex}`,
      {
        thread: thread.name,
        threadId: thread.id,
        guild: thread.guild.name,
        guildId: thread.guildId,
        event: 'log_threads_prune_data',
      }
    );
  },
  log_fetching_archived_channels: (channel: IndexableChannels) => {
    container.logger.info('Fetching archived threads', {
      channel: channel.name,
      channelId: channel.id,
      guild: channel.guild.name,
      guildId: channel.guildId,
      event: 'log_fetching_archived_channels',
    });
  },
  log_starting_indexing_from_message: (
    channel: GuildTextBasedChannel,
    start: string | undefined
  ) => {
    container.logger.info('Starting indexing from message', {
      start,
      until: channel.lastMessageId,
      channel: channel.name,
      channelId: channel.id,
      guild: channel.guild.name,
      event: 'log_starting_indexing_from_message',
    });
  },
  log_indexing_complete: (channel: GuildTextBasedChannel) => {
    container.logger.info('Indexing complete 🎉', {
      channel: channel.name,
      channelId: channel.id,
      guild: channel.guild.name,
      event: 'log_indexing_complete',
    });
  },
  bot_cannot_view_channel: (channel: IndexableChannels) => {
    container.logger.error('Bot cannot view channel', {
      channel: channel.name,
      channelId: channel.id,
      guild: channel.guild.name,
      event: 'bot_cannot_view_channel',
    });
  },
  indexing_thread_info: (
    idx: number,
    outOfDateThreadsCount: number,
    thread: AnyThreadChannel,
    channel: IndexableChannels | GuildTextBasedChannel
  ) => {
    container.logger.info(
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
    container.logger.info(`Truncated ${outOfDateThreads} threads`, {
      threadsToIndex,
      outOfDateThreads,
      event: 'log_truncated_out_of_date_threads',
    });
  },
} as const;

export function Log<T extends keyof typeof errToLogStringMap>(
  errorType: T,
  ...payload: Parameters<(typeof errToLogStringMap)[T]>
) {
  const fn = errToLogStringMap[errorType] as (...args: typeof payload) => void;
  fn(...payload);
}
