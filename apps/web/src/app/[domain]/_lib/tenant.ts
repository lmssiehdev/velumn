import { normalizeHostHeader } from "@repo/utils/helpers/domains";
import { notFound } from "next/navigation";
import {
	getAllMessagesInThreadsCache,
	getChannelInfoCached,
	getServerInfoByDomainCache,
} from "@/utils/cache";

export async function getTenantServerOrNotFound(domainParam: string) {
	const domain = normalizeHostHeader(decodeURIComponent(domainParam));
	const server = await getServerInfoByDomainCache(domain);

	if (!server) {
		notFound();
	}

	return {
		domain,
		server,
	};
}

export async function getTenantChannelOrNotFound(
	domainParam: string,
	channelId: string,
) {
	const tenant = await getTenantServerOrNotFound(domainParam);
	const channel = await getChannelInfoCached(channelId);

	if (!channel?.server || channel.serverId !== tenant.server.id) {
		notFound();
	}

	return {
		...tenant,
		channel,
	};
}

export async function getTenantThreadOrNotFound(
	domainParam: string,
	threadId: string,
) {
	const tenant = await getTenantServerOrNotFound(domainParam);
	const thread = await getAllMessagesInThreadsCache(threadId);

	if (!thread?.server || thread.serverId !== tenant.server.id) {
		notFound();
	}

	return {
		...tenant,
		thread,
	};
}
