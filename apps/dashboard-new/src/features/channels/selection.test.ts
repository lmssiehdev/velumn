import { describe, expect, it } from "vitest"

import {
  countSelectionChanges,
  filterChannels,
  selectionsEqual,
} from "./selection"

const channels = [
  { id: "1", name: "Community Help", type: "forum" as const },
  { id: "2", name: "general", type: "text" as const },
  { id: "3", name: "Product Help", type: "text" as const },
]

describe("channel selection", () => {
  it("filters by name and type together", () => {
    expect(filterChannels(channels, "help", "text")).toEqual([channels[2]])
    expect(filterChannels(channels, "HELP", "all")).toEqual([
      channels[0],
      channels[2],
    ])
  })

  it("compares selections without depending on insertion order", () => {
    expect(selectionsEqual(new Set(["1", "2"]), new Set(["2", "1"]))).toBe(true)
    expect(selectionsEqual(new Set(["1"]), new Set(["2"]))).toBe(false)
  })

  it("counts enabled and disabled changes", () => {
    expect(
      countSelectionChanges(new Set(["1", "2"]), new Set(["2", "3"]))
    ).toBe(2)
  })
})
