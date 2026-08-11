import { describe, expect, it } from "vitest"

import { getTrustedClientIp } from "./client-ip.server"

describe("trusted client IP", () => {
  it("uses Vercel's forwarded address", () => {
    expect(
      getTrustedClientIp(
        new Headers({ "x-vercel-forwarded-for": "2001:db8::8" }),
        "velumn.com"
      )
    ).toBe("2001:db8::8")
  })

  it("does not trust generic forwarding headers", () => {
    expect(
      getTrustedClientIp(
        new Headers({ "x-forwarded-for": "203.0.113.8" }),
        "velumn.com"
      )
    ).toBeNull()
  })

  it("allows local development without proxy headers", () => {
    expect(getTrustedClientIp(new Headers(), "localhost")).toBe("127.0.0.1")
  })
})
