import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/server/")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
})
