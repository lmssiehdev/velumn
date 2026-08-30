import { getDashboardThreadPage } from "@repo/db/helpers/dashboard-threads"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authorizeManagementServer } from "@/features/dashboard/server-context"
import {
  getForumUrl,
  getThreadUrl,
  toServerIdentity,
} from "@/features/dashboard/urls"
import {
  THREAD_PAGE_SIZE_LIMIT,
  threadChannelIdsSchema,
  threadDirectionSchema,
  threadPinnedSchema,
  threadQuerySchema,
  threadSortSchema,
} from "./search"

const requestSchema = z.object({
  serverId: discordSnowflakeSchema,
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(THREAD_PAGE_SIZE_LIMIT),
  search: threadQuerySchema,
  channelIds: threadChannelIdsSchema,
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
