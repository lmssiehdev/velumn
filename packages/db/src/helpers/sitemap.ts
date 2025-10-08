import { count, eq } from "drizzle-orm";
import { db } from "..";
import { dbChannel } from "../schema";
import { ChannelType } from "discord-api-types/v10";

export async function getThreadsCountTotal() {
  const threadsCount = await db
    .select({ count: count(dbChannel.id) })
    .from(dbChannel)
    .where(eq(dbChannel.type, ChannelType.PublicThread));

  if (!threadsCount || threadsCount.length === 0) {
    return 0;
  }

  const { count: c } = threadsCount[0]!;
  return c;
}

export async function getThreadsForSitemap(start: number, limit: number) {
  return await db
    .select({ id: dbChannel.id })
    .from(dbChannel)
    .where(eq(dbChannel.type, ChannelType.PublicThread))
    .offset(start)
    .limit(limit);
}
