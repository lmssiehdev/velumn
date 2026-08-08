import { describe, expect, it } from "vitest"

import {
  hasThreadFilters,
  normalizeThreadsSearch,
  threadsSearchSchema,
} from "./search"

describe("thread search state", () => {
  it("uses truthful default query values without adding URL state", () => {
    const search = threadsSearchSchema.parse({})

    expect(search).toEqual({})
    expect(normalizeThreadsSearch(search)).toEqual({
      search: "",
      channelIds: [],
      pinned: "all",
      sort: "newest",
      direction: "desc",
      page: 1,
      pageSize: 20,
    })
  })

  it("normalizes channel IDs for stable query keys", () => {
    expect(
      normalizeThreadsSearch({
        channels: ["300", "100", "300", "200"],
      }).channelIds
    ).toEqual(["100", "200", "300"])
  })

  it("falls back safely for invalid URL values", () => {
    const search = threadsSearchSchema.parse({
      page: "not-a-page",
      pinned: "maybe",
      sort: "indexedAt",
      direction: "sideways",
      channels: ["not-a-snowflake"],
    })

    expect(normalizeThreadsSearch(search)).toMatchObject({
      page: 1,
      pinned: "all",
      sort: "newest",
      direction: "desc",
      channelIds: [],
    })
  })

  it("coerces a valid page from the URL", () => {
    const search = threadsSearchSchema.parse({ page: "3" })
    expect(normalizeThreadsSearch(search).page).toBe(3)
  })

  it("distinguishes filters from pagination and sorting", () => {
    expect(hasThreadFilters({ page: 2, sort: "title" })).toBe(false)
    expect(hasThreadFilters({ q: "webhook" })).toBe(true)
    expect(hasThreadFilters({ channels: ["123"] })).toBe(true)
    expect(hasThreadFilters({ pinned: "pinned" })).toBe(true)
  })
})
