import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCanonicalPublicSearch } =
          await import("@/features/public-search/server")
        return handleCanonicalPublicSearch(request)
      },
    },
  },
})
