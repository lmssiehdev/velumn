import {
  getPublicForumShell,
  resolvePublicServer,
} from "@repo/db/helpers/public-content"

export async function loadThreadForumShell(serverId: string) {
  const capability = await resolvePublicServer(serverId)
  if (!capability) return null
  return getPublicForumShell(capability)
}
