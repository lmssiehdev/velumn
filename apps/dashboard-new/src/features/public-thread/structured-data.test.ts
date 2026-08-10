import { describe, expect, it } from "vitest"

import type { PublicThreadPage } from "./contracts"
import {
  buildDiscussionForumPostingJsonLd,
  buildDiscussionForumPostingScripts,
  serializeJsonLd,
} from "./structured-data"

describe("DiscussionForumPosting structured data", () => {
  it("describes the canonical post and its replies", () => {
    const thread = {
      id: "123",
      title: "How do I publish this?",
      slug: "how-do-i-publish-this",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      replyCount: 1,
      truncated: false,
      discordUrl: "https://discord.com/channels/1/123",
      parent: { id: "2", name: "help", type: 0 },
      state: { archived: false, archivedAt: null, locked: false },
      tags: [],
      server: {
        id: "1",
        name: "Example",
        description: null,
        memberCount: 10,
        icon: null,
        joinUrl: null,
        canonicalDomain: null,
      },
      starter: message("123", "The original question", "Ada"),
      replies: [message("124", "The answer", "Grace")],
      backlinks: [],
      canonical: {
        origin: "https://velumn.com",
        url: "https://velumn.com/thread/123/how-do-i-publish-this",
      },
    } satisfies PublicThreadPage & {
      canonical: { origin: string; url: string }
    }

    const data = buildDiscussionForumPostingJsonLd(thread)

    expect(data).toMatchObject({
      "@type": "DiscussionForumPosting",
      headline: thread.title,
      interactionStatistic: { userInteractionCount: 1 },
      comment: [
        {
          "@type": "Comment",
          text: "The answer",
          author: { name: "Grace" },
        },
      ],
    })

    const [script] = buildDiscussionForumPostingScripts(thread)
    expect(script.type).toBe("application/ld+json")
    expect(JSON.parse(script.children)).toEqual(data)
  })

  it("omits invalid structured data for posts without text or an image", () => {
    const thread = {
      id: "123",
      title: "Poll only",
      slug: "poll-only",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      replyCount: 0,
      truncated: false,
      discordUrl: "https://discord.com/channels/1/123",
      parent: { id: "2", name: "help", type: 0 },
      state: { archived: false, archivedAt: null, locked: false },
      tags: [],
      server: {
        id: "1",
        name: "Example",
        description: null,
        memberCount: 10,
        icon: null,
        joinUrl: null,
        canonicalDomain: null,
      },
      starter: {
        ...message("123", "", "Ada"),
        attachments: [
          {
            id: "attachment-1",
            name: "notes.txt",
            url: "https://cdn.example.com/notes.txt",
            description: null,
            contentType: "text/plain",
            size: 10,
            width: null,
            height: null,
            isSnapshot: false,
          },
        ],
      },
      replies: [],
      backlinks: [],
      canonical: {
        origin: "https://velumn.com",
        url: "https://velumn.com/thread/123/poll-only",
      },
    } satisfies PublicThreadPage & {
      canonical: { origin: string; url: string }
    }

    expect(buildDiscussionForumPostingJsonLd(thread)).toBeNull()
    expect(buildDiscussionForumPostingScripts(thread)).toEqual([])
  })

  it("escapes markup that could terminate the script element", () => {
    expect(serializeJsonLd({ text: "</script>" })).toBe(
      '{"text":"\\u003c/script>"}'
    )
  })
})

function message(id: string, content: string, author: string) {
  return {
    id,
    createdAt: "2026-08-01T00:00:00.000Z",
    content,
    referenceId: null,
    metadata: null,
    embeds: null,
    poll: null,
    components: null,
    snapshot: null,
    stickers: null,
    author: {
      name: author,
      avatar: null,
      isBot: false,
      isStarterAuthor: id === "123",
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
  }
}
