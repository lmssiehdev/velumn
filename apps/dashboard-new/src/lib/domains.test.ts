import { normalizeDomain } from "@repo/utils/helpers/domains"
import { describe, expect, it } from "vitest"

describe("normalizeDomain", () => {
  it.each([
    ["Example.COM", "example.com"],
    ["HTTPS://Docs.Example.COM.", "docs.example.com"],
    ["  sub.Example.com.  ", "sub.example.com"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected)
  })

  it.each([
    "https://user@example.com",
    "https://user:password@example.com",
    "https://example.com:8443",
    "https://example.com/path",
    "https://example.com?query=value",
    "https://example.com#section",
    "127.0.0.1",
    "https://[2001:db8::1]",
    "*.example.com",
    "localhost",
    "internal",
    "bad_host.example.com",
    "-bad.example.com",
    "bad-.example.com",
    "bad..example.com",
    `${"a".repeat(64)}.example.com`,
    `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}.com`,
  ])("rejects invalid domain %s", (input) => {
    expect(() => normalizeDomain(input)).toThrow()
  })
})
