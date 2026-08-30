import { captureOnboardingEvent } from "@repo/utils/onboarding-analytics"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import {
  checkIfServerExistsForUser,
  getChannelsInServer,
  getExistingThreadCountsByChannel,
  getOnboardingInstallationForUser,
  getOnboardingLifecyclesForUser,
} from "@repo/db/helpers/servers"
import { updateServerOnboarding } from "@repo/db/helpers/user"
import { createServerFn } from "@tanstack/react-start"
import { Result, TaggedError } from "better-result"
import { ChannelType, PermissionFlagsBits } from "discord-api-types/v10"
import { z } from "zod"

import { requireDiscordClientId } from "@/env.server"
import type {
  EligibleDiscordServer,
  ServerIdentity,
  ServerSetup,
} from "@/features/dashboard/contracts"
import { requireServerAuth } from "@/lib/server-auth"
import { createBotApiClient } from "@/lib/bot-api.server"

import { getDiscordGuildIcon, toInstallationState } from "./discord"
import { fetchDiscordGuilds, type DiscordGuildsResult } from "./discord-server"
import { InviteAlreadyClaimed, prepareServerInvite } from "./invite.server"
import {
  ChannelSelectionChanged,
  ChannelSelectionRequired,
  validateAndPersistChannelSelection,
} from "../channels/selection.server"

const serverIdSchema = discordSnowflakeSchema
const requiredPermissionCopy = [
  "View selected channels",
  "Read message history",
  "Create links back to Discord",
]
const botPermissions = [
  PermissionFlagsBits.CreateInstantInvite,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
].reduce((permissions, permission) => permissions | permission, 0n)

class InitialIndexUnavailable extends TaggedError("InitialIndexUnavailable")<{
  cause: unknown
  message: string
}> {}

export type EligibleDiscordServersResult =
  | { status: "ok"; servers: Array<EligibleDiscordServer> }
  | Extract<DiscordGuildsResult, { status: "error" }>

function toServerIdentity(guild: {
  id: string
  name: string
  icon: string | null
}): ServerIdentity {
  return {
    id: guild.id,
    name: guild.name,
    icon: getDiscordGuildIcon(guild),
  }
}

function createDiscordInviteUrl(serverId: string) {
  const clientId = requireDiscordClientId()

  const url = new URL("https://discord.com/oauth2/authorize")
  url.search = new URLSearchParams({
    client_id: clientId,
    permissions: botPermissions.toString(),
    scope: "bot applications.commands",
    guild_id: serverId,
    disable_guild_select: "true",
  }).toString()
  return url.toString()
}

async function requestInitialIndex(serverId: string) {
  const client = createBotApiClient()
  return Result.tryPromise({
    try: () => client.indexServer.mutate({ serverId }),
    catch: (cause) =>
      new InitialIndexUnavailable({
        cause,
        message: "Indexing could not start.",
      }),
  })
}

export const getEligibleDiscordServers = createServerFn({
  method: "GET",
}).handler(async (): Promise<EligibleDiscordServersResult> => {
  const context = await requireServerAuth()
  const guildsResult = await fetchDiscordGuilds(context)
  if (guildsResult.status === "error") return guildsResult

  const lifecycles = await getOnboardingLifecyclesForUser({
    userId: context.session.user.id,
    serverIds: guildsResult.guilds.map((guild) => guild.id),
  })
  const servers = guildsResult.guilds.map((guild): EligibleDiscordServer => {
    const lifecycle = lifecycles.get(guild.id) ?? "invite_required"

    return {
      ...toServerIdentity(guild),
      owner: guild.owner,
      canManage: true,
      installation: toInstallationState(lifecycle),
    }
  })

  return { status: "ok", servers }
})

async function resolveServerSetup(
  context: Awaited<ReturnType<typeof requireServerAuth>>,
  serverId: string
): Promise<ServerSetup> {
  const userId = context.session.user.id
  const installation = await getOnboardingInstallationForUser({
    userId,
    serverId,
  })
  const { lifecycle, membership } = installation

  if (membership?.server) {
    const server = toServerIdentity(membership.server)
    if (lifecycle === "waiting_for_bot") {
      return {
        state: "waiting_for_bot",
        server,
        lastCheckedAt: new Date().toISOString(),
        inviteUrl: createDiscordInviteUrl(serverId),
      }
    }
    if (lifecycle === "bot_disconnected") {
      return {
        state: "reconnect_required",
        server,
        requiredPermissions: requiredPermissionCopy,
      }
    }
    if (lifecycle === "ready") {
      return { state: "ready", serverId }
    }

    const channels = await getChannelsInServer(serverId)
    const threadCounts = await getExistingThreadCountsByChannel(
      serverId,
      channels.map((channel) => channel.id)
    )
    return {
      state: "select_channels",
      server,
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.channelName ?? "Unknown channel",
        type:
          channel.type === ChannelType.GuildForum
            ? ("forum" as const)
            : ("text" as const),
        selected: channel.indexingEnabled,
        existingThreadCount: threadCounts.get(channel.id) ?? 0,
      })),
    }
  }

  const guildsResult = await fetchDiscordGuilds(context)
  if (guildsResult.status === "error") {
    return {
      state: "failed",
      server: { id: serverId, name: "Discord server", icon: null },
      message: guildsResult.message,
      retryable: guildsResult.code === "discord_unavailable",
    }
  }

  const guild = guildsResult.guilds.find((item) => item.id === serverId)
  if (!guild) {
    return {
      state: "failed",
      server: { id: serverId, name: "Discord server", icon: null },
      message: "You no longer have permission to install this server.",
      retryable: false,
    }
  }

  const server = toServerIdentity(guild)
  if (lifecycle === "waiting_for_bot") {
    return {
      state: "waiting_for_bot",
      server,
      lastCheckedAt: new Date().toISOString(),
      inviteUrl: createDiscordInviteUrl(serverId),
    }
  }

  return {
    state: "invite_required",
    server,
    requiredPermissions: requiredPermissionCopy,
  }
}

