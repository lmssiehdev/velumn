import { createFileRoute, redirect } from "@tanstack/react-router"

import { buildDiscussionForumPostingScripts } from "@/features/public-thread/structured-data"
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
            {
              property: "og:description",
              content: loaderData.description,
            },
            { property: "og:url", content: loaderData.canonical.url },
            { property: "og:image", content: loaderData.canonical.imageUrl },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: loaderData.title },
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:image", content: loaderData.canonical.imageUrl },
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
          scripts: buildDiscussionForumPostingScripts(loaderData),
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
