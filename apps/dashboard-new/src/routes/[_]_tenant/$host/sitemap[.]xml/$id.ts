import { createFileRoute } from "@tanstack/react-router"

import { getTenantSitemapChunkResponse } from "@/features/seo/sitemap.server"

export const Route = createFileRoute("/__tenant/$host/sitemap.xml/$id")({
  server: {
    handlers: {
      GET: ({ params }) =>
        getTenantSitemapChunkResponse(params.host, params.id),
    },
  },
})
