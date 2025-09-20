import { count, eq, inArray } from 'drizzle-orm';
import { db } from '../index';
import { type DBChannel, dbChannel, dbMessage, dbServer } from '../schema';

export async function getChannelInfo(channelId: string) {
  const data = await db
    .select({
      channel: dbChannel,
      server: dbServer,
    })
    .from(dbChannel)
    .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
    .where(eq(dbChannel.id, channelId))
    .limit(1);

  if (data.length === 0) {
    return;
  }
  return data[0];
}

export async function getAllMessagesInThreads(channelId: string) {
  return await db.query.dbChannel.findFirst({
    where: eq(dbChannel.id, channelId),
    with: {
      messages: {
        with: {
          user: true,
          attachments: true,
        },
        orderBy: [dbChannel.id],
      },
    },
  });
}

export async function findLatestMessageInChannel(channelId: string) {
  const result = await db.query.dbChannel.findFirst({
    where: eq(dbChannel.id, channelId),
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
  return await db.query.dbChannel.findFirst({
    where: eq(dbChannel.id, channelId),
  });
}

export async function deleteChannel(channelId: string) {
  await db.delete(dbChannel).where(eq(dbChannel.id, channelId));
}

export async function upsertChannel(data: {
  update: Partial<DBChannel>;
  create: DBChannel;
}) {
  const exist = await findChannelById(data.create.id);

  if (!exist) {
    await db.insert(dbChannel).values(data.create);
    return;
  }

  await db
    .update(dbChannel)
    .set({
      id: data.create.id,
      ...data.update,
    })
    .where(eq(dbChannel.id, data.create.id));
}

export async function getThreadComments(channelId: string) {
  const result = await db
    .select({ count: count(dbMessage.id) })
    .from(dbMessage)
    .where(eq(dbMessage.channelId, channelId))
    .groupBy(dbMessage.id)
    .limit(1);

  return result[0]?.count ?? 0;
}

export async function getBulkThreadReplies(channelIds: string[]) {
  if (channelIds.length === 0) {
    return [];
  }
  return await db
    .select({
      count: count(dbMessage.id),
      channelId: dbMessage.channelId,
    })
    .from(dbMessage)
    .where(inArray(dbMessage.channelId, channelIds))
    .groupBy(dbMessage.channelId);
}
