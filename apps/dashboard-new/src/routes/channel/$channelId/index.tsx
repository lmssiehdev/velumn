import { createFileRoute, redirect } from "@tanstack/react-router"

import { parsePublicForumSearch } from "@/features/public-forum/contracts"
import { getPublicForum } from "@/features/public-forum/functions"
import {
  PublicForumError,
  PublicForumNotFound,
  PublicForumPending,
  PublicForumView,
} from "@/features/public-forum/forum"

export const Route = createFileRoute("/channel/$channelId/")({
  validateSearch: parsePublicForumSearch,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ params, deps }) => {
    const forum = await getPublicForum({
      data: { kind: "channel", id: params.channelId, cursor: deps.cursor },
    })
    if (forum.customDomain) {
      const search = forum.cursor ? `?cursor=${forum.cursor}` : ""
      throw redirect({
        href: `https://${forum.customDomain}/channel/${params.channelId}${search}`,
        statusCode: 308,
      })
    }
    return forum
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: ({ loaderData }) => channelHead(loaderData),
  component: ChannelForumPage,
  pendingComponent: PublicForumPending,
  errorComponent: PublicForumError,
  notFoundComponent: PublicForumNotFound,
})

function ChannelForumPage() {
  return <PublicForumView forum={Route.useLoaderData()} />
}

function channelHead(
  forum: Awaited<ReturnType<typeof getPublicForum>> | undefined
) {
  if (!forum) {
    return {
      meta: [
        { title: "Channel not found | Velumn" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    }
  }
  const channel = forum.channels.find(
    (item) => item.id === forum.activeChannelId
  )
  const name = channel?.name ?? "Channel"
  const description = `Browse public Discord discussions from #${name} in ${forum.server.name}.`
  return {
    meta: [
      { title: `#${name} discussions | ${forum.server.name}` },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: `#${name} discussions` },
      { property: "og:description", content: description },
      { property: "og:url", content: forum.canonicalUrl },
      ...(forum.cursor ? [{ name: "robots", content: "noindex, follow" }] : []),
    ],
    links: [{ rel: "canonical", href: forum.canonicalUrl }],
  }
}
