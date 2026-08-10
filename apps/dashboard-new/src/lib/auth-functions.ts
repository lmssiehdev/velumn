import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth } = await import("./auth")
    return auth.api.getSession({ headers: getRequestHeaders() })
  }
)

export const getAuthAvailability = createServerFn({ method: "GET" }).handler(
  async () => {
    const { discordAuthAvailable } = await import("./auth")
    return { discord: discordAuthAvailable }
  }
)
