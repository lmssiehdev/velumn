import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  TenantForumPage,
  TenantRouteError,
  TenantRouteNotFound,
  TenantRoutePending,
} from "@/features/tenant-routing/components"
import { getTenantForumChannel } from "@/features/tenant-routing/functions"

const searchSchema = z.object({
  cursor: z
    .string()
    .regex(/^[0-9]{1,20}$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/__tenant/$host/channel/$channelId/")({
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
    return {
      ...data,
      canonical: {
        ...data.canonical,
        url: `${data.canonical.origin}${data.channel.href}`,
      },
    }
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            {
              title: `${loaderData.channel.name} Discord Channel`,
            },
            {
              name: "description",
              content: `Browse indexed Discord discussions from the ${loaderData.channel.name} channel.`,
            },
            { property: "og:url", content: loaderData.canonical.url },
            ...(loaderData.cursor
              ? [{ name: "robots", content: "noindex, follow" }]
              : []),
          ],
          links: [{ rel: "canonical", href: loaderData.canonical.url }],
        }
      : {},
  component: TenantChannel,
  pendingComponent: TenantRoutePending,
  errorComponent: TenantRouteError,
  notFoundComponent: TenantRouteNotFound,
})

function TenantChannel() {
  const data = Route.useLoaderData()
  return <TenantForumPage data={data} activeChannelId={data.channel.id} />
}
