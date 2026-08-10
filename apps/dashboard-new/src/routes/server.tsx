import { createFileRoute } from "@tanstack/react-router"

import forumCss from "@/features/public-forum/public-forum.css?url"
import { PublicForumRouteLayout } from "@/features/public-forum/forum"
import searchCss from "@/features/public-search/public-search.css?url"

export const Route = createFileRoute("/server")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: forumCss },
      { rel: "stylesheet", href: searchCss },
    ],
  }),
  component: PublicForumRouteLayout,
})
