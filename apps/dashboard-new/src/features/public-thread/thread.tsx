import { ChannelType } from "discord-api-types/v10"
import { Archive, Lock } from "lucide-react"
import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { DiscordMarkdown, DiscordMessageContent } from "./discord-markdown"
import {
  ChatIcon,
  ChevronRightIcon,
  DiscordIcon,
  ForumIcon,
  HashIcon,
} from "./icons"
import type { PublicThreadMessage, PublicThreadPage } from "./contracts"
import { ThreadFeedback } from "./thread-feedback"
import { formatFullDate, formatRelativeDate } from "@/lib/date"

export function PublicThreadView({
  afterStarter,
  contentId = "public-forum-content",
  footer,
  showContinueDiscussion = true,
  showFeedback = true,
  showServerInfo = true,
  presentation = "default",
  thread,
  serverHref = `/server/${thread.server.id}`,
}: {
  afterStarter?: ReactNode
  contentId?: string
  footer?: ReactNode
  showContinueDiscussion?: boolean
  showFeedback?: boolean
  showServerInfo?: boolean
  presentation?: "canonical" | "default"
  thread: PublicThreadPage
  serverHref?: string
}) {
  const items = [
    ...thread.replies.map((message) => ({
      id: message.id,
      type: "message" as const,
      data: message,
    })),
    ...thread.backlinks.map((backlink) => ({
      id: backlink.fromMessageId,
      type: "backlink" as const,
      data: backlink,
    })),
  ].sort((left, right) => left.id.localeCompare(right.id))

  return (
    <main
      className={cn(
        "thread-page min-w-0 overflow-hidden p-0",
        presentation === "canonical" &&
          "rounded-xl border border-[#deddd7] bg-white"
      )}
      id={contentId}
    >
      <div
        className={cn(
          "thread-heading mx-3 my-6",
          presentation === "canonical" &&
            "m-0 border-b border-[#e5e3dd] bg-[#fbfaf7] p-5 max-[40rem]:px-3.5 max-[40rem]:py-4"
        )}
      >
        <h1
          className={cn(
            "thread-title my-2 max-w-4xl overflow-hidden text-[2.25rem] leading-[1.1] font-medium tracking-[-0.025em] text-balance [overflow-wrap:anywhere] text-ellipsis max-[40rem]:text-[1.875rem]",
            presentation === "canonical" &&
              "mb-3 max-w-3xl text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.08] font-normal"
          )}
        >
          {thread.title}
        </h1>
        <div
          className={cn(
            presentation === "canonical" &&
              "mt-4 flex flex-wrap items-start gap-x-3 gap-y-2"
          )}
        >
          <a
            className={cn(
              "thread-channel flex w-fit items-center gap-1 bg-purple-100 px-2 py-0.5 text-sm text-purple-700 no-underline transition-colors hover:bg-purple-200 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[0.2rem] focus-visible:outline-purple-700 motion-reduce:transition-none [&_svg]:size-3.5",
              presentation === "canonical" &&
                "min-h-7 max-w-full bg-transparent px-0 text-xs font-medium text-[#4c5948] hover:bg-transparent hover:underline hover:underline-offset-2 focus-visible:outline-[#4c5948]"
            )}
            href={`/channel/${thread.parent.id}`}
            title={thread.parent.name}
          >
            {thread.parent.type === ChannelType.GuildForum ? (
              <ForumIcon />
            ) : (
              <HashIcon />
            )}
            <span className="truncate">{thread.parent.name}</span>
          </a>
          <ThreadStatus
            presentation={presentation}
            state={thread.state}
            tags={thread.tags}
          />
        </div>
      </div>

      <div
        className={cn(
          "thread-layout flex flex-col gap-6 overflow-hidden md:flex-row",
          presentation === "canonical" && "block overflow-visible"
        )}
      >
        <div
          className={cn(
            "thread-main min-w-0 flex-1 overflow-hidden",
            presentation === "canonical" &&
              "p-5 max-[40rem]:px-3.5 max-[40rem]:py-4"
          )}
        >
          <MessagePost
            isOriginalPost
            message={thread.starter}
            presentation={presentation}
          />
          {afterStarter}
          <div
            className={cn(
              "thread-reply-count my-4 flex items-center gap-2 px-3 text-sm",
              presentation === "canonical" &&
                "mt-4 mb-0 border-t border-[#deddd7] px-0 py-3 text-xs text-[#625f57]"
            )}
          >
            <ChatIcon className="size-5" />
            <span>
              {thread.replyCount}{" "}
              {thread.replyCount === 1 ? "Reply" : "Replies"}
            </span>
          </div>
          <div
            className={cn(
              "thread-replies grid gap-2",
              presentation === "canonical" &&
                "gap-0 [&>*]:border-t [&>*]:border-[#ebe9e4]"
            )}
          >
            {items.map((item) =>
              item.type === "message" ? (
                <MessagePost
                  key={item.id}
                  message={item.data}
                  presentation={presentation}
                />
              ) : (
                <Backlink backlink={item.data} key={item.id} />
              )
            )}
          </div>
          {thread.truncated && (
            <p className="thread-truncated m-3 text-sm text-neutral-600">
              Some messages are not included in this archived view.
            </p>
          )}
          {showContinueDiscussion &&
            (footer ?? (
              <ContinueDiscussion
                noReplies={thread.replyCount === 0}
                url={thread.discordUrl}
              />
            ))}
        </div>

        {(showServerInfo || showFeedback) && (
          <aside
            className={cn(
              "thread-sidebar mx-3 hidden w-auto max-w-none md:mx-0 md:block md:w-full md:max-w-80 md:flex-[0_0_20rem]",
              presentation === "canonical" &&
                "m-0 block max-w-none px-5 pb-5 max-[40rem]:px-3.5 max-[40rem]:pb-4"
            )}
            aria-label={showServerInfo ? "Community information" : "Feedback"}
          >
            {showServerInfo && (
              <ServerInfo serverHref={serverHref} thread={thread} />
            )}
            {showFeedback && <ThreadFeedback threadId={thread.id} />}
          </aside>
        )}
      </div>
    </main>
  )
}

