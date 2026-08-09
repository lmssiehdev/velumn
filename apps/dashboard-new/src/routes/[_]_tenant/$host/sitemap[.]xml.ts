import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/__tenant/$host/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response("Not found\n", {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
})
