import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params: _params,
    preload: _preload,
    to: _to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown
    preload?: boolean
    to?: string
  }) => <a {...props}>{children}</a>,
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock("@/features/public-search/community-search", () => ({
  CommunitySearch: () => <button type="button">Search community</button>,
}))

vi.mock("@/features/public-thread/thread", () => ({
  PublicThreadView: ({
    afterStarter,
    contentId,
    footer,
    thread,
  }: {
    afterStarter: React.ReactNode
    contentId: string
    footer: React.ReactNode
    thread: { title: string }
  }) => (
    <main id={contentId}>
      {thread.title}
      <div>Starter message</div>
      {afterStarter}
      <div>Replies</div>
      {footer}
    </main>
  ),
}))

vi.mock("./thread-redesign-actions", () => ({
  ThreadRedesignContinue: () => <div>Continue action</div>,
  ThreadRedesignFeedback: () => <div>Thread feedback</div>,
}))

const {
  ThreadRedesign,
  ThreadRedesignError,
  ThreadRedesignNotFound,
  ThreadRedesignPending,
} = await import("./thread-redesign")

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
  ],
}

const thread = {
  id: "1536470033692233848",
  title: "How do I configure this?",
  server: forum.server,
  parent: { id: "1228579842212106304", name: "general", type: 0 as const },
}

describe("thread redesign", () => {
  it("renders discussion context and marks its board active", () => {
    const html = renderToStaticMarkup(
      <ThreadRedesign
        forum={forum}
        thread={thread as Parameters<typeof ThreadRedesign>[0]["thread"]}
      />
    )

    expect(html).toContain("Skip to discussion")
    expect(html).toContain("Resurviv")
    expect(html).toContain("How do I configure this?")
    expect(html).toContain('id="redesign-thread"')
    expect(html).toContain("Thread feedback")
    expect(html).toContain("Continue action")
    expect(html.indexOf("Starter message")).toBeLessThan(
      html.indexOf("Thread feedback")
    )
    expect(html.indexOf("Thread feedback")).toBeLessThan(
      html.indexOf("Replies")
    )
    expect(html.indexOf("Replies")).toBeLessThan(
      html.indexOf("Continue action")
    )
    expect(html).toContain('aria-current="page"')
  })

  it("renders loading, not-found, and error states", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(renderToStaticMarkup(<ThreadRedesignPending />)).toContain(
      "Loading discussion"
    )
    expect(renderToStaticMarkup(<ThreadRedesignNotFound />)).toContain(
      "Thread not found"
    )
    expect(
      renderToStaticMarkup(<ThreadRedesignError error={new Error("offline")} />)
    ).toContain("Unable to load this discussion")
    consoleError.mockRestore()
  })
})
