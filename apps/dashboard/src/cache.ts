import { getAllThreads } from '@repo/db/helpers/servers';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

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

export const getAllThreadsCached = stable_cache(getAllThreads, {
  keyParts: (getBy, config) => [
    `get-all-threads-${getBy}-${config.id}-${config.pinned ?? 'all'}-${config.page ?? 1}`,
  ],
  tags: (_, config) => [
    `clear-get-all-threads-${config.id}`,
    'clear-get-all-threads',
  ],
});
