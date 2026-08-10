import { ChannelType } from "discord-api-types/v10";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import { dbChannel } from "../schema";

export type DashboardChannelListItem = {
	id: string;
	name: string;
	type: "forum" | "text";
	indexingEnabled: boolean;
	indexedThreadCount: number;
};

export async function getDashboardChannels(
	serverId: string,
): Promise<DashboardChannelListItem[]> {
	const threadCounts = db
		.select({
			parentId: dbChannel.parentId,
			count: sql<number>`count(*)::int`.as("thread_count"),
		})
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
		.groupBy(dbChannel.parentId)
		.as("channel_thread_counts");

	const rows = await db
		.select({
			id: dbChannel.id,
			name: dbChannel.channelName,
			type: dbChannel.type,
			indexingEnabled: dbChannel.indexingEnabled,
			indexedThreadCount: sql<number>`coalesce(${threadCounts.count}, 0)::int`,
		})
		.from(dbChannel)
		.leftJoin(threadCounts, eq(threadCounts.parentId, dbChannel.id))
		.where(
			and(
				eq(dbChannel.serverId, serverId),
				inArray(dbChannel.type, [
					ChannelType.GuildText,
					ChannelType.GuildForum,
					ChannelType.GuildAnnouncement,
				]),
			),
		)
		.orderBy(asc(dbChannel.channelName), asc(dbChannel.id));

	return rows.map((row) => ({
		id: row.id,
		name: row.name ?? "unknown-channel",
		type: row.type === ChannelType.GuildForum ? "forum" : "text",
		indexingEnabled: row.indexingEnabled,
		indexedThreadCount: row.indexedThreadCount,
	}));
}
