import { asc, count, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../index';
import {
  type DBChannel,
  type DBMessage,
  type DBUser,
  dbAttachments,
  dbChannel,
  dbDiscordUser,
  dbMessage,
  dbServer,
} from '../schema';
import type { DBAttachments } from './validation';

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

export async function getAllMessagesInThreads(channelId: string): Promise<
  | (DBChannel & {
    parent: DBChannel;
    messages: (DBMessage & {
      user: DBUser | null;
      attachments: DBAttachments[];
    })[];
  })
  | null
> {
  const parent = alias(dbChannel, 'parent');
  const threadWithParent = await db
    .select({
      channel: dbChannel,
      parentChannel: parent,
    })
    .from(dbChannel)
    .innerJoin(parent, eq(dbChannel.parentId, parent.id))
    .where(eq(dbChannel.id, channelId))
    .limit(1);

  if (!threadWithParent[0] || !threadWithParent[0].channel) {
    return null;
  }

  const { channel, parentChannel } = threadWithParent[0];

  const messages = await db
    .select()
    .from(dbMessage)
    .where(or(eq(dbMessage.channelId, channelId), eq(dbMessage.childThreadId, channelId)))
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
    ...channel,
    parent: parentChannel,
    messages: messages.map((message) => ({
      ...message,
      user: usersMap.get(message.authorId) || null,
      attachments: attachmentsByMessage[message.id] || [],
    })),
  };

  // return await db.query.dbChannel.findFirst({
  //   where: eq(dbChannel.id, channelId),
  //   with: {
  //     messages: {
  //       with: {
  //         user: true,
  //         attachments: true,
  //       },
  //       orderBy: [asc(dbChannel.id)],
  //     },
  //   },
  // });
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
  await db.insert(dbChannel).values(data.create).onConflictDoUpdate({
    target: dbChannel.id,
    set: data.update,
  });
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
