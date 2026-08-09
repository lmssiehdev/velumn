import { createFileRoute, redirect } from "@tanstack/react-router"

import { getTenantCanonicalOrigin } from "@/features/tenant-routing/functions"

export const Route = createFileRoute("/__tenant/$host/channel/")({
  loader: async ({ params }) => {
    const origin = await getTenantCanonicalOrigin({
      data: { hostname: params.host },
    })
    throw redirect({
      href: `${origin}/`,
      statusCode: 308,
      headers: { "Cache-Control": "no-store" },
    })
  },
  headers: () => ({ "Cache-Control": "no-store" }),
})
