import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("server environment", () => {
  it("normalizes trusted origins and validates complete OAuth groups", async () => {
    vi.stubEnv("VELUMN_DASHBOARD_NEW_URL", "https://dashboard.example.com/path")
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret")
    vi.stubEnv("DISCORD_CLIENT_ID", "client-id")
    vi.stubEnv("DISCORD_CLIENT_SECRET", "client-secret")

    const { getAuthEnv } = await import("./env.server")

    expect(getAuthEnv()).toEqual({
      dashboardOrigin: "https://dashboard.example.com",
      secret: "test-secret",
      discord: { clientId: "client-id", clientSecret: "client-secret" },
    })
  })

  it("rejects partial feature configuration", async () => {
    vi.stubEnv("BOT_API_URL", "https://api.example.com")
    vi.stubEnv("BOT_API_SECRET", "")

    const { requireIndexingEnv } = await import("./env.server")

    expect(() => requireIndexingEnv()).toThrow(
      "Indexing service configuration is incomplete: BOT_API_SECRET"
    )
  })

  it("uses the dedicated bot API secret", async () => {
    vi.stubEnv("BOT_API_URL", "https://api.example.com")
    vi.stubEnv("BOT_API_SECRET", "api-secret")

    const { requireIndexingEnv } = await import("./env.server")

    expect(requireIndexingEnv()).toEqual({
      apiOrigin: "https://api.example.com",
      secret: "api-secret",
    })
  })

  it("returns a complete Polar billing configuration", async () => {
    vi.stubEnv("VELUMN_DASHBOARD_NEW_URL", "https://dashboard.example.com")
    vi.stubEnv("POLAR_ACCESS_TOKEN", "polar-token")
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "polar-secret")
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "product-id")
    vi.stubEnv("POLAR_SERVER", "sandbox")

    const { getPolarEnv } = await import("./env.server")

    expect(getPolarEnv()).toEqual({
      accessToken: "polar-token",
      webhookSecret: "polar-secret",
      productId: "product-id",
      server: "sandbox",
      dashboardOrigin: "https://dashboard.example.com",
    })
  })

  it("allows billing to be entirely unconfigured", async () => {
    vi.stubEnv("POLAR_ACCESS_TOKEN", "")
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "")
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "")
    vi.stubEnv("POLAR_SERVER", "")

    const { getPolarEnv } = await import("./env.server")

    expect(getPolarEnv()).toBeNull()
  })

  it("rejects partial Polar billing configuration", async () => {
    vi.stubEnv("POLAR_ACCESS_TOKEN", "polar-token")
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "")
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "")
    vi.stubEnv("POLAR_SERVER", "sandbox")

    const { getPolarEnv } = await import("./env.server")

    expect(() => getPolarEnv()).toThrow(
      "Polar billing configuration is incomplete: POLAR_WEBHOOK_SECRET, POLAR_PRO_PRODUCT_ID"
    )
  })

  it("requires an explicit dashboard origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VELUMN_DASHBOARD_NEW_URL", "")
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret")
    vi.stubEnv("DISCORD_CLIENT_ID", "")
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
