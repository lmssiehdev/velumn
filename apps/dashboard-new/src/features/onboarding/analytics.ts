import { createServerFn } from "@tanstack/react-start"
import { captureOnboardingEvent } from "@repo/utils/onboarding-analytics"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { z } from "zod"

import { requireServerAuth } from "@/lib/server-auth"

const onboardingEventSchema = z.object({
  event: z.enum([
    "server_selected",
    "discord_authorization_opened",
    "bot_connected",
    "channel_selection_submitted",
    "indexing_successfully_started",
  ]),
  serverId: discordSnowflakeSchema,
  properties: z.record(z.string(), z.string().or(z.number())).optional(),
})

export const trackOnboardingEvent = createServerFn({ method: "POST" })
  .validator(onboardingEventSchema)
  .handler(async ({ data }) => {
    const context = await requireServerAuth()
    await captureOnboardingEvent({
      ...data,
      userId: context.session.user.id,
    })
  })
