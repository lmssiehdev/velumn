import { ChannelType } from "discord-api-types/v10"

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
  contentId = "public-forum-content",
  thread,
  serverHref = `/server/${thread.server.id}`,
}: {
  contentId?: string
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
    <main className="thread-page" id={contentId}>
      <div className="thread-heading">
        <h1 className="thread-title">{thread.title}</h1>
        <a className="thread-channel" href={`/channel/${thread.parent.id}`}>
          {thread.parent.type === ChannelType.GuildForum ? (
            <ForumIcon />
          ) : (
            <HashIcon />
          )}
          {thread.parent.name}
        </a>
        <ThreadStatus state={thread.state} tags={thread.tags} />
      </div>

      <div className="thread-layout">
        <div className="thread-main">
          <MessagePost isOriginalPost message={thread.starter} />
          <div className="thread-reply-count">
            <ChatIcon />
            <span>
              {thread.replyCount}{" "}
              {thread.replyCount === 1 ? "Reply" : "Replies"}
            </span>
          </div>
          <div className="thread-replies">
            {items.map((item) =>
              item.type === "message" ? (
                <MessagePost key={item.id} message={item.data} />
              ) : (
                <Backlink backlink={item.data} key={item.id} />
              )
            )}
          </div>
          {thread.truncated && (
            <p className="thread-truncated">
              Some messages are not included in this archived view.
            </p>
          )}
          <ContinueDiscussion
            noReplies={thread.replyCount === 0}
            url={thread.discordUrl}
          />
        </div>

        <aside className="thread-sidebar" aria-label="Community information">
          <ServerInfo serverHref={serverHref} thread={thread} />
          <ThreadFeedback threadId={thread.id} />
        </aside>
      </div>
    </main>
  )
}

function MessagePost({
  message,
  isOriginalPost = false,
}: {
  message: PublicThreadMessage
  isOriginalPost?: boolean
}) {
  const avatarUrl = safeAvatarUrl(
    message.author.webhook?.avatar ?? message.author.avatar
  )
  return (
    <article
      className={`thread-message${isOriginalPost ? " is-original" : ""}`}
      id={message.id}
    >
      {message.reference && <ReferenceMessage reference={message.reference} />}
      <div className="thread-message__row">
        <div className="thread-message__avatar">
          {avatarUrl ? (
            <img alt="" height="37" loading="lazy" src={avatarUrl} width="37" />
          ) : (
            <DiscordIcon />
          )}
        </div>
        <div className="thread-message__body">
          <header className="thread-message__meta">
            <strong>{message.author.name}</strong>
            {message.author.isStarterAuthor && (
              <span className="thread-message__op">OP</span>
            )}
            {message.author.webhook && (
              <span className="thread-message__bot">Webhook</span>
            )}
            {message.author.isBot && (
              <span className="thread-message__bot">BOT</span>
            )}
            <span aria-hidden="true">•</span>
            <time
              dateTime={message.createdAt}
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
      <div className="thread-reference is-missing">
        {reference?.state === "redacted"
          ? "Original message is private"
          : "Original message was deleted"}
      </div>
    )
  }
  const message = reference.message
  return (
    <div className="thread-reference">
      <span className="thread-reference__spline" aria-hidden="true" />
      <a href={`#${message.id}`}>
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
    <article className="thread-backlink">
      <span className="thread-backlink__line" aria-hidden="true" />
      <span className="thread-backlink__icon" aria-hidden="true">
        ↗
      </span>
      <div>
        <div>
          <strong>@{backlink.author.name}</strong> mentioned this thread{" "}
          <span aria-hidden="true">•</span>{" "}
          <time dateTime={backlink.createdAt} suppressHydrationWarning>
            {formatRelativeDate(backlink.createdAt)}
          </time>
        </div>
        <a
          href={`/thread/${backlink.thread.id}/${backlink.thread.slug}#${backlink.fromMessageId}`}
        >
          {backlink.thread.title}
        </a>
      </div>
    </article>
  )
}

function ThreadStatus({
  state,
  tags,
}: {
  state: PublicThreadPage["state"]
  tags: PublicThreadPage["tags"]
}) {
  if (!(state.archived || state.locked || tags.length)) return null
  return (
    <aside className="thread-status" aria-label="Thread status">
      {(state.archived || state.locked) && (
        <p>
          {state.locked && <span>Locked</span>}
          {state.archived && <span>Archived</span>}
          {state.archivedAt && (
            <time dateTime={state.archivedAt} suppressHydrationWarning>
              {formatFullDate(state.archivedAt)}
            </time>
          )}
        </p>
      )}
      {tags.length > 0 && (
        <ul aria-label="Applied tags">
          {tags.map((tag) => (
            <li key={tag.id}>
              {tag.emojiId && tag.emojiName ? (
                <img
                  alt={`:${tag.emojiName}:`}
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

function ContinueDiscussion({
  noReplies,
  url,
}: {
  noReplies: boolean
  url: string
}) {
  const icon = noReplies ? "👋" : "💬"
  return (
    <section className="continue-discussion">
      <div className="continue-discussion__copy">
        <img
          alt={icon}
          src={
            noReplies
              ? "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f44b.svg"
              : "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4ac.svg"
          }
        />
        <div>
          <strong>
            {noReplies ? "Start the conversation!" : "Continue the Discussion"}
          </strong>
          {noReplies && <span>Be the first to share what you think!</span>}
        </div>
      </div>
      <a href={url} rel="noopener noreferrer" target="_blank">
        Open in Discord <ChevronRightIcon />
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
    <section className="thread-server-card">
      <a className="thread-server-card__name" href={serverHref}>
        {thread.server.name}
      </a>
      <div className="thread-server-card__members">
        <span aria-hidden="true" />
        {memberCountFormatter.format(thread.server.memberCount)} members
      </div>
      {thread.server.description && <p>{thread.server.description}</p>}
      {thread.server.joinUrl && (
        <a
          className="thread-server-card__join"
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
