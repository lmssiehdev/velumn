import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake"
import { getSlugFromTitle } from "@repo/utils/helpers/slugify"
import { ChannelType } from "discord-api-types/v10"
import {
  ChevronLeft,
  ChevronRight,
  Hash,
  MessageCircle,
  MessagesSquare,
  Pin,
  Users,
} from "lucide-react"
import { Link, useRouter } from "@tanstack/react-router"
import { type ReactNode, useState } from "react"

import { CommunitySearch } from "@/features/public-search/community-search"
import { formatRelativeDate } from "@/lib/date"
import { cn } from "@/lib/utils"
import type {
  PublicForumPage,
  PublicForumShell,
} from "@/features/public-forum/contracts"

export function ForumRedesign({ forum }: { forum: PublicForumPage }) {
  const threadCount = forum.pinnedThreads.length + forum.threads.length

  return (
    <div className="min-h-svh min-w-80 bg-[#f7f6f2] font-['Questrial',ui-sans-serif,system-ui,sans-serif] text-[#24231f] antialiased">
      <a
        className="fixed start-2 top-2 z-[100] -translate-y-[150%] rounded-lg bg-[#24231f] px-3.5 py-2.5 text-white focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f]"
        href="#redesign-discussions"
      >
        Skip to discussions
      </a>

      <RedesignTopbar serverId={forum.server.id} />

      <main
        className="mx-auto w-[min(calc(100%-2rem),72rem)] py-6 pb-12 max-md:w-[min(calc(100%-1.25rem),72rem)] max-md:pt-4"
        id="redesign-discussions"
      >
        <CommunityHeader forum={forum} />

        <div className="grid items-start gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <BoardRail
            activeChannelId={forum.activeChannelId ?? undefined}
            channels={forum.channels}
            serverId={forum.server.id}
          />

          <section
            className="min-w-0 overflow-hidden rounded-xl border border-[#deddd7] bg-white"
            aria-labelledby="redesign-feed-title"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e3dd] px-4 py-3.5 max-[34rem]:px-3">
              <div>
                <p className="mb-1 text-[0.6875rem] tracking-[0.08em] text-[#69665e] uppercase">
                  Community discussions
                </p>
                <h2
                  className="m-0 text-lg font-normal tracking-[-0.025em]"
                  id="redesign-feed-title"
                >
                  Discussions
                </h2>
              </div>
              <span className="text-[0.6875rem] text-[#69665e] max-[34rem]:hidden">
                {threadCount} on this page
              </span>
            </div>

            {threadCount > 0 ? (
              <>
                {forum.pinnedThreads.length > 0 && (
                  <ThreadSection
                    label="Pinned threads"
                    threads={forum.pinnedThreads}
                  />
                )}
                {forum.threads.length > 0 && (
                  <ThreadSection
                    label={forum.pinnedThreads.length ? "Latest threads" : null}
                    threads={forum.threads}
                  />
                )}
              </>
            ) : (
              <div className="grid min-h-64 place-items-center px-8 py-8 text-center">
                <MessagesSquare
                  aria-hidden="true"
                  className="mb-3 size-8 text-[#69665e]"
                />
                <h3 className="m-0 text-xl font-normal tracking-[-0.025em]">
                  {forum.cursor
                    ? "No older threads"
                    : forum.activeChannelId
                      ? "No threads in this board"
                      : "No public threads yet"}
                </h3>
                <p className="mt-1.5 max-w-[30rem] text-[0.8125rem] leading-6 text-[#69665e]">
                  {forum.cursor
                    ? "Return to the newest discussions to keep browsing."
                    : forum.activeChannelId
                      ? "Published discussions from this board will appear here."
                      : "Indexed discussions from this community will appear here."}
                </p>
              </div>
            )}

            <Pagination forum={forum} />
          </section>
        </div>
      </main>
    </div>
  )
}

