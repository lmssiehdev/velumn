import { createFileRoute } from "@tanstack/react-router"
import {
  encodeSitemapRange,
  getCanonicalSitemapPartitions,
} from "@repo/db/helpers/sitemap"

import { getHostRoutingEnv } from "@/env.server"
import { normalizeConfiguredHost } from "@/lib/host-routing"
import { buildSitemapIndexXml } from "@/lib/xml"

export const SITEMAP_LIMIT = 47_000

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/xml; charset=utf-8",
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { canonicalOrigin } = getHostRoutingEnv()
        if (
          normalizeConfiguredHost(new URL(request.url).hostname) !==
          normalizeConfiguredHost(canonicalOrigin)
        ) {
          return new Response("Not found\n", { status: 404, headers })
        }

        const partitions = await getCanonicalSitemapPartitions(SITEMAP_LIMIT)
        const entries = [
          { loc: new URL("/sitemap.xml/static", canonicalOrigin).href },
          ...partitions.map((partition) => ({
            loc: new URL(
              `/sitemap.xml/${encodeSitemapRange(partition)}`,
              canonicalOrigin
            ).href,
          })),
        ]

        return new Response(buildSitemapIndexXml(entries), { headers })
      },
    },
  },
})
