import {
  PENDING_INVITE_MAX_AGE_MS,
  resolveOnboardingLifecycle,
} from "@repo/db/lifecycle"
import { describe, expect, it } from "vitest"

const now = new Date("2026-08-04T12:00:00.000Z")

describe("resolveOnboardingLifecycle", () => {
  it.each([
    {
      name: "requires an invite when no installation exists",
      membership: null,
      pendingInvite: null,
      expected: "invite_required",
    },
    {
      name: "waits for a fresh invite owned by the current user",
      membership: null,
      pendingInvite: {
        userId: "user-1",
        updatedAt: new Date(now.getTime() - PENDING_INVITE_MAX_AGE_MS),
      },
      expected: "waiting_for_bot",
    },
    {
      name: "ignores another user's invite",
      membership: null,
      pendingInvite: { userId: "user-2", updatedAt: now },
      expected: "invite_required",
    },
    {
      name: "ignores an expired invite",
      membership: null,
      pendingInvite: {
        userId: "user-1",
        updatedAt: new Date(now.getTime() - PENDING_INVITE_MAX_AGE_MS - 1),
      },
      expected: "invite_required",
    },
    {
      name: "selects channels for an unfinished installation",
      membership: { finishedOnboarding: false, kickedAt: null },
      pendingInvite: null,
      expected: "select_channels",
    },
    {
      name: "is ready after onboarding finishes",
      membership: { finishedOnboarding: true, kickedAt: null },
      pendingInvite: null,
      expected: "ready",
    },
    {
      name: "prioritizes disconnection over completion",
      membership: { finishedOnboarding: true, kickedAt: now },
      pendingInvite: null,
      expected: "bot_disconnected",
    },
    {
      name: "waits for a reconnect invite on a disconnected installation",
      membership: { finishedOnboarding: true, kickedAt: now },
      pendingInvite: { userId: "user-1", updatedAt: now },
      expected: "waiting_for_bot",
    },
  ])("$name", ({ membership, pendingInvite, expected }) => {
    expect(
      resolveOnboardingLifecycle(
        { userId: "user-1", membership, pendingInvite },
        now
      )
    ).toBe(expected)
  })
})