function MessagePost({
  message,
  isOriginalPost = false,
  presentation,
}: {
  message: PublicThreadMessage
  isOriginalPost?: boolean
  presentation: "canonical" | "default"
}) {
  const avatarUrl = safeAvatarUrl(
    message.author.webhook?.avatar ?? message.author.avatar
  )
  return (
    <article
      className={cn(
        "thread-message scroll-my-4 rounded-sm border border-neutral-200 p-3 transition-colors target:bg-purple-200/10 motion-reduce:transition-none max-[24rem]:px-2",
        isOriginalPost && "is-original border-transparent",
        presentation === "canonical" && "rounded-none border-0 px-0 py-3.5",
        presentation === "canonical" && isOriginalPost && "pt-0"
      )}
      id={message.id}
    >
      {message.reference && <ReferenceMessage reference={message.reference} />}
      <div className="thread-message__row flex gap-2">
        <div
          className={cn(
            "thread-message__avatar flex w-[3.125rem] flex-[0_0_3.125rem] flex-col items-center max-[24rem]:w-10 max-[24rem]:basis-10",
            presentation === "canonical" && "w-11 basis-11"
          )}
        >
          {avatarUrl ? (
            <img
              alt=""
              className="size-[2.3125rem] rounded-full object-cover outline-1 outline-black/10"
              height="37"
              loading="lazy"
              src={avatarUrl}
              width="37"
            />
          ) : (
            <DiscordIcon />
          )}
        </div>
        <div className="thread-message__body min-w-0 flex-1">
          <header className="thread-message__meta mb-1 flex min-w-0 flex-wrap items-center gap-1 text-sm">
            <strong
              className={cn(
                "overflow-hidden font-medium text-ellipsis whitespace-nowrap",
                presentation === "canonical" && "font-semibold"
              )}
            >
              {message.author.name}
            </strong>
            {message.author.isStarterAuthor && (
              <span
                className={cn(
                  "thread-message__op shrink-0 border border-purple-700 px-1 text-xs leading-tight text-purple-700",
                  presentation === "canonical" &&
                    "rounded-[0.2rem] border-[#76866f] text-[#4c5948]"
                )}
              >
                OP
              </span>
            )}
            {message.author.webhook && (
              <span className="thread-message__bot shrink-0 rounded-[0.2rem] border border-neutral-300 px-1 text-xs leading-tight">
                Webhook
              </span>
            )}
            {message.author.isBot && (
              <span className="thread-message__bot shrink-0 rounded-[0.2rem] border border-neutral-300 px-1 text-xs leading-tight">
                BOT
              </span>
            )}
            <span className="text-neutral-500" aria-hidden="true">
              •
            </span>
            <time
              dateTime={message.createdAt}
              className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-neutral-500"
              suppressHydrationWarning
              title={formatFullDate(message.createdAt)}
            >
              {formatRelativeDate(message.createdAt)}
            </time>
          </header>
          <DiscordMessageContent message={message} />
        </div>
      </div>
    </article>
  )
}

