import { describe, expect, it, vi } from "vitest"

const createBotInvite = vi.fn()

vi.mock("@repo/db/helpers/servers", () => ({ createBotInvite }))

const {
  InviteAlreadyClaimed,
  InvitePreparationUnavailable,
  prepareServerInvite,
} = await import("./invite.server")

describe("server invite preparation", () => {
  it("classifies an active competing installer", async () => {
    createBotInvite.mockRejectedValueOnce(
      new Error("A different user is already installing this server")
    )
    const result = await prepareServerInvite({ userId: "1", serverId: "2" })

    expect(result.isErr() && result.error).toBeInstanceOf(InviteAlreadyClaimed)
  })

  it("does not expose unexpected repository errors", async () => {
    createBotInvite.mockRejectedValueOnce(new Error("connection secret"))
    const result = await prepareServerInvite({ userId: "1", serverId: "2" })

    expect(result.isErr() && result.error).toBeInstanceOf(
      InvitePreparationUnavailable
    )
    expect(result.isErr() && result.error.message).toBe(
      "This server could not be prepared. Try again."
    )
  })
})
