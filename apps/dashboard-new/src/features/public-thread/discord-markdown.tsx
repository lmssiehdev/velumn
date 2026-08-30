import { emojiToTwemoji } from "@repo/utils/helpers/twemoji"
import type { RowsSchema } from "@repo/db/helpers/validation"
import {
  ChannelType,
  ComponentType,
  EmbedType,
  StickerFormatType,
} from "discord-api-types/v10"
import { ImageOff } from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { z } from "zod"

import { formatUtcShortDateTime } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { PublicThreadMessage } from "./contracts"
import { formatDiscordTimestamp } from "./discord-date"
import {
  ChatIcon,
  ChevronRightIcon,
  ForumIcon,
  HashIcon,
  ThreadIcon,
} from "./icons"

type Metadata = PublicThreadMessage["metadata"]
type Mentions = PublicThreadMessage["mentions"]
type Embed = NonNullable<PublicThreadMessage["embeds"]>[number]
type EmbedField = NonNullable<Embed["fields"]>[number]
type ActionRow = RowsSchema
type ActionItem = Exclude<
  ActionRow["components"][number],
  { unsupported: true }
>
type ActionButton = Extract<ActionItem, { type: typeof ComponentType.Button }>
type ThumbnailComponent = {
  type: typeof ComponentType.Thumbnail
  media: { url: string }
  description?: string | null
  spoiler?: boolean
}
type MessageComponent =
  | ActionRow
  | { type: typeof ComponentType.TextDisplay; content: string }
  | {
      type: typeof ComponentType.Section
      components: Array<{
        type: typeof ComponentType.TextDisplay
        content: string
      }>
      accessory?: ActionButton | ThumbnailComponent
    }
  | {
      type: typeof ComponentType.Separator
      divider?: boolean
      spacing?: number
    }
  | {
      type: typeof ComponentType.MediaGallery
      items: Array<{
        media: { url: string }
        description?: string | null
        spoiler?: boolean
      }>
    }
  | {
      type: typeof ComponentType.File
      file: { url: string }
      spoiler?: boolean
    }
  | {
      type: typeof ComponentType.Container
      accentColor?: number | null
      spoiler?: boolean
      components: MessageComponent[]
    }
  | { type: number; unsupported: true }
type MessageComponentsContract = MessageComponent[]

export function DiscordMessageContent({
  message,
}: {
  message: PublicThreadMessage
}) {
  if (message.snapshot) {
    return (
      <blockquote className="discord-forwarded mt-2 border-s-4 border-neutral-300 ps-3 text-neutral-700">
        <div className="discord-forwarded__label mb-1 text-sm text-neutral-700">
          ↱ Forwarded
        </div>
        <DiscordMarkdown
          content={message.snapshot.content}
          metadata={message.snapshot.metadata}
          mentions={message.snapshot.mentions}
        />
        <Attachments
          attachments={(message.snapshot.attachments ?? []).map(
            (attachment) => ({
              ...attachment,
              url: attachment.proxyURL,
            })
          )}
        />
        <Embeds embeds={message.snapshot.embeds} />
        <Stickers stickers={message.snapshot.stickers} />
        <MessageComponents
          components={message.snapshot.components}
          metadata={message.snapshot.metadata}
        />
      </blockquote>
    )
  }

  return (
    <>
      <DiscordMarkdown
        content={message.content}
        mentions={message.mentions}
        metadata={message.metadata}
      />
      <Attachments attachments={message.attachments} />
      <Embeds embeds={message.embeds} />
      <Stickers stickers={message.stickers} />
      <MessageComponents
        components={message.components}
        metadata={message.metadata}
      />
      {message.poll && <Poll poll={message.poll} />}
      <Reactions reactions={message.reactions} />
    </>
  )
}

export function DiscordMarkdown({
  content,
  metadata,
  mentions,
  compact = false,
}: {
  content: string | null
  metadata: Metadata
  mentions?: Mentions
  compact?: boolean
}) {
  if (!content) return null
  return (
    <div
      className={cn(
        "discord-markdown leading-6 [overflow-wrap:anywhere] text-neutral-900 [&_a]:text-blue-600 [&_a]:underline-offset-2 [&_blockquote]:my-1 [&_blockquote]:border-s-4 [&_blockquote]:border-neutral-300 [&_blockquote]:ps-3 [&_blockquote]:text-neutral-700 [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-2xl [&_h2]:leading-tight [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-xl [&_h3]:leading-tight [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-[1.1rem] [&_h4]:leading-tight [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-6",
        compact &&
          "is-compact ms-1 inline p-px text-xs [&_*]:m-0 [&_*]:inline [&_*]:p-px [&_*]:text-xs"
      )}
    >
      {renderBlocks(
        content,
        metadata,
        compact ? "compact" : "message",
        mentions
      )}
    </div>
  )
}

function EmbedMarkdown({ content }: { content: string }) {
  return (
    <div className="discord-markdown discord-embed__markdown text-sm leading-[1.45] [overflow-wrap:anywhere] text-neutral-700 [&_a]:text-blue-600 [&_a]:underline-offset-2 [&_blockquote]:my-1 [&_blockquote]:border-s-4 [&_blockquote]:border-neutral-300 [&_blockquote]:ps-3 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-6">
      {renderBlocks(content, null, "embed")}
    </div>
  )
}

type MarkdownPresentation = "message" | "compact" | "embed"

