import {
  getPublicForumShell,
  getPublicThreadPage,
  listPublicThreads,
  resolveTenantPublicChannel,
  resolveVerifiedPublicTenant,
  type PublicForumShell,
  type PublicThreadListPage,
} from "@repo/db/helpers/public-content"
import { getSlugFromTitle } from "@repo/utils/helpers/slugify"

import {
  threadInputSchema,
  type TenantChannelInput,
  type TenantListInput,
} from "./contracts"

type ForumChannel = { id: string; name: string; type: number }

export async function loadTenantForumHome(input: TenantListInput) {
  const capability = await resolveVerifiedPublicTenant(input.hostname)
  if (!capability) return null

  const [shell, threads] = await Promise.all([
    getPublicForumShell(capability),
    listPublicThreads(capability, { cursor: input.cursor, limit: 20 }),
  ])
  if (!shell || !threads) return null

  return forumView(capability.hostname, shell, threads, "/", input.cursor)
}

export async function loadTenantCanonicalOrigin(hostname: string) {
  const capability = await resolveVerifiedPublicTenant(hostname)
  return capability ? `https://${capability.hostname}` : null
}

export async function loadTenantForumChannel(input: TenantChannelInput) {
  const capability = await resolveVerifiedPublicTenant(input.hostname)
  if (!capability) return null

  const channelCapability = await resolveTenantPublicChannel(
    capability,
    input.channelId
  )
  if (!channelCapability) return null
  const channel = {
    id: channelCapability.channelId,
    name: channelCapability.channelName,
    type: channelCapability.channelType,
  }

  const [shell, threads] = await Promise.all([
    getPublicForumShell(capability),
    listPublicThreads(capability, {
      channelId: channel.id,
      cursor: input.cursor,
      limit: 20,
    }),
  ])
  if (!shell || !threads) return null

  return {
    ...forumView(
      capability.hostname,
      shell,
      threads,
      `/channel/${channel.id}`,
      input.cursor
    ),
    channel: channelView(channel),
  }
}

export async function loadTenantThread(hostname: string, threadId: string) {
  const parsed = threadInputSchema.safeParse({ hostname, threadId })
  if (!parsed.success) return null

  const capability = await resolveVerifiedPublicTenant(parsed.data.hostname)
  if (!capability) return null

  const thread = await getPublicThreadPage(capability, parsed.data.threadId)
  if (!thread) return null

  const origin = `https://${capability.hostname}`
  const path = `/thread/${thread.id}/${thread.slug}`
  return {
    ...thread,
    description: toDescription(thread.starter.content, thread.title),
    canonical: {
      origin,
      url: `${origin}${path}`,
      markdownUrl: `${origin}${path}.md`,
    },
  }
}

function forumView(
  hostname: string,
  shell: PublicForumShell,
  threads: PublicThreadListPage,
  baseHref: string,
  cursor?: string
) {
  const origin = `https://${hostname}`
  return {
    server: shell.server,
    channels: shell.channels.map(channelView),
    threads: threads.items.map((thread) => ({
      ...thread,
      href: `/thread/${thread.id}/${getSlugFromTitle(thread.title)}`,
      channelHref: `/channel/${thread.channel.id}`,
    })),
    baseHref,
    cursor: cursor ?? null,
    nextCursor: threads.nextCursor,
    canonical: { origin, url: `${origin}/` },
  }
}

function channelView(channel: ForumChannel) {
  return {
    ...channel,
    href: `/channel/${channel.id}`,
  }
}

function toDescription(content: string, title: string) {
  const normalized = content.replace(/\s+/g, " ").trim()
  if (!normalized) return `Read the indexed Discord discussion for ${title}.`
  return normalized.length <= 160
    ? normalized
    : `${normalized.slice(0, 157).trimEnd()}...`
}
