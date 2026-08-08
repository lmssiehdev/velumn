import { createFileRoute, redirect } from "@tanstack/react-router"

import { DashboardShell } from "@/components/dashboard-shell"
import { getDashboardShell } from "@/features/dashboard/server"
import { getSession } from "@/lib/auth-functions"

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: location.href },
      })
    }

    return { user: session.user }
  },
  loader: () => getDashboardShell(),
  component: DashboardLayout,
})

function DashboardLayout() {
  const shell = Route.useLoaderData()
  return <DashboardShell shell={shell} />
}
