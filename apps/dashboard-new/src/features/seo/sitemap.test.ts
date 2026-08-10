import { describe, expect, it, vi } from "vitest"
import { encodeSitemapRange, parseSitemapRange } from "@repo/db/helpers/sitemap"

import {
  getTenantSitemapChunkResponse,
  getTenantSitemapResponse,
  type TenantSitemapDependencies,
} from "./sitemap.server"

describe("sitemap ranges", () => {
  it("round-trips bounded and final ranges", () => {
    expect(
      parseSitemapRange(
        encodeSitemapRange({ upperId: "600", lowerExclusiveId: "400" })
      )
    ).toEqual({ upperId: "600", lowerExclusiveId: "400" })
    expect(
      parseSitemapRange(
        encodeSitemapRange({ upperId: "400", lowerExclusiveId: null })
      )
    ).toEqual({ upperId: "400", lowerExclusiveId: null })
  })

  it.each([
    "",
    "1",
    "1-1",
    "1-2",
    "-1-0",
    "1.5-0",
    "1e3-0",
    "9223372036854775808-0",
    "10-9223372036854775808",
  ])("rejects invalid range %s", (value) => {
    expect(parseSitemapRange(value)).toBeNull()
  })
})

describe("tenant sitemap responses", () => {
  it("returns the tenant homepage and canonical threads for a small sitemap", async () => {
    const deps = tenantDependencies({
      partitions: [{ upperId: "600", lowerExclusiveId: null }],
      threads: [{ id: "500", name: "A useful thread" }],
    })

    const response = await getTenantSitemapResponse("docs.example.com", deps)
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/xml")
    expect(xml).toContain("<loc>https://docs.example.com/</loc>")
    expect(xml).toContain(
      "<loc>https://docs.example.com/thread/500/a-useful-thread</loc>"
    )
  })

  it("includes a homepage sitemap alongside large thread partitions", async () => {
    const deps = tenantDependencies({
      partitions: [
        { upperId: "600", lowerExclusiveId: "400" },
        { upperId: "400", lowerExclusiveId: null },
      ],
    })

    const indexResponse = await getTenantSitemapResponse(
      "docs.example.com",
      deps
    )
    const index = await indexResponse.text()
    expect(index).toContain(
      "<loc>https://docs.example.com/sitemap.xml/static</loc>"
    )
    expect(index).toContain(
      "<loc>https://docs.example.com/sitemap.xml/600-400</loc>"
    )

    const staticResponse = await getTenantSitemapChunkResponse(
      "docs.example.com",
      "static",
      deps
    )
    expect(await staticResponse.text()).toContain(
      "<loc>https://docs.example.com/</loc>"
    )
  })

  it("returns 404 without querying sitemap data for an unverified tenant", async () => {
    const deps = tenantDependencies({ verified: false })

    const response = await getTenantSitemapResponse("unknown.example.com", deps)

    expect(response.status).toBe(404)
    expect(deps.getPartitions).not.toHaveBeenCalled()
    expect(deps.getThreads).not.toHaveBeenCalled()
  })

  it("rejects malformed chunk ranges before resolving the tenant", async () => {
    const deps = tenantDependencies()

    const response = await getTenantSitemapChunkResponse(
      "docs.example.com",
      "not-a-range",
      deps
    )

    expect(response.status).toBe(404)
    expect(deps.resolveTenant).not.toHaveBeenCalled()
  })
})

function tenantDependencies(
  options: {
    verified?: boolean
    partitions?: Array<{ upperId: string; lowerExclusiveId: string | null }>
    threads?: Array<{ id: string; name: string | null }>
  } = {}
): TenantSitemapDependencies {
  const tenant = {
    origin: "https://docs.example.com",
    serverId: "123",
    threadUrl: (thread: { id: string; name: string | null }) =>
      `https://docs.example.com/thread/${thread.id}/${thread.name
        ?.toLowerCase()
        .replaceAll(" ", "-")}`,
  }

  return {
    resolveTenant: vi.fn(async () =>
      options.verified === false ? null : tenant
    ),
    getPartitions: vi.fn(async () => options.partitions ?? []),
    getThreads: vi.fn(async () => options.threads ?? []),
  }
}
