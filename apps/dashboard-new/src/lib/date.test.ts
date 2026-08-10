import { afterEach, describe, expect, it, vi } from "vitest"

import {
  formatRelativeDate,
  formatUtcDate,
  formatUtcShortDateTime,
} from "./date"
import { formatDiscordTimestamp } from "@/features/public-thread/discord-date"

afterEach(() => {
  vi.useRealTimers()
})

describe("date formatting", () => {
  it("formats relative dates against the current time", () => {
    vi.useFakeTimers()
    vi.setSystemTime("2026-08-10T12:00:00.000Z")

    expect(formatRelativeDate("2026-08-10T11:55:00.000Z")).toBe("5 minutes ago")
    expect(formatRelativeDate("2026-08-11T12:00:00.000Z")).toBe("tomorrow")
  })

  it("keeps public dates stable in UTC", () => {
    const value = "2026-08-10T23:30:00.000-07:00"

    expect(formatUtcDate(value)).toBe("Aug 11, 2026")
    expect(formatUtcDate(value, "long")).toBe("August 11, 2026")
    expect(formatUtcShortDateTime(value)).toContain("8/11/26")
  })

  it("preserves Discord timestamp styles", () => {
    const value = String(Date.parse("2026-08-10T19:05:06.000Z") / 1000)

    expect(formatDiscordTimestamp(value, "t")).toBe("7:05 PM")
    expect(formatDiscordTimestamp(value, "T")).toBe("7:05:06 PM")
    expect(formatDiscordTimestamp(value, "d")).toBe("08/10/2026")
    expect(formatDiscordTimestamp(value, "D")).toBe("August 10, 2026")
  })
})
