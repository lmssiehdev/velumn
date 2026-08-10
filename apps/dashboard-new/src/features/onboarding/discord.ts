import { PermissionFlagsBits } from "discord-api-types/v10"
import { z } from "zod"

import type { OnboardingLifecycle } from "@repo/db/lifecycle"
import type { EligibleDiscordServer } from "@/features/dashboard/contracts"

export const discordGuildSchema = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  icon: z.string().nullable(),
  owner: z.boolean(),
  permissions: z.string().regex(/^\d+$/),
})

export const discordGuildsSchema = z.array(discordGuildSchema)
export type DiscordGuild = z.infer<typeof discordGuildSchema>

export function canManageDiscordGuild(guild: DiscordGuild) {
  if (guild.owner) return true

  const permissions = BigInt(guild.permissions)
  return (
    (permissions & PermissionFlagsBits.Administrator) !== 0n ||
    (permissions & PermissionFlagsBits.ManageGuild) !== 0n
  )
}

export function getDiscordGuildIcon(guild: Pick<DiscordGuild, "id" | "icon">) {
  if (!guild.icon) return null

  const extension = guild.icon.startsWith("a_") ? "gif" : "webp"
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=128`
}

export function sortDiscordGuilds(guilds: Array<DiscordGuild>) {
  return guilds
    .filter(canManageDiscordGuild)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function toInstallationState(
  lifecycle: OnboardingLifecycle
): EligibleDiscordServer["installation"] {
  switch (lifecycle) {
    case "waiting_for_bot":
      return "awaiting_bot"
    case "select_channels":
      return "selecting_channels"
    case "bot_disconnected":
      return "bot_disconnected"
    case "ready":
      return "ready"
    case "invite_required":
      return "not_added"
  }
}
