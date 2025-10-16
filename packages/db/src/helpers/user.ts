import { eq, inArray } from 'drizzle-orm';
import { db } from '..';
import {
  type AuthUser,
  type DBUser,
  dbAttachments,
  dbDiscordUser,
  dbMessage,
  user,
} from '../schema';

export async function updateAuthUser(
  userId: string,
  payload: Exclude<Partial<AuthUser>, 'id'>
) {
  await db.update(user).set(payload).where(eq(user.id, userId));
}
export async function resetUserServerIdLink(serverId: string) {
  await db
    .update(user)
    .set({ serverId: null })
    .where(eq(user.serverId, serverId));
}

export async function anonymizeUser(user: DBUser, anonymizeName: boolean) {
  await db
    .insert(dbDiscordUser)
    .values({
      ...user,
      anonymizeName,
    })
    .onConflictDoUpdate({
      target: dbDiscordUser.id,
      set: {
        anonymizeName,
      },
    });
}

export async function ignoreDiscordUser(user: DBUser) {
  try {
    await db
      .insert(dbDiscordUser)
      .values({
        ...user,
        anonymizeName: true,
        isIgnored: true,
      })
      .onConflictDoUpdate({
        target: dbDiscordUser.id,
        set: {
          anonymizeName: true,
          isIgnored: true,
        },
      });
    await db
      .delete(dbAttachments)
      .where(
        inArray(
          dbAttachments.messageId,
          db
            .select({ id: dbMessage.id })
            .from(dbMessage)
            .where(eq(dbMessage.authorId, user.id))
        )
      );
    await db
      .update(dbMessage)
      .set({
        content: '',
        cleanContent: '',
        embeds: null,
        reactions: null,
        snapshot: null,
        poll: null,
        isIgnored: true,
      })
      .where(eq(dbMessage.authorId, user.id));
  } catch (error) {
    console.log('failed_to_ignore_user', { error, user: user.id });
  }
}

export async function upsertUser(userId: string) {
  await db
    .insert(dbDiscordUser)
    .values({
      id: userId,
      displayName: userId,
      avatar: null,
      isBot: false,
      anonymizeName: false,
      isIgnored: false,
    })
    .onConflictDoNothing();
  return userId;
}

export async function findUserByAccountId(accountId: string) {
  return await db.query.dbDiscordUser.findFirst({
    where: eq(dbDiscordUser.id, accountId),
  });
}
export async function findManyDiscordAccountsById(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }
  return await db.query.dbDiscordUser.findMany({
    where: inArray(dbDiscordUser.id, ids),
  });
}

// !! TODO: clean up
export async function upsertManyDiscordAccounts(users: DBUser[]) {
  const existing = await findManyDiscordAccountsById(users.map((x) => x.id));

  const existingMap = existing.reduce(
    (acc, cur) => {
      acc[cur.id] = cur;
      return acc;
    },
    {} as Record<string, DBUser>
  );

  const toCreate = users.filter((c) => !existingMap[c.id]).map((c) => c);
  const toUpdate = users.filter((c) => existingMap[c.id]).map((c) => c);

  const [created, updated] = await Promise.all([
    updateManyDiscordAccounts(toUpdate),
    createManyDiscordAccounts(toCreate),
  ]);
  return [...created, ...updated];
}

export async function createManyDiscordAccounts(users: DBUser[]) {
  const uniqueAccountsToCreate = new Map<string, DBUser>(
    users.map((i) => [i.id, i])
  );
  const accountSet = Array.from(uniqueAccountsToCreate.values());

  const chunkSize = 25;
  const chunks: DBUser[][] = [];
  for (let i = 0; i < accountSet.length; i += chunkSize) {
    chunks.push(accountSet.slice(i, i + chunkSize));
  }
  for await (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (user) => db.insert(dbDiscordUser).values(user))
    );
  }
  return findManyDiscordAccountsById(accountSet.map((i) => i.id));
}

export async function updateManyDiscordAccounts(data: DBUser[]) {
  const uniqueAccountsToCreate = new Map<string, DBUser>(
    data.map((i) => [i.id, i])
  );
  const accountSet = Array.from(uniqueAccountsToCreate.values());

  const chunkSize = 25;
  const chunks: DBUser[][] = [];
  for (let i = 0; i < accountSet.length; i += chunkSize) {
    chunks.push(accountSet.slice(i, i + chunkSize));
  }
  for await (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (user) =>
        db.update(dbDiscordUser).set(user).where(eq(dbDiscordUser.id, user.id))
      )
    );
  }
  return findManyDiscordAccountsById(accountSet.map((i) => i.id));
}
