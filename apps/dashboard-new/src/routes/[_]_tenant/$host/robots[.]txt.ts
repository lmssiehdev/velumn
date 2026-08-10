import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/__tenant/$host/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(
          `User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", request.url).href}\n`,
          {
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "text/plain; charset=utf-8",
            },
          }
        ),
    },
  },
})
