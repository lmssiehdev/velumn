import { QueryClientProvider } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { DashboardShell } from "@/components/dashboard-shell"
import { getDashboardShell } from "@/features/dashboard/server"

export const Route = createFileRoute("/dashboard/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { getSession } = await import("@/lib/auth-functions")
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/dashboard/sign-in",
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
  const { queryClient } = Route.useRouteContext()

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell shell={shell} />
    </QueryClientProvider>
  )
}