function ThreadSection({
  label,
  threads,
}: {
  label: string | null
  threads: PublicForumPage["threads"]
}) {
  return (
    <section aria-label={label ?? "Threads"}>
      {label && (
        <h3 className="m-0 border-b border-[#ebe9e4] bg-[#fbfaf7] px-4 py-2 text-[0.6875rem] font-normal tracking-[0.07em] text-[#69665e] uppercase max-[34rem]:px-3">
          {label}
        </h3>
      )}
      <ol className="m-0 list-none p-0">
        {threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
      </ol>
    </section>
  )
}

export function CommunityHeader({ forum }: { forum: PublicForumShell }) {
  const visibleBoardCount = forum.channels.filter(
    (channel) => channel.hasThreads
  ).length
  return (
    <section className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 pb-6 max-md:grid-cols-[auto_minmax(0,1fr)] max-[34rem]:gap-3">
      <ServerMark
        icon={forum.server.icon}
        id={forum.server.id}
        name={forum.server.name}
      />
      <div className="min-w-0">
        <p className="mb-1 text-[0.6875rem] tracking-[0.08em] text-[#69665e] uppercase">
          Public Discord forum
        </p>
        <h1 className="m-0 text-[clamp(1.5rem,3vw,2rem)] leading-[1.05] font-normal tracking-[-0.025em]">
          {forum.server.name}
        </h1>
        {forum.server.description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-[1.45] text-pretty text-[#625f57] max-[34rem]:line-clamp-2">
            {forum.server.description}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-[#69665e]">
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden="true" className="size-3.5" />
            {new Intl.NumberFormat("en-US").format(
              forum.server.memberCount
            )}{" "}
            members
          </span>
          <span className="inline-flex items-center gap-1">
            {visibleBoardCount} active boards
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 max-md:col-span-full max-md:justify-start max-[34rem]:grid max-[34rem]:grid-cols-2">
        {forum.server.joinUrl && (
          <a
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#24231f] bg-[#24231f] px-3 text-xs text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f]"
            href={forum.server.joinUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Join Discord
          </a>
        )}
      </div>
    </section>
  )
}

export function RedesignTopbar({ serverId }: { serverId: string }) {
  return (
    <header className="border-b border-[#deddd7] bg-white/90">
      <div className="mx-auto flex min-h-14 w-[min(calc(100%-2rem),72rem)] items-center justify-between gap-4 max-[34rem]:w-[min(calc(100%-1.25rem),72rem)] [&_.community-search__trigger]:rounded-lg [&_.community-search__trigger]:border-[#deddd7] [&_.community-search__trigger]:bg-white max-[34rem]:[&_.community-search__trigger]:w-48 max-[34rem]:[&_.community-search__trigger]:min-w-48">
        <Link
          className="text-lg text-[#24231f] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f] max-[34rem]:text-base"
          to="/"
        >
          Velumn
        </Link>
        <CommunitySearch scope={{ kind: "server", id: serverId }} />
      </div>
    </header>
  )
}

export function BoardRail({
  activeChannelId,
  channels,
  serverId,
}: {
  activeChannelId?: string
  channels: PublicForumPage["channels"]
  serverId: string
}) {
  const groups = groupVisibleBoards(channels, activeChannelId)
  const visibleBoardCount = groups.reduce(
    (count, group) => count + group.channels.length,
    0
  )
  return (
    <aside
      className="sticky top-4 overflow-hidden rounded-xl border border-[#deddd7] bg-white max-md:static max-md:mb-3"
      aria-label="Discussion boards"
    >
      <div className="flex items-center justify-between gap-3 p-3 text-[0.6875rem] tracking-[0.06em] text-[#69665e] uppercase max-md:pb-2">
        <span>Browse boards</span>
        <strong className="min-w-5.5 rounded-full bg-[#f0eee8] px-1.5 py-0.5 text-center text-[0.625rem] text-[#5f5c54]">
          {visibleBoardCount}
        </strong>
      </div>
      <nav className="grid [scrollbar-width:thin] gap-3 px-1.5 pb-2 max-md:flex max-md:gap-4 max-md:overflow-x-auto max-md:px-2 max-md:pb-2.5">
        <Link
          aria-current={activeChannelId ? undefined : "page"}
          className={boardClassName(!activeChannelId)}
          params={{ serverId }}
          preload={false}
          to="/server/$serverId"
        >
          <MessagesSquare aria-hidden="true" />
          <span>All discussions</span>
        </Link>
        {groups.map((group) => (
          <section className="min-w-0 max-md:shrink-0" key={group.id}>
            <h3 className="mb-1 px-2 text-[0.625rem] font-normal tracking-[0.07em] text-[#69665e] uppercase">
              {group.name}
            </h3>
            <div className="grid gap-0.5 max-md:flex max-md:gap-1">
              {group.channels.map((channel) => {
                const Icon =
                  channel.type === ChannelType.GuildForum
                    ? MessagesSquare
                    : Hash
                return (
                  <Link
                    aria-current={
                      channel.id === activeChannelId ? "page" : undefined
                    }
                    className={boardClassName(channel.id === activeChannelId)}
                    key={channel.id}
                    params={{ channelId: channel.id }}
                    preload={false}
                    to="/channel/$channelId"
                  >
                    <Icon aria-hidden="true" />
                    <span>{channel.name}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  )
}

function boardClassName(active: boolean) {
  return cn(
    "grid min-h-9 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-[0.4rem] px-2 text-[0.8125rem] text-[#5e5b53] no-underline hover:bg-[#f1efe9] hover:text-[#24231f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f] max-md:shrink-0 max-md:grid-cols-[1rem_auto] max-md:border max-md:border-[#e2e0da] max-md:bg-white [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_svg]:size-3.5",
    active && "bg-[#f1efe9] text-[#24231f] max-md:bg-[#f1efe9]"
  )
}

function groupVisibleBoards(
  channels: PublicForumPage["channels"],
  activeChannelId?: string
) {
  const groups = new Map<
    string,
    {
      id: string
      name: string
      position: number
      channels: PublicForumPage["channels"]
    }
  >()

  for (const channel of channels) {
    if (!(channel.hasThreads || channel.id === activeChannelId)) continue
    const id = channel.category?.id ?? "uncategorized"
    const group = groups.get(id) ?? {
      id,
      name: channel.category?.name ?? "Other boards",
      position: channel.category?.position ?? Number.MAX_SAFE_INTEGER,
      channels: [],
    }
    group.channels.push(channel)
    groups.set(id, group)
  }

  return [...groups.values()]
    .sort((left, right) => left.position - right.position)
    .map((group) => ({
      ...group,
      channels: group.channels.sort(
        (left, right) => left.position - right.position
      ),
    }))
}

function ThreadRow({ thread }: { thread: PublicForumPage["threads"][number] }) {
  const replies = Math.max(0, thread.messageCount - 1)
  return (
    <li className="grid min-h-25 grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-3 px-4 py-3.5 hover:bg-[#fbfaf7] max-md:min-h-23 max-[34rem]:grid-cols-[1.75rem_minmax(0,1fr)] max-[34rem]:gap-2.5 max-[34rem]:px-3 [&+&]:border-t [&+&]:border-[#ebe9e4]">
      <span
        className="grid size-8 shrink-0 place-items-center self-start overflow-hidden rounded-[0.625rem] border border-black/10 bg-[#ebe7dc] text-[0.625rem] font-semibold text-[#625d50] max-[34rem]:size-7"
        aria-hidden="true"
      >
        {initials(thread.author)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.6875rem] text-[#69665e] [&_a]:font-semibold [&_a]:text-[#4c5948] [&_a]:no-underline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-[#24231f]">
          <Link
            params={{ channelId: thread.channel.id }}
            preload={false}
            to="/channel/$channelId"
          >
            {thread.channel.name}
          </Link>
          <span>by {thread.author}</span>
          {thread.pinned && (
            <span className="inline-flex items-center gap-1 text-[#7f5b31]">
              <Pin aria-hidden="true" className="size-3" /> Pinned
            </span>
          )}
        </div>
        <Link
          className="my-1.5 block text-base leading-5 text-pretty break-words text-[#24231f] no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f]"
          params={{
            threadId: thread.id,
            slug: getSlugFromTitle(thread.title),
          }}
          preload={false}
          to="/thread/$threadId/$slug"
        >
          {thread.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.6875rem] text-[#69665e]">
          <time dateTime={getDateFromSnowflake(thread.id).toISOString()}>
            {formatRelativeDate(getDateFromSnowflake(thread.id))}
          </time>
          <span className="inline-flex items-center gap-1">
            <MessageCircle aria-hidden="true" className="size-3" />
            {replies} {replies === 1 ? "reply" : "replies"}
          </span>
        </div>
      </div>
      <span
        className="grid size-8 place-items-center rounded-[0.45rem] text-[#89857d] max-[34rem]:hidden"
        aria-hidden="true"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </span>
    </li>
  )
}

function Pagination({ forum }: { forum: PublicForumPage }) {
  if (!forum.cursor && !forum.nextCursor) return null
  return (
    <nav
      className="flex justify-end gap-2 border-t border-[#e5e3dd] px-4 py-3"
      aria-label="Discussion pages"
    >
      {forum.cursor && (
        <RedesignPageLink forum={forum}>
          <ChevronLeft aria-hidden="true" /> Newest
        </RedesignPageLink>
      )}
      {forum.nextCursor && (
        <RedesignPageLink cursor={forum.nextCursor} forum={forum} rel="next">
          Older <ChevronRight aria-hidden="true" />
        </RedesignPageLink>
      )}
    </nav>
  )
}

function RedesignPageLink({
  children,
  cursor,
  forum,
  rel,
}: {
  children: ReactNode
  cursor?: string | null
  forum: PublicForumPage
  rel?: string
}) {
  return (
    <Link
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#d6d4cd] bg-white px-3 text-xs text-[#38362f] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f] [&_svg]:size-3.5"
      params={
        forum.activeChannelId
          ? { channelId: forum.activeChannelId }
          : { serverId: forum.server.id }
      }
      preload={false}
      rel={rel}
      search={cursor ? { cursor } : {}}
      to={forum.activeChannelId ? "/channel/$channelId" : "/server/$serverId"}
    >
      {children}
    </Link>
  )
}

export function ServerMark({
  icon,
  id,
  name,
}: {
  icon: string | null
  id: string
  name: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = icon
    ? icon.startsWith("http")
      ? icon
      : `https://cdn.discordapp.com/icons/${id}/${icon}.webp?size=96`
    : null
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-[#ebe7dc] text-base font-semibold text-[#625d50] max-[34rem]:size-12 max-[34rem]:rounded-[0.875rem]">
      {src && src !== failedSrc ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
          src={src}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?"
  )
}

export function ForumRedesignPending() {
  return (
    <RouteState busy title="Loading discussions">
      <div
        className="size-6 animate-spin rounded-full border-2 border-[#d3d0c7] border-t-[#24231f] motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p>Gathering the latest public threads.</p>
    </RouteState>
  )
}

export function ForumRedesignNotFound() {
  return (
    <RouteState title="Forum not found">
      <p>This community is unavailable or no longer public.</p>
      <StateLink to="/">Return home</StateLink>
    </RouteState>
  )
}

export function ForumRedesignError({ error }: { error: Error }) {
  const router = useRouter()
  if (import.meta.env.DEV) console.error(error)
  return (
    <RouteState title="Unable to load discussions">
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

export const stateActionClassName =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-[#d6d4cd] bg-white px-3 text-xs text-[#38362f] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f]"

export function RouteState({
  busy,
  children,
  title,
}: {
  busy?: boolean
  children: ReactNode
  title: string
}) {
  return (
    <main
      aria-busy={busy || undefined}
      aria-live={busy ? "polite" : undefined}
      className="grid-auto-rows-max mx-auto my-[clamp(3rem,12svh,6rem)] grid w-[min(calc(100%-2rem),28rem)] place-items-center gap-2 rounded-xl border border-[#deddd7] bg-[#f7f6f2] p-3 text-center font-['Questrial',ui-sans-serif,system-ui,sans-serif] text-[#24231f] antialiased"
    >
      <h1 className="m-0 px-1 text-base font-normal tracking-[-0.025em]">
        {title}
      </h1>
      <div className="grid w-full place-items-center gap-2 rounded-lg border border-[#e5e3dd] bg-white px-5 py-6 [&>p]:m-0 [&>p]:max-w-[30rem] [&>p]:text-[0.8125rem] [&>p]:leading-5 [&>p]:text-[#69665e]">
        {busy && <span className="sr-only">Loading</span>}
        {children}
      </div>
    </main>
  )
}

function StateLink({ children, to }: { children: ReactNode; to: "/" }) {
  return (
    <Link className={stateActionClassName} to={to}>
      {children}
    </Link>
  )
}
