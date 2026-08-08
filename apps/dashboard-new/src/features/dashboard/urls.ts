import type { DashboardServerProjection } from "@repo/db/helpers/dashboard-servers"
import { buildHostUrl } from "@repo/utils/helpers/domains"
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify"

import { getDiscordGuildIcon } from "@/features/onboarding/discord"

const MAIN_SITE_HOST = "velumn.com"

export function toServerIdentity(server: DashboardServerProjection) {
  return {
    id: server.id,
    name: server.name,
    icon: getDiscordGuildIcon({ id: server.id, icon: server.icon }),
  }
}

export function hasVerifiedDomain(
  server: DashboardServerProjection
): server is DashboardServerProjection & { customDomain: string } {
  return Boolean(server.customDomain && server.domainVerified)
}

export function getForumUrl(server: DashboardServerProjection) {
  return hasVerifiedDomain(server)
    ? buildHostUrl(server.customDomain, "/")
    : buildHostUrl(MAIN_SITE_HOST, `/server/${server.id}`)
}

export function getThreadUrl(
  server: DashboardServerProjection,
  thread: { id: string; name: string }
) {
  const path = slugifyThreadUrl(thread)
  return hasVerifiedDomain(server)
    ? buildHostUrl(server.customDomain, path)
    : buildHostUrl(MAIN_SITE_HOST, path)
}
