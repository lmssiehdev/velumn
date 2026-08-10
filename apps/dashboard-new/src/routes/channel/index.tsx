import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/channel/")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
})
