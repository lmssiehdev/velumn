import { and, count, eq, exists, isNotNull, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '..';
import {
  type DBServer,
  dbChannel,
  dbDiscordUser,
  dbMessage,
  dbServer,
} from '../schema';

export async function upsertServer(server: DBServer) {
  await db.insert(dbServer).values(server).onConflictDoUpdate({
    target: dbServer.id,
    set: server,
  });
}

export async function createBulkServers(servers: DBServer[]) {
  if (servers.length === 0) {
    return [];
  }

  const chunkSize = 25;
  const chunks: DBServer[][] = [];
  for (let i = 0; i < servers.length; i += chunkSize) {
    chunks.push(servers.slice(i, i + chunkSize));
  }
  for await (const chunk of chunks) {
    await db.insert(dbServer).values(chunk).onConflictDoNothing();
  }

  return servers;
}

export async function getServerInfo(serverId: string) {
  return await db.query.dbServer.findFirst({
    where: and(eq(dbServer.id, serverId)),
  });
}

export async function getServerInfoByChannelId(channelId: string) {
  const result = await db
    .select({
      server: dbServer,
    })
    .from(dbChannel)
    .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
    .where(eq(dbChannel.id, channelId))
    .limit(1);

  if (result.length === 0 || result[0]?.server === undefined) {
    return;
  }

  const { server } = result[0];

  return server;
}

export async function getAllThreads(getBy: 'server' | 'channel', id: string) {
  const parentChannel = alias(dbChannel, 'parentChannel');
  return await db
    .select({
      channel: dbChannel,
      user: dbDiscordUser,
      messagesCount: count(dbMessage.id),
      parentChannel,
    })
    .from(dbChannel)
    .innerJoin(dbMessage, eq(dbChannel.id, dbMessage.channelId))
    .innerJoin(dbDiscordUser, eq(dbChannel.authorId, dbDiscordUser.id))
    .leftJoin(parentChannel, eq(dbChannel.parentId, parentChannel.id))
    .where(
      getBy === 'server'
        ? and(eq(dbChannel.serverId, id), isNotNull(dbChannel.parentId))
        : eq(dbChannel.parentId, id)
    )
    .groupBy(dbChannel.id, dbDiscordUser.id, parentChannel.id);
}

export async function getTopicsInServer(serverId: string) {
  return await db
    .select({
      id: dbChannel.id,
      channelName: dbChannel.channelName,
      type: dbChannel.type,
    })
    .from(dbChannel)
    .where(
      and(
        eq(dbChannel.serverId, serverId),
        isNull(dbChannel.parentId),
        exists(
          db
            .select()
            .from(dbMessage)
            .where(eq(dbMessage.parentChannelId, dbChannel.id))
        )
      )
    );
}
