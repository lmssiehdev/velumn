import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"

import { validatePublicForumInput } from "@/features/public-forum/contracts"
import { loadThreadForumShell } from "./thread.server"

export const getThreadForumShell = createServerFn({ method: "GET" })
  .validator(validatePublicForumInput)
  .handler(async ({ data }) => {
    if (data.kind !== "server") throw notFound()
    const forum = await loadThreadForumShell(data.id)
    if (!forum) throw notFound()
    return forum
  })
