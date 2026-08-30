import type {
  PublicThreadMessage as DbPublicThreadMessage,
  PublicThreadPage as DbPublicThreadPage,
} from "@repo/db/helpers/public-content"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { z } from "zod"

export type PublicThreadParams = {
  threadId: string
  slug: string
}

export type PublicThreadMessage = DbPublicThreadMessage
export type PublicThreadPage = DbPublicThreadPage
export type ThreadVote = "upvote" | "downvote"

const publicThreadInputSchema = z.object({
  threadId: discordSnowflakeSchema,
})

const threadVoteInputSchema = publicThreadInputSchema.extend({
  type: z.enum(["upvote", "downvote"]),
})

const publicThreadParamsSchema = publicThreadInputSchema.extend({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9_]+$/),
})

export function validatePublicThreadInput(
  value: Parameters<typeof publicThreadInputSchema.safeParse>[0]
) {
  const parsed = publicThreadInputSchema.safeParse(value)
  if (!parsed.success) throw new Error("Invalid public thread input")
  return parsed.data
}

export function validateThreadVoteInput(
  value: Parameters<typeof threadVoteInputSchema.safeParse>[0]
) {
  const parsed = threadVoteInputSchema.safeParse(value)
  if (!parsed.success) throw new Error("Invalid thread vote input")
  return parsed.data
}

export function parsePublicThreadParams(
  value: Parameters<typeof publicThreadParamsSchema.safeParse>[0]
): PublicThreadParams | null {
  const parsed = publicThreadParamsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
