import { beforeEach, describe, expect, it, vi } from "vitest"

const getPublicForumShell = vi.fn()
const listPublicThreads = vi.fn()
const resolvePublicChannel = vi.fn()
const resolvePublicServer = vi.fn()

vi.mock("@repo/db/helpers/public-content", () => ({
  getPublicForumShell,
  listPublicThreads,
  resolvePublicChannel,
  resolvePublicServer,
}))

vi.mock("@/env.server", () => ({
  getHostRoutingEnv: () => ({ canonicalOrigin: "https://velumn.com" }),
}))

const { loadPublicForum } = await import("./server")

const serverId = "1228579842212106302"
const channelId = "1228579842212106304"
const cursor = "1536470033692233848"
const capability = { serverId }
const shell = {
  server: {
    id: serverId,
    name: "Community",
    description: null,
    memberCount: 10,
    icon: null,
    joinUrl: null,
    canonicalDomain: null,
  },
  channels: [
    {
      id: channelId,
      name: "general",
      type: 0,
      position: 0,
      hasThreads: true,
      category: null,
    },
  ],
}
const pinned = {
  id: "1436470033692233848",
  title: "Pinned guide",
  author: "moderator",
  channel: { id: channelId, name: "general" },
  pinned: true,
  messageCount: 2,
}
const regular = {
  id: cursor,
  title: "Latest question",
  author: "member",
  channel: { id: channelId, name: "general" },
  pinned: false,
  messageCount: 1,
}

describe("public forum loader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvePublicServer.mockResolvedValue(capability)
    resolvePublicChannel.mockResolvedValue(capability)
    getPublicForumShell.mockResolvedValue(shell)
  })

  it("returns scoped pinned threads separately from regular pagination", async () => {
    listPublicThreads.mockResolvedValue({
      pinnedItems: [pinned],
      items: [regular],
      nextCursor: regular.id,
    })

    const result = await loadPublicForum({ kind: "channel", id: channelId })

    expect(listPublicThreads).toHaveBeenCalledWith(capability, {
      channelId,
      cursor: undefined,
      limit: 20,
    })
    expect(result?.pinnedThreads).toEqual([pinned])
    expect(result?.threads).toEqual([regular])
    expect(result?.nextCursor).toBe(regular.id)
  })

  it("does not receive pinned threads on cursor pages", async () => {
    listPublicThreads.mockResolvedValue({
      pinnedItems: [],
      items: [regular],
      nextCursor: null,
    })

    const result = await loadPublicForum({
      kind: "server",
      id: serverId,
      cursor,
    })

    expect(listPublicThreads).toHaveBeenCalledWith(capability, {
      channelId: undefined,
      cursor,
      limit: 20,
    })
    expect(result?.pinnedThreads).toEqual([])
    expect(result?.cursor).toBe(cursor)
  })
})
