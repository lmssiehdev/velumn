import { eq, inArray } from 'drizzle-orm';
import { db } from '..';
import { type DBUser, dbDiscordUser } from '../schema';

export async function anonymizeUser(user: DBUser, anonymizeName: boolean) {
  await db.insert(dbDiscordUser).values({
    ...user,
    anonymizeName,
  }).onConflictDoUpdate({
    target: dbDiscordUser.id,
    set: {
      anonymizeName,
    },
  });
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
      canPubliclyDisplayMessages: false,
    })
    .onConflictDoNothing();
  return userId;
}

export async function findUserByAccountId(accountId: string) {
  return await db.query.dbDiscordUser.findFirst({
    where: eq(dbDiscordUser.id, accountId),
  });
}
export function findManyDiscordAccountsById(ids: string[]) {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return db.query.dbDiscordUser.findMany({
    where: inArray(dbDiscordUser.id, ids),
  });
}

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
