import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import {
  getBillingPage,
  openBillingPortal,
  startProCheckout,
} from "./billing-functions"

export type BillingPageResult = Awaited<ReturnType<typeof getBillingPage>>
export type BillingPageData = Extract<
  BillingPageResult,
  { status: "ok" }
>["data"]

export const billingQueryKeys = {
  all: ["dashboard", "billing"] as const,
  page: (userId: string, serverId: string) =>
    [...billingQueryKeys.all, userId, serverId] as const,
}

export function billingPageQueryOptions(
  userId: string,
  serverId: string,
  pollUntil = 0
) {
  return queryOptions({
    queryKey: billingQueryKeys.page(userId, serverId),
    queryFn: () => getBillingPage({ data: { serverId } }),
    refetchInterval: (query) => {
      const result = query.state.data
      return Date.now() < pollUntil &&
        result?.status === "ok" &&
        result.data.checkoutPending
        ? 3_000
        : false
    },
  })
}

export function useStartProCheckout(userId: string, serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => startProCheckout({ data: { serverId } }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: billingQueryKeys.page(userId, serverId),
      }),
  })
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: (serverId: string) => openBillingPortal({ data: { serverId } }),
  })
}
