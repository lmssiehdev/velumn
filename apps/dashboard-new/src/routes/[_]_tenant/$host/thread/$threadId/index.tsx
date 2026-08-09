import { createFileRoute, redirect } from "@tanstack/react-router"

import { getTenantForumThread } from "@/features/tenant-routing/functions"

export const Route = createFileRoute("/__tenant/$host/thread/$threadId/")({
  loader: async ({ params }) => {
    const thread = await getTenantForumThread({
      data: { hostname: params.host, threadId: params.threadId },
    })
    throw redirect({
      href: thread.canonical.url,
      statusCode: 308,
      headers: { "Cache-Control": "no-store" },
    })
  },
  headers: () => ({ "Cache-Control": "no-store" }),
})
