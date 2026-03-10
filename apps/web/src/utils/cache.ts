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

const METADATA_TTL = 86_400;
const THREAD_LIST_TTL = 3_600;

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
				revalidate: options.revalidate,
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
		revalidate: METADATA_TTL,
	},
);

export const getServerInfoByChannelIdCache = cache(async (id: string) => {
	const channel = await getChannelInfoCached(id);
	if (!channel) {
		return getServerInfoByChannelId(id);
	}
	return getServerInfoCached(channel.serverId);
});

export const getServerInfoCached = stable_cache(getServerInfo, {
	keyParts: (id) => [`server-info-${id}`],
	tags: (id) => [CacheTags.server(id)],
	revalidate: METADATA_TTL,
});

export const getChannelInfoCached = stable_cache(getChannelInfo, {
	keyParts: (id) => [`channel-info-${id}`],
	tags: (id) => [CacheTags.channelInfo(id)],
	revalidate: METADATA_TTL,
});

export const getAllThreadsCached = stable_cache(getAllThreads, {
	keyParts: (getBy, config) => [
		`get-all-threads-${getBy}-${config.id}-${config.pinFilter ?? "all"}-${config.page ?? 1}`,
	],
	tags: (_, config) => [CacheTags.getAllThreads(config.id)],
	revalidate: THREAD_LIST_TTL,
});

export const getTopicsInServerCached = stable_cache(getTopicsInServer, {
	keyParts: (id) => [`topics-in-server-${id}`],
	tags: (id) => [CacheTags.topicsInServer(id)],
	revalidate: METADATA_TTL,
});
