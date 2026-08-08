import { beforeEach, describe, expect, it, vi } from "vitest"

import { getDomainStatus, getVercelErrorCode } from "./vercel"

const vercelMocks = vi.hoisted(() => ({
  calls: [] as Array<string>,
  addProjectDomain: vi.fn(),
  deleteDomain: vi.fn(),
  getDomainConfig: vi.fn(),
  getProjectDomain: vi.fn(),
  removeProjectDomain: vi.fn(),
  verifyProjectDomain: vi.fn(),
}))

vi.mock("@vercel/sdk", () => ({
  Vercel: class {
    projects = {
      addProjectDomain: vercelMocks.addProjectDomain,
      getProjectDomain: vercelMocks.getProjectDomain,
      removeProjectDomain: vercelMocks.removeProjectDomain,
      verifyProjectDomain: vercelMocks.verifyProjectDomain,
    }

    domains = {
      deleteDomain: vercelMocks.deleteDomain,
      getDomainConfig: vercelMocks.getDomainConfig,
    }
  },
}))

describe("Vercel domain status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vercelMocks.calls.length = 0
    vercelMocks.getProjectDomain.mockImplementation(async () => {
      vercelMocks.calls.push("project")
      return {
        name: "community.example.com",
        apexName: "example.com",
        projectId: "project",
        verified: false,
        verification: [],
      }
    })
    vercelMocks.getDomainConfig.mockImplementation(async () => {
      vercelMocks.calls.push("config")
      return {
        misconfigured: false,
        recommendedCNAME: [],
        recommendedIPv4: [],
      }
    })
    vercelMocks.verifyProjectDomain.mockImplementation(async () => {
      vercelMocks.calls.push("verify")
      return {
        name: "community.example.com",
        apexName: "example.com",
        projectId: "project",
        verified: true,
      }
    })
  })

  it("uses the verification response after reading the current state", async () => {
    const result = await getDomainStatus("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value.status).toBe("verified")
    expect(result.value.verified).toBe(true)
    expect(vercelMocks.calls.slice(0, 2)).toEqual(["project", "config"])
    expect(vercelMocks.calls[2]).toBe("verify")
  })

  it("keeps DNS instructions when ownership verification is pending", async () => {
    vercelMocks.getProjectDomain.mockResolvedValue({
      name: "community.example.com",
      apexName: "example.com",
      projectId: "project",
      verified: false,
      verification: [
        {
          domain: "_vercel.example.com",
          type: "TXT",
          value: "vc-domain-verify=community.example.com,token",
          reason: "pending",
        },
      ],
    })
    vercelMocks.verifyProjectDomain.mockRejectedValue({
      statusCode: 400,
      body: JSON.stringify({ error: { code: "verification_failed" } }),
    })

    const result = await getDomainStatus("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value.status).toBe("pending")
    expect(result.value.records).toEqual([
      {
        name: "_vercel",
        type: "TXT",
        value: "vc-domain-verify=community.example.com,token",
      },
    ])
  })

  it("preserves the last known state when Vercel is unavailable", async () => {
    vercelMocks.getProjectDomain.mockRejectedValue({
      statusCode: 503,
      body: JSON.stringify({ error: { code: "service_unavailable" } }),
    })

    const result = await getDomainStatus("community.example.com")

    expect(result.status).toBe("error")
    if (result.isOk()) throw new Error("Expected a provider failure")
    expect(result.error.code).toBe("unavailable")
    expect(result.error.message).toContain("temporarily unavailable")
  })
})

describe("Vercel errors", () => {
  it("reads stable provider codes from SDK error bodies", () => {
    expect(
      getVercelErrorCode({
        body: JSON.stringify({ error: { code: "domain_taken" } }),
      })
    ).toBe("domain_taken")
  })
})