function ReferenceMessage({
  reference,
}: {
  reference: PublicThreadMessage["reference"]
}) {
  if (!reference || reference.state !== "available") {
    return (
      <div className="thread-reference is-missing ms-[4.5rem] text-sm text-neutral-600 italic max-[24rem]:ms-12">
        {reference?.state === "redacted"
          ? "Original message is private"
          : "Original message was deleted"}
      </div>
    )
  }
  const message = reference.message
  return (
    <div className="thread-reference ms-2 flex min-w-0 items-center text-sm">
      <span
        className="thread-reference__spline ms-3 h-3 w-10 flex-[0_0_2.5rem] rounded-ss-lg border-s border-t border-[#72767d] max-[24rem]:ms-1 max-[24rem]:w-8 max-[24rem]:basis-8"
        aria-hidden="true"
      />
      <a
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-inherit no-underline"
        href={`#${message.id}`}
      >
        <strong>@{message.author.name}</strong>{" "}
        <DiscordMarkdown
          compact
          content={message.content.slice(0, 150)}
          metadata={null}
        />
      </a>
    </div>
  )
}

function Backlink({
  backlink,
}: {
  backlink: PublicThreadPage["backlinks"][number]
}) {
  return (
    <article className="thread-backlink relative flex gap-3 p-4">
      <span
        className="thread-backlink__line absolute inset-y-[-0.5rem] start-[1.85rem] w-0.5 bg-neutral-200"
        aria-hidden="true"
      />
      <span
        className="thread-backlink__icon relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-white text-neutral-700 ring-2 ring-neutral-200"
        aria-hidden="true"
      >
        ↗
      </span>
      <div className="min-w-0 text-sm text-neutral-600">
        <div>
          <strong className="text-neutral-700">@{backlink.author.name}</strong>{" "}
          mentioned this thread <span aria-hidden="true">•</span>{" "}
          <time
            className="text-xs text-neutral-500"
            dateTime={backlink.createdAt}
            suppressHydrationWarning
          >
            {formatRelativeDate(backlink.createdAt)}
          </time>
        </div>
        <a
          className="mt-1 inline-block font-medium [overflow-wrap:anywhere] text-neutral-900 underline-offset-2"
          href={`/thread/${backlink.thread.id}/${backlink.thread.slug}#${backlink.fromMessageId}`}
        >
          {backlink.thread.title}
        </a>
      </div>
    </article>
  )
}

