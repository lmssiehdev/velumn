import { z } from "zod"

export const hostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/)
export const snowflakeSchema = z.string().regex(/^[0-9]{1,20}$/)
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
