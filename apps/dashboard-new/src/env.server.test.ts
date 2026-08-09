import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("server environment", () => {
  it("normalizes trusted origins and validates complete OAuth groups", async () => {
    vi.stubEnv("VELUMN_DASHBOARD_NEW_URL", "https://dashboard.example.com/path")
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret")
    vi.stubEnv("NEXT_PUBLIC_DISCORD_CLIENT_ID", "client-id")
    vi.stubEnv("DISCORD_CLIENT_SECRET", "client-secret")

    const { getAuthEnv } = await import("./env.server")

    expect(getAuthEnv()).toEqual({
      dashboardOrigin: "https://dashboard.example.com",
      secret: "test-secret",
      discord: { clientId: "client-id", clientSecret: "client-secret" },
    })
  })

  it("rejects partial feature configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_VELUMN_API_URL", "https://api.example.com")
    vi.stubEnv("DISCORD_BOT_TOKEN", "")

    const { requireIndexingEnv } = await import("./env.server")

    expect(() => requireIndexingEnv()).toThrow(
      "Indexing service configuration is incomplete: DISCORD_BOT_TOKEN"
    )
  })

  it("prefers the dedicated bot API secret", async () => {
    vi.stubEnv("NEXT_PUBLIC_VELUMN_API_URL", "https://api.example.com")
    vi.stubEnv("BOT_API_SECRET", "api-secret")
    vi.stubEnv("DISCORD_BOT_TOKEN", "discord-token")

    const { requireIndexingEnv } = await import("./env.server")

    expect(requireIndexingEnv()).toEqual({
      apiOrigin: "https://api.example.com",
      secret: "api-secret",
    })
  })

  it("requires an explicit dashboard origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VELUMN_DASHBOARD_NEW_URL", "")
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret")
    vi.stubEnv("NEXT_PUBLIC_DISCORD_CLIENT_ID", "")
    vi.stubEnv("DISCORD_CLIENT_SECRET", "")

    const { getAuthEnv } = await import("./env.server")

    expect(() => getAuthEnv()).toThrow(
      "VELUMN_DASHBOARD_NEW_URL is required in production"
    )
  })

  it("trusts deployment URLs but never the project production URL", async () => {
    vi.stubEnv("VERCEL_URL", "deployment.example.com")
    vi.stubEnv("VERCEL_BRANCH_URL", "branch.example.com")
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "untrusted.example.com")

    const { getHostRoutingEnv } = await import("./env.server")

    expect(getHostRoutingEnv().previewHosts).toEqual([
      "deployment.example.com",
      "branch.example.com",
    ])
    expect(getHostRoutingEnv().previewHosts).not.toContain(
      "untrusted.example.com"
    )
  })
})
