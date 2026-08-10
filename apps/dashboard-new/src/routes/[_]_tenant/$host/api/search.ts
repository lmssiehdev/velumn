import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/__tenant/$host/api/search")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { handleTenantPublicSearch } =
          await import("@/features/public-search/server")
        return handleTenantPublicSearch(request, params.host)
      },
    },
  },
})
