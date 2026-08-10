import { ChannelType } from "discord-api-types/v10";
import { and, asc, desc, eq, ilike, inArray, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index";
import { dbChannel, dbMessage } from "../schema";

export type DashboardThreadSort =
	| "newest"
	| "title"
	| "parentChannel"
	| "messageCount";
export type DashboardThreadDirection = "asc" | "desc";
export type DashboardThreadPinnedFilter = "all" | "pinned" | "unpinned";

export type DashboardThreadQuery = {
	serverId: string;
	page: number;
	pageSize: number;
	search: string;
	channelIds: string[];
	pinned: DashboardThreadPinnedFilter;
	sort: DashboardThreadSort;
	direction: DashboardThreadDirection;
};

export type DashboardThreadPage = {
	threads: Array<{
		id: string;
		title: string;
		parentChannel: { id: string; name: string };
		messageCount: number;
		pinned: boolean;
	}>;
	channels: Array<{ id: string; name: string }>;
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	summary: {
		published: number;
		pinned: number;
		channels: number;
	};
};

function escapeLike(value: string) {
	return value.replace(/[\\%_]/g, "\\$&");
}

export async function getDashboardThreadPage(
	query: DashboardThreadQuery,
): Promise<DashboardThreadPage> {
	const parent = alias(dbChannel, "thread_parent");
	const messageCounts = db
		.select({
			threadId: dbMessage.primaryChannelId,
			count: sql<number>`count(*)::int`.as("message_count"),
		})
		.from(dbMessage)
		.where(eq(dbMessage.serverId, query.serverId))
		.groupBy(dbMessage.primaryChannelId)
		.as("thread_message_counts");
	const messageCount = sql<number>`coalesce(${messageCounts.count}, 0)::int`;
	const filters: Array<SQL | undefined> = [
		eq(dbChannel.serverId, query.serverId),
		inArray(dbChannel.type, [
			ChannelType.PublicThread,
			ChannelType.AnnouncementThread,
		]),
		eq(parent.serverId, query.serverId),
		query.search
			? ilike(dbChannel.channelName, `%${escapeLike(query.search)}%`)
			: undefined,
		query.channelIds.length > 0
			? inArray(parent.id, query.channelIds)
			: undefined,
		query.pinned === "pinned"
			? eq(dbChannel.pinned, true)
			: query.pinned === "unpinned"
				? eq(dbChannel.pinned, false)
				: undefined,
	];
	const where = and(...filters);
	const sortExpression =
		query.sort === "title"
			? dbChannel.channelName
			: query.sort === "parentChannel"
				? parent.channelName
				: query.sort === "messageCount"
					? messageCount
					: dbChannel.id;
	const order = query.direction === "asc" ? asc : desc;

	const publishedWhere = and(
		eq(dbChannel.serverId, query.serverId),
		inArray(dbChannel.type, [
			ChannelType.PublicThread,
			ChannelType.AnnouncementThread,
		]),
		eq(parent.serverId, query.serverId),
	);
	const [rows, totalRows, channelRows, summaryRows] = await Promise.all([
		db
			.select({
				id: dbChannel.id,
				title: dbChannel.channelName,
				parentId: parent.id,
				parentName: parent.channelName,
				messageCount,
				pinned: dbChannel.pinned,
			})
			.from(dbChannel)
			.innerJoin(
				parent,
				and(
					eq(parent.id, dbChannel.parentId),
					eq(parent.serverId, dbChannel.serverId),
				),
			)
			.leftJoin(messageCounts, eq(messageCounts.threadId, dbChannel.id))
			.where(where)
			.orderBy(order(sortExpression), desc(dbChannel.id))
			.limit(query.pageSize)
			.offset((query.page - 1) * query.pageSize),
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(dbChannel)
			.innerJoin(
				parent,
				and(
					eq(parent.id, dbChannel.parentId),
					eq(parent.serverId, dbChannel.serverId),
				),
			)
			.where(where),
		db
			.selectDistinct({ id: parent.id, name: parent.channelName })
			.from(dbChannel)
			.innerJoin(
				parent,
				and(
					eq(parent.id, dbChannel.parentId),
					eq(parent.serverId, dbChannel.serverId),
				),
			)
			.where(
				and(
					eq(dbChannel.serverId, query.serverId),
					inArray(dbChannel.type, [
						ChannelType.PublicThread,
						ChannelType.AnnouncementThread,
					]),
				),
			)
			.orderBy(asc(parent.channelName), asc(parent.id)),
		db
			.select({
				published: sql<number>`count(*)::int`,
				pinned: sql<number>`(count(*) filter (where ${dbChannel.pinned}))::int`,
			})
			.from(dbChannel)
			.innerJoin(
				parent,
				and(
					eq(parent.id, dbChannel.parentId),
					eq(parent.serverId, dbChannel.serverId),
				),
			)
			.where(publishedWhere),
	]);

	const total = totalRows[0]?.count ?? 0;
	return {
		threads: rows.map((row) => ({
			id: row.id,
			title: row.title ?? "Untitled thread",
			parentChannel: {
				id: row.parentId,
				name: row.parentName ?? "unknown",
			},
			messageCount: row.messageCount,
			pinned: row.pinned,
		})),
		channels: channelRows.map((channel) => ({
			id: channel.id,
			name: channel.name ?? "unknown",
		})),
		total,
		page: query.page,
		pageSize: query.pageSize,
		totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
		summary: {
			published: summaryRows[0]?.published ?? 0,
			pinned: summaryRows[0]?.pinned ?? 0,
			channels: channelRows.length,
		},
	};
}
