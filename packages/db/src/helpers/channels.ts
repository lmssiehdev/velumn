import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  type DBAttachments,
  type DBChannel,
  dbAttachments,
  dbChannel,
  dbDiscordUser,
  dbMessage,
  dbServer,
} from '../schema';

export async function setBulkIndexingStatus(
  channels: { channelId: string; status: boolean }[]
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
  const channel = await db
    .select()
    .from(dbChannel)
    .where(eq(dbChannel.id, channelId))
    .limit(1);

  if (!channel[0]) {
    return null;
  }

  const messages = await db
    .select()
    .from(dbMessage)
    .where(eq(dbMessage.channelId, channelId))
    .orderBy(asc(dbMessage.id));

  const userIds = [...new Set(messages.map((m) => m.authorId).filter(Boolean))];
  const users =
    userIds.length > 0
      ? await db
          .select()
          .from(dbDiscordUser)
          .where(inArray(dbDiscordUser.id, userIds))
      : [];

  const messageIds = messages.map((m) => m.id);
  const attachments =
    messageIds.length > 0
      ? await db
          .select()
          .from(dbAttachments)
          .where(inArray(dbAttachments.messageId, messageIds))
      : [];

  const usersMap = new Map(users.map((u) => [u.id, u]));
  const attachmentsByMessage = attachments.reduce(
    (acc, att) => {
      if (!acc[att.messageId]) {
        acc[att.messageId] = [];
      }
      acc[att.messageId]?.push(att);
      return acc;
    },
    {} as Record<string, DBAttachments[]>
  );

  return {
    ...channel[0],
    messages: messages.map((message) => ({
      ...message,
      user: usersMap.get(message.authorId) || null,
      attachments: attachmentsByMessage[message.id] || [],
    })),
  };

  return await db.query.dbChannel.findFirst({
    where: eq(dbChannel.id, channelId),
    with: {
      messages: {
        with: {
          user: true,
          attachments: true,
        },
        orderBy: [asc(dbChannel.id)],
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

export async function updateChannel(data: Partial<DBChannel>) {
  if (!data.id) {
    throw new Error('Channel ID is required for update');
  }
  await db.update(dbChannel).set(data).where(eq(dbChannel.id, data.id));
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
