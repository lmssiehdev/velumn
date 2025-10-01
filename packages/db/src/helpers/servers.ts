import { and, count, desc, eq, exists, isNotNull, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../index';
import {
  type DBServer,
  dbChannel,
  dbDiscordUser,
  dbMessage,
  dbServer,
  pendingDiscordInvite,
  type ServerPlan,
} from '../schema';

export async function createBotInvite({
  userId,
  serverId,
}: {
  userId: string;
  serverId: string;
}) {
  await db
    .insert(pendingDiscordInvite)
    .values({
      userId,
      serverId,
    })
    .onConflictDoUpdate({
      target: pendingDiscordInvite.serverId,
      set: {
        userId,
      },
    });
}

export async function getUserWhoInvited(guildId: string) {
  return await db.query.pendingDiscordInvite.findFirst({
    where: eq(pendingDiscordInvite.serverId, guildId),
    columns: {
      userId: true,
    },
  });
}

export async function getChannelsInServer(serverId: string) {
  return await db.query.dbChannel.findMany({
    where: eq(dbChannel.serverId, serverId),
    limit: 10,
  });
}

export async function setServerPlanById(
  serverId: string,
  plan: ServerPlan
) {
  return await db
    .update(dbServer)
    .set({
      plan,
    })
    .where(eq(dbServer.id, serverId));
}

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

export async function getAllThreads(
  getBy: 'server' | 'channel',
  config: {
    id: string;
    pinned?: boolean;
    page?: number;
  }
) {
  const { id, pinned = false, page = 1 } = config;
  const LIMIT_PER_PAGE = pinned ? 1 : 10;
  const parentChannel = alias(dbChannel, 'parentChannel');
  const result = await db
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
        ? and(
          eq(dbChannel.serverId, id),
          isNotNull(dbChannel.parentId),
          eq(dbChannel.pinned, pinned)
        )
        : and(eq(dbChannel.parentId, id), eq(dbChannel.pinned, pinned))
    )
    .groupBy(dbChannel.id, dbDiscordUser.id, parentChannel.id)
    .limit(LIMIT_PER_PAGE + 1)
    .offset((page - 1) * LIMIT_PER_PAGE)
    .orderBy(desc(dbChannel.id));

  return {
    hasMore: result.length > LIMIT_PER_PAGE,
    threads: result.splice(0, LIMIT_PER_PAGE),
    page,
  };
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
