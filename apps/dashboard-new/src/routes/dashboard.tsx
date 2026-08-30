import { Outlet, createFileRoute } from "@tanstack/react-router"
import { Suspense, lazy } from "react"

import dashboardCss from "../dashboard.css?url"
import { publicEnv } from "@/env.public"

const DashboardDevtools = publicEnv.dev
  ? lazy(() => import("@/components/dashboard-devtools"))
  : null

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Velumn Dashboard" },
      {
        name: "description",
        content: "Manage your Velumn Discord publishing workspace.",
      },
    ],
    links: [{ rel: "stylesheet", href: dashboardCss }],
  }),
  component: DashboardRoute,
  notFoundComponent: DashboardNotFound,
})

function DashboardRoute() {
  return (
    <div className="dashboard-surface min-h-svh bg-background font-sans text-foreground antialiased">
      <Outlet />
      {DashboardDevtools ? (
        <Suspense fallback={null}>
          <DashboardDevtools />
        </Suspense>
      ) : null}
    </div>
  )
}

function DashboardNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          This page drifted out of view.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The dashboard route you requested does not exist or is no longer
          available.
        </p>
      </div>
    </main>
  )
}
