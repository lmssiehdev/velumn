import { describe, expect, it } from "vitest"

import { safeReturnTo } from "./safe-return-to"

describe("safeReturnTo", () => {
  it("keeps internal dashboard paths", () => {
    expect(safeReturnTo("/servers/example/threads?page=2")).toBe(
      "/servers/example/threads?page=2"
    )
  })

  it.each([undefined, "https://attacker.example", "//attacker.example"])(
    "falls back for an unsafe return URL",
    (value) => {
      expect(safeReturnTo(value)).toBe("/servers")
    }
  )
})
