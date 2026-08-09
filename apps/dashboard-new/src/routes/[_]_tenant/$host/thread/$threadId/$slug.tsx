import { createFileRoute, redirect } from "@tanstack/react-router"

import {
  TenantRouteError,
  TenantRouteNotFound,
  TenantRoutePending,
  TenantThreadPage,
} from "@/features/tenant-routing/components"
import { getTenantForumThread } from "@/features/tenant-routing/functions"

export const Route = createFileRoute("/__tenant/$host/thread/$threadId/$slug")({
  loader: async ({ params }) => {
    const thread = await getTenantForumThread({
      data: { hostname: params.host, threadId: params.threadId },
    })
    if (params.slug !== thread.slug) {
      throw redirect({
        href: thread.canonical.url,
        statusCode: 308,
        headers: { "Cache-Control": "no-store" },
      })
    }
    return thread
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.title} | ${loaderData.server.name}` },
            { name: "description", content: loaderData.description },
            { property: "og:type", content: "article" },
            { property: "og:title", content: loaderData.title },
            { property: "og:url", content: loaderData.canonical.url },
          ],
          links: [
            { rel: "canonical", href: loaderData.canonical.url },
            {
              rel: "alternate",
              type: "text/markdown",
              href: loaderData.canonical.markdownUrl,
              title: `${loaderData.title} as Markdown`,
            },
          ],
        }
      : {},
  component: TenantThread,
  pendingComponent: TenantRoutePending,
  errorComponent: TenantRouteError,
  notFoundComponent: TenantRouteNotFound,
})

function TenantThread() {
  return <TenantThreadPage data={Route.useLoaderData()} />
}
