import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
    to,
  }: {
    children: React.ReactNode
    params?: Record<string, string>
    search?: Record<string, string>
    to?: string
  }) => (
    <a
      data-params={JSON.stringify(params)}
      data-search={JSON.stringify(search)}
      data-to={to}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock("@/features/public-search/community-search", () => ({
  CommunitySearch: () => <button type="button">Search community</button>,
}))

const {
  ForumRedesign,
  ForumRedesignError,
  ForumRedesignNotFound,
  ForumRedesignPending,
} = await import("./forum-redesign")

const forum = {
  server: {
    id: "1228579842212106302",
    name: "Resurviv",
    description: "A compact community forum.",
    memberCount: 1234,
    icon: null,
    joinUrl: null,
    canonicalDomain: null,
  },
  channels: [
    {
      id: "1228579842212106304",
      name: "general",
      type: 0 as const,
      position: 1,
      hasThreads: true,
      category: { id: "100", name: "Community", position: 1 },
    },
    {
      id: "1228579842212106305",
      name: "empty-board",
      type: 0 as const,
      position: 2,
      hasThreads: false,
      category: { id: "100", name: "Community", position: 1 },
    },
  ],
  activeChannelId: null,
  pinnedThreads: [
    {
      id: "1436470033692233848",
      title: "How do I configure this?",
      author: "builder",
      channel: { id: "1228579842212106304", name: "general" },
      pinned: true,
      messageCount: 3,
    },
  ],
  threads: [
    {
      id: "1536470033692233848",
      title: "A newer regular thread",
      author: "member",
      channel: { id: "1228579842212106304", name: "general" },
      pinned: false,
      messageCount: 1,
    },
  ],
  cursor: null,
  nextCursor: "1536470033692233848",
  canonicalUrl: "https://velumn.com/server/1228579842212106302",
  customDomain: null,
}

describe("forum redesign", () => {
  it("renders compact thread and board information", () => {
    const html = renderToStaticMarkup(<ForumRedesign forum={forum} />)

    expect(html).toContain("Resurviv")
    expect(html).toContain("How do I configure this?")
    expect(html).toContain("Pinned threads")
    expect(html).toContain("Latest threads")
    expect(html).toContain(">Discussions</h2>")
    expect(html.indexOf("How do I configure this?")).toBeLessThan(
      html.indexOf("A newer regular thread")
    )
    expect(html).toContain("2 replies")
    expect(html).toContain("Browse boards")
    expect(html).toContain("Community")
    expect(html).not.toContain("empty-board")
    expect(html).toContain("Older")
  })

  it("renders an empty forum state", () => {
    const html = renderToStaticMarkup(
      <ForumRedesign
        forum={{
          ...forum,
          pinnedThreads: [],
          threads: [],
          nextCursor: null,
        }}
      />
    )
    expect(html).toContain("No public threads yet")
  })

  it("keeps an active empty board visible and channel pagination scoped", () => {
    const html = renderToStaticMarkup(
      <ForumRedesign
        forum={{
          ...forum,
          activeChannelId: "1228579842212106305",
          cursor: "1536470033692233849",
          pinnedThreads: [],
          threads: [],
        }}
      />
    )

    expect(html).toContain("empty-board")
    expect(html).toContain("No older threads")
    expect(html).not.toContain("Pinned threads")
    expect(html).toContain('data-to="/channel/$channelId"')
    expect(html).toContain(
      'data-params="{&quot;channelId&quot;:&quot;1228579842212106305&quot;}"'
    )
  })

  it("renders loading, not-found, and error states", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(renderToStaticMarkup(<ForumRedesignPending />)).toContain(
      "Loading discussions"
    )
    expect(renderToStaticMarkup(<ForumRedesignNotFound />)).toContain(
      "Forum not found"
    )
    expect(
      renderToStaticMarkup(<ForumRedesignError error={new Error("offline")} />)
    ).toContain("Unable to load discussions")
    consoleError.mockRestore()
  })
})
