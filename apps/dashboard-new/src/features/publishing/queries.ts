import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import {
  addPublishingDomain,
  getPublishingPage,
  removePublishingDomain,
  verifyPublishingDomain,
} from "./server"

export type PublishingPageResult = Awaited<ReturnType<typeof getPublishingPage>>
export type PublishingPageData = Extract<
  PublishingPageResult,
  { status: "ok" }
>["data"]
export type DomainVerificationResult = Awaited<
  ReturnType<typeof verifyPublishingDomain>
>
export type PublishingVerification = {
  status: "not_configured" | "pending" | "verified" | "failed"
  failureReason: "not_found" | "permission" | "unavailable" | null
  checkedAt: string | null
  message: string | null
  records: Array<{ type: string; name: string; value: string }>
}

export const publishingQueryKeys = {
  all: ["publishing"] as const,
  page: (userId: string, serverId: string) =>
    [...publishingQueryKeys.all, "page", userId, serverId] as const,
  verification: (userId: string, serverId: string, domain: string) =>
    [
      ...publishingQueryKeys.all,
      "verification",
      userId,
      serverId,
      domain,
    ] as const,
  serverVerification: (userId: string, serverId: string) =>
    [...publishingQueryKeys.all, "verification", userId, serverId] as const,
}

export function publishingPageQueryOptions(userId: string, serverId: string) {
  return queryOptions({
    queryKey: publishingQueryKeys.page(userId, serverId),
    queryFn: () => getPublishingPage({ data: { serverId } }),
  })
}

export function publishingVerificationQueryOptions(
  userId: string,
  serverId: string,
  domain: string | null
) {
  return queryOptions({
    queryKey: publishingQueryKeys.verification(userId, serverId, domain ?? ""),
    queryFn: () => verifyPublishingDomain({ data: { serverId } }),
    enabled: Boolean(domain),
    retry: false,
    refetchInterval: (query) => {
      const result = query.state.data
      return result?.status === "ok" && result.data.status === "pending"
        ? 60_000
        : false
    },
    refetchOnWindowFocus: false,
  })
}

export function useAddPublishingDomain(userId: string, serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (domain: string) =>
      addPublishingDomain({ data: { serverId, domain } }),
    onSuccess: (result) => {
      if (result.status !== "ok") return
      queryClient.setQueryData<PublishingPageResult>(
        publishingQueryKeys.page(userId, serverId),
        (current) =>
          current?.status === "ok"
            ? {
                ...current,
                data: {
                  ...current.data,
                  customDomain: result.data.domain,
                  canonicalUrl: current.data.defaultUrl,
                  verification: {
                    status: "pending",
                    failureReason: null,
                    checkedAt: null,
                    message:
                      "Verify the domain to load its current DNS requirements.",
                    records: [],
                  },
                },
              }
            : current
      )
    },
  })
}

export function useRemovePublishingDomain(userId: string, serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => removePublishingDomain({ data: { serverId } }),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: publishingQueryKeys.serverVerification(userId, serverId),
      })
    },
    onSuccess: (result) => {
      if (result.status !== "ok") return
      queryClient.setQueryData<PublishingPageResult>(
        publishingQueryKeys.page(userId, serverId),
        (current) =>
          current?.status === "ok"
            ? {
                ...current,
                data: {
                  ...current.data,
                  customDomain: null,
                  canonicalUrl: current.data.defaultUrl,
                  verification: {
                    status: "not_configured",
                    failureReason: null,
                    checkedAt: null,
                    message: null,
                    records: [],
                  },
                },
              }
            : current
      )
      void queryClient.invalidateQueries({
        queryKey: publishingQueryKeys.all,
      })
    },
  })
}