export const getServerSetup = createServerFn({ method: "GET" })
  .validator(z.object({ serverId: serverIdSchema }))
  .handler(async ({ data }): Promise<ServerSetup> => {
    const context = await requireServerAuth()
    return resolveServerSetup(context, data.serverId)
  })

export const getServerSetupStatus = createServerFn({ method: "GET" })
  .validator(z.object({ serverId: serverIdSchema }))
  .handler(async ({ data }) => {
    const context = await requireServerAuth()
    const installation = await getOnboardingInstallationForUser({
      userId: context.session.user.id,
      serverId: data.serverId,
    })
    const setup =
      installation.lifecycle !== "waiting_for_bot"
        ? await resolveServerSetup(context, data.serverId)
        : null

    return {
      lifecycle: installation.lifecycle,
      checkedAt: new Date().toISOString(),
      setup,
    }
  })

export const createServerInvite = createServerFn({ method: "POST" })
  .validator(z.object({ serverId: serverIdSchema }))
  .handler(async ({ data }) => {
    const context = await requireServerAuth()
    const guildsResult = await fetchDiscordGuilds(context)
    if (guildsResult.status === "error") return guildsResult

    const guild = guildsResult.guilds.find((item) => item.id === data.serverId)
    if (!guild) {
      return {
        status: "error" as const,
        code: "forbidden" as const,
        message: "You do not have permission to install this server.",
      }
    }

    const invite = await prepareServerInvite({
      userId: context.session.user.id,
      serverId: data.serverId,
    })
    if (invite.isErr()) {
      return {
        status: "error" as const,
        code:
          invite.error instanceof InviteAlreadyClaimed
            ? ("invite_conflict" as const)
            : ("invite_unavailable" as const),
        message: invite.error.message,
      }
    }
    void captureOnboardingEvent({
      event: "discord_authorization_opened",
      serverId: data.serverId,
      userId: context.session.user.id,
    })
    return {
      status: "ok" as const,
      inviteUrl: createDiscordInviteUrl(data.serverId),
    }
  })

export const finishServerSetup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      serverId: serverIdSchema,
      selectedChannelIds: z.array(serverIdSchema).min(1),
    })
  )
  .handler(async ({ data }) => {
    const context = await requireServerAuth()
    const membership = await checkIfServerExistsForUser({
      userId: context.session.user.id,
      serverId: data.serverId,
    })
    if (!membership?.server) {
      return {
        status: "error" as const,
        code: "forbidden" as const,
        message: "You do not have access to this server.",
      }
    }
    if (membership.server.kickedAt) {
      return {
        status: "error" as const,
        code: "bot_disconnected" as const,
        message: "Reconnect the Discord bot before selecting channels.",
      }
    }

    const channels = await getChannelsInServer(data.serverId)
    const selection = await validateAndPersistChannelSelection({
      availableChannelIds: channels.map((channel) => channel.id),
      selectedChannelIds: data.selectedChannelIds,
      serverId: data.serverId,
    })
    if (selection.isErr()) {
      const code =
        selection.error instanceof ChannelSelectionChanged
          ? ("invalid_channels" as const)
          : selection.error instanceof ChannelSelectionRequired
            ? ("channel_required" as const)
            : ("save_unavailable" as const)
      return {
        status: "error" as const,
        code,
        message: selection.error.message,
      }
    }

    void captureOnboardingEvent({
      event: "channel_selection_submitted",
      properties: { channel_count: data.selectedChannelIds.length },
      serverId: data.serverId,
      userId: context.session.user.id,
    })

    const initialIndex = await requestInitialIndex(data.serverId)
    if (initialIndex.isErr()) {
      return {
        status: "error" as const,
        code: "indexing_unavailable" as const,
        message:
          "Your selection was saved, but indexing could not start. Try again.",
      }
    }
    void captureOnboardingEvent({
      event: "indexing_successfully_started",
      properties: { channel_count: data.selectedChannelIds.length },
      serverId: data.serverId,
      userId: context.session.user.id,
    })
    await updateServerOnboarding(context.session.user.id, data.serverId, true)
    return { status: "ok" as const }
  })
