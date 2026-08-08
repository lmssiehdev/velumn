import { getDashboardServerForUser } from "@repo/db/helpers/dashboard-servers"

import { requireServerAuth } from "@/lib/server-auth"

import { getManagementAccess } from "./management-access"

type ManagementSurface = "channels" | "publishing" | "threads"

export async function authorizeManagementServer(
  serverId: string,
  surface: ManagementSurface
) {
  const { session } = await requireServerAuth()
  const server = await getDashboardServerForUser({
    userId: session.user.id,
    serverId,
  })
  const access = getManagementAccess(server?.lifecycle ?? null)

  if (!server || access === "not_found") {
    return {
      status: "error" as const,
      code: "server_not_found" as const,
      message: "The server could not be found.",
    }
  }
  if (access === "setup_required") {
    return {
      status: "error" as const,
      code: "setup_required" as const,
      message: `Finish setting up this server before managing ${surface}.`,
    }
  }
  return { status: "ok" as const, server }
}
