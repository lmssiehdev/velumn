import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { getChannelsPage, saveChannelSelection } from "./server"

export type ChannelsPageResult = Awaited<ReturnType<typeof getChannelsPage>>
export type ChannelsPageData = Extract<
  ChannelsPageResult,
  { status: "ok" }
>["data"]

export const channelQueryKeys = {
  all: ["channels"] as const,
  page: (userId: string, serverId: string) =>
    [...channelQueryKeys.all, "page", userId, serverId] as const,
}

export function channelsPageQueryOptions(userId: string, serverId: string) {
  return queryOptions({
    queryKey: channelQueryKeys.page(userId, serverId),
    queryFn: () => getChannelsPage({ data: { serverId } }),
  })
}

export function useSaveChannelSelection(userId: string, serverId: string) {
  const queryClient = useQueryClient()
  const queryKey = channelQueryKeys.page(userId, serverId)

  return useMutation({
    mutationFn: (channels: Array<{ id: string; indexingEnabled: boolean }>) =>
      saveChannelSelection({ data: { serverId, channels } }),
    onSuccess: (result) => {
      if (result.status !== "ok") return
      queryClient.setQueryData<ChannelsPageResult>(queryKey, (current) =>
        current?.status === "ok"
          ? {
              ...current,
              data: { ...current.data, channels: result.data },
            }
          : current
      )
    },
  })
}
