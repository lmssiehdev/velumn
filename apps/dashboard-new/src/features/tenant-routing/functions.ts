import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
  channelInputSchema,
  hostnameSchema,
  listInputSchema,
  threadInputSchema,
} from "./contracts"

export const getTenantForumHome = createServerFn({ method: "GET" })
  .validator(listInputSchema)
  .handler(async ({ data }) => {
    const { loadTenantForumHome } = await import("./repository.server")
    const forum = await loadTenantForumHome(data)
    if (!forum) throw notFound()
    return forum
  })

export const getTenantCanonicalOrigin = createServerFn({ method: "GET" })
  .validator(z.object({ hostname: hostnameSchema }))
  .handler(async ({ data }) => {
    const { loadTenantCanonicalOrigin } = await import("./repository.server")
    const origin = await loadTenantCanonicalOrigin(data.hostname)
    if (!origin) throw notFound()
    return origin
  })

export const getTenantForumChannel = createServerFn({ method: "GET" })
  .validator(channelInputSchema)
  .handler(async ({ data }) => {
    const { loadTenantForumChannel } = await import("./repository.server")
    const forum = await loadTenantForumChannel(data)
    if (!forum) throw notFound()
    return forum
  })

export const getTenantForumThread = createServerFn({ method: "GET" })
  .validator(threadInputSchema)
  .handler(async ({ data }) => {
    const { loadTenantThread } = await import("./repository.server")
    const thread = await loadTenantThread(data.hostname, data.threadId)
    if (!thread) throw notFound()
    return thread
  })
