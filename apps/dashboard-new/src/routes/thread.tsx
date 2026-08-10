import { createFileRoute } from "@tanstack/react-router"

import publicForumCss from "@/features/public-forum/public-forum.css?url"
import { PublicForumRouteLayout } from "@/features/public-forum/forum"
import searchCss from "@/features/public-search/public-search.css?url"
import publicThreadCss from "@/features/public-thread/public-thread.css?url"

export const Route = createFileRoute("/thread")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: publicForumCss },
      { rel: "stylesheet", href: publicThreadCss },
      { rel: "stylesheet", href: searchCss },
    ],
  }),
  component: PublicForumRouteLayout,
})
