import { renderToStaticMarkup } from "react-dom/server"
import {
  ComponentType,
  EmbedType,
  StickerFormatType,
} from "discord-api-types/v10"
import { describe, expect, it } from "vitest"

import type { PublicThreadMessage } from "./contracts"
import {
  DiscordMarkdown,
  DiscordMessageContent,
  formatReactionCount,
} from "./discord-markdown"
import { PublicThreadView } from "./thread"

describe("DiscordMarkdown", () => {
  it("formats reaction counts without allowing invalid values", () => {
    expect(formatReactionCount(0)).toBe("0")
    expect(formatReactionCount(999)).toBe("999")
    expect(formatReactionCount(1200)).toBe("1.2K")
    expect(formatReactionCount(-4)).toBe("0")
    expect(formatReactionCount(Number.NaN)).toBe("0")
  })

  it("renders Discord formatting, emoji, and resolved mentions", () => {
    const html = renderToStaticMarkup(
      <DiscordMarkdown
        content="**hello** <@123> in <#456> 👋"
        mentions={{
          users: [
            { id: "123", state: "available", name: "Ada", source: "database" },
          ],
          channels: [
            { id: "456", state: "available", name: "help", source: "database" },
          ],
          roles: [],
        }}
        metadata={null}
      />
    )

    expect(html).toContain("<strong>hello</strong>")
    expect(html).toContain("@Ada")
    expect(html).toContain("help")
    expect(html).toContain("twemoji@14.0.2")
  })

  it("links only HTTP URLs", () => {
    const html = renderToStaticMarkup(
      <DiscordMarkdown
        content="[safe](https://example.com) [unsafe](javascript:alert(1))"
        metadata={null}
      />
    )

    expect(html).toContain('href="https://example.com/"')
    expect(html).not.toContain('href="javascript:')
  })

  it("keeps spoiler content hidden from assistive technology until reveal", () => {
    const html = renderToStaticMarkup(
      <DiscordMarkdown content="||classified||" metadata={null} />
    )

    expect(html).toContain('aria-label="Reveal spoiler"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-hidden="true"')
  })

  it("renders rich archived message content and component fallbacks", () => {
    const message = messageFixture({
      attachments: [
        {
          id: "attachment",
          name: "guide.pdf",
          url: "https://cdn.example.com/guide.pdf",
          description: null,
          contentType: "application/pdf",
          size: 2048,
          width: null,
          height: null,
          isSnapshot: false,
        },
      ],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: 1,
              disabled: false,
              label: "Run action",
              url: "https://example.com/action",
            },
            {
              type: ComponentType.StringSelect,
              customId: "select",
              disabled: false,
              placeholder: "Choose one",
              options: [{ label: "First", value: "first" }],
            },
          ],
        },
        { type: ComponentType.TextDisplay, content: "V2 text" },
        {
          type: ComponentType.Section,
          components: [
            { type: ComponentType.TextDisplay, content: "Section text" },
          ],
          accessory: {
            type: ComponentType.Thumbnail,
            media: { url: "https://cdn.example.com/thumb.png" },
            description: "Preview",
          },
        },
        { type: ComponentType.Separator, divider: true },
        {
          type: ComponentType.MediaGallery,
          items: [
            {
              media: { url: "https://cdn.example.com/gallery.png" },
              description: "Gallery preview",
            },
          ],
        },
        {
          type: ComponentType.File,
          file: { url: "https://cdn.example.com/archive.zip" },
        },
        {
          type: ComponentType.Container,
          accentColor: 0x7e22ce,
          components: [{ type: 99, unsupported: true }],
        },
      ],
      content: "See https://discord.com/channels/1/2/3",
      embeds: [
        {
          type: EmbedType.Rich,
          title: "Release notes",
          description: "Details",
          provider: { name: "Velumn" },
          thumbnail: {
            url: "https://cdn.example.com/thumb.png",
            description: "Release thumbnail",
          },
          image: {
            url: "https://cdn.example.com/release.png",
            description: "Release diagram",
            width: 640,
            height: 360,
          },
          fields: [
            { name: "Status", value: "Ready", inline: true },
            { name: "Version", value: "1.0", inline: true },
          ],
          footer: { text: "Published" },
          timestamp: "2026-08-10T12:00:00.000Z",
          flags: 0,
          components: [
            {
              type: ComponentType.Container,
              components: [
                { type: ComponentType.TextDisplay, content: "Embed component" },
              ],
            },
          ],
        },
        {
          type: EmbedType.Video,
          title: "Demo video",
          video: {
            url: "https://cdn.example.com/demo.mp4",
            description: "Product demo",
            width: 1280,
            height: 720,
          },
        },
      ],
      metadata: {
        internalLinks: [
          {
            original: "https://discord.com/channels/1/2/3",
            guild: { id: "1", name: "Community" },
            channel: {
              id: "2",
              name: "updates",
              type: 0,
              parent: {
                name: "Events on this Server",
                type: 4,
              },
            },
            message: "3",
          },
        ],
      },
      poll: {
        question: "Ship it?",
        resultsFinalized: true,
        layoutType: 1,
        answers: {
          yes: { text: "Yes", voteCount: 4, emoji: null },
        },
      },
      reactions: [
        {
          id: null,
          name: "👍",
          animated: false,
          count: 3,
          messageId: "100",
          isServerEmoji: false,
        },
      ],
      stickers: [
        { id: "sticker", name: "Wave", format: StickerFormatType.Lottie },
        {
          id: "animated-sticker",
          name: "Celebrate",
          format: StickerFormatType.GIF,
        },
      ],
    })

    const html = renderToStaticMarkup(
      <DiscordMessageContent message={message} />
    )

    expect(html).toContain("discord-internal-link")
    expect(html).toContain("Discord message in updates, opens in a new tab")
    expect(html).toContain("updates")
    expect(html).toContain("discord-internal-link__trail")
    expect(html).not.toContain("Events on this Server")
    expect(html.match(/<svg/g)).toHaveLength(3)
    expect(html).toContain("Release notes")
    expect(html).toContain("Release diagram")
    expect(html).toContain("discord-embed__thumbnail")
    expect(html).toContain('class="discord-embed__field-row columns-2"')
    expect(html).toContain("Published")
    expect(html).toContain("Embed component")
    expect(html).toContain("Product demo")
    expect(html).toContain("<video")
    expect(html).toContain("guide.pdf")
    expect(html).toContain("Ship it?")
    expect(html).toContain("<meter")
    expect(html).toContain('aria-label="Reactions"')
    expect(html).toContain("👍: 3 reactions")
    expect(html).toContain('<span class="sr-only">👍: 3 reactions</span>')
    expect(html).toContain("size-4")
    expect(html).toContain("Sticker: Wave")
    expect(html).toContain("Show animated sticker")
    expect(html).toContain("V2 text")
    expect(html).toContain("Section text")
    expect(html).toContain("Gallery preview")
    expect(html).toContain("archive.zip")
    expect(html).toContain("<hr")
    expect(html).toContain("Unsupported archived component (type 99)")
    expect(html).toContain("<select")
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('href="https://example.com/action')
  })

  it("renders webhook identity, reference fallback, tags, and locked archive state", () => {
    const starter = messageFixture({
      author: { ...messageFixture().author, isStarterAuthor: true },
    })
    const reply = messageFixture({
      id: "101",
      author: {
        ...messageFixture().author,
        name: "Build hook",
        webhook: {
          id: "webhook",
          name: "Build hook",
          avatar: "https://cdn.example.com/hook.png",
        },
      },
      referenceId: "99",
      reference: { state: "unavailable", messageId: "99" },
    })
    const html = renderToStaticMarkup(
      <PublicThreadView
        thread={
          {
            id: "10",
            title: "A production thread",
            slug: "a_production_thread",
            createdAt: "2026-08-09T00:00:00.000Z",
            updatedAt: "2026-08-09T00:00:00.000Z",
            replyCount: 1,
            truncated: false,
            discordUrl: "https://discord.com/channels/1/2",
            parent: { id: "2", name: "support", type: 0 },
            state: {
              archived: true,
              archivedAt: "2026-08-09T00:00:00.000Z",
              locked: true,
            },
            tags: [
              {
                id: "tag",
                name: "Resolved",
                moderated: false,
                emojiId: "123",
                emojiName: "resolved",
              },
            ],
            server: {
              id: "1",
              name: "Community",
              description: null,
              memberCount: 10,
              icon: null,
              joinUrl: null,
              canonicalDomain: null,
            },
            starter,
            replies: [reply],
            backlinks: [],
            description: "Thread",
            canonical: {
              origin: "https://example.com",
              url: "https://example.com/thread/10/a_production_thread",
              markdownUrl:
                "https://example.com/thread/10/a_production_thread.md",
              imageUrl: "https://example.com/og?id=10",
              usesCustomDomain: false,
            },
          } as Parameters<typeof PublicThreadView>[0]["thread"]
        }
      />
    )

    expect(html).toContain("Build hook")
    expect(html).toContain("Webhook")
    expect(html).toContain("Original message was deleted")
    expect(html).toContain("Locked")
    expect(html).toContain("Archived")
    expect(html).toContain("Resolved")
    expect(html).toContain("Did this answer your question?")
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain("<span>Yes</span>")
    expect(html).toContain("<span>No</span>")
    expect(html).not.toContain("assets/svg/1f44d.svg")
    expect(html).not.toContain("assets/svg/1f44e.svg")
    expect(html).toContain("Loading feedback options.")
    expect(html).toContain(
      'src="https://cdn.discordapp.com/emojis/123.webp?size=32"'
    )
    expect(html).toContain('src="https://cdn.example.com/hook.png"')
  })

  it("renders forwarded snapshots with their archived rich content", () => {
    const message = messageFixture({
      snapshot: {
        id: null,
        forwardedInMessageId: "100",
        content: "Forwarded details from <@123>",
        type: 0,
        createdTimestamp: 1,
        editedTimestamp: null,
        attachments: [],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: 2,
                disabled: false,
                label: "Snapshot action",
              },
            ],
          },
        ],
        stickers: null,
        embeds: [{ type: EmbedType.Rich, title: "Snapshot embed" }],
        flags: 0,
        metadata: null,
        mentions: {
          users: [
            { id: "123", state: "available", name: "Ada", source: "snapshot" },
          ],
          channels: [],
          roles: [],
        },
      },
    })

    const html = renderToStaticMarkup(
      <DiscordMessageContent message={message} />
    )

    expect(html).toContain("Forwarded")
    expect(html).toContain("Forwarded details")
    expect(html).toContain("@Ada")
    expect(html).toContain("Snapshot embed")
    expect(html).toContain("Snapshot action")
    expect(html).toContain('disabled=""')
  })

  it("ignores malformed embed timestamps", () => {
    const html = renderToStaticMarkup(
      <DiscordMessageContent
        message={messageFixture({
          embeds: [{ type: EmbedType.Rich, timestamp: "not-a-date" }],
        })}
      />
    )

    expect(html).not.toContain("not-a-date")
    expect(html).not.toContain("<time")
  })
})

function messageFixture(
  overrides: Partial<PublicThreadMessage> = {}
): PublicThreadMessage {
  return {
    id: "100",
    createdAt: "2026-08-09T00:00:00.000Z",
    content: "Message",
    referenceId: null,
    metadata: null,
    embeds: null,
    poll: null,
    components: null,
    snapshot: null,
    stickers: null,
    author: {
      name: "Ada",
      avatar: null,
      isBot: false,
      isStarterAuthor: false,
      webhook: null,
    },
    type: 0,
    pinned: false,
    flags: 0,
    applicationId: null,
    interactionId: null,
    reference: null,
    mentions: { users: [], channels: [], roles: [] },
    reactions: null,
    attachments: [],
    ...overrides,
  }
}
