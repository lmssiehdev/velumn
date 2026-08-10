import { emojiToTwemoji } from "@repo/utils/helpers/twemoji"
import {
  ChannelType,
  ComponentType,
  EmbedType,
  StickerFormatType,
  type APIEmbed,
  type APIEmbedField,
} from "discord-api-types/v10"
import { useId, useState, type ReactNode } from "react"

import { formatUtcShortDateTime } from "@/lib/date"
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
type Embed = APIEmbed
type ActionRow = NonNullable<PublicThreadMessage["components"]>[number]
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
      <blockquote className="discord-forwarded">
        <div className="discord-forwarded__label">↱ Forwarded</div>
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
      className={compact ? "discord-markdown is-compact" : "discord-markdown"}
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
    <div className="discord-markdown discord-embed__markdown">
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
        <pre className="discord-code-block" key={`code-${match.index}`}>
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
          <strong className="discord-embed__heading" key={`line-${lineIndex}`}>
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
        className="discord-emoji"
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
        className={`discord-timestamp is-${style}`}
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
      <code className="discord-inline-code" key={key}>
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
        className="discord-emoji"
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
      <span className="discord-mention">
        <HashIcon />
        <span className="discord-sr-only">Channel </span>
        {mentionName(channel, id)}
      </span>
    )
  }
  const records = modifier === "&" ? mentions?.roles : mentions?.users
  const mention = records?.find((item) => item.id === id)
  if (modifier === "&")
    return <span className="discord-mention">@{mentionName(mention, id)}</span>
  return <span className="discord-mention">@{mentionName(mention, id)}</span>
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
        className={className}
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
      className="discord-internal-link"
      href={safeHref}
      rel="noopener noreferrer"
      target="_blank"
    >
      {forumParent && (
        <>
          <ForumIcon />
          <span className="discord-internal-link__label">
            {forumParent.name}
          </span>
          <span className="discord-internal-link__chevron" aria-hidden="true">
            <ChevronRightIcon />
          </span>
        </>
      )}
      <ChannelGlyph type={internal.channel.type} />
      <span className="discord-internal-link__label">
        {shortenedChannelName}
      </span>
      {internal.message && (
        <span className="discord-internal-link__trail" aria-hidden="true">
          <ChevronRightIcon />
          <ChatIcon />
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
    <span className={`discord-spoiler${revealed ? " is-revealed" : ""}`}>
      <span
        aria-hidden={!revealed}
        className="discord-spoiler__content"
        id={contentId}
      >
        {children}
      </span>
      <button
        aria-controls={contentId}
        aria-expanded={revealed}
        aria-label={revealed ? "Hide spoiler" : "Reveal spoiler"}
        className="discord-spoiler__control"
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
    <div className="discord-attachments">
      {images.length > 0 && (
        <div
          className={`discord-image-grid count-${Math.min(images.length, 5)}`}
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
        <div className="discord-file" key={attachment.id}>
          <span className="discord-file__icon" aria-hidden="true">
            ▤
          </span>
          <span className="discord-file__details">
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
    <a href={src} rel="noreferrer" target="_blank">
      <img
        alt={attachment.description ?? attachment.name}
        height={attachment.height ?? undefined}
        loading="lazy"
        src={src}
        width={attachment.width ?? undefined}
      />
    </a>
  )
}

function Embeds({ embeds }: { embeds: PublicThreadMessage["embeds"] }) {
  if (!embeds?.length) return null
  return (
    <div className="discord-embeds">
      {embeds.map((embed, index) => (
        <EmbedCard embed={embed} key={index} />
      ))}
    </div>
  )
}

function EmbedCard({ embed }: { embed: Embed }) {
  const image = embed.type === EmbedType.Image ? embed.url : embed.image?.url
  if (embed.type === "image" && image)
    return (
      <SafeEmbedImage
        alt={embed.title ?? embed.description ?? "Embedded image"}
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
  const color =
    typeof embed.color === "number"
      ? `#${embed.color.toString(16).padStart(6, "0")}`
      : "#dadadc"
  const largeThumbnail =
    embed.type === EmbedType.Link || embed.type === EmbedType.Article
  return (
    <article className="discord-embed" style={{ borderLeftColor: color }}>
      <div className="discord-embed__body">
        <div className="discord-embed__content">
          <EmbedHeader embed={embed} />
          <EmbedTitle embed={embed} />
          <EmbedDescription description={embed.description} />
          <EmbedFields fields={embed.fields} />
        </div>
        {!largeThumbnail && embed.thumbnail && (
          <EmbedMedia
            alt={embed.title ?? "Embedded thumbnail"}
            className="discord-embed__thumbnail"
            media={embed.thumbnail}
          />
        )}
      </div>
      {largeThumbnail && embed.thumbnail && (
        <EmbedMedia
          alt={embed.title ?? "Embedded thumbnail"}
          className="discord-embed__image discord-embed__preview"
          media={embed.thumbnail}
        />
      )}
      {embed.image && embed.type !== EmbedType.Image && (
        <EmbedMedia
          alt={embed.title ?? embed.description ?? "Embedded image"}
          className="discord-embed__image"
          media={embed.image}
        />
      )}
      <EmbedFooter embed={embed} />
    </article>
  )
}

function EmbedHeader({ embed }: { embed: APIEmbed }) {
  return (
    <>
      {embed.provider?.name && (
        <small className="discord-embed__provider">{embed.provider.name}</small>
      )}
      {embed.author && (
        <div className="discord-embed__author">
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

function EmbedTitle({ embed }: { embed: APIEmbed }) {
  if (!embed.title) return null
  const title = renderInline(embed.title, null, "embed-title")
  return (
    <strong className="discord-embed__title">
      {embed.url ? <SafeLink href={embed.url}>{title}</SafeLink> : title}
    </strong>
  )
}

function EmbedDescription({ description }: { description?: string }) {
  return description ? <EmbedMarkdown content={description} /> : null
}

type EmbedFieldRow = {
  fields: APIEmbedField[]
  inline: boolean
}

export function composeEmbedFieldRows(
  fields: APIEmbedField[] = []
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

    const run: APIEmbedField[] = []
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

function EmbedFields({ fields }: { fields?: APIEmbedField[] }) {
  const rows = composeEmbedFieldRows(fields)
  if (rows.length === 0) return null

  return (
    <div className="discord-embed__fields">
      {rows.map((row, rowIndex) => (
        <div
          className={`discord-embed__field-row columns-${row.fields.length}`}
          data-columns={row.fields.length}
          data-inline={row.inline}
          key={rowIndex}
        >
          {row.fields.map((field, fieldIndex) => (
            <div className="discord-embed__field" key={fieldIndex}>
              {field.name && (
                <strong className="discord-embed__field-name">
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
  media: NonNullable<APIEmbed["image"]>
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

function EmbedFooter({ embed }: { embed: APIEmbed }) {
  if (!embed.footer && !embed.timestamp) return null
  return (
    <small className="discord-embed__footer">
      {(embed.footer?.icon_url || embed.footer?.proxy_icon_url) && (
        <SafeEmbedImage
          alt=""
          fallbackSrc={embed.footer.proxy_icon_url}
          src={embed.footer.icon_url ?? embed.footer.proxy_icon_url ?? ""}
        />
      )}
      {embed.footer?.text}
      {embed.footer?.text && embed.timestamp && " • "}
      {embed.timestamp && (
        <time dateTime={embed.timestamp}>
          {formatEmbedDate(embed.timestamp)}
        </time>
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
  src: string
  fallbackSrc?: string
  alt: string
  className?: string
  height?: number
  width?: number
}) {
  const primarySrc = safeHttpsUrl(src)
  const safeFallbackSrc = safeHttpsUrl(fallbackSrc)
  const [safeSrc, setSafeSrc] = useState(primarySrc ?? safeFallbackSrc)
  return safeSrc ? (
    <img
      alt={alt}
      className={className}
      height={height}
      loading="lazy"
      onError={
        safeFallbackSrc && safeFallbackSrc !== safeSrc
          ? () => setSafeSrc(safeFallbackSrc)
          : undefined
      }
      src={safeSrc}
      width={width}
    />
  ) : null
}

function Poll({ poll }: { poll: NonNullable<PublicThreadMessage["poll"]> }) {
  const answers = Object.values(poll.answers ?? {})
  const total = answers.reduce((sum, answer) => sum + answer.voteCount, 0)
  return (
    <section aria-label={`Poll: ${poll.question}`} className="discord-poll">
      <strong>{poll.question}</strong>
      {!poll.resultsFinalized && <small>Archived poll</small>}
      <div>
        {answers.map((answer, index) => (
          <div className="discord-poll__answer" key={index}>
            <span>
              {answer.emoji && <Emoji emoji={answer.emoji} />}
              {answer.text}
            </span>
            <span>{answer.voteCount}</span>
            <meter
              aria-label={`${answer.text}: ${answer.voteCount} votes`}
              max={Math.max(1, total)}
              value={answer.voteCount}
            />
          </div>
        ))}
      </div>
      <small>
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
    <img alt={emoji.name} className="discord-emoji" loading="lazy" src={src} />
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
      className="discord-components"
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
        <div className="discord-actions">
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
        <section className="discord-component-section">
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
              <details className="discord-media-spoiler">
                <summary>Show spoiler media</summary>
                <SafeEmbedImage
                  alt={component.accessory.description ?? "Thumbnail"}
                  className="discord-component-thumbnail"
                  src={component.accessory.media.url}
                />
              </details>
            ) : (
              <SafeEmbedImage
                alt={component.accessory.description ?? "Thumbnail"}
                className="discord-component-thumbnail"
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
        <div className="discord-component-space" />
      ) : (
        <hr />
      )
    case ComponentType.MediaGallery:
      return (
        <div className="discord-component-gallery">
          {component.items.map((item, index) =>
            item.spoiler ? (
              <details className="discord-media-spoiler" key={index}>
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
          className="discord-component-file"
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
          className="discord-component-container"
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
    <p className="discord-component-unknown">
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
    <ul className="discord-reactions" aria-label="Reactions">
      {reactions.map((reaction, index) => (
        <li key={`${reaction.id ?? reaction.name}-${index}`}>
          <Emoji emoji={reaction} />
          <span>{reaction.count}</span>
          <span className="sr-only"> reactions</span>
        </li>
      ))}
    </ul>
  )
}

function Stickers({ stickers }: { stickers: PublicThreadMessage["stickers"] }) {
  if (!stickers?.length) return null
  return (
    <div className="discord-stickers">
      {stickers.map((sticker) => {
        if (sticker.format === StickerFormatType.Lottie) {
          return (
            <a
              className="discord-sticker-fallback"
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
                  className="discord-sticker__static"
                  loading="lazy"
                  src={`https://media.discordapp.net/stickers/${sticker.id}.webp?size=320`}
                />
                <details className="discord-sticker__animation">
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
