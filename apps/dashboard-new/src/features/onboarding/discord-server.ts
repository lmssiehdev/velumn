import {
  discordGuildsSchema,
  sortDiscordGuilds as shapeDiscordGuilds,
} from "./discord"
import { getDiscordAccessToken } from "@/lib/server-auth"
import type { requireServerAuth } from "@/lib/server-auth"

type AuthContext = Awaited<ReturnType<typeof requireServerAuth>>

export type DiscordGuildsResult =
  | {
      status: "ok"
      guilds: ReturnType<typeof shapeDiscordGuilds>
    }
  | {
      status: "error"
      code: "discord_reauth_required" | "discord_unavailable"
      message: string
    }

async function requestDiscordGuilds(
  context: AuthContext,
  accessToken: string
): Promise<DiscordGuildsResult> {
  const requestGuilds = (token: string) =>
    fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
      headers: { Authorization: `Bearer ${token}` },
    })

  let response: Response
  try {
    response = await requestGuilds(accessToken)
    if (response.status === 401) {
      accessToken = await getDiscordAccessToken(context, true)
      response = await requestGuilds(accessToken)
    }
  } catch {
    return {
      status: "error",
      code: "discord_unavailable",
      message: "Discord could not be reached. Try again in a moment.",
    }
  }

  if (response.status === 401) {
    return {
      status: "error",
      code: "discord_reauth_required",
      message: "Reconnect Discord to refresh your server permissions.",
    }
  }
  if (!response.ok) {
    return {
      status: "error",
      code: "discord_unavailable",
      message: "Discord could not load your servers. Try again in a moment.",
    }
  }

  try {
    const guilds = discordGuildsSchema.parse(await response.json())
    return { status: "ok", guilds: shapeDiscordGuilds(guilds) }
  } catch {
    return {
      status: "error",
      code: "discord_unavailable",
      message: "Discord returned an unexpected server list. Try again.",
    }
  }
}

export async function fetchDiscordGuilds(
  context: AuthContext
): Promise<DiscordGuildsResult> {
  let accessToken: string
  try {
    accessToken = await getDiscordAccessToken(context)
  } catch {
    return {
      status: "error",
      code: "discord_reauth_required",
      message: "Reconnect Discord to refresh your server permissions.",
    }
  }

  return requestDiscordGuilds(context, accessToken)
}
