import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import type { ThreadsSearch } from "./search"
import { normalizeThreadsSearch } from "./search"
import { getThreadsPage } from "./server"

export const threadQueryKeys = {
  all: ["threads"] as const,
  page: (userId: string, serverId: string, search: ThreadsSearch) =>
    [
      ...threadQueryKeys.all,
      "page",
      userId,
      serverId,
      normalizeThreadsSearch(search),
    ] as const,
}

export function threadsPageQueryOptions(
  userId: string,
  serverId: string,
  search: ThreadsSearch
) {
  const normalized = normalizeThreadsSearch(search)
  return queryOptions({
    queryKey: threadQueryKeys.page(userId, serverId, search),
    queryFn: () => getThreadsPage({ data: { serverId, ...normalized } }),
    placeholderData: keepPreviousData,
  })
}
