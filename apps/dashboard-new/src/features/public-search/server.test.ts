import { describe, expect, it, vi } from "vitest"

import type { PublicSearchResponse } from "./contracts"
import {
  getTrustedRequestIp,
  handleCanonicalPublicSearch,
  handleTenantPublicSearch,
} from "./server"

process.env.DATABASE_URL ??= "postgres://localhost/velumn_test"

const serverId = "123456789012345678"
const threadId = "223456789012345678"
const response: PublicSearchResponse = {
  hits: [
    {
      id: "323456789012345678",
      threadId,
      title: "Effect services",
      channelName: "help",
      content: "How should this service be scoped?",
      isThreadStarter: true,
      timestamp: 1,
      threadUrl: `/thread/${threadId}/effect_services`,
      highlights: {
        title: [{ value: "Effect", highlighted: true }],
        content: [{ value: "service", highlighted: true }],
      },
    },
  ],
  estimatedTotalHits: 1,
  processingTimeMs: 2,
  query: "effect",
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://velumn.com/api/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://velumn.com",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe("public search resource handler", () => {
  it("resolves canonical scope before calling the search service", async () => {
    const search = vi.fn(async () => response)
    const resolveScope = vi.fn(async () => serverId)
    const result = await handleCanonicalPublicSearch(
      request({
        query: "effect",
        scope: { kind: "server", id: serverId },
      }),
      { clientIp: () => "203.0.113.5", search },
      resolveScope
    )

    expect(result.status).toBe(200)
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(await result.json()).toEqual(response)
    expect(resolveScope).toHaveBeenCalledWith({ kind: "server", id: serverId })
    expect(search).toHaveBeenCalledWith(
      serverId,
      "effect",
      "203.0.113.5",
      expect.any(AbortSignal)
    )
  })

  it("derives tenant authority only from the rewritten hostname", async () => {
    const search = vi.fn(async () => response)
    const resolveTenant = vi.fn(async () => serverId)
    const tenantRequest = new Request("https://docs.example.com/api/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://docs.example.com",
      },
      body: JSON.stringify({ query: "effect" }),
    })
    const result = await handleTenantPublicSearch(
      tenantRequest,
      "docs.example.com",
      { clientIp: () => "203.0.113.5", search },
      resolveTenant
    )

    expect(result.status).toBe(200)
    expect(resolveTenant).toHaveBeenCalledWith("docs.example.com")
    expect(search).toHaveBeenCalledWith(
      serverId,
      "effect",
      "203.0.113.5",
      expect.any(AbortSignal)
    )
  })

  it("rejects cross-origin, malformed, and oversized requests", async () => {
    const search = vi.fn(async () => response)
    const dependencies = { clientIp: () => "203.0.113.5", search }
    const resolveScope = vi.fn(async () => serverId)

    const crossOrigin = await handleCanonicalPublicSearch(
      request(
        { query: "effect", scope: { kind: "server", id: serverId } },
        { origin: "https://attacker.example" }
      ),
      dependencies,
      resolveScope
    )
    const malformed = await handleCanonicalPublicSearch(
      request({ query: "x", scope: { kind: "server", id: serverId } }),
      dependencies,
      resolveScope
    )
    const oversized = await handleCanonicalPublicSearch(
      request(
        { query: "effect", scope: { kind: "server", id: serverId } },
        { "content-length": "5000" }
      ),
      dependencies,
      resolveScope
    )

    expect(crossOrigin.status).toBe(403)
    expect(malformed.status).toBe(400)
    expect(oversized.status).toBe(413)
    expect(search).not.toHaveBeenCalled()
  })

  it("uses Vercel's spoof-resistant forwarded client address", () => {
    expect(
      getTrustedRequestIp(
        request(
          { query: "effect", scope: { kind: "server", id: serverId } },
          { "x-vercel-forwarded-for": "2001:db8::8" }
        )
      )
    ).toBe("2001:db8::8")
  })
})
