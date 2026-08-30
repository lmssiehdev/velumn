import { describe, expect, it } from "vitest"

import {
  decideHostRouting,
  normalizeConfiguredHost,
  normalizeHostname,
  type HostRoutingConfig,
} from "./host-routing"

const productionConfig: HostRoutingConfig = {
  canonicalHost: "velumn.com",
  previewHosts: new Set(["velumn-git-routing-team.vercel.app"]),
  allowLocalHosts: false,
  requireHttps: true,
}

describe("host routing", () => {
  it("passes exact canonical and approved preview hosts", () => {
    expect(decide("https://velumn.com/dashboard")).toEqual({
      type: "pass",
      hostType: "canonical",
    })
    expect(
      decide("https://velumn-git-routing-team.vercel.app/pricing")
    ).toEqual({ type: "pass", hostType: "preview" })
  })

  it("does not trust arbitrary preview suffixes or suffix attacks", () => {
    expect(decide("https://attacker.vercel.app/").type).toBe("rewrite")
    expect(
      decide("https://velumn-git-routing-team.vercel.app.attacker.test/").type
    ).toBe("rewrite")
  })

  it("allows explicit local hosts only outside production", () => {
    const localConfig = {
      ...productionConfig,
      allowLocalHosts: true,
      requireHttps: false,
    }
    expect(
      decideHostRouting("http://localhost:3001/dashboard", null, localConfig)
    ).toEqual({ type: "pass", hostType: "local" })
    expect(
      decideHostRouting("http://127.0.0.1:3001/", null, localConfig)
    ).toEqual({ type: "pass", hostType: "local" })
    expect(decideHostRouting("http://[::1]:3001/", null, localConfig)).toEqual({
      type: "pass",
      hostType: "local",
    })
    expect(decide("https://localhost/").type).toBe("rewrite")
  })

  it("rejects insecure recognized production hosts", () => {
    expect(decide("http://velumn.com/")).toEqual({
      type: "reject",
      status: 400,
      reason: "insecure_protocol",
    })
  })

  it("rejects malformed, ambiguous, and disagreeing authorities", () => {
    expect(
      decideHostRouting("not a url", null, productionConfig)
    ).toMatchObject({ type: "reject", status: 400 })
    expect(
      decideHostRouting(
        "https://velumn.com/",
        "velumn.com, attacker.test",
        productionConfig
      )
    ).toMatchObject({ type: "reject", status: 400 })
    expect(
      decideHostRouting(
        "https://velumn.com/",
        "attacker.test",
        productionConfig
      )
    ).toMatchObject({ type: "reject", status: 400 })
    expect(
      decideHostRouting(
        "https://velumn.com/",
        "velumn.com:8443",
        productionConfig
      )
    ).toMatchObject({ type: "reject", status: 400 })
  })

  it("normalizes explicit default ports", () => {
    expect(
      decideHostRouting(
        "https://velumn.com/",
        "velumn.com:443",
        productionConfig
      )
    ).toEqual({ type: "pass", hostType: "canonical" })
  })

  it("normalizes case and one DNS root dot", () => {
    expect(
      decideHostRouting("https://VELUMN.com./", "velumn.com.", productionConfig)
    ).toEqual({ type: "pass", hostType: "canonical" })
  })

  it("rewrites tenant public paths into the reserved namespace", () => {
    expect(decide("https://docs.example.com/")).toEqual({
      type: "rewrite",
      hostname: "docs.example.com",
      pathname: "/__tenant/docs.example.com",
    })
    expect(decide("https://docs.example.com/thread/123/slug.md")).toEqual({
      type: "rewrite",
      hostname: "docs.example.com",
      pathname: "/__tenant/docs.example.com/thread/123/slug.md",
    })
    expect(decide("https://docs.example.com/sitemap.xml/1").type).toBe(
      "rewrite"
    )
  })

  it.each([
    "/dashboard",
    "/dashboard/servers",
    "/api/auth/session",
    "/api/revalidate-tag",
    "/_serverFn/abc",
    "/auth/callback",
    "/trpc/search",
    "/markdown/123",
    "/og/thread",
  ])("rejects private tenant-host path %s", (pathname) => {
    expect(decide(`https://docs.example.com${pathname}`)).toEqual({
      type: "reject",
      status: 404,
      reason: "private_tenant_path",
    })
  })

  it("rejects direct internal paths on every host", () => {
    expect(decide("https://velumn.com/__tenant/docs.example.com/")).toEqual({
      type: "reject",
      status: 404,
      reason: "internal_path",
    })
    expect(
      decide("https://docs.example.com/__tenant/docs.example.com/")
    ).toEqual({ type: "reject", status: 404, reason: "internal_path" })
  })

  it("rejects unsupported paths on tenant candidates", () => {
    expect(decide("https://docs.example.com/pricing")).toEqual({
      type: "reject",
      status: 404,
      reason: "unsupported_tenant_path",
    })
  })

  it("allows only the exact public search endpoint on tenant hosts", () => {
    expect(decide("https://docs.example.com/api/search")).toEqual({
      type: "rewrite",
      hostname: "docs.example.com",
      pathname: "/__tenant/docs.example.com/api/search",
    })
    expect(decide("https://docs.example.com/api/search/anything")).toEqual({
      type: "reject",
      status: 404,
      reason: "private_tenant_path",
    })
  })

  it("allows only required shared build assets on tenant candidates", () => {
    expect(decide("https://docs.example.com/assets/index.js")).toEqual({
      type: "pass",
      hostType: "shared-asset",
    })
    expect(decide("https://docs.example.com/favicon.svg")).toEqual({
      type: "pass",
      hostType: "shared-asset",
    })
  })
})

describe("configured hosts", () => {
  it("accepts hostnames and origins", () => {
    expect(normalizeConfiguredHost("Velumn.com")).toBe("velumn.com")
    expect(normalizeConfiguredHost("https://velumn.com")).toBe("velumn.com")
  })

  it.each([
    "https://user@velumn.com",
    "https://velumn.com/path",
    "https://velumn.com:8443",
    "velumn.com,attacker.test",
    "bad_host.test",
  ])("rejects invalid configured host %s", (value) => {
    expect(normalizeConfiguredHost(value)).toBeNull()
  })
})

describe("hostnames", () => {
  it("normalizes valid DNS names", () => {
    expect(normalizeHostname("Docs.Example.com.")).toBe("docs.example.com")
  })

  it.each(["bad..example.com", "-bad.example.com", "bad-.example.com"])(
    "rejects invalid DNS hostname %s",
    (value) => {
      expect(normalizeHostname(value)).toBeNull()
    }
  )
})

function decide(url: string) {
  return decideHostRouting(url, null, productionConfig)
}
