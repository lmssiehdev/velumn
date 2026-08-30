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
const optionalPolarServer = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["sandbox", "production"]).optional()
)

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  VELUMN_CANONICAL_URL: optionalOrigin,
  VELUMN_DASHBOARD_NEW_URL: optionalOrigin,
  VERCEL_URL: optionalString,
  VERCEL_BRANCH_URL: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,
  BOT_API_URL: optionalOrigin,
  BOT_API_SECRET: optionalString,
  VERCEL_BEARER_TOKEN: optionalString,
  VERCEL_PROJECT_ID: optionalString,
  VERCEL_TEAM_ID: optionalString,
  POLAR_ACCESS_TOKEN: optionalString,
  POLAR_WEBHOOK_SECRET: optionalString,
  POLAR_PRO_PRODUCT_ID: optionalString,
  POLAR_SERVER: optionalPolarServer,
  CRON_SECRET: optionalString,
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
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
  })

  return {
    dashboardOrigin,
    secret: env.BETTER_AUTH_SECRET,
    discord: discord
      ? {
          clientId: discord.DISCORD_CLIENT_ID,
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
  const clientId = getEnv().DISCORD_CLIENT_ID
  if (!clientId) throw new Error("Discord client is not configured")
  return clientId
}

export function requireIndexingEnv() {
  const env = getEnv()
  const config = optionalGroup("Indexing service", {
    BOT_API_URL: env.BOT_API_URL,
    BOT_API_SECRET: env.BOT_API_SECRET,
  })
  if (!config) throw new Error("Indexing service is not configured")
  return {
    apiOrigin: config.BOT_API_URL,
    secret: config.BOT_API_SECRET,
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

export function getPolarEnv() {
  const env = getEnv()
  const config = optionalGroup("Polar billing", {
    POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET,
    POLAR_PRO_PRODUCT_ID: env.POLAR_PRO_PRODUCT_ID,
    POLAR_SERVER: env.POLAR_SERVER,
  })
  if (!config) return null

  const dashboardOrigin = getAuthEnv().dashboardOrigin
  return {
    accessToken: config.POLAR_ACCESS_TOKEN,
    webhookSecret: config.POLAR_WEBHOOK_SECRET,
    productId: config.POLAR_PRO_PRODUCT_ID,
    server: config.POLAR_SERVER as "sandbox" | "production",
    dashboardOrigin,
  }
}

export function requireCronSecret() {
  const secret = getEnv().CRON_SECRET
  if (!secret) throw new Error("Billing reconciliation cron is not configured")
  return secret
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
