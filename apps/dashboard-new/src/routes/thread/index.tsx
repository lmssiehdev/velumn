import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/thread/")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
})
