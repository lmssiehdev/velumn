import { ChannelType } from "discord-api-types/v10"
import {
  ChevronLeft,
  ChevronRight,
  Hash,
  MessageCircle,
  MessageSquareText,
  Pin,
} from "lucide-react"
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router"

import questrialUrl from "../../../../web/assets/Questrial-Regular.ttf?url"
import { CommunitySearch } from "@/features/public-search/community-search"
import { getPublicSearchScope } from "@/features/public-search/contracts"
import type { PublicForumPage } from "./contracts"

export function PublicForumRouteLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const searchScope = getPublicSearchScope(pathname)

  return (
    <div className="public-forum">
      <style>{`@font-face{font-family:"Questrial";src:url("${questrialUrl}") format("truetype");font-style:normal;font-weight:400;font-display:swap}`}</style>
      <a className="public-forum__skip-link" href="#public-forum-content">
        Skip to discussions
      </a>
      <header className="public-forum__topbar">
        <div className="public-forum__topbar-inner">
          <a className="public-forum__brand" href="/">
            Velumn
          </a>
          {searchScope && <CommunitySearch scope={searchScope} />}
        </div>
      </header>
      <div className="public-forum__content">
        <Outlet />
      </div>
      <footer className="public-forum__footer">
        <div className="public-forum__footer-inner">Powered by Velumn</div>
      </footer>
    </div>
  )
}

export function PublicForumView({ forum }: { forum: PublicForumPage }) {
  const activeChannel = forum.channels.find(
    (channel) => channel.id === forum.activeChannelId
  )
  const basePath = activeChannel
    ? `/channel/${activeChannel.id}`
    : `/server/${forum.server.id}`

  return (
    <main className="public-forum__main" id="public-forum-content">
      <h1>Join a Discussion</h1>
      <div className="public-forum__body">
        <ThreadList forum={forum} basePath={basePath} />
        <ForumSidebar forum={forum} />
      </div>
    </main>
  )
}

function ForumSidebar({ forum }: { forum: PublicForumPage }) {
  const serverPath = `/server/${forum.server.id}`

  return (
    <aside className="public-forum__sidebar" aria-label="Forum information">
      <section className="public-forum__server-info">
        <div>
          <a className="public-forum__server-name" href={serverPath}>
            {forum.server.name}
          </a>
          <div className="public-forum__member-count">
            <span aria-hidden="true" />
            {forum.server.memberCount} members
          </div>
        </div>
        {forum.server.description && <p>{forum.server.description}</p>}
        {forum.server.joinUrl && (
          <a
            className="public-forum__join"
            href={forum.server.joinUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Join Server
          </a>
        )}
      </section>

      <nav className="public-forum__boards" aria-label="Boards">
        <div className="public-forum__boards-header">
          <span>Boards</span>
          {forum.activeChannelId && <a href={serverPath}>show all</a>}
        </div>
        {forum.channels.map((channel) => {
          const isActive = channel.id === forum.activeChannelId
          const Icon =
            channel.type === ChannelType.GuildForum ? MessageSquareText : Hash

          return (
            <a
              aria-current={isActive ? "page" : undefined}
              className="public-forum__board"
              href={`/channel/${channel.id}`}
              key={channel.id}
            >
              <Icon aria-hidden="true" />
              <span>{channel.name}</span>
            </a>
          )
        })}
      </nav>
    </aside>
  )
}

function ThreadList({
  forum,
  basePath,
}: {
  forum: PublicForumPage
  basePath: string
}) {
  if (forum.threads.length === 0) {
    return (
      <div className="public-forum__empty">
        <div>
          No threads found
          {forum.cursor && (
            <a className="public-forum__secondary-button" href={basePath}>
              <ChevronLeft aria-hidden="true" />
              Clear Filters
            </a>
          )}
        </div>
      </div>
    )
  }

  const threads = [...forum.threads].sort(
    (left, right) => Number(right.pinned) - Number(left.pinned)
  )

  return (
    <section className="public-forum__discussions" aria-label="Discussions">
      <ol className="public-forum__thread-list">
        {threads.map((thread) => {
          const replies = Math.max(0, thread.messageCount - 1)

          return (
            <li className="public-forum__thread" key={thread.id}>
              <div className="public-forum__thread-copy">
                <a
                  className="public-forum__thread-title"
                  href={`/thread/${thread.id}/${slugify(thread.title)}`}
                >
                  {thread.title}
                </a>
                <div className="public-forum__thread-meta">
                  by {thread.author} <span aria-hidden="true">•</span> in{" "}
                  <a href={`/channel/${thread.channel.id}`}>
                    #{thread.channel.name}
                  </a>{" "}
                  <span aria-hidden="true">•</span>{" "}
                  <time dateTime={snowflakeDate(thread.id).toISOString()}>
                    {formatDate(thread.id)}
                  </time>
                </div>
              </div>
              <div className="public-forum__thread-controls">
                {thread.pinned && (
                  <span className="public-forum__pinned">
                    <Pin aria-hidden="true" />
                    <span className="public-forum__sr-only">Pinned thread</span>
                  </span>
                )}
                <div className="public-forum__reply-count">
                  <MessageCircle aria-hidden="true" />
                  <span>{replies}</span>
                  <span className="public-forum__sr-only">
                    {replies === 1 ? " reply" : " replies"}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <nav className="public-forum__pagination" aria-label="Discussion pages">
        {forum.cursor && (
          <a href={basePath}>
            <ChevronLeft aria-hidden="true" />
            Clear Filters
          </a>
        )}
        {forum.nextCursor && (
          <a href={`${basePath}?cursor=${forum.nextCursor}`} rel="next">
            Next
            <ChevronRight aria-hidden="true" />
          </a>
        )}
      </nav>
    </section>
  )
}

export function PublicForumPending() {
  return (
    <main
      className="public-forum__state"
      id="public-forum-content"
      aria-busy="true"
      aria-live="polite"
    >
      <h1>Loading discussions</h1>
      <p>Gathering the latest public threads.</p>
      <div className="public-forum__loading" aria-hidden="true" />
    </main>
  )
}

export function PublicForumNotFound() {
  return (
    <main className="public-forum__state" id="public-forum-content">
      <h1>Forum not found</h1>
      <p>This forum or channel does not exist or is no longer public.</p>
      <a className="public-forum__secondary-button" href="/">
        Return to Velumn
      </a>
    </main>
  )
}

export function PublicForumError({ error }: { error: Error }) {
  const router = useRouter()
  if (import.meta.env.DEV) console.error(error)

  return (
    <main className="public-forum__state" id="public-forum-content">
      <h1>Unable to load discussions</h1>
      <p>Check your connection and try again.</p>
      <button
        className="public-forum__secondary-button"
        type="button"
        onClick={() => router.invalidate()}
      >
        Try again
      </button>
    </main>
  )
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return slug || "thread"
}

function snowflakeDate(id: string) {
  return new Date(Number((BigInt(id) >> 22n) + 1_420_070_400_000n))
}

function formatDate(id: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(snowflakeDate(id))
}
