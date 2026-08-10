import { z } from "zod"

const discordSnowflake = z
  .string()
  .regex(/^[1-9]\d{16,19}$/, "Invalid Discord snowflake")
  .refine((value) => {
    try {
      return BigInt(value) <= 18_446_744_073_709_551_615n
    } catch {
      return false
    }
  }, "Invalid Discord snowflake")

export const publicSearchScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("server"), id: discordSnowflake }),
  z.object({ kind: z.literal("channel"), id: discordSnowflake }),
  z.object({ kind: z.literal("thread"), id: discordSnowflake }),
])

const querySchema = z.string().trim().min(2).max(120)

export const canonicalPublicSearchRequestSchema = z
  .object({
    query: querySchema,
    scope: publicSearchScopeSchema,
  })
  .strict()

export const tenantPublicSearchRequestSchema = z
  .object({
    query: querySchema,
  })
  .strict()

const highlightSegmentSchema = z.object({
  value: z.string(),
  highlighted: z.boolean(),
})

export const publicSearchResponseSchema = z.object({
  hits: z.array(
    z.object({
      id: discordSnowflake,
      threadId: discordSnowflake,
      title: z.string(),
      channelName: z.string(),
      content: z.string(),
      isThreadStarter: z.boolean(),
      timestamp: z.number(),
      threadUrl: z.string().startsWith("/thread/"),
      highlights: z.object({
        title: z.array(highlightSegmentSchema),
        content: z.array(highlightSegmentSchema),
      }),
    })
  ),
  estimatedTotalHits: z.number().int().nonnegative(),
  processingTimeMs: z.number().nonnegative(),
  query: z.string(),
})

export type PublicSearchScope = z.infer<typeof publicSearchScopeSchema>
export type PublicSearchResponse = z.infer<typeof publicSearchResponseSchema>

export function getPublicSearchScope(
  pathname: string
): PublicSearchScope | null {
  const match = /^\/(server|channel|thread)\/([^/]+)/.exec(pathname)
  if (!match) return null

  const parsed = publicSearchScopeSchema.safeParse({
    kind: match[1],
    id: match[2],
  })
  return parsed.success ? parsed.data : null
}
