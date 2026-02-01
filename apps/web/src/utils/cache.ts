import {
	getAllMessagesInThreads,
	getChannelInfo,
} from "@repo/db/helpers/channels";
import {
	getAllThreads,
	getServerInfo,
	getServerInfoByChannelId,
	getServerInfoByDomain,
	getTopicsInServer,
} from "@repo/db/helpers/servers";
import { CacheTags } from "@repo/utils/helpers/cache-keys";
import { unstable_cache } from "next/cache";
import { cache } from "react";

// sanity check for now
const VERCEL_CACHE_TTL = 20; // 86_400;

// :P
export function stable_cache<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	options: {
		keyParts: (...args: T) => string[];
		tags: (...args: T) => string[];
		revalidate?: number;
	},
) {
	return cache((...args: T) => {
		const cachedFn = unstable_cache(
			() => fn(...args),
			options.keyParts(...args),
			{
				tags: options.tags(...args),
				revalidate: options.revalidate ?? VERCEL_CACHE_TTL,
			},
		);
		return cachedFn();
	});
}

export const getServerInfoByDomainCache = stable_cache(getServerInfoByDomain, {
	keyParts: (domain) => [`server-info-${domain}`],
	tags: (domain) => [CacheTags.serverByDomain(domain), CacheTags.allServers()],
});

export const getAllMessagesInThreadsCache = stable_cache(
	getAllMessagesInThreads,
	{
		keyParts: (id) => [`messages-thread-${id}`],
		tags: (id) => [CacheTags.thread(id)],
	},
);

export const getServerInfoByChannelIdCache = stable_cache(
	getServerInfoByChannelId,
	{
		keyParts: (id) => [`server-info-${id}`],
		tags: (id) => [CacheTags.server(id)],
	},
);

export const getServerInfoCached = stable_cache(getServerInfo, {
	keyParts: (id) => [`server-info-${id}`],
	tags: (id) => [CacheTags.server(id)],
});

export const getChannelInfoCached = stable_cache(getChannelInfo, {
	keyParts: (id) => [`server-info-${id}`],
	tags: (id) => [CacheTags.channelInfo(id)],
});

export const getAllThreadsCached = stable_cache(getAllThreads, {
	keyParts: (getBy, config) => [
		`get-all-threads-${getBy}-${config.id}-${config.pinned ?? "all"}-${config.page ?? 1}`,
	],
	tags: (_, config) => [
		CacheTags.getAllThreads(config.id),
	],
});

export const getTopicsInServerCached = stable_cache(getTopicsInServer, {
	keyParts: (id) => [`topics-in-server-${id}`],
	tags: (id) => [CacheTags.topicsInServer(id)],
});
