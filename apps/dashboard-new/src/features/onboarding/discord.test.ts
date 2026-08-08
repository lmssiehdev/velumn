import { PermissionFlagsBits } from "discord-api-types/v10"
import { describe, expect, it } from "vitest"

import {
  canManageDiscordGuild,
  getDiscordGuildIcon,
  sortDiscordGuilds,
  toInstallationState,
  type DiscordGuild,
} from "./discord"

function guild(overrides: Partial<DiscordGuild> = {}): DiscordGuild {
  return {
    id: "123456789012345678",
    name: "Velumn",
    icon: null,
    owner: false,
    permissions: "0",
    ...overrides,
  }
}

describe("Discord guild shaping", () => {
  it.each([
    guild({ owner: true }),
    guild({ permissions: PermissionFlagsBits.ManageGuild.toString() }),
    guild({ permissions: PermissionFlagsBits.Administrator.toString() }),
  ])("allows owners and server managers", (manageableGuild) => {
    expect(canManageDiscordGuild(manageableGuild)).toBe(true)
  })

  it("filters unmanageable guilds and sorts by name", () => {
    const manageable = PermissionFlagsBits.ManageGuild.toString()
    expect(
      sortDiscordGuilds([
        guild({ id: "3", name: "Zulu", permissions: manageable }),
        guild({ id: "2", name: "Hidden" }),
        guild({ id: "1", name: "Alpha", owner: true }),
      ]).map((item) => item.name)
    ).toEqual(["Alpha", "Zulu"])
  })

  it("builds static and animated Discord CDN icon URLs", () => {
    expect(getDiscordGuildIcon(guild({ icon: "hash" }))).toContain("hash.webp")
    expect(getDiscordGuildIcon(guild({ icon: "a_hash" }))).toContain(
      "a_hash.gif"
    )
    expect(getDiscordGuildIcon(guild())).toBeNull()
  })

  it.each([
    ["invite_required", "not_added"],
    ["waiting_for_bot", "awaiting_bot"],
    ["select_channels", "selecting_channels"],
    ["bot_disconnected", "bot_disconnected"],
    ["ready", "ready"],
  ] as const)("maps %s lifecycle to %s installation", (lifecycle, expected) => {
    expect(toInstallationState(lifecycle)).toBe(expected)
  })
})
