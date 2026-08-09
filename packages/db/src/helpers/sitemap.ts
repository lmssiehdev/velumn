import { ChannelType } from "discord-api-types/v10";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "..";
import { dbChannel, dbServer } from "../schema";

const mainSiteThreadFilter = and(
	inArray(dbChannel.type, [
		ChannelType.PublicThread,
		ChannelType.AnnouncementThread,
	]),
	or(isNull(dbServer.customDomain), eq(dbServer.domainVerified, false)),
);

export async function getThreadsCountTotal() {
	const threadsCount = await db
		.select({ count: count(dbChannel.id) })
		.from(dbChannel)
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.where(mainSiteThreadFilter);

	if (!threadsCount || threadsCount.length === 0) {
		return 0;
	}

	const { count: c } = threadsCount[0]!;
	return c;
}

export async function getThreadsForSitemap(start: number, limit: number) {
	return await db
		.select({ id: dbChannel.id, name: dbChannel.channelName })
		.from(dbChannel)
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.where(mainSiteThreadFilter)
		.orderBy(desc(dbChannel.id))
		.offset(start)
		.limit(limit);
}

export async function getThreadsCountForServer(serverId: string) {
	const threadsCount = await db
		.select({ count: count(dbChannel.id) })
		.from(dbChannel)
		.where(
			and(
				eq(dbChannel.serverId, serverId),
				inArray(dbChannel.type, [
					ChannelType.PublicThread,
					ChannelType.AnnouncementThread,
				]),
			),
		);

	if (!threadsCount || threadsCount.length === 0) {
		return 0;
	}

	return threadsCount[0]?.count ?? 0;
}

export async function getThreadsForServerSitemap(
	serverId: string,
	start: number,
	limit: number,
) {
	return await db
		.select({ id: dbChannel.id, name: dbChannel.channelName })
		.from(dbChannel)
		.where(
			and(
				eq(dbChannel.serverId, serverId),
				inArray(dbChannel.type, [
					ChannelType.PublicThread,
					ChannelType.AnnouncementThread,
				]),
			),
		)
		.orderBy(desc(dbChannel.id))
		.offset(start)
		.limit(limit);
}
