import { createFileRoute } from "@tanstack/react-router"
import {
  getCanonicalThreadsForSitemapRange,
  parseSitemapRange,
} from "@repo/db/helpers/sitemap"
import { getSlugFromTitle } from "@repo/utils/helpers/slugify"

import { getHostRoutingEnv } from "@/env.server"
import { posts } from "@/features/blog/posts"
import { normalizeConfiguredHost } from "@/lib/host-routing"
import { buildUrlSetXml } from "@/lib/xml"
import { SITEMAP_LIMIT } from "../sitemap[.]xml"

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/xml; charset=utf-8",
}

export const Route = createFileRoute("/sitemap.xml/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { canonicalOrigin } = getHostRoutingEnv()
        if (
          normalizeConfiguredHost(new URL(request.url).hostname) !==
          normalizeConfiguredHost(canonicalOrigin)
        ) {
          return new Response("Not found\n", { status: 404, headers })
        }

        if (params.id === "static") {
          return new Response(
            buildUrlSetXml([
              {
                loc: new URL("/", canonicalOrigin).href,
                changefreq: "weekly",
              },
              {
                loc: new URL("/pricing", canonicalOrigin).href,
                changefreq: "monthly",
              },
              {
                loc: new URL("/oss-program", canonicalOrigin).href,
                changefreq: "monthly",
              },
              {
                loc: new URL("/blog", canonicalOrigin).href,
                changefreq: "weekly",
              },
              ...posts.map((post) => ({
                loc: new URL(
                  `/blog/${encodeURIComponent(post.slug)}`,
                  canonicalOrigin
                ).href,
                lastmod: post.metadata.updatedAt ?? post.metadata.publishedAt,
                changefreq: "monthly",
              })),
            ]),
            { headers }
          )
        }

        const range = parseSitemapRange(params.id)
        if (!range) {
          return new Response("Not found\n", { status: 404, headers })
        }
        const threads = await getCanonicalThreadsForSitemapRange(
          range,
          SITEMAP_LIMIT
        )
        return new Response(
          buildUrlSetXml(
            threads.map((thread) => ({
              loc: new URL(
                `/thread/${thread.id}/${getSlugFromTitle(thread.name?.trim() || thread.id)}`,
                canonicalOrigin
              ).href,
            }))
          ),
          { headers }
        )
      },
    },
  },
})
