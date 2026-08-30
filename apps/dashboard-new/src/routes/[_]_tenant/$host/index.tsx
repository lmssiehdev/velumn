import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  TenantForumPage,
  TenantRouteError,
  TenantRouteNotFound,
  TenantRoutePending,
} from "@/features/tenant-routing/components"
import { snowflakeSchema } from "@/features/tenant-routing/contracts"
import { getTenantForumHome } from "@/features/tenant-routing/functions"

const searchSchema = z.object({
  cursor: snowflakeSchema.optional().catch(undefined),
})

export const Route = createFileRoute("/__tenant/$host/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: ({ deps, params }) =>
    getTenantForumHome({
      data: { hostname: params.host, cursor: deps.cursor },
    }),
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.server.name} Discord discussions` },
            {
              name: "description",
              content:
                loaderData.server.description ??
                `Browse public discussions from ${loaderData.server.name}.`,
            },
            { property: "og:url", content: loaderData.canonical.url },
            ...(loaderData.cursor
              ? [{ name: "robots", content: "noindex, follow" }]
              : []),
          ],
          links: [{ rel: "canonical", href: loaderData.canonical.url }],
        }
      : {},
  component: TenantHome,
  pendingComponent: TenantRoutePending,
  errorComponent: TenantRouteError,
  notFoundComponent: TenantRouteNotFound,
})

function TenantHome() {
  const data = Route.useLoaderData()
  return <TenantForumPage data={data} />
}
