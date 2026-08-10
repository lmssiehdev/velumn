import { createFileRoute } from "@tanstack/react-router"

import { parsePublicThreadParams } from "@/features/public-thread/contracts"
import { getPublicThreadMarkdown } from "@/features/public-thread/markdown.server"

const markdownHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/markdown; charset=utf-8",
}

export const Route = createFileRoute("/thread/$threadId/{$slug}.md")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = parsePublicThreadParams(params)
        if (!parsed) {
          return new Response("Not found\n", {
            status: 404,
            headers: markdownHeaders,
          })
        }

        const result = await getPublicThreadMarkdown(parsed.threadId)
        if (!result) {
          return new Response("Not found\n", {
            status: 404,
            headers: markdownHeaders,
          })
        }
        if (
          result.thread.canonical.usesCustomDomain ||
          parsed.slug !== result.thread.slug
        ) {
          return Response.redirect(result.thread.canonical.markdownUrl, 308)
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