function renderBlocks(
  content: string,
  metadata: Metadata,
  presentation: MarkdownPresentation,
  mentions?: Mentions
) {
  const blocks: ReactNode[] = []
  const codePattern = /```([^\n`]*)\n?([\s\S]*?)```/g
  let cursor = 0
  let match = codePattern.exec(content)
  while (match) {
    if (match.index > cursor) {
      blocks.push(
        ...renderLines(
          content.slice(cursor, match.index),
          metadata,
          presentation,
          mentions
        )
      )
    }
    blocks.push(
      presentation === "compact" ? (
        " "
      ) : (
        <pre
          className="discord-code-block my-2 max-w-full overflow-auto rounded border border-neutral-300 bg-neutral-100 p-3 text-sm leading-6 whitespace-pre"
          key={`code-${match.index}`}
        >
          <code data-language={match[1].trim() || undefined}>{match[2]}</code>
        </pre>
      )
    )
    cursor = match.index + match[0].length
    match = codePattern.exec(content)
  }
  if (cursor < content.length) {
    blocks.push(
      ...renderLines(content.slice(cursor), metadata, presentation, mentions)
    )
  }
  return blocks
}

function renderLines(
  content: string,
  metadata: Metadata,
  presentation: MarkdownPresentation,
  mentions?: Mentions
) {
  if (presentation === "compact")
    return renderInline(
      content.replace(/\s+/g, " "),
      metadata,
      "compact",
      mentions
    )
  const output: ReactNode[] = []
  const lines = content.split("\n")
  let list: { ordered: boolean; items: ReactNode[][] } | null = null
  let quote: { start: number; lines: ReactNode[][] } | null = null

  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? "ol" : "ul"
    output.push(
      <Tag key={`list-${output.length}`}>
        {list.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </Tag>
    )
    list = null
  }

  const flushQuote = () => {
    if (!quote) return
    output.push(
      <blockquote key={`quote-${quote.start}`}>
        {quote.lines.map((line, index) => (
          <span className="discord-line" key={index}>
            {line}
            {index < quote!.lines.length - 1 && <br />}
          </span>
        ))}
      </blockquote>
    )
    quote = null
  }

  lines.forEach((line, lineIndex) => {
    const listMatch = line.match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/)
    if (listMatch) {
      const ordered = Boolean(listMatch[1])
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push(
        renderInline(listMatch[2], metadata, `li-${lineIndex}`, mentions)
      )
      return
    }
    flushList()
    if (line.startsWith("> ")) {
      quote ??= { start: lineIndex, lines: [] }
      quote.lines.push(
        renderInline(line.slice(2), metadata, `quote-${lineIndex}`, mentions)
      )
      return
    }
    flushQuote()
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      if (presentation === "embed") {
        output.push(
          <strong
            className="discord-embed__heading mt-2 mb-0.5 block font-semibold [overflow-wrap:anywhere] text-neutral-900"
            key={`line-${lineIndex}`}
          >
            {renderInline(
              heading[2],
              metadata,
              `heading-${lineIndex}`,
              mentions
            )}
          </strong>
        )
        return
      }
      const Tag = `h${heading[1].length + 1}` as "h2" | "h3" | "h4"
      output.push(
        <Tag key={`line-${lineIndex}`}>
          {renderInline(heading[2], metadata, `heading-${lineIndex}`, mentions)}
        </Tag>
      )
      return
    }
    output.push(
      <span className="discord-line" key={`line-${lineIndex}`}>
        {renderInline(line, metadata, `line-${lineIndex}`, mentions)}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    )
  })
  flushList()
  flushQuote()
  return output
}

const inlinePattern =
  /(\[[^\]\n]+\]\([^)\s]+\)|<https?:\/\/[^>\s]+>|https?:\/\/[^\s<]+|<a?:[a-zA-Z0-9_]+:\d+>|<[@#](?:[!&])?\d+>|<t:\d+(?::[tTdDfFR])?>|\|\|.+?\|\||\*\*.+?\*\*|__.+?__|~~.+?~~|`[^`\n]+`|\*[^*\n]+\*)/g

function renderInline(
  value: string,
  metadata: Metadata,
  keyPrefix: string,
  mentions?: Mentions
) {
  const nodes: ReactNode[] = []
  let cursor = 0
  let tokenIndex = 0
  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index
    if (index > cursor)
      nodes.push(
        ...renderEmojiText(value.slice(cursor, index), keyPrefix, tokenIndex++)
      )
    const token = match[0]
    nodes.push(
      renderToken(token, metadata, `${keyPrefix}-${tokenIndex++}`, mentions)
    )
    cursor = index + token.length
  }
  if (cursor < value.length)
    nodes.push(...renderEmojiText(value.slice(cursor), keyPrefix, tokenIndex))
  return nodes
}

function renderToken(
  token: string,
  metadata: Metadata,
  key: string,
  mentions?: Mentions
): ReactNode {
  if (token.startsWith("[")) {
    const match = token.match(/^\[([^\]]+)\]\((.+)\)$/)
    const calendarLink = match
      ? match[1] === "[+]" && isCalendarUrl(match[2])
      : false
    return (
      <MarkdownLink
        className={calendarLink ? "discord-calendar-link" : undefined}
        content={calendarLink ? "+" : match?.[1]}
        href={match?.[2] ?? ""}
        key={key}
        metadata={metadata}
        label={calendarLink ? "Add to calendar" : undefined}
      />
    )
  }
  if (token.startsWith("http") || token.startsWith("<http")) {
    const href = token.startsWith("<") ? token.slice(1, -1) : token
    return (
      <MarkdownLink content={href} href={href} key={key} metadata={metadata} />
    )
  }
  const customEmoji = token.match(/^<(a?):([^:]+):(\d+)>$/)
  if (customEmoji) {
    return (
      <img
        alt={`:${customEmoji[2]}:`}
        className="discord-emoji mx-[0.04rem] inline-block size-[1.375rem] object-contain align-[-0.35rem]"
        key={key}
        loading="lazy"
        src={`https://cdn.discordapp.com/emojis/${customEmoji[3]}.webp?size=128`}
        title={`:${customEmoji[2]}:`}
      />
    )
  }
  const mention = token.match(/^<([@#])([!&]?)(\d+)>$/)
  if (mention) return <Mention key={key} match={mention} mentions={mentions} />
  const timestamp = token.match(/^<t:(\d+)(?::([tTdDfFR]))?>$/)
  if (timestamp) {
    const [, seconds, style = "f"] = timestamp
    return (
      <time
        aria-label={timestampLabel(seconds, style)}
        className="discord-timestamp rounded-[0.15rem] bg-neutral-200 px-[0.2rem]"
        data-timestamp-style={style}
        dateTime={new Date(Number(seconds) * 1000).toISOString()}
        key={key}
      >
        {formatDiscordTimestamp(seconds, style)}
      </time>
    )
  }
  if (token.startsWith("||"))
    return (
      <Spoiler key={key}>
        {renderInline(token.slice(2, -2), metadata, key, mentions)}
      </Spoiler>
    )
  if (token.startsWith("**"))
    return (
      <strong key={key}>
        {renderInline(token.slice(2, -2), metadata, key, mentions)}
      </strong>
    )
  if (token.startsWith("__"))
    return (
      <u key={key}>
        {renderInline(token.slice(2, -2), metadata, key, mentions)}
      </u>
    )
  if (token.startsWith("~~"))
    return (
      <s key={key}>
        {renderInline(token.slice(2, -2), metadata, key, mentions)}
      </s>
    )
  if (token.startsWith("`"))
    return (
      <code
        className="discord-inline-code rounded-[0.2rem] border border-neutral-300 bg-neutral-100 px-1 py-[0.1rem] text-sm"
        key={key}
      >
        {token.slice(1, -1)}
      </code>
    )
  if (token.startsWith("*"))
    return (
      <em key={key}>
        {renderInline(token.slice(1, -1), metadata, key, mentions)}
      </em>
    )
  return token
}

function renderEmojiText(value: string, keyPrefix: string, offset: number) {
  const nodes: ReactNode[] = []
  const emojiPattern =
    /:calendar_spiral:|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*/gu
  let cursor = 0
  let index = offset
  for (const match of value.matchAll(emojiPattern)) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index))
    const emoji = match[0] === ":calendar_spiral:" ? "🗓️" : match[0]
    nodes.push(
      <img
        alt={emoji}
        className="discord-emoji mx-[0.04rem] inline-block size-[1.375rem] object-contain align-[-0.35rem]"
        key={`${keyPrefix}-emoji-${index++}`}
        loading="lazy"
        src={emojiToTwemoji(emoji)}
      />
    )
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) nodes.push(value.slice(cursor))
  return nodes
}

