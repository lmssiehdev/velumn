import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import {
  createServerInvite,
  finishServerSetup,
  getEligibleDiscordServers,
  getServerSetup,
  getServerSetupStatus,
} from "./server"

export const onboardingQueryKeys = {
  all: ["onboarding"] as const,
  eligibleServers: (userId: string) =>
    [...onboardingQueryKeys.all, "eligible-servers", userId] as const,
  setup: (userId: string, serverId: string) =>
    [...onboardingQueryKeys.all, "setup", userId, serverId] as const,
  setupStatus: (userId: string, serverId: string) =>
    [...onboardingQueryKeys.all, "setup-status", userId, serverId] as const,
}

export function eligibleDiscordServersQueryOptions(userId: string) {
  return queryOptions({
    queryKey: onboardingQueryKeys.eligibleServers(userId),
    queryFn: () => getEligibleDiscordServers(),
    staleTime: 60_000,
  })
}

export function serverSetupQueryOptions(userId: string, serverId: string) {
  return queryOptions({
    queryKey: onboardingQueryKeys.setup(userId, serverId),
    queryFn: () => getServerSetup({ data: { serverId } }),
  })
}

export function serverSetupStatusQueryOptions({
  enabled,
  serverId,
  userId,
}: {
  enabled: boolean
  serverId: string
  userId: string
}) {
  return queryOptions({
    queryKey: onboardingQueryKeys.setupStatus(userId, serverId),
    queryFn: () => getServerSetupStatus({ data: { serverId } }),
    enabled,
    refetchInterval: (query) =>
      !query.state.data || query.state.data.lifecycle === "waiting_for_bot"
        ? 3_000
        : false,
  })
}

export function useServerSetupMutations(userId: string, serverId: string) {
  const queryClient = useQueryClient()
  const invalidateSetup = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: onboardingQueryKeys.setup(userId, serverId),
      }),
      queryClient.invalidateQueries({
        queryKey: onboardingQueryKeys.setupStatus(userId, serverId),
      }),
      queryClient.invalidateQueries({
        queryKey: onboardingQueryKeys.eligibleServers(userId),
      }),
    ])

  const createInvite = useMutation({
    mutationFn: () => createServerInvite({ data: { serverId } }),
    onSuccess: (result) =>
      result.status === "ok" ? invalidateSetup() : undefined,
  })
  const finishSetup = useMutation({
    mutationFn: (selectedChannelIds: string[]) =>
      finishServerSetup({ data: { serverId, selectedChannelIds } }),
    onSuccess: (result) =>
      result.status === "ok" ? invalidateSetup() : undefined,
  })

  return { createInvite, finishSetup }
}
