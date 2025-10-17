import {
  and,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  or,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../index';
import {
  type DBChannel,
  type DBServer,
  type DBServerInsert,
  dbChannel,
  dbDiscordUser,
  dbMessage,
  dbServer,
  pendingDiscordInvite,
  type ServerPlan,
  user,
} from '../schema';
import { buildConflictUpdateColumns } from '../utils';

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
      updatedAt: new Date(),
      serverId,
    })
    .onConflictDoUpdate({
      target: pendingDiscordInvite.serverId,
      set: {
        userId,
        updatedAt: new Date(),
      },
    });
}

export async function linkServerToUser(serverId: string, userId: string) {
  await db
    .update(user)
    .set({
      serverId,
    })
    .where(eq(user.id, userId));
}

export async function getUserWhoInvited(serverId: string) {
  return await db._query.pendingDiscordInvite.findFirst({
    where: eq(pendingDiscordInvite.serverId, serverId),
    columns: {
      userId: true,
    },
  });
}

export async function getChannelsInServer(
  serverId: string
): Promise<DBChannel[] | undefined> {
  // return await db.query.dbChannel.findMany({
  //   where: {
  //     AND: [
  //       { serverId },
  //       { server: { kickedAt: { isNull: true } } },
  //     ]
  //   },
  //   with: {
  //     server: true,
  //   }
  // });
  const result = await db
    .select({
      channel: dbChannel,
    })
    .from(dbChannel)
    .leftJoin(dbServer, eq(dbServer.id, dbChannel.serverId))
    .where(and(eq(dbChannel.serverId, serverId), isNull(dbServer.kickedAt)));

  if (!result) {
    return;
  }

  return result.map(({ channel }) => channel);
}

export async function setServerPlanById(serverId: string, plan: ServerPlan) {
  return await db
    .update(dbServer)
    .set({
      plan,
    })
    .where(eq(dbServer.id, serverId));
}

export async function updateServer(
  server: { id: string } & Partial<Omit<DBServerInsert, 'id'>>
) {
  const { id, ...updateFields } = server;

  await db.update(dbServer).set(updateFields).where(eq(dbServer.id, id));
}
export async function upsertServer(server: Partial<DBServerInsert>) {
  const { id, invitedBy, ...updateFields } = server;

  await db
    .insert(dbServer)
    .values(server as DBServerInsert)
    .onConflictDoUpdate({
      target: dbServer.id,
      set: buildConflictUpdateColumns(
        dbServer,
        Object.keys(updateFields) as Array<keyof typeof updateFields>
      ),
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

export async function getAllServers() {
  return await db._query.dbServer.findMany();
}

export async function getServerInfo(serverId: string) {
  return await db._query.dbServer.findFirst({
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

export async function getBulkServers(serverIds: string[]) {
  return await db._query.dbServer.findMany({
    where: inArray(dbServer.id, serverIds),
  });
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
  const result = await db.query.dbChannel.findMany({
    where: getBy === "server" ? {
      serverId: id,
      pinned,
      parentId: {
        isNotNull: true,
      },
    } : {
      parentId: id,
      pinned,
    },
    with: {
      author: true,
      parent: true,
    },
    extras: {
      messagesCount: (t) => db.$count(dbMessage, eq(dbMessage.primaryChannelId, t.id))
    },
    limit: LIMIT_PER_PAGE + 1,
    offset: (page - 1) * LIMIT_PER_PAGE,
    orderBy: {
      id: "desc"
    }
  });
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
