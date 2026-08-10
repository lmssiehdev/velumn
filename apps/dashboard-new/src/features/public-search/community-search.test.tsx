import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { Command, CommandList } from "@/components/ui/command"
import type { PublicSearchResponse } from "./contracts"
import { PublicSearchRequestError, SearchContent } from "./community-search"

const noop = vi.fn()
const result: PublicSearchResponse = {
  hits: [
    {
      id: "323456789012345678",
      threadId: "223456789012345678",
      title: "Effect services",
      channelName: "help",
      content: "How should this service be scoped?",
      isThreadStarter: false,
      timestamp: 1,
      threadUrl:
        "/thread/223456789012345678/effect_services#323456789012345678",
      highlights: {
        title: [
          { value: "Effect", highlighted: true },
          { value: " services", highlighted: false },
        ],
        content: [
          { value: "How should this ", highlighted: false },
          { value: "service", highlighted: true },
          { value: " be scoped?", highlighted: false },
        ],
      },
    },
  ],
  estimatedTotalHits: 1,
  processingTimeMs: 2,
  query: "effect",
}

function render(
  props: Partial<React.ComponentProps<typeof SearchContent>> = {}
) {
  return renderToStaticMarkup(
    <Command shouldFilter={false}>
      <CommandList>
        <SearchContent
          data={undefined}
          error={null}
          input=""
          onClose={noop}
          onRetry={noop}
          searching={false}
          {...props}
        />
      </CommandList>
    </Command>
  )
}

describe("community search states", () => {
  it("orients people before searching and while a request is pending", () => {
    expect(render()).toContain("Start typing to search the community")
    expect(render({ input: "e" })).toContain(
      "Start typing to search the community"
    )
    expect(render({ input: "effect", searching: true })).toContain(
      "Searching discussions"
    )
  })

  it("provides recoverable unavailable and rate-limit states", () => {
    expect(render({ input: "effect", error: new Error("offline") })).toContain(
      "Check your connection and try again"
    )
    expect(
      render({ input: "effect", error: new PublicSearchRequestError(429) })
    ).toContain("Wait about a minute and try again")
  })

  it("renders native result links and text-only highlight markup", () => {
    const html = render({ input: "effect", data: result })
    expect(html).toContain(`href="${result.hits[0]?.threadUrl}"`)
    expect(html).toContain("<mark>Effect</mark>")
    expect(html).toContain("<mark>service</mark>")
    expect(html).not.toContain("dangerouslySetInnerHTML")
  })

  it("names the empty query in the no-results state", () => {
    const html = render({ input: "effect", data: { ...result, hits: [] } })
    expect(html).toContain("We couldn’t find anything for ")
    expect(html).toContain("<b>“effect”</b>")
  })
})
