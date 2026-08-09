import { db } from "@repo/db/index"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { getAuthEnv } from "@/env.server"

const authEnv = getAuthEnv()
export const discordAuthAvailable = Boolean(authEnv.discord)
const socialProviders = authEnv.discord
  ? {
      discord: {
        clientId: authEnv.discord.clientId,
        clientSecret: authEnv.discord.clientSecret,
        prompt: "consent" as const,
        scope: ["identify", "email", "guilds"],
        disableDefaultScope: true,
      },
    }
  : {}

export const auth = betterAuth({
  baseURL: authEnv.dashboardOrigin,
  secret: authEnv.secret,
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins: [authEnv.dashboardOrigin],
  socialProviders,
  plugins: [tanstackStartCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
