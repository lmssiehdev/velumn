import { z } from "zod"

const serverIdSchema = z.string().regex(/^\d+$/)

export const threadSortSchema = z.enum([
  "newest",
  "title",
  "parentChannel",
  "messageCount",
])
export const threadDirectionSchema = z.enum(["asc", "desc"])
export const threadPinnedSchema = z.enum(["pinned", "unpinned"])

export const threadsSearchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  channels: z.array(serverIdSchema).max(20).optional().catch(undefined),
  pinned: threadPinnedSchema.optional().catch(undefined),
  sort: threadSortSchema.optional().catch(undefined),
  direction: threadDirectionSchema.optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})

export type ThreadsSearch = z.infer<typeof threadsSearchSchema>

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
