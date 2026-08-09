import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/__tenant/$host/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response("User-agent: *\nAllow: /\n", {
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
})
