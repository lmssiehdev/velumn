import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"

import { validatePublicForumInput } from "./contracts"
import { loadPublicForum } from "./server"

export const getPublicForum = createServerFn({ method: "GET" })
  .validator(validatePublicForumInput)
  .handler(async ({ data }) => {
    const forum = await loadPublicForum(data)
    if (!forum) throw notFound()
    return forum
  })