function Mention({
  match,
  mentions,
}: {
  match: RegExpMatchArray
  mentions?: Mentions
}) {
  const [, prefix, modifier, id = ""] = match
  if (prefix === "#") {
    const channel = mentions?.channels.find((item) => item.id === id)
    return (
      <span className="discord-mention inline-flex items-baseline gap-0.5 rounded-[0.2rem] bg-purple-100 px-[0.2rem] py-[0.05rem] text-purple-800">
        <HashIcon className="size-3.5 self-center" />
        <span className="discord-sr-only sr-only">Channel </span>
        {mentionName(channel, id)}
      </span>
    )
  }
  const records = modifier === "&" ? mentions?.roles : mentions?.users
  const mention = records?.find((item) => item.id === id)
  if (modifier === "&")
    return (
      <span className="discord-mention inline-flex items-baseline rounded-[0.2rem] bg-purple-100 px-[0.2rem] py-[0.05rem] text-purple-800">
        @{mentionName(mention, id)}
      </span>
    )
  return (
    <span className="discord-mention inline-flex items-baseline rounded-[0.2rem] bg-purple-100 px-[0.2rem] py-[0.05rem] text-purple-800">
      @{mentionName(mention, id)}
    </span>
  )
}

function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  const safeHref = safeHttpUrl(href)
  return safeHref ? (
    <a href={safeHref} rel="noreferrer" target="_blank">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  )
}

function MarkdownLink({
  className,
  content,
  href,
  label,
  metadata,
}: {
  className?: string
  content?: ReactNode
  href: string
  label?: string
  metadata: Metadata
}) {
  const internal = metadata?.internalLinks?.find(
    (link) => link.original === href
  )
  if (!internal) {
    const safeHref = safeHttpUrl(href)
    return safeHref ? (
      <a
        aria-label={label}
        className={cn("text-blue-600 underline-offset-2", className)}
        href={safeHref}
        rel="noreferrer"
        target="_blank"
      >
        {content}
      </a>
    ) : (
      <span>{content}</span>
    )
  }
  const safeHref = safeHttpUrl(internal.original)
  if (!safeHref) return <span>{content}</span>
  const channelName = internal.channel.name
  const forumParent =
    internal.channel.parent?.type === ChannelType.GuildForum && internal.message
      ? internal.channel.parent
      : null
  const locationName = forumParent
    ? `${forumParent.name}, ${channelName}`
    : channelName
  const shortenedChannelName =
    channelName.length > 40 ? `${channelName.slice(0, 40)}...` : channelName
  return (
    <a
      aria-label={`Discord message in ${locationName}, opens in a new tab`}
      className="discord-internal-link inline-flex max-w-full items-center gap-0.5 rounded bg-purple-100 p-0.5 align-middle leading-[inherit] text-purple-800! no-underline hover:bg-purple-200 [&>svg]:size-4 [&>svg]:shrink-0"
      href={safeHref}
      rel="noopener noreferrer"
      target="_blank"
    >
      {forumParent && (
        <>
          <ForumIcon />
          <span className="discord-internal-link__label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {forumParent.name}
          </span>
          <span
            className="discord-internal-link__chevron shrink-0"
            aria-hidden="true"
          >
            <ChevronRightIcon className="size-2.5" />
          </span>
        </>
      )}
      <ChannelGlyph type={internal.channel.type} />
      <span className="discord-internal-link__label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {shortenedChannelName}
      </span>
      {internal.message && (
        <span
          className="discord-internal-link__trail inline-flex shrink-0 items-center gap-0.5"
          aria-hidden="true"
        >
          <ChevronRightIcon className="size-2.5" />
          <ChatIcon className="size-4" />
        </span>
      )}
    </a>
  )
}

