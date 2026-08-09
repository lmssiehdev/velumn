import { describe, expect, it } from "vitest"

import {
  canonicalPublicSearchRequestSchema,
  getPublicSearchScope,
  tenantPublicSearchRequestSchema,
} from "./contracts"

const serverId = "123456789012345678"

describe("public search contracts", () => {
  it("derives an explicit capability scope from public routes", () => {
    expect(getPublicSearchScope(`/server/${serverId}`)).toEqual({
      kind: "server",
      id: serverId,
    })
    expect(getPublicSearchScope(`/channel/${serverId}`)).toEqual({
      kind: "channel",
      id: serverId,
    })
    expect(getPublicSearchScope(`/thread/${serverId}/search-help`)).toEqual({
      kind: "thread",
      id: serverId,
    })
    expect(getPublicSearchScope("/pricing")).toBeNull()
  })

  it("trims bounded queries and rejects malformed scopes", () => {
    expect(
      canonicalPublicSearchRequestSchema.parse({
        query: "  effect scopes  ",
        scope: { kind: "server", id: serverId },
      })
    ).toEqual({
      query: "effect scopes",
      scope: { kind: "server", id: serverId },
    })
    expect(
      canonicalPublicSearchRequestSchema.safeParse({
        query: "x",
        scope: { kind: "server", id: "not-a-snowflake" },
      }).success
    ).toBe(false)
  })

  it("does not allow callers to select a tenant search scope", () => {
    expect(
      tenantPublicSearchRequestSchema.safeParse({
        query: "effect",
        scope: { kind: "server", id: serverId },
      }).success
    ).toBe(false)
  })
})
