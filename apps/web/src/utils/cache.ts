import { getAllMessagesInThreads } from '@repo/db/helpers/channels';
import { getAllThreads, getServerInfo, getServerInfoByChannelId } from '@repo/db/helpers/servers';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

type ValidTags =
  | 'clear-all-threads'
  | `clear-thread-${string}`
  | 'clear-all-servers'
  | `clear-server-${string}`;

// sanity check for now
// biome-ignore lint/style/noMagicNumbers: TODO: refactor to a util function later
const THREE_DAYS_IN_SECONDS =
  process.env.NODE_ENV === 'development' ? 2 : 60 * 60 * 24 * 30;

export const getAllMessagesInThreadsCache = cache((id: string) => {
  const cacheFn = unstable_cache(
    getAllMessagesInThreads,
    [`messages-thread-${id}`],
    {
      tags: [`clear-thread-${id}`, 'clear-all-threads'] satisfies ValidTags[],
      revalidate: THREE_DAYS_IN_SECONDS,
    }
  );

  return cacheFn(id);
});

export const getServerInfoByChannelIdCache = cache((id: string) => {
  const cachedFn = unstable_cache(
    getServerInfoByChannelId,
    [`server-info-${id}`],
    {
      tags: [`clear-server-${id}`, 'clear-all-servers'] satisfies ValidTags[],
      revalidate: THREE_DAYS_IN_SECONDS,
    }
  );
  return cachedFn(id);
});

export const getServerInfoCached = cache((id: string) => {
  const cachedFn = unstable_cache(
    getServerInfo,
    [`server-info-${id}`],
    {
      tags: [`clear-server-${id}`, 'clear-all-servers'] satisfies ValidTags[],
      revalidate: THREE_DAYS_IN_SECONDS,
    }
  );
  return cachedFn(id);
});
