import { z } from "zod"

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
)
const optionalOrigin = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Expected an HTTP or HTTPS URL",
    })
    .transform((value) => new URL(value).origin)
    .optional()
)

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  VELUMN_CANONICAL_URL: optionalOrigin,
  VELUMN_DASHBOARD_NEW_URL: optionalOrigin,
  VERCEL_URL: optionalString,
  VERCEL_BRANCH_URL: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  NEXT_PUBLIC_DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,
  NEXT_PUBLIC_VELUMN_API_URL: optionalOrigin,
  BOT_API_SECRET: optionalString,
  DISCORD_BOT_TOKEN: optionalString,
  VERCEL_BEARER_TOKEN: optionalString,
  VERCEL_PROJECT_ID: optionalString,
  VERCEL_TEAM_ID: optionalString,
})

let cachedEnv: z.infer<typeof serverEnvSchema> | undefined

function getEnv() {
  cachedEnv ??= serverEnvSchema.parse(process.env)
  return cachedEnv
}

export function getAuthEnv() {
  const env = getEnv()
  const dashboardOrigin =
    env.VELUMN_DASHBOARD_NEW_URL ??
    (env.NODE_ENV === "production" ? undefined : "http://localhost:3001")

  if (!dashboardOrigin) {
    throw new Error("VELUMN_DASHBOARD_NEW_URL is required in production")
  }
  if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production")
  }

  const discord = optionalGroup("Discord OAuth", {
    NEXT_PUBLIC_DISCORD_CLIENT_ID: env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
  })

  return {
    dashboardOrigin,
    secret: env.BETTER_AUTH_SECRET,
    discord: discord
      ? {
          clientId: discord.NEXT_PUBLIC_DISCORD_CLIENT_ID,
          clientSecret: discord.DISCORD_CLIENT_SECRET,
        }
      : null,
  }
}

export function getHostRoutingEnv() {
  const env = getEnv()
  return {
    canonicalOrigin: env.VELUMN_CANONICAL_URL ?? "https://velumn.com",
    previewHosts: [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(
      (value): value is string => Boolean(value)
    ),
    production: env.NODE_ENV === "production",
  }
}

export function requireDiscordClientId() {
  const clientId = getEnv().NEXT_PUBLIC_DISCORD_CLIENT_ID
  if (!clientId) throw new Error("Discord client is not configured")
  return clientId
}

export function requireIndexingEnv() {
  const env = getEnv()
  const config = optionalGroup("Indexing service", {
    NEXT_PUBLIC_VELUMN_API_URL: env.NEXT_PUBLIC_VELUMN_API_URL,
    DISCORD_BOT_TOKEN: env.BOT_API_SECRET ?? env.DISCORD_BOT_TOKEN,
  })
  if (!config) throw new Error("Indexing service is not configured")
  return {
    apiOrigin: config.NEXT_PUBLIC_VELUMN_API_URL,
    secret: config.DISCORD_BOT_TOKEN,
  }
}

export function requireVercelEnv() {
  const env = getEnv()
  const config = optionalGroup("Vercel publishing", {
    VERCEL_BEARER_TOKEN: env.VERCEL_BEARER_TOKEN,
    VERCEL_PROJECT_ID: env.VERCEL_PROJECT_ID,
  })
  if (!config) throw new Error("Vercel publishing is not configured")
  return {
    bearerToken: config.VERCEL_BEARER_TOKEN,
    projectId: config.VERCEL_PROJECT_ID,
    teamId: env.VERCEL_TEAM_ID,
  }
}

function optionalGroup<T extends Record<string, string | undefined>>(
  name: string,
  values: T
): { [K in keyof T]: string } | null {
  const configured = Object.values(values).filter(Boolean).length
  if (configured === 0) return null
  if (configured !== Object.keys(values).length) {
    const missing = Object.entries(values)
      .filter(([, value]) => !value)
      .map(([key]) => key)
      .join(", ")
    throw new Error(`${name} configuration is incomplete: ${missing}`)
  }
  return values as { [K in keyof T]: string }
}
