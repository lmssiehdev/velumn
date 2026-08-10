import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addProjectDomain,
  getDomainStatus,
  getVercelErrorCode,
  removeDomainFromProject,
} from "./vercel"

const vercelMocks = vi.hoisted(() => ({
  calls: [] as Array<string>,
  addProjectDomain: vi.fn(),
  deleteDomain: vi.fn(),
  getDomainConfig: vi.fn(),
  getProjectDomain: vi.fn(),
  removeProjectDomain: vi.fn(),
  requireVercelEnv: vi.fn(),
  verifyProjectDomain: vi.fn(),
}))

vi.mock("@/env.server", () => ({
  requireVercelEnv: vercelMocks.requireVercelEnv,
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

beforeEach(() => {
  vi.clearAllMocks()
  vercelMocks.calls.length = 0
  vercelMocks.requireVercelEnv.mockReturnValue({
    bearerToken: "test-token",
    projectId: "test-project",
    teamId: "test-team",
  })
})

describe("Vercel domain add", () => {
  it("accepts an ambiguous add after the project attachment is found", async () => {
    vercelMocks.addProjectDomain.mockRejectedValue(vercelError(503))
    vercelMocks.getProjectDomain.mockResolvedValue(
      projectDomain("community.example.com")
    )

    const result = await addProjectDomain("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value).toBe("attached")
    expect(vercelMocks.getProjectDomain).toHaveBeenCalledOnce()
  })

  it("returns the add failure when reconciliation proves absence", async () => {
    vercelMocks.addProjectDomain.mockRejectedValue(vercelError(503))
    vercelMocks.getProjectDomain.mockRejectedValue(
      vercelError(404, "not_found")
    )

    const result = await addProjectDomain("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value).toBe("unknown")
  })

  it("reports an unknown outcome when ambiguous reconciliation also fails", async () => {
    vercelMocks.addProjectDomain.mockRejectedValue(vercelError(503))
    vercelMocks.getProjectDomain.mockRejectedValue(vercelError(503))

    const result = await addProjectDomain("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value).toBe("unknown")
  })

  it.each(["domain_already_in_use", "domain_taken"])(
    "maps %s as a domain ownership conflict",
    async (providerCode) => {
      vercelMocks.addProjectDomain.mockRejectedValue(
        vercelError(409, providerCode)
      )
      vercelMocks.getProjectDomain.mockRejectedValue(
        vercelError(404, "not_found")
      )

      const result = await addProjectDomain("community.example.com")

      expect(result.status).toBe("error")
      if (result.isOk()) throw new Error("Expected a provider failure")
      expect(result.error.code).toBe("domain_taken")
      expect(vercelMocks.getProjectDomain).toHaveBeenCalledOnce()
    }
  )

  it("accepts an ownership conflict only after confirming project attachment", async () => {
    vercelMocks.addProjectDomain.mockRejectedValue(
      vercelError(409, "domain_already_in_use")
    )
    vercelMocks.getProjectDomain.mockResolvedValue(
      projectDomain("community.example.com")
    )

    const result = await addProjectDomain("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value).toBe("attached")
  })

  it("maps rate limits without reconciling", async () => {
    vercelMocks.addProjectDomain.mockRejectedValue(
      vercelError(429, "rate_limited")
    )

    const result = await addProjectDomain("community.example.com")

    expect(result.status).toBe("error")
    if (result.isOk()) throw new Error("Expected a provider failure")
    expect(result.error.code).toBe("unavailable")
    expect(result.error.statusCode).toBe(429)
    expect(result.error.message).toContain("too many domains")
    expect(vercelMocks.getProjectDomain).not.toHaveBeenCalled()
  })
})

describe("Vercel domain removal", () => {
  it("removes only the project domain", async () => {
    vercelMocks.removeProjectDomain.mockResolvedValue({})

    const result = await removeDomainFromProject("community.example.com")

    expect(result.status).toBe("ok")
    expect(vercelMocks.removeProjectDomain).toHaveBeenCalledOnce()
    expect(vercelMocks.deleteDomain).not.toHaveBeenCalled()
  })

  it("treats a missing project domain as already removed", async () => {
    vercelMocks.removeProjectDomain.mockRejectedValue(
      vercelError(404, "not_found")
    )

    const result = await removeDomainFromProject("community.example.com")

    expect(result.status).toBe("ok")
    expect(vercelMocks.getProjectDomain).not.toHaveBeenCalled()
  })

  it.each([408, 503])(
    "reconciles an ambiguous %s removal by confirming absence",
    async (statusCode) => {
      vercelMocks.removeProjectDomain.mockRejectedValue(vercelError(statusCode))
      vercelMocks.getProjectDomain.mockRejectedValue(
        vercelError(404, "not_found")
      )

      const result = await removeDomainFromProject("community.example.com")

      expect(result.status).toBe("ok")
      expect(vercelMocks.deleteDomain).not.toHaveBeenCalled()
    }
  )

  it("preserves the removal failure while the project domain still exists", async () => {
    vercelMocks.removeProjectDomain.mockRejectedValue(vercelError(503))
    vercelMocks.getProjectDomain.mockResolvedValue(
      projectDomain("community.example.com")
    )

    const result = await removeDomainFromProject("community.example.com")

    expect(result.status).toBe("error")
    if (result.isOk()) throw new Error("Expected a provider failure")
    expect(result.error.code).toBe("unavailable")
  })
})

describe("Vercel domain status", () => {
  beforeEach(() => {
    vercelMocks.getProjectDomain.mockImplementation(async () => {
      vercelMocks.calls.push("project")
      return projectDomain("community.example.com")
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
    vercelMocks.getProjectDomain.mockRejectedValue(
      vercelError(503, "service_unavailable")
    )

    const result = await getDomainStatus("community.example.com")

    expect(result.status).toBe("error")
    if (result.isOk()) throw new Error("Expected a provider failure")
    expect(result.error.code).toBe("unavailable")
    expect(result.error.message).toContain("temporarily unavailable")
  })

  it("does not fabricate records when Vercel has no DNS recommendation", async () => {
    vercelMocks.getProjectDomain.mockResolvedValue({
      ...projectDomain("community.example.com"),
      verified: true,
    })
    vercelMocks.getDomainConfig.mockResolvedValue({
      misconfigured: true,
      recommendedCNAME: [],
      recommendedIPv4: [],
    })

    const result = await getDomainStatus("community.example.com")

    expect(result.status).toBe("ok")
    if (result.isErr()) throw result.error
    expect(result.value.records).toEqual([])
    expect(result.value.status).toBe("pending")
    expect(result.value.message).toContain("has not returned")
  })
})

describe("Vercel configuration", () => {
  it.each([
    ["add", addProjectDomain],
    ["check", getDomainStatus],
    ["remove", removeDomainFromProject],
  ])("returns a provider failure when %s is not configured", async (_, run) => {
    vercelMocks.requireVercelEnv.mockImplementation(() => {
      throw new Error("Vercel publishing is not configured")
    })

    const result = await run("community.example.com")

    expect(result.status).toBe("error")
    if (result.isOk()) throw new Error("Expected a provider failure")
    expect(result.error.code).toBe("unavailable")
    expect(vercelMocks.addProjectDomain).not.toHaveBeenCalled()
    expect(vercelMocks.getProjectDomain).not.toHaveBeenCalled()
    expect(vercelMocks.removeProjectDomain).not.toHaveBeenCalled()
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

function projectDomain(name: string) {
  return {
    name,
    apexName: "example.com",
    projectId: "project",
    verified: false,
    verification: [],
  }
}

function vercelError(statusCode: number, code = "service_unavailable") {
  return {
    statusCode,
    body: JSON.stringify({ error: { code } }),
  }
}
