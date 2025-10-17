import { and, eq } from 'drizzle-orm';
import { db } from '..';
import { account } from '../schema';

export async function getDiscordAccountIdForUser(userId: string) {
  return await db._query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, 'discord')),
    columns: {
      accountId: true,
      accessToken: true,
    },
  });
}
