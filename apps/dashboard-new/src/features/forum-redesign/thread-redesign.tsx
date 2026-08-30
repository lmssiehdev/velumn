import { ArrowLeft } from "lucide-react"
import { Link, useRouter } from "@tanstack/react-router"

import type { PublicForumShell } from "@/features/public-forum/contracts"
import type { PublicThreadPage } from "@/features/public-thread/contracts"
import { PublicThreadView } from "@/features/public-thread/thread"
import {
  BoardRail,
  CommunityHeader,
  RedesignTopbar,
  RouteState,
  stateActionClassName,
} from "./forum-redesign"
import {
  ThreadRedesignContinue,
  ThreadRedesignFeedback,
} from "./thread-redesign-actions"

export function ThreadRedesign({
  forum,
  thread,
}: {
  forum: PublicForumShell
  thread: PublicThreadPage
}) {
  return (
    <div className="thread-redesign min-h-svh min-w-80 bg-[#f7f6f2] font-['Questrial',ui-sans-serif,system-ui,sans-serif] text-[#24231f] antialiased">
      <a
        className="fixed start-2 top-2 z-[100] -translate-y-[150%] rounded-lg bg-[#24231f] px-3.5 py-2.5 text-white focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f]"
        href="#redesign-thread"
      >
        Skip to discussion
      </a>

      <RedesignTopbar serverId={thread.server.id} />

      <div className="mx-auto w-[min(calc(100%-2rem),72rem)] pt-4 pb-12 max-md:w-[min(calc(100%-1.25rem),72rem)]">
        <CommunityHeader forum={forum} />
        <nav
          className="mb-4 flex min-w-0 items-center gap-2 text-xs text-[#69665e] [&_a]:inline-flex [&_a]:min-h-7 [&_a]:min-w-0 [&_a]:items-center [&_a]:gap-1.5 [&_a]:overflow-hidden [&_a]:text-ellipsis [&_a]:whitespace-nowrap [&_a]:text-[#4c5948] [&_a]:no-underline [&_a]:hover:underline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-[#24231f] [&_svg]:size-3.5 [&_svg]:shrink-0"
          aria-label="Breadcrumb"
        >
          <Link
            params={{ serverId: thread.server.id }}
            preload={false}
            to="/server/$serverId"
          >
            <ArrowLeft aria-hidden="true" />
            {thread.server.name}
          </Link>
          <span aria-hidden="true">/</span>
          <a href={`/channel/${thread.parent.id}`}>{thread.parent.name}</a>
        </nav>

        <div className="grid items-start gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <BoardRail
            activeChannelId={thread.parent.id}
            channels={forum.channels}
            serverId={thread.server.id}
          />
          <PublicThreadView
            afterStarter={<ThreadRedesignFeedback threadId={thread.id} />}
            contentId="redesign-thread"
            footer={
              <ThreadRedesignContinue
                discordUrl={thread.discordUrl}
                noReplies={thread.replyCount === 0}
              />
            }
            presentation="canonical"
            showFeedback={false}
            showServerInfo={false}
            serverHref={`/server/${thread.server.id}`}
            thread={thread}
          />
        </div>
      </div>
    </div>
  )
}

export function ThreadRedesignPending() {
  return (
    <RouteState busy title="Loading discussion">
      <div
        className="size-6 animate-spin rounded-full border-2 border-[#d3d0c7] border-t-[#24231f] motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p>Gathering the public messages.</p>
    </RouteState>
  )
}

export function ThreadRedesignNotFound() {
  return (
    <RouteState title="Thread not found">
      <p>This discussion is unavailable or no longer public.</p>
      <Link className={stateActionClassName} to="/">
        Return home
      </Link>
    </RouteState>
  )
}

export function ThreadRedesignError({ error }: { error: Error }) {
  const router = useRouter()
  if (import.meta.env.DEV) console.error(error)
  return (
    <RouteState title="Unable to load this discussion">
      <p>Check your connection and try again.</p>
      <button
        className={stateActionClassName}
        type="button"
        onClick={() => router.invalidate()}
      >
        Try again
      </button>
    </RouteState>
  )
}
