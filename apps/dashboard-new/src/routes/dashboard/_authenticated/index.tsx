import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/dashboard/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/servers" })
  },
})
