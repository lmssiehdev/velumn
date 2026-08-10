const threadSorts = [
  "newest",
  "title",
  "parentChannel",
  "messageCount",
] as const
const threadDirections = ["asc", "desc"] as const
const threadPinnedFilters = ["pinned", "unpinned"] as const

export type ThreadsSearch = {
  q?: string
  channels?: string[]
  pinned?: (typeof threadPinnedFilters)[number]
  sort?: (typeof threadSorts)[number]
  direction?: (typeof threadDirections)[number]
  page?: number
}

export function parseThreadsSearch(search: Record<string, unknown>) {
  const query = typeof search.q === "string" ? search.q.trim() : undefined
  const channels =
    Array.isArray(search.channels) &&
    search.channels.length <= 20 &&
    search.channels.every(
      (channel): channel is string =>
        typeof channel === "string" && /^\d+$/.test(channel)
    )
      ? search.channels
      : undefined
  const page = Number(search.page)

  return {
    ...(query && query.length <= 100 ? { q: query } : {}),
    ...(channels ? { channels } : {}),
    ...(includes(threadPinnedFilters, search.pinned)
      ? { pinned: search.pinned }
      : {}),
    ...(includes(threadSorts, search.sort) ? { sort: search.sort } : {}),
    ...(includes(threadDirections, search.direction)
      ? { direction: search.direction }
      : {}),
    ...(Number.isInteger(page) && page > 0 ? { page } : {}),
  } satisfies ThreadsSearch
}

export const threadsSearchSchema = { parse: parseThreadsSearch }

function includes<const T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && values.includes(value)
}

export function normalizeThreadsSearch(search: ThreadsSearch) {
  const channels = [...new Set(search.channels ?? [])].sort()
  return {
    search: search.q?.trim() ?? "",
    channelIds: channels,
    pinned: search.pinned ?? ("all" as const),
    sort: search.sort ?? ("newest" as const),
    direction: search.direction ?? ("desc" as const),
    page: search.page ?? 1,
    pageSize: 20,
  }
}

export function hasThreadFilters(search: ThreadsSearch) {
  return Boolean(search.q || search.channels?.length || search.pinned)
}
