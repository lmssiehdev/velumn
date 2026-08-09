import { createFileRoute } from "@tanstack/react-router"

import { getHostRoutingEnv } from "@/env.server"
import { posts } from "@/features/blog/posts"
import { normalizeConfiguredHost } from "@/lib/host-routing"
import { buildUrlSetXml } from "@/lib/xml"

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/xml; charset=utf-8",
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const { canonicalOrigin } = getHostRoutingEnv()
        if (
          normalizeConfiguredHost(new URL(request.url).hostname) !==
          normalizeConfiguredHost(canonicalOrigin)
        ) {
          return new Response("Not found\n", { status: 404, headers })
        }

        const urls = [
          new URL("/", canonicalOrigin).href,
          new URL("/blog", canonicalOrigin).href,
          ...posts.map(
            (post) =>
              new URL(`/blog/${encodeURIComponent(post.slug)}`, canonicalOrigin)
                .href
          ),
        ]

        return new Response(buildUrlSetXml(urls), { headers })
      },
    },
  },
})
