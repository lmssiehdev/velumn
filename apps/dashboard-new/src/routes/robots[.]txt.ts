import { createFileRoute } from "@tanstack/react-router"

import { getHostRoutingEnv } from "@/env.server"
import { posts } from "@/features/blog/posts"
import { normalizeConfiguredHost } from "@/lib/host-routing"

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const { canonicalOrigin } = getHostRoutingEnv()
        if (!isCanonicalHost(request, canonicalOrigin)) {
          return new Response("User-agent: *\nDisallow: /\n", { headers })
        }

        const allowedPaths = [
          "/$",
          "/blog$",
          "/blog/$",
          "/server/",
          "/channel/",
          "/thread/",
          ...posts.map((post) => `/blog/${encodeURIComponent(post.slug)}$`),
        ]
        const body = [
          "User-agent: *",
          "Disallow: /",
          ...allowedPaths.map((path) => `Allow: ${path}`),
          "",
          `Sitemap: ${new URL("/sitemap.xml", canonicalOrigin).href}`,
          "",
        ].join("\n")

        return new Response(body, { headers })
      },
    },
  },
})

function isCanonicalHost(request: Request, canonicalOrigin: string) {
  return (
    normalizeConfiguredHost(new URL(request.url).hostname) ===
    normalizeConfiguredHost(canonicalOrigin)
  )
}
