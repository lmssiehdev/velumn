import { resolveVerifiedPublicTenant } from "@repo/db/helpers/public-content"
import {
  encodeSitemapRange,
  getTenantSitemapPartitions,
  getTenantThreadsForSitemapRange,
  parseSitemapRange,
  type SitemapRange,
} from "@repo/db/helpers/sitemap"
import { getSlugFromTitle } from "@repo/utils/helpers/slugify"

import { buildSitemapIndexXml, buildUrlSetXml } from "@/lib/xml"

type SitemapThread = { id: string; name: string | null }
type TenantSitemap = NonNullable<
  Awaited<ReturnType<typeof resolveTenantSitemap>>
>

export const SITEMAP_LIMIT = 47_000

export type TenantSitemapDependencies = {
  resolveTenant: (hostname: string) => Promise<TenantSitemap | null>
  getPartitions: (serverId: string, limit: number) => Promise<SitemapRange[]>
  getThreads: (
    serverId: string,
    range: SitemapRange,
    limit: number
  ) => Promise<SitemapThread[]>
}

const dependencies: TenantSitemapDependencies = {
  resolveTenant: resolveTenantSitemap,
  getPartitions: getTenantSitemapPartitions,
  getThreads: getTenantThreadsForSitemapRange,
}

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/xml; charset=utf-8",
}

export async function resolveTenantSitemap(hostname: string) {
  const capability = await resolveVerifiedPublicTenant(hostname)
  if (!capability) return null

  const origin = `https://${capability.hostname}`
  return {
    origin,
    serverId: capability.serverId,
    threadUrl: (thread: SitemapThread) => {
      const slug = getSlugFromTitle(thread.name?.trim() || thread.id)
      return `${origin}/thread/${thread.id}/${slug}`
    },
  }
}

export async function getTenantSitemapResponse(
  hostname: string,
  deps: TenantSitemapDependencies = dependencies
) {
  const tenant = await deps.resolveTenant(hostname)
  if (!tenant) return notFound()

  const partitions = await deps.getPartitions(tenant.serverId, SITEMAP_LIMIT)
  if (partitions.length <= 1) {
    const threads = partitions[0]
      ? await deps.getThreads(tenant.serverId, partitions[0], SITEMAP_LIMIT)
      : []
    return xml(
      buildUrlSetXml([
        { loc: `${tenant.origin}/` },
        ...threads.map((thread) => ({ loc: tenant.threadUrl(thread) })),
      ])
    )
  }

  return xml(
    buildSitemapIndexXml([
      { loc: `${tenant.origin}/sitemap.xml/static` },
      ...partitions.map((partition) => ({
        loc: `${tenant.origin}/sitemap.xml/${encodeSitemapRange(partition)}`,
      })),
    ])
  )
}

export async function getTenantSitemapChunkResponse(
  hostname: string,
  id: string,
  deps: TenantSitemapDependencies = dependencies
) {
  const range = id === "static" ? null : parseSitemapRange(id)
  if (id !== "static" && !range) return notFound()

  const tenant = await deps.resolveTenant(hostname)
  if (!tenant) return notFound()
  if (!range) return xml(buildUrlSetXml([{ loc: `${tenant.origin}/` }]))

  const threads = await deps.getThreads(tenant.serverId, range, SITEMAP_LIMIT)
  return xml(
    buildUrlSetXml(threads.map((thread) => ({ loc: tenant.threadUrl(thread) })))
  )
}

function xml(body: string) {
  return new Response(body, { headers })
}

function notFound() {
  return new Response("Not found\n", { status: 404, headers })
}
