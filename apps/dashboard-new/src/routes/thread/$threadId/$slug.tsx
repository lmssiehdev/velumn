import { createFileRoute, redirect } from "@tanstack/react-router"

import { getThreadForumShell } from "@/features/forum-redesign/functions"
import {
  ThreadRedesign,
  ThreadRedesignError,
  ThreadRedesignNotFound,
  ThreadRedesignPending,
} from "@/features/forum-redesign/thread-redesign"
import { parsePublicThreadParams } from "@/features/public-thread/contracts"
import { getPublicThread } from "@/features/public-thread/functions"
import { buildDiscussionForumPostingScripts } from "@/features/public-thread/structured-data"

export const Route = createFileRoute("/thread/$threadId/$slug")({
  params: {
    parse: (rawParams) => {
      return parsePublicThreadParams(rawParams) ?? false
    },
    stringify: (params) => params,
  },
  loader: async ({ params }) => {
    const thread = await getPublicThread({
      data: { threadId: params.threadId },
    })
    if (thread.canonical.usesCustomDomain || params.slug !== thread.slug) {
      throw redirect({ href: thread.canonical.url, statusCode: 308 })
    }
    const forum = await getThreadForumShell({
      data: { kind: "server", id: thread.server.id },
    })
    return { forum, thread }
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.thread.title} | Velumn` },
            { name: "description", content: loaderData.thread.description },
            { property: "og:type", content: "article" },
            { property: "og:title", content: loaderData.thread.title },
            {
              property: "og:description",
              content: loaderData.thread.description,
            },
            { property: "og:url", content: loaderData.thread.canonical.url },
            {
              property: "og:image",
              content: loaderData.thread.canonical.imageUrl,
            },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: loaderData.thread.title },
            { name: "twitter:card", content: "summary_large_image" },
            {
              name: "twitter:image",
              content: loaderData.thread.canonical.imageUrl,
            },
            {
              property: "article:published_time",
              content: loaderData.thread.createdAt,
            },
            {
              property: "article:modified_time",
              content: loaderData.thread.updatedAt,
            },
          ],
          links: [
            { rel: "canonical", href: loaderData.thread.canonical.url },
            {
              rel: "alternate",
              type: "text/markdown",
              href: loaderData.thread.canonical.markdownUrl,
              title: `${loaderData.thread.title} as Markdown`,
            },
          ],
          scripts: buildDiscussionForumPostingScripts(loaderData.thread),
        }
      : {
          meta: [
            { title: "Thread not found | Velumn" },
            { name: "robots", content: "noindex, nofollow" },
          ],
        },
  component: PublicThreadPage,
  pendingComponent: ThreadRedesignPending,
  errorComponent: ThreadRedesignError,
  notFoundComponent: ThreadRedesignNotFound,
})

function PublicThreadPage() {
  const result = Route.useLoaderData()
  return <ThreadRedesign forum={result.forum} thread={result.thread} />
}
