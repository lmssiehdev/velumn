import { createFileRoute } from "@tanstack/react-router"

import { getTenantSitemapResponse } from "@/features/seo/sitemap.server"

export const Route = createFileRoute("/__tenant/$host/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ params }) => getTenantSitemapResponse(params.host),
    },
  },
})
