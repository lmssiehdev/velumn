import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { getTenantForumChannel } from "@/features/tenant-routing/functions"

const searchSchema = z.object({
  cursor: z
    .string()
    .regex(/^[0-9]{1,20}$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute(
  "/__tenant/$host/channel/$channelId/$slug"
)({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ deps, params }) => {
    const data = await getTenantForumChannel({
      data: {
        hostname: params.host,
        channelId: params.channelId,
        cursor: deps.cursor,
      },
    })
    const search = deps.cursor ? `?cursor=${deps.cursor}` : ""
    throw redirect({
      href: `${data.canonical.origin}${data.channel.href}${search}`,
      statusCode: 308,
      headers: { "Cache-Control": "no-store" },
    })
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
})
