import { createFileRoute, redirect } from "@tanstack/react-router"

import { parsePublicForumSearch } from "@/features/public-forum/contracts"
import { getPublicForum } from "@/features/public-forum/functions"
import {
  PublicForumError,
  PublicForumNotFound,
  PublicForumPending,
  PublicForumView,
} from "@/features/public-forum/forum"

export const Route = createFileRoute("/server/$serverId/")({
  validateSearch: parsePublicForumSearch,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ params, deps }) => {
    const forum = await getPublicForum({
      data: { kind: "server", id: params.serverId, cursor: deps.cursor },
    })
    if (forum.customDomain) {
      const search = forum.cursor ? `?cursor=${forum.cursor}` : ""
      throw redirect({
        href: `https://${forum.customDomain}/${search}`,
        statusCode: 308,
      })
    }
    return forum
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: ({ loaderData }) => forumHead(loaderData),
  component: ServerForumPage,
  pendingComponent: PublicForumPending,
  errorComponent: PublicForumError,
  notFoundComponent: PublicForumNotFound,
})

function ServerForumPage() {
  return <PublicForumView forum={Route.useLoaderData()} />
}

function forumHead(
  forum: Awaited<ReturnType<typeof getPublicForum>> | undefined
) {
  if (!forum) {
    return {
      meta: [
        { title: "Forum not found | Velumn" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    }
  }
  const description =
    forum.server.description ||
    `Browse public Discord discussions and community answers from ${forum.server.name}.`
  return {
    meta: [
      { title: `${forum.server.name} discussions | Velumn` },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: `${forum.server.name} discussions` },
      { property: "og:description", content: description },
      { property: "og:url", content: forum.canonicalUrl },
      ...(forum.cursor ? [{ name: "robots", content: "noindex, follow" }] : []),
    ],
    links: [{ rel: "canonical", href: forum.canonicalUrl }],
  }
}
