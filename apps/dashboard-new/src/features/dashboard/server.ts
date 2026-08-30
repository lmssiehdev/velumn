import type { DashboardServerProjection } from "@repo/db/helpers/dashboard-servers"
import {
  getDashboardServerForUser,
  getDashboardServersForUser,
} from "@repo/db/helpers/dashboard-servers"
import { getDashboardThreadPage } from "@repo/db/helpers/dashboard-threads"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { requireServerAuth } from "@/lib/server-auth"

import type {
  DashboardShell,
  ServerLifecycle,
  ServerListItem,
  ServerOverview,
  ThreadListItem,
} from "./contracts"
import {
  getForumUrl,
  getThreadUrl,
  hasVerifiedDomain,
  toServerIdentity,
} from "./urls"

const RECENT_THREAD_LIMIT = 5

/**
 * Every member currently has the same capabilities. `user_servers` has no role
 * column, so a truthful tier cannot be persisted; authorization is enforced by
 * membership rather than by this label.
 */
const MEMBER_ROLE = "manager" as const
const MEMBER_CAPABILITIES = ["manage_content", "manage_publishing"]

function toServerLifecycle(
  lifecycle: DashboardServerProjection["lifecycle"]
): ServerLifecycle {
  if (lifecycle === "ready") return "ready"
  if (lifecycle === "bot_disconnected") return "bot_disconnected"
  return "setup_required"
}

function toServerListItem(server: DashboardServerProjection): ServerListItem {
  return {
    ...toServerIdentity(server),
    role: MEMBER_ROLE,
    lifecycle: toServerLifecycle(server.lifecycle),
    enabledChannelCount: server.enabledChannelCount,
    indexedThreadCount: server.indexedThreadCount,
    // Not persisted by the current schema; surfaces omit it rather than guess.
    lastIndexedAt: null,
    forumUrl: getForumUrl(server),
  }
}

export const getDashboardShell = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardShell> => {
    const { session } = await requireServerAuth()
    const servers = await getDashboardServersForUser({
      userId: session.user.id,
    })

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
      servers: servers.map((server) => ({
        ...toServerIdentity(server),
        role: MEMBER_ROLE,
        capabilities: MEMBER_CAPABILITIES,
        lifecycle: toServerLifecycle(server.lifecycle),
      })),
      // No persisted preference exists yet.
      lastUsedServerId: null,
    }
  }
)

export const getServers = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<ServerListItem>> => {
    const { session } = await requireServerAuth()
    const servers = await getDashboardServersForUser({
      userId: session.user.id,
    })

    return servers.map(toServerListItem)
  }
)

export const getServerOverview = createServerFn({ method: "GET" })
  .validator(z.object({ serverId: discordSnowflakeSchema }))
  .handler(
    async ({
      data,
    }): Promise<
      | { status: "ok"; overview: ServerOverview }
      | { status: "error"; error: { code: string; message: string } }
    > => {
      const { session } = await requireServerAuth()
      const server = await getDashboardServerForUser({
        userId: session.user.id,
        serverId: data.serverId,
      })

      if (!server) {
        // Non-members and unknown servers are intentionally indistinguishable.
        return {
          status: "error",
          error: {
            code: "ServerNotFound",
            message: "The server could not be found.",
          },
        }
      }

      const threadPage = await getDashboardThreadPage({
        serverId: data.serverId,
        page: 1,
        pageSize: RECENT_THREAD_LIMIT,
        search: "",
        channelIds: [],
        pinned: "all",
        sort: "newest",
        direction: "desc",
      })
      const recent: Array<ThreadListItem> = threadPage.threads.map(
        (thread) => ({
          ...thread,
          // Per-thread index timestamps are not persisted.
          lastIndexedAt: null,
          discordUrl: `https://discord.com/channels/${data.serverId}/${thread.id}`,
          publicUrl: getThreadUrl(server, {
            id: thread.id,
            name: thread.title,
          }),
        })
      )

      return {
        status: "ok",
        overview: {
          server: toServerIdentity(server),
          forumUrl: getForumUrl(server),
          bot: {
            status:
              server.lifecycle === "bot_disconnected"
                ? "disconnected"
                : "connected",
            // No bot heartbeat is persisted.
            lastSeenAt: null,
          },
          indexing: {
            // No indexing job state is persisted; surfaces omit this.
            status: "unknown",
            lastSucceededAt: null,
            error: null,
          },
          channels: {
            eligible: server.eligibleChannelCount,
            enabled: server.enabledChannelCount,
          },
          threads: { total: threadPage.total, recent },
          publishing: {
            domain: hasVerifiedDomain(server) ? server.customDomain : null,
            status: hasVerifiedDomain(server)
              ? "verified"
              : server.customDomain
                ? "pending"
                : "default",
          },
        },
      }
    }
  )
