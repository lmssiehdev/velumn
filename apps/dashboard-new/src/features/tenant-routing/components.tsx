import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake"
import { ChannelType } from "discord-api-types/v10"
import type { PublicThreadPage } from "@/features/public-thread/contracts"
import { PublicThreadView } from "@/features/public-thread/thread"
import { formatRelativeDate } from "@/lib/date"
import { useRouter } from "@tanstack/react-router"
import {
  ChevronRight,
  Hash,
  MessageCircle,
  MessagesSquare,
  Pin,
} from "lucide-react"

export function TenantForumPage({
  data,
  activeChannelId,
}: {
  data: TenantForumData
  activeChannelId?: string
}) {
  return (
    <main className="p-4" id="main-content">
      <h1 className="mt-1 mb-6 max-w-4xl text-[clamp(1.875rem,5vw,2.25rem)] leading-[1.15] font-medium tracking-[-0.025em] text-balance [overflow-wrap:anywhere]">
        Join a Discussion
      </h1>
      <div className="flex items-start gap-6">
        <section className="min-w-0 flex-1" aria-label="Community discussions">
          <ThreadList data={data} />
        </section>
        <ForumSidebar data={data} activeChannelId={activeChannelId} />
      </div>
    </main>
  )
}

export function TenantThreadPage({ data }: { data: TenantThreadData }) {
  return (
    <PublicThreadView contentId="main-content" serverHref="/" thread={data} />
  )
}

export function TenantRoutePending() {
  return (
    <main
      className="px-4 py-[clamp(4rem,12vw,8rem)]"
      id="main-content"
      aria-busy="true"
      aria-live="polite"
    >
      <h1 className="text-[clamp(1.875rem,5vw,2.25rem)] font-medium">
        Loading discussions
      </h1>
      <p className="my-4 text-neutral-600">
        Gathering the latest public threads.
      </p>
    </main>
  )
}

export function TenantRouteNotFound() {
  return (
    <main className="px-4 py-[clamp(4rem,12vw,8rem)]" id="main-content">
      <h1 className="text-[clamp(1.875rem,5vw,2.25rem)] font-medium">
        Page not found
      </h1>
      <p className="my-4 text-neutral-600">
        This discussion or channel is no longer publicly available.
      </p>
      <a
        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 bg-neutral-100 px-3.5 text-sm text-neutral-600 no-underline"
        href="/"
      >
        Browse discussions
      </a>
    </main>
  )
}

export function TenantRouteError({ error }: { error: Error }) {
  const router = useRouter()
  if (import.meta.env.DEV) console.error(error)
  return (
    <main className="px-4 py-[clamp(4rem,12vw,8rem)]" id="main-content">
      <h1 className="text-[clamp(1.875rem,5vw,2.25rem)] font-medium">
        Unable to load discussions
      </h1>
      <p className="my-4 text-neutral-600">
        Check your connection and try again.
      </p>
      <button
        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 border-0 bg-neutral-100 px-3.5 font-[inherit] text-sm text-neutral-600"
        type="button"
        onClick={() => router.invalidate()}
      >
        Try again
      </button>
    </main>
  )
}

function ThreadList({ data }: { data: TenantForumData }) {
  if (data.pinnedThreads.length === 0 && data.threads.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center content-center gap-3 text-neutral-500">
        <p className="m-0">No threads found</p>
        {data.cursor && (
          <a
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 bg-neutral-100 px-3.5 text-sm text-neutral-600 no-underline"
            href={data.baseHref}
          >
            Newest
          </a>
        )}
      </div>
    )
  }

  return (
    <>
      {data.pinnedThreads.length > 0 && (
        <TenantThreadSection
          label="Pinned threads"
          threads={data.pinnedThreads}
        />
      )}
      {data.threads.length > 0 && (
        <TenantThreadSection
          label={data.pinnedThreads.length ? "Latest threads" : null}
          threads={data.threads}
        />
      )}
      {(data.cursor || data.nextCursor) && (
        <nav
          className="mt-6 flex justify-end gap-4 [&_a]:inline-flex [&_a]:min-h-10 [&_a]:cursor-pointer [&_a]:items-center [&_a]:gap-1.5 [&_a]:bg-neutral-100 [&_a]:px-3.5 [&_a]:text-sm [&_a]:text-neutral-600 [&_a]:no-underline [&_svg]:size-4"
          aria-label="Discussion pages"
        >
          {data.cursor && <a href={data.baseHref}>Newest</a>}
          {data.nextCursor && (
            <a href={`${data.baseHref}?cursor=${data.nextCursor}`} rel="next">
              Next
              <ChevronRight aria-hidden="true" />
            </a>
          )}
        </nav>
      )}
    </>
  )
}

