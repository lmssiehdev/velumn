import type { BotRouter } from "@repo/api/client"
import { createTRPCClient, httpLink } from "@trpc/client"

import { requireIndexingEnv } from "@/env.server"

export function createBotApiClient(clientIp?: string) {
  const { apiOrigin, secret } = requireIndexingEnv()
  const headers = new Headers({ "x-velumn-secret": secret })
  if (clientIp) headers.set("x-velumn-client-ip", clientIp)
  return createTRPCClient<BotRouter>({
    links: [
      httpLink({
        url: `${apiOrigin}/trpc`,
        headers,
      }),
    ],
  })
}
