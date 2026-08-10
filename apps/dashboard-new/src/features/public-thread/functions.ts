import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"

import { validatePublicThreadInput, validateThreadVoteInput } from "./contracts"
import { loadPublicThread, recordPublicThreadVote } from "./server"

export const getPublicThread = createServerFn({ method: "GET" })
  .validator(validatePublicThreadInput)
  .handler(async ({ data }) => {
    const thread = await loadPublicThread(data.threadId)
    if (!thread) throw notFound()
    return thread
  })

export const submitThreadVote = createServerFn({ method: "POST" })
  .validator(validateThreadVoteInput)
  .handler(async ({ data }) => {
    try {
      await recordPublicThreadVote(data.threadId, data.type)
      return { status: "ok" as const }
    } catch {
      return { status: "error" as const }
    }
  })
