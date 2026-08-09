import type { PublicThreadPage } from "@/features/public-thread/contracts"
import { PublicThreadView } from "@/features/public-thread/thread"
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
    <main className="tenant-content tenant-forum-page" id="main-content">
      <h1>Join a Discussion</h1>
      <div className="tenant-forum-layout">
        <section
          className="tenant-discussions"
          aria-label="Community discussions"
        >
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
      className="tenant-content tenant-route-state"
      id="main-content"
      aria-busy="true"
      aria-live="polite"
    >
      <h1>Loading discussions</h1>
      <p>Gathering the latest public threads.</p>
    </main>
  )
}

export function TenantRouteNotFound() {
  return (
    <main className="tenant-content tenant-route-state" id="main-content">
      <h1>Page not found</h1>
      <p>This discussion or channel is no longer publicly available.</p>
      <a href="/">Browse discussions</a>
    </main>
  )
}

export function TenantRouteError({ error }: { error: Error }) {
  const router = useRouter()
  if (import.meta.env.DEV) console.error(error)
  return (
    <main className="tenant-content tenant-route-state" id="main-content">
      <h1>Unable to load discussions</h1>
      <p>Check your connection and try again.</p>
      <button type="button" onClick={() => router.invalidate()}>
        Try again
      </button>
    </main>
  )
}

function ThreadList({ data }: { data: TenantForumData }) {
  if (data.threads.length === 0) {
    return (
      <div className="tenant-empty">
        <p>No threads found</p>
        {data.cursor && <a href={data.baseHref}>Newest</a>}
      </div>
    )
  }

  const threads = [...data.threads].sort(
    (left, right) => Number(right.pinned) - Number(left.pinned)
  )

  return (
    <>
      <ol className="tenant-thread-list">
        {threads.map((thread) => (
          <li key={thread.id}>
            <div className="tenant-thread-copy">
              <a className="tenant-thread-title" href={thread.href}>
                {thread.title}
              </a>
              <p>
                by {thread.author}
                <span aria-hidden="true"> • </span>
                in <a href={thread.channelHref}>#{thread.channel.name}</a>
                <span aria-hidden="true"> • </span>
                <time dateTime={snowflakeDate(thread.id).toISOString()}>
                  {formatRelativeDate(thread.id)}
                </time>
              </p>
            </div>
            <div className="tenant-thread-stats">
              {thread.pinned && (
                <span className="tenant-pinned">
                  <Pin aria-hidden="true" />
                  <span className="tenant-visually-hidden">Pinned thread</span>
                </span>
              )}
              <span>
                <MessageCircle aria-hidden="true" />
                <span className="tenant-visually-hidden">Replies: </span>
                {formatCount(Math.max(0, thread.messageCount - 1))}
              </span>
            </div>
          </li>
        ))}
      </ol>
      {(data.cursor || data.nextCursor) && (
        <nav className="tenant-pagination" aria-label="Discussion pages">
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

function ForumSidebar({
  data,
  activeChannelId,
}: {
  data: TenantForumData
  activeChannelId?: string
}) {
  return (
    <aside className="tenant-forum-sidebar" aria-label="Community information">
      <ServerInfo server={data.server} />
      <nav className="tenant-boards" aria-label="Boards">
        <div className="tenant-boards-heading">
          <span>Boards</span>
          {activeChannelId && <a href="/">show all</a>}
        </div>
        {data.channels.map((channel) => (
          <a
            aria-current={channel.id === activeChannelId ? "page" : undefined}
            href={channel.href}
            key={channel.id}
          >
            {channel.type === 15 ? (
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
    <section className="tenant-server-card">
      <a className="tenant-server-name" href="/">
        {server.name}
      </a>
      <p className="tenant-member-count">
        <span aria-hidden="true" />
        {formatCount(server.memberCount)} members
      </p>
      {server.description && <p>{server.description}</p>}
      {server.joinUrl && (
        <a
          className="tenant-join-button"
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
  channels: Array<{ id: string; name: string; type: number; href: string }>
  threads: Array<{
    id: string
    title: string
    author: string
    href: string
    channelHref: string
    channel: { name: string }
    pinned: boolean
    messageCount: number
  }>
  baseHref: string
  cursor: string | null
  nextCursor: string | null
}

type TenantThreadData = PublicThreadPage

function snowflakeDate(id: string) {
  return new Date(Number((BigInt(id) >> 22n) + 1_420_070_400_000n))
}

function formatRelativeDate(id: string) {
  const date = snowflakeDate(id)
  const elapsedDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (elapsedDays <= 0) return "today"
  if (elapsedDays === 1) return "yesterday"
  if (elapsedDays < 30) return `${elapsedDays} days ago`
  return formatDate(date.toISOString())
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value))
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}
