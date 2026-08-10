import { describe, expect, it } from "vitest"

import { validateThreadVoteInput } from "./contracts"

describe("thread feedback validation", () => {
  it("accepts supported votes for Discord thread IDs", () => {
    expect(
      validateThreadVoteInput({ threadId: "123456789", type: "upvote" })
    ).toEqual({ threadId: "123456789", type: "upvote" })
    expect(
      validateThreadVoteInput({ threadId: "123456789", type: "downvote" })
    ).toEqual({ threadId: "123456789", type: "downvote" })
  })

  it("rejects unsupported vote payloads", () => {
    expect(() =>
      validateThreadVoteInput({ threadId: "not-a-thread", type: "upvote" })
    ).toThrow("Invalid thread vote input")
    expect(() =>
      validateThreadVoteInput({ threadId: "123456789", type: "maybe" })
    ).toThrow("Invalid thread vote input")
  })
})
