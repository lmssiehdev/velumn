import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import { type DBChannel, dbChannel } from "../schema";

export async function setBulkIndexingStatus(
	channels: { channelId: string; status: boolean }[],
) {
	if (channels.length === 0) {
		return;
	}

	const enableIds = channels.filter((c) => c.status).map((c) => c.channelId);
	const disableIds = channels.filter((c) => !c.status).map((c) => c.channelId);

	if (enableIds.length > 0) {
		await db
			.update(dbChannel)
			.set({ indexingEnabled: true })
			.where(inArray(dbChannel.id, enableIds));
	}

	if (disableIds.length > 0) {
		await db
			.update(dbChannel)
			.set({ indexingEnabled: false })
			.where(inArray(dbChannel.id, disableIds));
	}
}

export async function getChannelInfo(channelId: string) {
	return await db.query.dbChannel.findFirst({
		where: { id: channelId },
		with: {
			server: true,
		},
	});
}

export async function getAllMessagesInThreads(channelId: string) {
	return await db.query.dbChannel.findFirst({
		where: { id: channelId },
		with: {
			server: true,
			backlinks: {
				with: {
					fromThread: {
						with: {
							author: {
								columns: {
									id: true,
									displayName: true,
									anonymizeName: true,
									isIgnored: true,
								},
							},
						},
						columns: {
							channelName: true,
						},
					},
				},
				limit: 10,
			},
			parent: true,
			messages: {
				with: {
					user: true,
					attachments: true,
				},
				orderBy: {
					id: "asc",
				},
			},
		},
	});
}

export async function findLatestMessageInChannel(channelId: string) {
	const result = await db.query.dbChannel.findFirst({
		where: {
			id: channelId,
		},
		columns: {
			lastIndexedMessageId: true,
		},
	});

	return result?.lastIndexedMessageId ?? undefined;
}

export async function bulkFindLatestMessageInChannel(channelIds: string[]) {
	if (channelIds.length === 0) {
		return [];
	}
	return await db
		.select({
			latestMessageId: dbChannel.lastIndexedMessageId,
			channelId: dbChannel.id,
		})
		.from(dbChannel)
		.where(inArray(dbChannel.id, channelIds))
		.groupBy(dbChannel.id);
}

export async function findChannelById(channelId: string) {
	return await db._query.dbChannel.findFirst({
		where: eq(dbChannel.id, channelId),
	});
}

export async function deleteChannel(channelId: string) {
	return await db.delete(dbChannel).where(eq(dbChannel.id, channelId));
}

export async function upsertBulkChannels(channels: DBChannel[]) {
	await db
		.insert(dbChannel)
		.values(channels)
		.onConflictDoUpdate({
			target: dbChannel.id,
			set: {
				channelName: sql.raw(`excluded.${dbChannel.channelName.name}`),
			},
		});
}

export async function upsertChannel(data: {
	update: Partial<DBChannel>;
	create: DBChannel;
}) {
	return await db.insert(dbChannel).values(data.create).onConflictDoUpdate({
		target: dbChannel.id,
		set: data.update,
	});
}

export async function updateChannel(data: Partial<DBChannel>) {
	if (!data.id) {
		throw new Error("Channel ID is required for update");
	}
	await db.update(dbChannel).set(data).where(eq(dbChannel.id, data.id));
}
