import type {
  PublicThreadMessage as DbPublicThreadMessage,
  PublicThreadPage as DbPublicThreadPage,
} from "@repo/db/helpers/public-content"

export type PublicThreadParams = {
  threadId: string
  slug: string
}

export type PublicThreadMessage = DbPublicThreadMessage
export type PublicThreadPage = DbPublicThreadPage
export type ThreadVote = "upvote" | "downvote"

export function validatePublicThreadInput(value: unknown) {
  if (!isRecord(value) || !isThreadId(value.threadId)) {
    throw new Error("Invalid public thread input")
  }
  return { threadId: value.threadId }
}

export function validateThreadVoteInput(value: unknown): {
  threadId: string
  type: ThreadVote
} {
  if (
    !isRecord(value) ||
    !isThreadId(value.threadId) ||
    (value.type !== "upvote" && value.type !== "downvote")
  ) {
    throw new Error("Invalid thread vote input")
  }
  return { threadId: value.threadId, type: value.type }
}

export function parsePublicThreadParams(
  value: unknown
): PublicThreadParams | null {
  if (
    !isRecord(value) ||
    !isThreadId(value.threadId) ||
    typeof value.slug !== "string" ||
    value.slug.length < 1 ||
    value.slug.length > 200 ||
    !/^[a-z0-9_]+$/.test(value.slug)
  ) {
    return null
  }
  return { threadId: value.threadId, slug: value.slug }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isThreadId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,20}$/.test(value)
}