function ThreadStatus({
  presentation,
  state,
  tags,
}: {
  presentation: "canonical" | "default"
  state: PublicThreadPage["state"]
  tags: PublicThreadPage["tags"]
}) {
  if (!(state.archived || state.locked || tags.length)) return null
  if (presentation === "canonical") {
    return (
      <aside
        className="contents text-xs text-[#625f57]"
        aria-label="Thread metadata"
      >
        {tags.length > 0 && (
          <ul
            className="m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0"
            aria-label="Applied tags"
          >
            {tags.map((tag) => (
              <li
                className="inline-flex min-h-7 max-w-56 items-center gap-1.5 rounded-md bg-[#f1efe9] px-2.5 text-[#555149]"
                key={tag.id}
                title={tag.name}
              >
                <ThreadTagEmoji tag={tag} />
                <span className="truncate">{tag.name}</span>
              </li>
            ))}
          </ul>
        )}
        {(state.locked || state.archived) && (
          <div
            className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-2 max-sm:ms-0 max-sm:basis-full"
            aria-label="Thread state"
          >
            {state.locked && (
              <span className="inline-flex min-h-7 items-center gap-1.5 text-[#6b563d]">
                <Lock aria-hidden="true" className="size-3.5" />
                Locked
              </span>
            )}
            {state.archived && (
              <span className="inline-flex min-h-7 items-center gap-1.5 text-[#6b563d]">
                <Archive aria-hidden="true" className="size-3.5" />
                Archived
                {state.archivedAt && (
                  <time
                    className="text-[#7b6d5d]"
                    dateTime={state.archivedAt}
                    suppressHydrationWarning
                    title={formatFullDate(state.archivedAt)}
                  >
                    {formatRelativeDate(state.archivedAt)}
                  </time>
                )}
              </span>
            )}
          </div>
        )}
      </aside>
    )
  }
  return (
    <aside
      className="thread-status mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-neutral-600"
      aria-label="Thread status"
    >
      {(state.archived || state.locked) && (
        <p className="m-0 flex flex-wrap gap-1.5 p-0">
          {state.locked && (
            <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5">
              Locked
            </span>
          )}
          {state.archived && (
            <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5">
              Archived
            </span>
          )}
          {state.archivedAt && (
            <time
              className="self-center"
              dateTime={state.archivedAt}
              suppressHydrationWarning
            >
              {formatFullDate(state.archivedAt)}
            </time>
          )}
        </p>
      )}
      {tags.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          aria-label="Applied tags"
        >
          {tags.map((tag) => (
            <li
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5"
              key={tag.id}
            >
              {tag.emojiId && tag.emojiName ? (
                <img
                  alt={`:${tag.emojiName}:`}
                  className="size-4 object-contain"
                  loading="lazy"
                  src={`https://cdn.discordapp.com/emojis/${tag.emojiId}.webp?size=32`}
                />
              ) : tag.emojiName ? (
                <span aria-hidden="true">{tag.emojiName} </span>
              ) : null}
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function ThreadTagEmoji({ tag }: { tag: PublicThreadPage["tags"][number] }) {
  const [failed, setFailed] = useState(false)
  if (tag.emojiId && tag.emojiName && !failed) {
    return (
      <img
        alt={`:${tag.emojiName}:`}
        className="size-3.5 shrink-0 object-contain"
        loading="lazy"
        onError={() => setFailed(true)}
        src={`https://cdn.discordapp.com/emojis/${tag.emojiId}.webp?size=32`}
      />
    )
  }
  if (tag.emojiName && !tag.emojiId) {
    return (
      <span className="shrink-0 leading-none" aria-hidden="true">
        {tag.emojiName}
      </span>
    )
  }
  return null
}

function ContinueDiscussion({
  noReplies,
  url,
}: {
  noReplies: boolean
  url: string
}) {
  const icon = noReplies ? "👋" : "💬"
  return (
    <section className="continue-discussion mt-2 flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-5 shadow-sm max-[40rem]:flex-col max-[40rem]:items-stretch">
      <div className="continue-discussion__copy flex min-w-0 items-center gap-2">
        <img
          alt={icon}
          className="size-12 p-2.5"
          src={
            noReplies
              ? "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f44b.svg"
              : "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4ac.svg"
          }
        />
        <div className="flex flex-col">
          <strong className="text-lg text-neutral-900">
            {noReplies ? "Start the conversation!" : "Continue the Discussion"}
          </strong>
          {noReplies && (
            <span className="text-sm text-neutral-700">
              Be the first to share what you think!
            </span>
          )}
        </div>
      </div>
      <a
        className="group inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-4 text-sm font-medium text-purple-800 no-underline hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 max-[40rem]:w-full"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open in Discord{" "}
        <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
      </a>
    </section>
  )
}

function ServerInfo({
  serverHref,
  thread,
}: {
  serverHref: string
  thread: PublicThreadPage
}) {
  return (
    <section className="thread-server-card border border-neutral-300 p-4">
      <a
        className="thread-server-card__name text-lg text-neutral-900 no-underline hover:underline"
        href={serverHref}
      >
        {thread.server.name}
      </a>
      <div className="thread-server-card__members mb-3 flex items-center gap-1.5 text-sm text-neutral-700">
        <span
          className="size-1.5 rounded-full bg-neutral-700"
          aria-hidden="true"
        />
        {memberCountFormatter.format(thread.server.memberCount)} members
      </div>
      {thread.server.description && (
        <p className="my-3">{thread.server.description}</p>
      )}
      {thread.server.joinUrl && (
        <a
          className="thread-server-card__join inline-flex min-h-10 items-center justify-center rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-4 text-sm font-medium text-purple-800 no-underline hover:bg-purple-100"
          href={thread.server.joinUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Join Server
        </a>
      )}
    </section>
  )
}

const memberCountFormatter = new Intl.NumberFormat("en-US")

function safeAvatarUrl(value: string | null) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}
