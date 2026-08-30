import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { z } from "zod"

export const THREAD_CHANNEL_FILTER_LIMIT = 20
export const THREAD_PAGE_SIZE = 20
export const THREAD_PAGE_SIZE_LIMIT = 100
export const THREAD_SEARCH_LENGTH_LIMIT = 100

export const threadSorts = [
  "newest",
  "title",
  "parentChannel",
  "messageCount",
] as const
export const threadDirections = ["asc", "desc"] as const
export const threadPinnedFilters = ["pinned", "unpinned"] as const
export const threadSortSchema = z.enum(threadSorts)
export const threadDirectionSchema = z.enum(threadDirections)
export const threadPinnedSchema = z.enum(threadPinnedFilters)
export const threadChannelIdsSchema = z
  .array(discordSnowflakeSchema)
  .max(THREAD_CHANNEL_FILTER_LIMIT)
export const threadQuerySchema = z.string().max(THREAD_SEARCH_LENGTH_LIMIT)

const rawThreadsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  channels: threadChannelIdsSchema.optional().catch(undefined),
  pinned: threadPinnedSchema.optional().catch(undefined),
  sort: threadSortSchema.optional().catch(undefined),
  direction: threadDirectionSchema.optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})

export type ThreadsSearch = {
  q?: string
  channels?: string[]
  pinned?: (typeof threadPinnedFilters)[number]
  sort?: (typeof threadSorts)[number]
  direction?: (typeof threadDirections)[number]
  page?: number
}

export function parseThreadsSearch(
  search: Parameters<typeof rawThreadsSearchSchema.parse>[0]
): ThreadsSearch {
  const parsed = rawThreadsSearchSchema.parse(search)
  const result: ThreadsSearch = {}
  const query = parsed.q?.trim()
  if (query && threadQuerySchema.safeParse(query).success) result.q = query
  if (parsed.channels) result.channels = parsed.channels
  if (parsed.pinned) result.pinned = parsed.pinned
  if (parsed.sort) result.sort = parsed.sort
  if (parsed.direction) result.direction = parsed.direction
  if (parsed.page) result.page = parsed.page
  return result
}

export const threadsSearchSchema = { parse: parseThreadsSearch }

export function normalizeThreadsSearch(search: ThreadsSearch) {
  const channels = [...new Set(search.channels ?? [])].sort()
  return {
    search: search.q?.trim() ?? "",
    channelIds: channels,
    pinned: search.pinned ?? ("all" as const),
    sort: search.sort ?? ("newest" as const),
    direction: search.direction ?? ("desc" as const),
    page: search.page ?? 1,
    pageSize: THREAD_PAGE_SIZE,
  }
}

export function hasThreadFilters(search: ThreadsSearch) {
  return Boolean(search.q || search.channels?.length || search.pinned)
}
