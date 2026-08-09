import { describe, expect, it } from "vitest"

import { safeReturnTo } from "./safe-return-to"

describe("safeReturnTo", () => {
  it("keeps internal dashboard paths", () => {
    expect(
      safeReturnTo("/dashboard/servers/example/threads?page=2#message")
    ).toBe("/dashboard/servers/example/threads?page=2#message")
    expect(safeReturnTo("/dashboard")).toBe("/dashboard")
  })

  it.each([
    undefined,
    "https://attacker.example",
    "//attacker.example",
    "/dashboard-evil",
    "/dashboard/../api/auth/session",
    "/servers/example",
    "/pricing",
  ])("falls back for an unsafe return URL", (value) => {
    expect(safeReturnTo(value)).toBe("/dashboard/servers")
  })
})
