import { db } from "@repo/db/index"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"

const dashboardUrl =
  process.env.VELUMN_DASHBOARD_NEW_URL ?? "http://localhost:3001"
const authSecret = process.env.BETTER_AUTH_SECRET
const discordClientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET
export const discordAuthAvailable = Boolean(
  authSecret && discordClientId && discordClientSecret
)
const socialProviders =
  discordAuthAvailable && discordClientId && discordClientSecret
    ? {
        discord: {
          clientId: discordClientId,
          clientSecret: discordClientSecret,
          prompt: "consent" as const,
          scope: ["identify", "email", "guilds"],
          disableDefaultScope: true,
        },
      }
    : {}

export const auth = betterAuth({
  baseURL: dashboardUrl,
  secret: authSecret,
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins: [dashboardUrl],
  socialProviders,
  plugins: [tanstackStartCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
