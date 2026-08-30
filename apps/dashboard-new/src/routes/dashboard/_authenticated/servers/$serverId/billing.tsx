import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { CircleAlert } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { BillingPage, BillingPending } from "@/features/dashboard/billing-page"
import { billingPageQueryOptions } from "@/features/dashboard/billing.queries"

type BillingSearch = {
  checkout?: "success"
  checkout_id?: string
}

const billingSearchSchema = z.object({
  checkout: z.literal("success").optional().catch(undefined),
  checkout_id: z.uuid().optional().catch(undefined),
})

export const Route = createFileRoute(
  "/dashboard/_authenticated/servers/$serverId/billing"
)({
  validateSearch: (
    search: Parameters<typeof billingSearchSchema.parse>[0]
  ): BillingSearch => billingSearchSchema.parse(search),
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(
      billingPageQueryOptions(context.user.id, params.serverId)
    )
    if (result.status === "error") {
      if (result.code === "setup_required") {
        throw redirect({
          to: "/dashboard/servers/$serverId/setup",
          params: { serverId: params.serverId },
        })
      }
      throw notFound()
    }
    return result
  },
  pendingComponent: BillingPending,
  component: BillingRoute,
})

function BillingRoute() {
  const { user } = Route.useRouteContext()
  const { serverId } = Route.useParams()
  const search = Route.useSearch()
  const [pollUntil] = useState(() =>
    search.checkout === "success" ? Date.now() + 60_000 : 0
  )
  const router = useRouter()
  const query = useQuery(billingPageQueryOptions(user.id, serverId, pollUntil))
  const result = query.data

  if (query.isError || !result || result.status === "error") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-xl border bg-card p-8 text-center">
          <CircleAlert className="mx-auto size-8 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Billing did not load</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Unable to load this server's billing settings. Retry or choose a
            different server.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.navigate({ to: "/dashboard/servers" })}
            >
              Switch server
            </Button>
            <Button onClick={() => query.refetch()}>Retry</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BillingPage
      data={result.data}
      serverId={serverId}
      userId={user.id}
      checkoutReturned={search.checkout === "success"}
      isRefreshing={query.isFetching}
      onRefresh={() => query.refetch()}
    />
  )
}