function ChannelGlyph({ type }: { type: number }) {
  if (type === ChannelType.GuildForum) return <ForumIcon />
  if (
    type === ChannelType.PublicThread ||
    type === ChannelType.PrivateThread ||
    type === ChannelType.AnnouncementThread
  ) {
    return <ThreadIcon />
  }
  return <HashIcon />
}

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  const contentId = useId()

  return (
    <span
      className={cn(
        "discord-spoiler relative inline-block w-fit overflow-hidden rounded-[0.2rem] border border-neutral-400",
        revealed && "is-revealed"
      )}
    >
      <span
        aria-hidden={!revealed}
        className={cn(
          "discord-spoiler__content inline-block px-1",
          revealed
            ? "bg-neutral-100 text-inherit select-text"
            : "text-transparent select-none"
        )}
        id={contentId}
      >
        {children}
      </span>
      <button
        aria-controls={contentId}
        aria-expanded={revealed}
        aria-label={revealed ? "Hide spoiler" : "Reveal spoiler"}
        className={cn(
          "discord-spoiler__control z-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700",
          revealed
            ? "static ms-1 w-auto bg-transparent p-0 text-xs text-neutral-600 underline underline-offset-2"
            : "absolute inset-0 w-full border-0 bg-neutral-500 hover:bg-neutral-700"
        )}
        onClick={() => setRevealed((current) => !current)}
        type="button"
      >
        {revealed && <span>Hide spoiler</span>}
      </button>
    </span>
  )
}

