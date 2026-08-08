import { setServerChannelSelection } from "@repo/db/helpers/channels"
import { getDashboardChannels } from "@repo/db/helpers/dashboard-channels"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authorizeManagementServer } from "@/features/dashboard/server-context"
import { toServerIdentity } from "@/features/dashboard/urls"

const serverIdSchema = z.string().regex(/^\d+$/)

export const getChannelsPage = createServerFn({ method: "GET" })
  .validator(z.object({ serverId: serverIdSchema }))
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "channels"
    )
    if (authorization.status === "error") return authorization

    const channels = await getDashboardChannels(data.serverId)
    return {
      status: "ok" as const,
      data: {
        server: toServerIdentity(authorization.server),
        disconnected: authorization.server.lifecycle === "bot_disconnected",
        channels,
      },
    }
  })

export const saveChannelSelection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      serverId: serverIdSchema,
      channels: z
        .array(
          z.object({
            id: serverIdSchema,
            indexingEnabled: z.boolean(),
          })
        )
        .min(1)
        .max(500),
    })
  )
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "channels"
    )
    if (authorization.status === "error") return authorization
    if (authorization.server.lifecycle === "bot_disconnected") {
      return {
        status: "error" as const,
        code: "bot_disconnected" as const,
        message: "Reconnect Discord before changing indexed channels.",
      }
    }
    const currentChannels = await getDashboardChannels(data.serverId)
    const submittedIds = new Set(data.channels.map((channel) => channel.id))
    if (
      submittedIds.size !== data.channels.length ||
      currentChannels.length !== data.channels.length ||
      currentChannels.some((channel) => !submittedIds.has(channel.id))
    ) {
      return {
        status: "error" as const,
        code: "invalid_channels" as const,
        message:
          "The channel list changed in Discord. Refresh and review your selection.",
      }
    }
    if (!data.channels.some((channel) => channel.indexingEnabled)) {
      return {
        status: "error" as const,
        code: "channel_required" as const,
        message: "Keep at least one channel enabled for indexing.",
      }
    }

    try {
      await setServerChannelSelection({
        serverId: data.serverId,
        channels: data.channels.map((channel) => ({
          channelId: channel.id,
          status: channel.indexingEnabled,
        })),
      })
      return {
        status: "ok" as const,
        data: currentChannels.map((channel) => ({
          ...channel,
          indexingEnabled:
            data.channels.find((submitted) => submitted.id === channel.id)
              ?.indexingEnabled ?? channel.indexingEnabled,
        })),
      }
    } catch {
      return {
        status: "error" as const,
        code: "invalid_channels" as const,
        message:
          "The channel list changed in Discord. Refresh and review your selection.",
      }
    }
  })
