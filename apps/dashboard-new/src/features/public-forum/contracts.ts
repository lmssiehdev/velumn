export type PublicForumScope =
  | { kind: "server"; id: string }
  | { kind: "channel"; id: string }

export type PublicForumInput = PublicForumScope & {
  cursor?: string
}

export type PublicForumShell = {
  server: {
    id: string
    name: string
    description: string | null
    memberCount: number
    icon: string | null
    joinUrl: string | null
    canonicalDomain: string | null
  }
  channels: Array<{
    id: string
    name: string
    type: number
  }>
}

export type PublicForumPage = PublicForumShell & {
  activeChannelId: string | null
  threads: Array<{
    id: string
    title: string
    author: string
    channel: { id: string; name: string }
    pinned: boolean
    messageCount: number
  }>
  cursor: string | null
  nextCursor: string | null
  canonicalUrl: string
  customDomain: string | null
}

export function validatePublicForumInput(value: unknown): PublicForumInput {
  if (!isRecord(value)) throw new Error("Invalid public forum input")
  const kind = value.kind
  const id = value.id
  const cursor = value.cursor
  if (
    (kind !== "server" && kind !== "channel") ||
    !isSnowflake(id) ||
    (cursor !== undefined && !isSnowflake(cursor))
  ) {
    throw new Error("Invalid public forum input")
  }
  return { kind, id, cursor }
}

export function parsePublicForumSearch(search: Record<string, unknown>): {
  cursor?: string
} {
  return isSnowflake(search.cursor) ? { cursor: search.cursor } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,20}$/.test(value)
}
