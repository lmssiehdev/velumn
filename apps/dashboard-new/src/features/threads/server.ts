import { getDashboardThreadPage } from "@repo/db/helpers/dashboard-threads"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authorizeManagementServer } from "@/features/dashboard/server-context"
import {
  getForumUrl,
  getThreadUrl,
  toServerIdentity,
} from "@/features/dashboard/urls"

const serverIdSchema = z.string().regex(/^\d+$/)
const threadSortSchema = z.enum([
  "newest",
  "title",
  "parentChannel",
  "messageCount",
])
const threadDirectionSchema = z.enum(["asc", "desc"])
const threadPinnedSchema = z.enum(["pinned", "unpinned"])
const requestSchema = z.object({
  serverId: serverIdSchema,
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  search: z.string().max(100),
  channelIds: z.array(serverIdSchema).max(20),
  pinned: z.union([threadPinnedSchema, z.literal("all")]),
  sort: threadSortSchema,
  direction: threadDirectionSchema,
})

export const getThreadsPage = createServerFn({ method: "GET" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "threads"
    )
    if (authorization.status === "error") return authorization
    const { server } = authorization

    const page = await getDashboardThreadPage(data)
    return {
      status: "ok" as const,
      data: {
        server: toServerIdentity(server),
        disconnected: server.lifecycle === "bot_disconnected",
        forumUrl: getForumUrl(server),
        channels: page.channels,
        threads: page.threads.map((thread) => ({
          ...thread,
          lastIndexedAt: null,
          discordUrl: `https://discord.com/channels/${server.id}/${thread.id}`,
          publicUrl: getThreadUrl(server, {
            id: thread.id,
            name: thread.title,
          }),
        })),
        pagination: {
          page: page.page,
          pageSize: page.pageSize,
          total: page.total,
          totalPages: page.totalPages,
        },
        summary: page.summary,
      },
    }
  })