function TenantThreadSection({
  label,
  threads,
}: {
  label: string | null
  threads: TenantForumData["threads"]
}) {
  return (
    <section aria-label={label ?? "Threads"}>
      {label && (
        <h2 className="m-0 border-b border-neutral-300 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
          {label}
        </h2>
      )}
      <ol className="m-0 list-none p-0">
        {threads.map((thread) => (
          <li
            className="flex min-h-19 items-center justify-between gap-4 border-b border-neutral-300 py-4 max-[30rem]:items-start"
            key={thread.id}
          >
            <div className="min-w-0">
              <a
                className="font-medium [overflow-wrap:anywhere] no-underline hover:underline"
                href={thread.href}
              >
                {thread.title}
              </a>
              <p className="mt-[0.35rem] mb-0 text-sm text-neutral-500 [&_a:hover]:underline">
                by {thread.author}
                <span aria-hidden="true"> • </span>
                in <a href={thread.channelHref}>#{thread.channel.name}</a>
                <span aria-hidden="true"> • </span>
                <time dateTime={getDateFromSnowflake(thread.id).toISOString()}>
                  {formatRelativeDate(getDateFromSnowflake(thread.id))}
                </time>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4 max-[30rem]:gap-2 [&_svg]:size-5 [&_svg]:stroke-[1.75] [&>span]:flex [&>span]:items-center [&>span]:gap-2">
              {thread.pinned && (
                <span>
                  <Pin aria-hidden="true" />
                  <span className="sr-only">Pinned thread</span>
                </span>
              )}
              <span>
                <MessageCircle aria-hidden="true" />
                <span className="sr-only">Replies: </span>
                {formatCount(Math.max(0, thread.messageCount - 1))}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ForumSidebar({
  data,
  activeChannelId,
}: {
  data: TenantForumData
  activeChannelId?: string
}) {
  return (
    <aside
      className="grid w-full max-w-80 shrink-0 basis-80 gap-6 max-[48rem]:hidden"
      aria-label="Community information"
    >
      <ServerInfo server={data.server} />
      <nav
        className="border border-neutral-300 p-4 [&_svg]:size-4 [&_svg]:stroke-[1.75] [&>a]:flex [&>a]:min-h-10 [&>a]:items-center [&>a]:gap-2 [&>a]:px-2 [&>a]:no-underline [&>a:hover]:bg-violet-100 [&>a:hover]:text-violet-600 [&>a[aria-current=page]]:bg-violet-100 [&>a[aria-current=page]]:text-violet-600"
        aria-label="Boards"
      >
        <div className="flex min-h-9 items-center justify-between gap-4 px-2">
          <span>Boards</span>
          {activeChannelId && (
            <a className="p-2 text-xs" href="/">
              show all
            </a>
          )}
        </div>
        {data.channels.map((channel) => (
          <a
            aria-current={channel.id === activeChannelId ? "page" : undefined}
            href={channel.href}
            key={channel.id}
          >
            {channel.type === ChannelType.GuildForum ? (
              <MessagesSquare aria-hidden="true" />
            ) : (
              <Hash aria-hidden="true" />
            )}
            {channel.name}
          </a>
        ))}
      </nav>
    </aside>
  )
}

function ServerInfo({ server }: { server: TenantServer }) {
  return (
    <section className="border border-neutral-300 p-4 [&>p:not(:first-of-type)]:my-3 [&>p:not(:first-of-type)]:leading-6">
      <a className="text-lg no-underline hover:underline" href="/">
        {server.name}
      </a>
      <p className="mt-[0.2rem] mb-3 flex items-center gap-1.5 text-sm text-neutral-700">
        <span
          className="size-1.5 rounded-full bg-neutral-700"
          aria-hidden="true"
        />
        {formatCount(server.memberCount)} members
      </p>
      {server.description && <p>{server.description}</p>}
      {server.joinUrl && (
        <a
          className="inline-flex min-h-10 items-center bg-violet-100 px-4 text-sm font-medium !text-violet-600 no-underline hover:bg-violet-100 hover:!text-violet-600"
          href={server.joinUrl}
          rel="noreferrer"
          target="_blank"
        >
          Join Server
        </a>
      )}
    </section>
  )
}

type TenantServer = {
  id: string
  name: string
  description: string | null
  memberCount: number
  joinUrl: string | null
}

type TenantForumData = {
  server: TenantServer
  channels: Array<{
    id: string
    name: string
    type:
      | ChannelType.GuildText
      | ChannelType.GuildForum
      | ChannelType.GuildAnnouncement
    href: string
  }>
  pinnedThreads: TenantForumThread[]
  threads: TenantForumThread[]
  baseHref: string
  cursor: string | null
  nextCursor: string | null
}

type TenantForumThread = {
  id: string
  title: string
  author: string
  href: string
  channelHref: string
  channel: { name: string }
  pinned: boolean
  messageCount: number
}

type TenantThreadData = PublicThreadPage

function formatCount(value: number) {
  return tenantCountFormatter.format(value)
}

const tenantCountFormatter = new Intl.NumberFormat("en-US")
