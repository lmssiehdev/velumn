import { db } from "@repo/db/index"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { getAuthEnv } from "@/env.server"
import {
  polarAuthPlugin,
  validatePolarCheckoutRequest,
} from "@/features/dashboard/polar.server"

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
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/checkout") return
      const session = await getSessionFromCtx(context)
      if (!session) {
        throw new APIError("UNAUTHORIZED", {
          message: "You must be signed in to start checkout.",
        })
      }
      if (
        !(await validatePolarCheckoutRequest(context.body, session.user.id))
      ) {
        throw new APIError("FORBIDDEN", {
          message: "This checkout request is not authorized.",
        })
      }
    }),
  },
  plugins: [polarAuthPlugin, tanstackStartCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