function Attachments({
  attachments,
}: {
  attachments: PublicThreadMessage["attachments"]
}) {
  if (!attachments.length) return null
  const images = attachments.filter(
    (item) =>
      item.contentType?.startsWith("image/") &&
      item.contentType !== "image/gif" &&
      item.contentType !== "image/apng"
  )
  const videos = attachments.filter((item) =>
    item.contentType?.startsWith("video/")
  )
  const audio = attachments.filter((item) =>
    item.contentType?.startsWith("audio/")
  )
  const files = attachments.filter(
    (item) =>
      !item.contentType?.startsWith("image/") &&
      !item.contentType?.startsWith("video/") &&
      !item.contentType?.startsWith("audio/")
  )
  const animatedImages = attachments.filter(
    (item) =>
      item.contentType === "image/gif" || item.contentType === "image/apng"
  )
  return (
    <div className="discord-attachments mt-1 flex flex-col gap-2 [&>audio]:w-full [&>audio]:max-w-[34.375rem] [&>video]:max-h-[25rem] [&>video]:w-full [&>video]:max-w-[34.375rem] [&>video]:rounded">
      {images.length > 0 && (
        <div
          className={cn(
            "discord-image-grid grid w-full max-w-[34.375rem] gap-1 overflow-hidden rounded [&_img]:block [&_img]:max-h-[25rem] [&_img]:min-h-full [&_img]:w-full [&_img]:rounded-[0.2rem] [&_img]:object-cover",
            images.length >= 2 && "grid-cols-2 max-[30rem]:grid-cols-1",
            images.length === 3 &&
              "[&>:first-child]:row-span-2 max-[30rem]:[&>:first-child]:row-span-1"
          )}
        >
          {images.map((attachment) => (
            <SafeImage attachment={attachment} key={attachment.id} />
          ))}
        </div>
      )}
      {videos.map((attachment) => {
        const src = safeHttpsUrl(attachment.url)
        return src ? (
          <video controls key={attachment.id} preload="metadata">
            <source src={src} type={attachment.contentType ?? undefined} />
            <a href={src}>Download {attachment.name}</a>
          </video>
        ) : null
      })}
      {audio.map((attachment) => {
        const src = safeHttpsUrl(attachment.url)
        return src ? (
          <audio controls key={attachment.id} preload="metadata">
            <source src={src} type={attachment.contentType ?? undefined} />
            <a href={src}>Download {attachment.name}</a>
          </audio>
        ) : null
      })}
      {[...animatedImages, ...files].map((attachment) => (
        <div
          className="discord-file mt-2 flex w-full max-w-md gap-2.5 border border-neutral-300 p-4 shadow-sm"
          key={attachment.id}
        >
          <span className="discord-file__icon text-[2rem]" aria-hidden="true">
            ▤
          </span>
          <span className="discord-file__details flex min-w-0 flex-col [&_a]:overflow-hidden [&_a]:text-ellipsis [&_a]:whitespace-nowrap [&_a]:text-inherit [&_small]:text-neutral-500">
            <SafeLink href={attachment.url}>{attachment.name}</SafeLink>
            {attachment.size !== null && (
              <small>{formatBytes(attachment.size)}</small>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function SafeImage({
  attachment,
}: {
  attachment: PublicThreadMessage["attachments"][number]
}) {
  const src = safeHttpsUrl(attachment.url)
  if (!src) return null
  return (
    <ArchivedImage
      alt={attachment.description ?? attachment.name}
      height={attachment.height ?? undefined}
      label={attachment.name}
      linkSrc={src}
      src={src}
      width={attachment.width ?? undefined}
    />
  )
}

function Embeds({ embeds }: { embeds: PublicThreadMessage["embeds"] }) {
  if (!embeds?.length) return null
  return (
    <div className="discord-embeds mt-1 flex flex-col gap-2 [&>img]:max-h-[18.75rem] [&>img]:max-w-[min(100%,25rem)] [&>img]:rounded [&>video]:max-h-[18.75rem] [&>video]:max-w-[min(100%,25rem)] [&>video]:rounded">
      {embeds.map((embed, index) => (
        <EmbedCard embed={embed} key={index} />
      ))}
    </div>
  )
}

function EmbedCard({ embed }: { embed: Embed }) {
  const image =
    embed.type === EmbedType.Image
      ? (embed.url ?? embed.image?.url ?? embed.image?.proxy_url)
      : undefined
  if (embed.type === EmbedType.Image && image)
    return (
      <SafeEmbedImage
        alt={
          embed.image?.description ??
          embed.title ??
          embed.description ??
          "Embedded image"
        }
        fallbackSrc={embed.image?.proxy_url}
        height={embed.image?.height}
        src={image}
        width={embed.image?.width}
      />
    )
  if (
    embed.type === EmbedType.GIFV &&
    (safeHttpsUrl(embed.video?.url) || safeHttpsUrl(embed.video?.proxy_url))
  ) {
    return (
      <video
        controls
        height={embed.video?.height}
        loop
        muted
        playsInline
        poster={safeMediaUrl(embed.thumbnail)}
        src={
          safeHttpsUrl(embed.video?.url) ?? safeHttpsUrl(embed.video?.proxy_url)
        }
        width={embed.video?.width}
      />
    )
  }
  const parsedColor = z
    .number()
    .int()
    .min(0)
    .max(0xffffff)
    .safeParse(embed.color)
  const color = parsedColor.success ? toHexColor(parsedColor.data) : "#dadadc"
  return (
    <article
      className="discord-embed w-full max-w-md rounded-[0.35rem] border border-s-4 border-neutral-300 bg-neutral-50 px-4 py-3 [&_a]:text-blue-600 [&_a]:underline-offset-2"
      style={{ borderInlineStartColor: color }}
    >
      <div className="discord-embed__body grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-[24rem]:grid-cols-1">
        <div className="discord-embed__content flex min-w-0 flex-col">
          <EmbedHeader embed={embed} />
          <EmbedTitle embed={embed} />
          <EmbedDescription description={embed.description} />
          <EmbedFields fields={embed.fields} />
        </div>
        {embed.thumbnail && (
          <EmbedMedia
            alt={
              embed.thumbnail.description ?? embed.title ?? "Embedded thumbnail"
            }
            className="discord-embed__thumbnail size-20 shrink-0 rounded object-cover outline-1 outline-black/10 max-[24rem]:h-auto max-[24rem]:max-h-32 max-[24rem]:w-full max-[24rem]:max-w-32"
            media={embed.thumbnail}
          />
        )}
      </div>
      {embed.image && embed.type !== EmbedType.Image && (
        <EmbedMedia
          alt={
            embed.image.description ??
            embed.title ??
            embed.description ??
            "Embedded image"
          }
          className="discord-embed__image mt-3 block max-h-[18.75rem] w-auto max-w-full rounded object-contain outline-1 outline-black/10"
          media={embed.image}
        />
      )}
      {embed.video && embed.type !== EmbedType.GIFV && (
        <EmbedVideo embed={embed} />
      )}
      <MessageComponents
        components={embed.components ?? null}
        metadata={null}
      />
      <EmbedFooter embed={embed} />
    </article>
  )
}

function EmbedHeader({ embed }: { embed: Embed }) {
  return (
    <>
      {embed.provider?.name && (
        <small className="discord-embed__provider mb-1.5 block text-xs leading-[1.3] text-neutral-600">
          {embed.provider.name}
        </small>
      )}
      {embed.author && (
        <div className="discord-embed__author mb-2 flex items-center gap-2 text-sm leading-[1.3] font-semibold [&_img]:size-5 [&_img]:rounded-full [&_img]:object-cover [&_img]:outline-1 [&_img]:outline-black/10">
          {(embed.author.icon_url || embed.author.proxy_icon_url) && (
            <SafeEmbedImage
              alt=""
              fallbackSrc={embed.author.proxy_icon_url}
              src={embed.author.icon_url ?? embed.author.proxy_icon_url ?? ""}
            />
          )}
          <SafeLink href={embed.author.url ?? ""}>{embed.author.name}</SafeLink>
        </div>
      )}
    </>
  )
}

function EmbedTitle({ embed }: { embed: Embed }) {
  if (!embed.title) return null
  const title = renderInline(embed.title, null, "embed-title")
  return (
    <strong className="discord-embed__title mb-1 block text-base leading-[1.3] font-semibold [overflow-wrap:anywhere]">
      {embed.url ? <SafeLink href={embed.url}>{title}</SafeLink> : title}
    </strong>
  )
}

function EmbedDescription({ description }: { description?: string }) {
  return description ? <EmbedMarkdown content={description} /> : null
}

type EmbedFieldRow = {
  fields: EmbedField[]
  inline: boolean
}

export function composeEmbedFieldRows(
  fields: EmbedField[] = []
): EmbedFieldRow[] {
  const rows: EmbedFieldRow[] = []
  const visibleFields = fields.filter(
    (field) => field.name.trim() !== "" || field.value.trim() !== ""
  )

  for (let index = 0; index < visibleFields.length;) {
    const field = visibleFields[index]
    if (!field.inline) {
      rows.push({ fields: [field], inline: false })
      index += 1
      continue
    }

    const run: EmbedField[] = []
    while (visibleFields[index]?.inline) {
      run.push(visibleFields[index])
      index += 1
    }
    for (let start = 0; start < run.length; start += 3) {
      rows.push({ fields: run.slice(start, start + 3), inline: true })
    }
  }

  return rows
}

function EmbedFields({ fields }: { fields?: EmbedField[] }) {
  const rows = composeEmbedFieldRows(fields)
  if (rows.length === 0) return null

  return (
    <div className="discord-embed__fields mt-3 flex flex-col gap-2.5 max-[40rem]:gap-3">
      {rows.map((row, rowIndex) => (
        <div
          className={
            row.fields.length === 2
              ? "discord-embed__field-row columns-2"
              : row.fields.length === 3
                ? "discord-embed__field-row columns-3"
                : "discord-embed__field-row"
          }
          data-columns={row.fields.length}
          data-inline={row.inline}
          key={rowIndex}
        >
          <div
            className={cn(
              "grid gap-3",
              row.fields.length === 2 && "grid-cols-2 max-[40rem]:grid-cols-1",
              row.fields.length === 3 && "grid-cols-3 max-[40rem]:grid-cols-1"
            )}
          >
            {row.fields.map((field, fieldIndex) => (
              <div
                className="discord-embed__field min-w-0 [&_.discord-embed__markdown]:text-[0.8125rem]"
                key={fieldIndex}
              >
                {field.name && (
                  <strong className="discord-embed__field-name mb-0.5 block text-sm leading-[1.35] font-semibold [overflow-wrap:anywhere]">
                    {renderInline(
                      field.name,
                      null,
                      `field-${rowIndex}-${fieldIndex}-name`
                    )}
                  </strong>
                )}
                {field.value && <EmbedMarkdown content={field.value} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmbedMedia({
  alt,
  className,
  media,
}: {
  alt: string
  className: string
  media: NonNullable<Embed["image"]>
}) {
  return (
    <SafeEmbedImage
      alt={alt}
      className={className}
      fallbackSrc={media.proxy_url}
      height={media.height}
      src={media.url}
      width={media.width}
    />
  )
}

function EmbedVideo({ embed }: { embed: Embed }) {
  const src = safeMediaUrl(embed.video)
  if (!src) return null
  return (
    <video
      aria-label={embed.video?.description ?? embed.title ?? "Embedded video"}
      className="discord-embed__video mt-3 block max-h-[18.75rem] w-full rounded outline-1 outline-black/10"
      controls
      height={embed.video?.height}
      playsInline
      poster={safeMediaUrl(embed.thumbnail)}
      src={src}
      width={embed.video?.width}
    />
  )
}

function EmbedFooter({ embed }: { embed: Embed }) {
  const timestamp = validEmbedTimestamp(embed.timestamp)
  if (!embed.footer && !timestamp) return null
  return (
    <small className="discord-embed__footer mt-2.5 flex items-center gap-1.5 text-xs leading-[1.3] text-neutral-600 [&_img]:size-5 [&_img]:rounded-full [&_img]:object-cover [&_img]:outline-1 [&_img]:outline-black/10">
      {(embed.footer?.icon_url || embed.footer?.proxy_icon_url) && (
        <SafeEmbedImage
          alt=""
          fallbackSrc={embed.footer.proxy_icon_url}
          src={embed.footer.icon_url ?? embed.footer.proxy_icon_url ?? ""}
        />
      )}
      {embed.footer?.text}
      {embed.footer?.text && timestamp && " • "}
      {timestamp && (
        <time dateTime={timestamp}>{formatEmbedDate(timestamp)}</time>
      )}
    </small>
  )
}

function SafeEmbedImage({
  src,
  fallbackSrc,
  alt,
  className,
  height,
  width,
}: {
  src?: string
  fallbackSrc?: string
  alt: string
  className?: string
  height?: number
  width?: number
}) {
  const primarySrc = safeHttpsUrl(src)
  const safeFallbackSrc = safeHttpsUrl(fallbackSrc)
  const initialSrc = primarySrc ?? safeFallbackSrc
  return initialSrc ? (
    <ArchivedImage
      alt={alt}
      className={className}
      fallbackSrc={safeFallbackSrc}
      height={height}
      label={alt || "Embedded image"}
      linkSrc={primarySrc ?? safeFallbackSrc}
      src={initialSrc}
      width={width}
    />
  ) : null
}

export function ArchivedImage({
  alt,
  className,
  fallbackSrc,
  height,
  label,
  linkSrc,
  src,
  width,
}: {
  alt: string
  className?: string
  fallbackSrc?: string
  height?: number
  label: string
  linkSrc?: string
  src: string
  width?: number
}) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src)

  if (!currentSrc) {
    if (!alt) return null
    return (
      <div
        className="discord-image-fallback col-span-full inline-grid min-h-11 w-[min(100%,24rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[#deddd7] bg-[#f7f6f2] p-2 text-[#555149]"
        role="group"
        aria-label={label}
      >
        <span
          className="discord-image-fallback__icon grid size-8 place-items-center rounded bg-[#ebe8df] text-[#69665e]"
          aria-hidden="true"
        >
          <ImageOff size={15} strokeWidth={1.5} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <strong className="text-xs font-medium text-[#38362f]">
            Image unavailable
          </strong>
          <small className="overflow-hidden text-[0.6875rem] text-ellipsis whitespace-nowrap text-[#625f57]">
            {label}
          </small>
        </span>
        {linkSrc && (
          <a
            aria-label={`Open original image: ${label}`}
            className="inline-flex min-h-7 shrink-0 items-center rounded px-1.5 text-[0.6875rem] font-medium text-[#4c5948] underline-offset-[0.15em] hover:bg-[#ebe8df] hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4c5948]"
            href={linkSrc}
            rel="noreferrer"
            target="_blank"
          >
            Open original
          </a>
        )}
      </div>
    )
  }

  const image = (
    <img
      alt={alt}
      className={cn("outline-1 outline-black/10", className)}
      height={height}
      loading="lazy"
      onError={() => {
        if (fallbackSrc && fallbackSrc !== currentSrc) {
          setCurrentSrc(fallbackSrc)
          return
        }
        setCurrentSrc(null)
      }}
      src={currentSrc}
      width={width}
    />
  )

  return linkSrc ? (
    <a href={linkSrc} rel="noreferrer" target="_blank">
      {image}
    </a>
  ) : (
    image
  )
}

function Poll({ poll }: { poll: NonNullable<PublicThreadMessage["poll"]> }) {
  const answers = Object.values(poll.answers ?? {}).filter(
    (answer) => answer !== undefined
  )
  const total = answers.reduce((sum, answer) => sum + answer.voteCount, 0)
  return (
    <section
      aria-label={`Poll: ${poll.question}`}
      className="discord-poll mt-2 flex flex-col gap-3 border border-neutral-200 p-4"
    >
      <strong>{poll.question}</strong>
      {!poll.resultsFinalized && (
        <small className="text-neutral-700">Archived poll</small>
      )}
      <div>
        {answers.map((answer, index) => (
          <div
            className="discord-poll__answer mt-2 flex items-center gap-3 rounded-sm bg-neutral-100 px-4 py-2"
            key={index}
          >
            <span className="inline-flex min-w-0 flex-1 items-center gap-2 [overflow-wrap:anywhere]">
              {answer.emoji && <Emoji emoji={answer.emoji} />}
              {answer.text}
            </span>
            <span>{answer.voteCount}</span>
            <meter
              aria-label={`${answer.text}: ${answer.voteCount} votes`}
              max={Math.max(1, total)}
              className="w-20 max-w-1/4"
              value={answer.voteCount}
            />
          </div>
        ))}
      </div>
      <small className="text-neutral-700">
        {total} {total === 1 ? "vote" : "votes"}
        {poll.resultsFinalized && " • Poll closed"}
      </small>
    </section>
  )
}

function Emoji({
  emoji,
}: {
  emoji: { id?: string | null; name?: string | null; animated?: boolean }
}) {
  if (!emoji.name) return null
  const src = emoji.id
    ? `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=128`
    : emojiToTwemoji(emoji.name)
  return (
    <img
      alt={emoji.name}
      className="discord-emoji mx-[0.04rem] inline-block size-[1.375rem] object-contain align-[-0.35rem]"
      loading="lazy"
      src={src}
    />
  )
}

function MessageComponents({
  components,
  metadata,
}: {
  components: MessageComponentsContract | null
  metadata: Metadata
}) {
  if (!components?.length) return null
  return (
    <div
      className="discord-components mt-2 grid gap-2"
      aria-label="Archived message components"
    >
      {components.map((component, index) => (
        <MessageComponentView
          component={component}
          key={`${component.type}-${index}`}
          metadata={metadata}
        />
      ))}
    </div>
  )
}

function MessageComponentView({
  component,
  metadata,
}: {
  component: MessageComponent
  metadata: Metadata
}) {
  if ("unsupported" in component) {
    return <UnknownComponent type={component.type} />
  }
  switch (component.type) {
    case ComponentType.ActionRow:
      return (
        <div className="discord-actions flex flex-wrap gap-2 pt-2 [&_button]:inline-flex [&_button]:min-h-9 [&_button]:max-w-60 [&_button]:items-center [&_button]:gap-2 [&_button]:overflow-hidden [&_button]:rounded-md [&_button]:border [&_button]:border-neutral-300 [&_button]:bg-white [&_button]:px-3 [&_button]:text-sm [&_button]:text-neutral-900 [&_button]:disabled:opacity-50 [&_select]:inline-flex [&_select]:min-h-9 [&_select]:w-full [&_select]:max-w-60 [&_select]:items-center [&_select]:rounded-md [&_select]:border [&_select]:border-neutral-300 [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_select]:text-neutral-900 [&_select]:disabled:opacity-50 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap">
          {component.components.map((child, index) => {
            if ("unsupported" in child) {
              return <UnknownComponent key={index} type={child.type} />
            }
            if (child.type === ComponentType.Button) {
              return <ArchivedButton component={child} key={index} />
            }
            return (
              <select
                aria-label={child.placeholder ?? "Archived selection"}
                disabled
                key={index}
              >
                <option>{child.placeholder ?? "Selection unavailable"}</option>
                {"options" in child &&
                  child.options.map((option) => (
                    <option key={option.value}>{option.label}</option>
                  ))}
              </select>
            )
          })}
        </div>
      )
    case ComponentType.TextDisplay:
      return <DiscordMarkdown content={component.content} metadata={metadata} />
    case ComponentType.Section:
      return (
        <section className="discord-component-section grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[40rem]:grid-cols-1">
          <div>
            {component.components.map((child, index) => (
              <DiscordMarkdown
                content={child.content}
                key={index}
                metadata={metadata}
              />
            ))}
          </div>
          {component.accessory?.type === ComponentType.Thumbnail &&
            (component.accessory.spoiler ? (
              <details className="discord-media-spoiler w-fit max-w-full rounded border border-neutral-300 p-2 [&>summary]:cursor-pointer [&>summary]:text-[0.8125rem] [&[open]>summary]:mb-2">
                <summary>Show spoiler media</summary>
                <SafeEmbedImage
                  alt={component.accessory.description ?? "Thumbnail"}
                  className="discord-component-thumbnail size-20 rounded object-cover outline-1 outline-black/10"
                  src={component.accessory.media.url}
                />
              </details>
            ) : (
              <SafeEmbedImage
                alt={component.accessory.description ?? "Thumbnail"}
                className="discord-component-thumbnail size-20 rounded object-cover outline-1 outline-black/10"
                src={component.accessory.media.url}
              />
            ))}
          {component.accessory?.type === ComponentType.Button && (
            <ArchivedButton component={component.accessory} />
          )}
        </section>
      )
    case ComponentType.Separator:
      return component.divider === false ? (
        <div className="discord-component-space min-h-3" />
      ) : (
        <hr />
      )
    case ComponentType.MediaGallery:
      return (
        <div className="discord-component-gallery grid w-full max-w-[34.375rem] grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-1 [&_img]:block [&_img]:h-auto [&_img]:max-h-80 [&_img]:w-full [&_img]:rounded [&_img]:object-cover [&_img]:outline-1 [&_img]:outline-black/10">
          {component.items.map((item, index) =>
            item.spoiler ? (
              <details
                className="discord-media-spoiler w-fit max-w-full rounded border border-neutral-300 p-2 [&>summary]:cursor-pointer [&>summary]:text-[0.8125rem] [&[open]>summary]:mb-2"
                key={index}
              >
                <summary>Show spoiler media</summary>
                <SafeEmbedImage
                  alt={item.description ?? "Gallery image"}
                  src={item.media.url}
                />
              </details>
            ) : (
              <SafeEmbedImage
                alt={item.description ?? "Gallery image"}
                key={index}
                src={item.media.url}
              />
            )
          )}
        </div>
      )
    case ComponentType.File: {
      const url = safeHttpsUrl(component.file.url)
      return url ? (
        <a
          className="discord-component-file w-fit [overflow-wrap:anywhere] text-inherit"
          href={url}
          rel="noreferrer"
          target="_blank"
        >
          {component.spoiler ? "Spoiler file" : fileName(url)}
        </a>
      ) : (
        <UnknownComponent type={component.type} />
      )
    }
    case ComponentType.Container:
      return (
        <section
          className="discord-component-container grid w-full max-w-[34.375rem] gap-2 rounded-[0.35rem] border border-s-4 border-neutral-300 p-3"
          style={
            component.accentColor
              ? { borderInlineStartColor: toHexColor(component.accentColor) }
              : undefined
          }
        >
          {component.spoiler && <small>Spoiler</small>}
          {component.components.map((child, index) => (
            <MessageComponentView
              component={child}
              key={`${child.type}-${index}`}
              metadata={metadata}
            />
          ))}
        </section>
      )
    default:
      return <UnknownComponent type={(component as { type: number }).type} />
  }
}

function ArchivedButton({
  component,
}: {
  component: {
    type: typeof ComponentType.Button
    label?: string | null
    emoji?: Parameters<typeof Emoji>[0]["emoji"] | null
  }
}) {
  return (
    <button disabled type="button">
      {component.emoji && <Emoji emoji={component.emoji} />}
      <span>{component.label ?? "Archived button"}</span>
    </button>
  )
}

function UnknownComponent({ type }: { type: number }) {
  return (
    <p className="discord-component-unknown m-0 w-fit border border-dashed border-neutral-400 px-2.5 py-1.5 text-[0.8125rem] text-neutral-600">
      Unsupported archived component (type {type})
    </p>
  )
}

function Reactions({
  reactions,
}: {
  reactions: PublicThreadMessage["reactions"]
}) {
  if (!reactions?.length) return null
  return (
    <ul
      className="discord-reactions mt-2 flex list-none flex-wrap gap-1.5 p-0"
      aria-label="Reactions"
    >
      {reactions.map((reaction, index) => (
        <li
          className="inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-md bg-[#f1efe9] px-1.5 text-xs leading-none text-[#625f57] tabular-nums"
          key={`${reaction.id ?? reaction.name}-${index}`}
          title={`${reaction.name}: ${reaction.count} ${reaction.count === 1 ? "reaction" : "reactions"}`}
        >
          <ReactionEmoji emoji={reaction} />
          <span aria-hidden="true">{formatReactionCount(reaction.count)}</span>
          <span className="sr-only">
            {reaction.name}: {reaction.count}{" "}
            {reaction.count === 1 ? "reaction" : "reactions"}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ReactionEmoji({
  emoji,
}: {
  emoji: { id?: string | null; name?: string | null; animated?: boolean }
}) {
  const [failed, setFailed] = useState(false)
  if (!emoji.name) return null
  const src = emoji.id
    ? `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=32`
    : emojiToTwemoji(emoji.name)

  if (failed || !src) {
    return emoji.id ? (
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 place-items-center rounded-sm bg-[#e3e0d7] text-[0.625rem] font-medium text-[#77736a]"
      >
        :
      </span>
    ) : (
      <span aria-hidden="true" className="shrink-0 text-sm leading-none">
        {emoji.name}
      </span>
    )
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-4 shrink-0 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  )
}

export function formatReactionCount(value: number) {
  const count = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
  return count < 1000
    ? String(count)
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(count)
}

function Stickers({ stickers }: { stickers: PublicThreadMessage["stickers"] }) {
  if (!stickers?.length) return null
  return (
    <div className="discord-stickers flex flex-wrap gap-2 [&_img]:size-40 [&_img]:object-contain">
      {stickers.map((sticker) => {
        if (sticker.format === StickerFormatType.Lottie) {
          return (
            <a
              className="discord-sticker-fallback self-center text-inherit"
              href={`https://cdn.discordapp.com/stickers/${sticker.id}.json`}
              key={sticker.id}
              rel="noreferrer"
              target="_blank"
            >
              Sticker: {sticker.name}
            </a>
          )
        }
        const animated =
          sticker.format === StickerFormatType.GIF ||
          sticker.format === StickerFormatType.APNG
        const extension =
          sticker.format === StickerFormatType.GIF ? "gif" : "png"
        const host =
          extension === "gif" ? "media.discordapp.net" : "cdn.discordapp.com"
        return (
          <span className="discord-sticker" key={sticker.id}>
            {animated && (
              <>
                <img
                  alt={sticker.name}
                  className="discord-sticker__static block has-[+_.discord-sticker__animation[open]]:hidden"
                  loading="lazy"
                  src={`https://media.discordapp.net/stickers/${sticker.id}.webp?size=320`}
                />
                <details className="discord-sticker__animation w-fit motion-reduce:hidden [&>summary]:mb-1 [&>summary]:cursor-pointer [&>summary]:text-[0.8125rem]">
                  <summary>Show animated sticker</summary>
                  <img
                    alt=""
                    className="discord-sticker__animated"
                    loading="lazy"
                    src={`https://${host}/stickers/${sticker.id}.${extension}`}
                  />
                </details>
              </>
            )}
            {!animated && (
              <img
                alt={sticker.name}
                loading="lazy"
                src={`https://${host}/stickers/${sticker.id}.${extension}`}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function isCalendarUrl(value: string) {
  const safeUrl = safeHttpUrl(value)
  if (!safeUrl) return false
  const url = new URL(safeUrl)
  return url.hostname === "www.google.com" && url.pathname === "/calendar/event"
}

function mentionName(
  mention: Mentions["users"][number] | undefined,
  fallback: string
) {
  if (!mention) return fallback
  if (mention.state === "available") return mention.name
  return mention.state === "redacted" ? "redacted" : fallback
}

function fileName(value: string) {
  try {
    return decodeURIComponent(
      new URL(value).pathname.split("/").at(-1) || "Attached file"
    )
  } catch {
    return "Attached file"
  }
}

function toHexColor(value: number) {
  return `#${value.toString(16).padStart(6, "0").slice(-6)}`
}

function safeHttpsUrl(value?: string | null) {
  if (!value) return undefined
  const url = safeHttpUrl(value)
  return url?.startsWith("https:") ? url : undefined
}

function safeMediaUrl(media?: { url?: string; proxy_url?: string }) {
  return safeHttpsUrl(media?.url) ?? safeHttpsUrl(media?.proxy_url)
}

function timestampLabel(value: string, style: string) {
  return style === "R"
    ? formatDiscordTimestamp(value, style)
    : `Discord timestamp: ${formatDiscordTimestamp(value, style)} UTC`
}

function formatEmbedDate(value: string) {
  return formatUtcShortDateTime(value)
}

function validEmbedTimestamp(value?: string) {
  if (!value) return undefined
  return Number.isNaN(Date.parse(value)) ? undefined : value
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  const units = ["KB", "MB", "GB"]
  let size = value / 1024
  let unit = units[0]
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024
    unit = units[index]
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`
}
