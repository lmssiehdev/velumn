import type { BotRouter } from "@repo/api/client"
import { createTRPCClient, httpLink } from "@trpc/client"

import { requireIndexingEnv } from "@/env.server"

export function createBotApiClient(clientIp?: string) {
  const { apiOrigin, secret } = requireIndexingEnv()
  return createTRPCClient<BotRouter>({
    links: [
      httpLink({
        url: `${apiOrigin}/trpc`,
        headers: {
          "x-velumn-secret": secret,
          ...(clientIp ? { "x-velumn-client-ip": clientIp } : {}),
        },
      }),
    ],
  })
}
