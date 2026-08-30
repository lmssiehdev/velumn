import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { PublicThreadMessage, PublicThreadPage } from "./contracts"
import { PublicThreadView } from "./thread"

describe("PublicThreadView states", () => {
  it("renders zero replies with injected actions in their requested positions", () => {
    const html = renderToStaticMarkup(
      <PublicThreadView
        afterStarter={<div>Starter actions</div>}
        footer={<div>Bottom continuation</div>}
        showFeedback={false}
        showServerInfo={false}
        thread={threadFixture()}
      />
    )

    expect(html).toContain("0 Replies")
    expect(html.indexOf("Message 100")).toBeLessThan(
      html.indexOf("Starter actions")
    )
    expect(html.indexOf("Starter actions")).toBeLessThan(
      html.indexOf("0 Replies")
    )
    expect(html.indexOf("0 Replies")).toBeLessThan(
      html.indexOf("Bottom continuation")
    )
  })

  it("renders truncation, reference privacy states, and chronological backlinks", () => {
    const unavailable = messageFixture("102", {
      content: "Unavailable reference",
      referenceId: "90",
      reference: { state: "unavailable", messageId: "90" },
    })
    const redacted = messageFixture("104", {
      content: "Redacted reference",
      referenceId: "91",
      reference: { state: "redacted", messageId: "91" },
    })
    const available = messageFixture("106", {
      content: "Available reference",
      referenceId: "92",
      reference: {
        state: "available",
        messageId: "92",
        message: {
          id: "92",
          createdAt: "2026-08-09T00:00:00.000Z",
          content: "Quoted details",
          author: { name: "Grace", isBot: false },
        },
      },
    })
    const html = renderToStaticMarkup(
      <PublicThreadView
        showFeedback={false}
        showServerInfo={false}
        thread={threadFixture({
          backlinks: [
            {
              fromMessageId: "103",
              createdAt: "2026-08-09T00:00:00.000Z",
              thread: { id: "200", title: "Related thread", slug: "related" },
              author: { name: "Lin", isBot: false },
            },
          ],
          replies: [unavailable, redacted, available],
          replyCount: 103,
          truncated: true,
        })}
      />
    )

    expect(html).toContain("Original message was deleted")
    expect(html).toContain("Original message is private")
    expect(html).toContain("@Grace")
    expect(html).toContain("Quoted details")
    expect(html).toContain("Related thread")
    expect(html).toContain("Some messages are not included")
    expect(html.indexOf("Unavailable reference")).toBeLessThan(
      html.indexOf("Related thread")
    )
    expect(html.indexOf("Related thread")).toBeLessThan(
      html.indexOf("Redacted reference")
    )
  })

  it("groups canonical board, tags, and thread state in one metadata row", () => {
    const html = renderToStaticMarkup(
      <PublicThreadView
        presentation="canonical"
        showFeedback={false}
        showServerInfo={false}
        thread={threadFixture({
          state: {
            archived: true,
            archivedAt: "2026-08-09T00:00:00.000Z",
            locked: true,
          },
          tags: [
            {
              id: "1",
              name: "Bug/Glitch",
              moderated: false,
              emojiId: null,
              emojiName: null,
            },
            {
              id: "2",
              name: "A very long status label that must not break the header",
              moderated: false,
              emojiId: null,
              emojiName: "✅",
            },
          ],
        })}
      />
    )

    expect(html).toContain('aria-label="Thread metadata"')
    expect(html).toContain("Bug/Glitch")
    expect(html).toContain("✅")
    expect(html).toContain("Locked")
    expect(html).toContain("Archived")
    expect(html).toContain('title="support"')
  })
})

function threadFixture(
  overrides: Partial<PublicThreadPage> = {}
): PublicThreadPage {
  return {
    id: "100",
    title: "Thread title",
    slug: "thread_title",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    replyCount: 0,
    truncated: false,
    discordUrl: "https://discord.com/channels/1/2/100",
    parent: { id: "2", name: "support", type: 0 },
    state: { archived: false, archivedAt: null, locked: false },
    tags: [],
    server: {
      id: "1",
      name: "Community",
      description: null,
      memberCount: 10,
      icon: null,
      joinUrl: null,
      canonicalDomain: null,
    },
    starter: messageFixture("100", {
      author: { ...messageFixture("100").author, isStarterAuthor: true },
    }),
    replies: [],
    backlinks: [],
    ...overrides,
  }
}

function messageFixture(
  id: string,
  overrides: Partial<PublicThreadMessage> = {}
): PublicThreadMessage {
  return {
    id,
    createdAt: "2026-08-09T00:00:00.000Z",
    content: `Message ${id}`,
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
