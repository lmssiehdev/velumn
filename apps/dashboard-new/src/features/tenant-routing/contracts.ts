import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { z } from "zod"

import { normalizeHostname } from "@/lib/host-routing"

export const hostnameSchema = z.string().transform((value, context) => {
  const hostname = normalizeHostname(value)
  if (hostname) return hostname
  context.addIssue({ code: "custom", message: "Invalid hostname" })
  return z.NEVER
})
export const snowflakeSchema = discordSnowflakeSchema
export const listInputSchema = z.object({
  hostname: hostnameSchema,
  cursor: snowflakeSchema.optional(),
})
export const channelInputSchema = listInputSchema.extend({
  channelId: snowflakeSchema,
})
export const threadInputSchema = z.object({
  hostname: hostnameSchema,
  threadId: snowflakeSchema,
})

export type TenantListInput = z.infer<typeof listInputSchema>
export type TenantChannelInput = z.infer<typeof channelInputSchema>
