import {
  getPublicForumShell,
  listPublicThreads,
  resolvePublicChannel,
  resolvePublicServer,
} from "@repo/db/helpers/public-content"

import { getHostRoutingEnv } from "@/env.server"

import type {
  PublicForumInput,
  PublicForumPage,
  PublicForumShell,
} from "./contracts"

export async function loadPublicForum(
  input: PublicForumInput
): Promise<PublicForumPage | null> {
  const capability =
    input.kind === "server"
      ? await resolvePublicServer(input.id)
      : await resolvePublicChannel(input.id)
  if (!capability) return null

  const [shell, threadPage] = await Promise.all([
    getPublicForumShell(capability),
    listPublicThreads(capability, {
      channelId: input.kind === "channel" ? input.id : undefined,
      cursor: input.cursor,
      limit: 20,
    }),
  ])
  if (!shell || !threadPage) return null

  const forumShell: PublicForumShell = shell
  const activeChannelId = input.kind === "channel" ? input.id : null
  if (
    activeChannelId &&
    !forumShell.channels.some((channel) => channel.id === activeChannelId)
  ) {
    return null
  }

  const platformOrigin = new URL(getHostRoutingEnv().canonicalOrigin).origin
  const pathname =
    input.kind === "server" ? `/server/${input.id}` : `/channel/${input.id}`

  return {
    ...forumShell,
    activeChannelId,
    threads: threadPage.items,
    cursor: input.cursor ?? null,
    nextCursor: threadPage.nextCursor,
    canonicalUrl: `${platformOrigin}${pathname}`,
    customDomain: forumShell.server.canonicalDomain,
  }
}
