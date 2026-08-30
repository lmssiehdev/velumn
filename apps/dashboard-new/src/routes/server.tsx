import { Outlet, createFileRoute } from "@tanstack/react-router"

import globalsCss from "@/globals.css?url"

export const Route = createFileRoute("/server")({
  head: () => ({
    links: [{ rel: "stylesheet", href: globalsCss }],
  }),
  component: Outlet,
})
