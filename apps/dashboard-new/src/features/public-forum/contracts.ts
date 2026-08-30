import type { PublicForumShell as DbPublicForumShell } from "@repo/db/helpers/public-content"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { z } from "zod"

export type PublicForumScope =
  | { kind: "server"; id: string }
  | { kind: "channel"; id: string }

export type PublicForumInput = PublicForumScope & {
  cursor?: string
}

const publicForumInputSchema = z.object({
  kind: z.enum(["server", "channel"]),
  id: discordSnowflakeSchema,
  cursor: discordSnowflakeSchema.optional(),
})

const publicForumSearchSchema = z.object({
  cursor: discordSnowflakeSchema.optional().catch(undefined),
})

export type PublicForumShell = DbPublicForumShell

export type PublicForumPage = PublicForumShell & {
  activeChannelId: string | null
  pinnedThreads: PublicForumThread[]
  threads: PublicForumThread[]
  cursor: string | null
  nextCursor: string | null
  canonicalUrl: string
  customDomain: string | null
}

export type PublicForumThread = {
  id: string
  title: string
  author: string
  channel: { id: string; name: string }
  pinned: boolean
  messageCount: number
}

export function validatePublicForumInput(
  value: Parameters<typeof publicForumInputSchema.safeParse>[0]
): PublicForumInput {
  const parsed = publicForumInputSchema.safeParse(value)
  if (!parsed.success) throw new Error("Invalid public forum input")
  return parsed.data
}

export function parsePublicForumSearch(
  search: Parameters<typeof publicForumSearchSchema.parse>[0]
) {
  return publicForumSearchSchema.parse(search)
}
