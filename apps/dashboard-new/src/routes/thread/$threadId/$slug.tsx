import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"

import { parsePublicThreadParams } from "@/features/public-thread/contracts"
import { getPublicThread } from "@/features/public-thread/functions"
import { PublicThreadView } from "@/features/public-thread/thread"

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
            { title: `${loaderData.title} | Velumn` },
            { name: "description", content: loaderData.description },
            { property: "og:type", content: "article" },
            { property: "og:title", content: loaderData.title },
            {
              property: "og:description",
              content: loaderData.description,
            },
            { property: "og:url", content: loaderData.canonical.url },
            {
              property: "article:published_time",
              content: loaderData.createdAt,
            },
            {
              property: "article:modified_time",
              content: loaderData.updatedAt,
            },
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
      : {
          meta: [
            { title: "Thread not found | Velumn" },
            { name: "robots", content: "noindex, nofollow" },
          ],
        },
  component: PublicThreadPage,
  pendingComponent: ThreadPending,
  errorComponent: ThreadError,
  notFoundComponent: ThreadNotFound,
})

function PublicThreadPage() {
  const thread = Route.useLoaderData()
  return <PublicThreadView thread={thread} />
}

function ThreadPending() {
  return (
    <main
      className="forum-shell thread-state"
      id="public-forum-content"
      aria-busy="true"
      aria-live="polite"
    >
      <h1>Loading discussion</h1>
      <p>The indexed messages are being prepared.</p>
    </main>
  )
}

function ThreadNotFound() {
  return (
    <main className="forum-shell thread-state" id="public-forum-content">
      <h1>Thread not found</h1>
      <p>This discussion does not exist or is no longer publicly available.</p>
      <a className="thread-link" href="/">
        Return to Velumn
      </a>
    </main>
  )
}

function ThreadError({ error }: { error: Error }) {
  const router = useRouter()
  if (import.meta.env.DEV) console.error(error)
  return (
    <main className="forum-shell thread-state" id="public-forum-content">
      <h1>Unable to load this discussion</h1>
      <p>Check your connection and try again.</p>
      <button
        className="thread-retry"
        type="button"
        onClick={() => router.invalidate()}
      >
        Try again
      </button>
    </main>
  )
}
