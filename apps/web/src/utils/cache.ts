import {
  getAllMessagesInThreads,
  getChannelInfo,
} from '@repo/db/helpers/channels';
import {
  getAllThreads,
  getPinnedThread,
  getServerInfo,
  getServerInfoByChannelId,
  getTopicsInServer,
} from '@repo/db/helpers/servers';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

type ValidTags =
  | 'clear-all-threads'
  | `clear-thread-${string}`
  | 'clear-all-servers'
  | `clear-server-${string}`
  | 'clear-all-channels'
  | `clear-channel-${string}`;


// :P
export function stable_cache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    keyParts: (...args: T) => string[];
    tags: (...args: T) => string[];
    revalidate?: number;
  }
) {
  return cache((...args: T) => {
    const cachedFn = unstable_cache(
      () => fn(...args),
      options.keyParts(...args),
      {
        tags: options.tags(...args),
        revalidate: options.revalidate ?? THREE_DAYS_IN_SECONDS,
      }
    );
    return cachedFn();
  });
}

// sanity check for now
// biome-ignore lint/style/noMagicNumbers: TODO: refactor to a util function later
const THREE_DAYS_IN_SECONDS =
  process.env.NODE_ENV === 'development' ? 2 : 60 * 60 * 24 * 30;

export const getAllMessagesInThreadsCache = stable_cache(getAllMessagesInThreads, {
  keyParts: (id) => [`messages-thread-${id}`],
  tags: (id) => [`clear-thread-${id}`, 'clear-all-threads']
})

export const getServerInfoByChannelIdCache = stable_cache(getServerInfoByChannelId, {
  keyParts: (id) => [`server-info-${id}`],
  tags: (id) => [`clear-server-${id}`, 'clear-all-servers']
})

export const getServerInfoCached = stable_cache(getServerInfo, {
  keyParts: (id) => [`server-info-${id}`],
  tags: (id) => [`clear-server-${id}`, 'clear-all-servers']
});

export const getChannelInfoCached = stable_cache(getChannelInfo, {
  keyParts: (id) => [`server-info-${id}`],
  tags: (id) => [`clear-channel-info-${id}`, 'clear-all-channels-info']
});

export const getAllThreadsCached = stable_cache(getAllThreads, {
  keyParts: (getBy, config) => [
    `get-all-threads-${getBy}-${config.id}-${config.pinned ?? 'all'}-${config.page ?? 1}`
  ],
  tags: (_, config) => [
    `clear-get-all-threads-${config.id}`,
    'clear-get-all-threads'
  ],
})

export const getPinnedThreadCached = stable_cache(getPinnedThread, {
  keyParts: (id) => [`pinned-thread-${id}`],
  tags: (id) => [`clear-get-pinned-thread-${id}`, `clear-get-pinned-channels`]
})

export const getTopicsInServerCached = stable_cache(getTopicsInServer, {
  keyParts: (id) => [`topics-in-server-${id}`],
  tags: (id) => [`clear-get-topics-in-server-${id}`, `clear-all-get-topics-in-server`]
})