import {
  getPublicThreadOgSummary,
  getPublicThreadPage,
  resolveVerifiedPublicTenant,
} from "@repo/db/helpers/public-content"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { getHostRoutingEnv } from "@/env.server"
import { createBotApiClient } from "@/lib/bot-api.server"
import { getTrustedClientIp } from "@/lib/client-ip.server"
import type { PublicThreadPage, ThreadVote } from "./contracts"

export async function recordPublicThreadVote(
  threadId: string,
  type: ThreadVote
) {
  const clientIp = getTrustedClientIp(getRequestHeaders())
  if (!clientIp) throw new Error("A trusted client IP is required")
  await createBotApiClient(clientIp).updateVote.mutate({ threadId, type })
}

export async function loadPublicThread(
  threadId: string,
  tenantHostname?: string
) {
  const capability = tenantHostname
    ? await resolveVerifiedPublicTenant(tenantHostname)
    : null
  if (tenantHostname && !capability) return null

  const thread: PublicThreadPage | null = await getPublicThreadPage(
    capability,
    threadId
  )
  if (!thread) return null

  const canonicalOrigin = thread.server.canonicalDomain
    ? `https://${thread.server.canonicalDomain}`
    : new URL(getHostRoutingEnv().canonicalOrigin).origin
  const velumnOrigin = new URL(getHostRoutingEnv().canonicalOrigin).origin
  const path = `/thread/${thread.id}/${thread.slug}`

  return {
    ...thread,
    description: toDescription(thread.starter.content, thread.title),
    canonical: {
      origin: canonicalOrigin,
      url: `${canonicalOrigin}${path}`,
      markdownUrl: `${canonicalOrigin}${path}.md`,
      imageUrl: `${velumnOrigin}/og?id=${encodeURIComponent(thread.id)}`,
      usesCustomDomain: thread.server.canonicalDomain !== null,
    },
  }
}

export function loadPublicThreadOgSummary(threadId: string) {
  return getPublicThreadOgSummary(null, threadId)
}

function toDescription(content: string, title: string) {
  const normalized = content.replace(/\s+/g, " ").trim()
  if (!normalized) return `Read the indexed Discord discussion for ${title}.`
  return normalized.length <= 160
    ? normalized
    : `${normalized.slice(0, 157).trimEnd()}...`
}
