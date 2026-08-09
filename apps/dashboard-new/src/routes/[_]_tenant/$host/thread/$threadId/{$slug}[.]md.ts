import { createFileRoute } from "@tanstack/react-router"

import { parsePublicThreadParams } from "@/features/public-thread/contracts"
import { getTenantThreadMarkdown } from "@/features/tenant-routing/markdown.server"

const markdownHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/markdown; charset=utf-8",
}

export const Route = createFileRoute(
  "/__tenant/$host/thread/$threadId/{$slug}.md"
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = parsePublicThreadParams(params)
        if (!parsed) return notFoundResponse()

        const result = await getTenantThreadMarkdown(
          params.host,
          parsed.threadId
        )
        if (!result) return notFoundResponse()
        if (parsed.slug !== result.thread.slug) {
          return new Response(null, {
            status: 308,
            headers: {
              ...markdownHeaders,
              Location: result.thread.canonical.markdownUrl,
            },
          })
        }

        return new Response(result.content, {
          headers: {
            ...markdownHeaders,
            Link: `<${result.thread.canonical.url}>; rel="canonical", <${result.thread.canonical.markdownUrl}>; rel="self"; type="text/markdown"`,
          },
        })
      },
    },
  },
})

function notFoundResponse() {
  return new Response("Not found\n", { status: 404, headers: markdownHeaders })
}
