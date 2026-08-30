import { getDashboardChannels } from "@repo/db/helpers/dashboard-channels"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authorizeManagementServer } from "@/features/dashboard/server-context"
import { toServerIdentity } from "@/features/dashboard/urls"

import {
  ChannelSelectionChanged,
  ChannelSelectionRequired,
  validateAndPersistChannelSelection,
} from "./selection.server"

export const getChannelsPage = createServerFn({ method: "GET" })
  .validator(z.object({ serverId: discordSnowflakeSchema }))
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
      serverId: discordSnowflakeSchema,
      channels: z
        .array(
          z.object({
            id: discordSnowflakeSchema,
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
    const selectedChannelIds = data.channels
      .filter((channel) => channel.indexingEnabled)
      .map((channel) => channel.id)
    const result = await validateAndPersistChannelSelection({
      availableChannelIds: currentChannels.map((channel) => channel.id),
      selectedChannelIds,
      serverId: data.serverId,
      submittedChannelIds: data.channels.map((channel) => channel.id),
    })
    if (result.isErr()) {
      const code =
        result.error instanceof ChannelSelectionChanged
          ? ("invalid_channels" as const)
          : result.error instanceof ChannelSelectionRequired
            ? ("channel_required" as const)
            : ("save_unavailable" as const)
      return {
        status: "error" as const,
        code,
        message: result.error.message,
      }
    }

    return {
      status: "ok" as const,
      data: currentChannels.map((channel) => ({
        ...channel,
        indexingEnabled: selectedChannelIds.includes(channel.id),
      })),
    }
  })
