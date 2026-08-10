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
  verification: (
    userId: string,
    serverId: string,
    domain: string,
    generation: number
  ) =>
    [
      ...publishingQueryKeys.all,
      "verification",
      userId,
      serverId,
      domain,
      generation,
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
  domain: string | null,
  lifecycleStatus: PublishingPageData["domainLifecycle"]["status"],
  generation: number
) {
  return queryOptions({
    queryKey: publishingQueryKeys.verification(
      userId,
      serverId,
      domain ?? "",
      generation
    ),
    queryFn: () => verifyPublishingDomain({ data: { serverId } }),
    enabled: Boolean(domain) && lifecycleStatus !== "removing",
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
                  domainLifecycle: {
                    status: result.data.lifecycleStatus,
                    generation: result.data.generation,
                  },
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
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: publishingQueryKeys.page(userId, serverId),
      }),
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
                  domainLifecycle: {
                    status: "unconfigured",
                    generation: current.data.domainLifecycle.generation + 1,
                  },
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
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: publishingQueryKeys.page(userId, serverId),
      }),
  })
}
