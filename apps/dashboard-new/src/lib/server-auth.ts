import { createServerOnlyFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

export const requireServerAuth = createServerOnlyFn(async () => {
  const headers = getRequestHeaders()
  const { auth } = await import("./auth")
  const session = await auth.api.getSession({ headers })

  if (!session) throw new Error("Unauthorized")

  return { auth, headers, session }
})

export const getDiscordAccessToken = createServerOnlyFn(
  async (
    context: Awaited<ReturnType<typeof requireServerAuth>>,
    refresh = false
  ) => {
    if (refresh) {
      const refreshed = await context.auth.api.refreshToken({
        headers: context.headers,
        body: { providerId: "discord" },
      })
      if (!refreshed.accessToken)
        throw new Error("Discord reauthorization required")
      return refreshed.accessToken
    }

    const token = await context.auth.api.getAccessToken({
      headers: context.headers,
      body: { providerId: "discord" },
    })
    return token.accessToken
  }
)
