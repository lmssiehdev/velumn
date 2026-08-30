import { describe, expect, it, vi } from "vitest"

const setServerChannelSelection = vi.fn()

vi.mock("@repo/db/helpers/channels", () => ({ setServerChannelSelection }))

const {
  ChannelSelectionChanged,
  ChannelSelectionRequired,
  ChannelSelectionUnavailable,
  validateAndPersistChannelSelection,
} = await import("./selection.server")

describe("server channel selection", () => {
  it("persists a complete channel projection", async () => {
    setServerChannelSelection.mockResolvedValueOnce(undefined)
    const result = await validateAndPersistChannelSelection({
      availableChannelIds: ["1", "2", "3"],
      selectedChannelIds: ["1", "3"],
      serverId: "10",
    })

    expect(result.isOk()).toBe(true)
    expect(setServerChannelSelection).toHaveBeenCalledWith({
      serverId: "10",
      channels: [
        { channelId: "1", status: true },
        { channelId: "2", status: false },
        { channelId: "3", status: true },
      ],
    })
  })

  it("rejects stale, duplicate, and empty selections", async () => {
    const stale = await validateAndPersistChannelSelection({
      availableChannelIds: ["1", "2"],
      selectedChannelIds: ["3"],
      serverId: "10",
    })
    const duplicate = await validateAndPersistChannelSelection({
      availableChannelIds: ["1", "2"],
      selectedChannelIds: ["1", "1"],
      serverId: "10",
    })
    const empty = await validateAndPersistChannelSelection({
      availableChannelIds: ["1", "2"],
      selectedChannelIds: [],
      serverId: "10",
    })

    expect(stale.isErr() && stale.error).toBeInstanceOf(ChannelSelectionChanged)
    expect(duplicate.isErr() && duplicate.error).toBeInstanceOf(
      ChannelSelectionChanged
    )
    expect(empty.isErr() && empty.error).toBeInstanceOf(
      ChannelSelectionRequired
    )
  })

  it("keeps persistence failures separate from selection conflicts", async () => {
    setServerChannelSelection.mockRejectedValueOnce(new Error("database down"))
    const result = await validateAndPersistChannelSelection({
      availableChannelIds: ["1"],
      selectedChannelIds: ["1"],
      serverId: "10",
    })

    expect(result.isErr() && result.error).toBeInstanceOf(
      ChannelSelectionUnavailable
    )
  })
})
