import { Result } from "better-result"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addPublishingDomainOrchestration,
  removePublishingDomainOrchestration,
  verifyPublishingDomainOrchestration,
  type PublishingOrchestrationDependencies,
} from "./orchestration"
import { DomainProviderFailure, type DomainCheckResult } from "./vercel"

const SERVER_ID = "123"
const DOMAIN = "community.example.com"

let dependencies: PublishingOrchestrationDependencies

beforeEach(() => {
  dependencies = {
    addProjectDomain: vi.fn(),
    beginDomainRemoval: vi.fn(),
    completeDomainProvisioning: vi.fn(),
    completeDomainRemoval: vi.fn(),
    completeDomainVerification: vi.fn(),
    getDomainLifecycle: vi.fn(),
    getDomainStatus: vi.fn(),
    releaseDomainProvisioning: vi.fn(),
    removeDomainFromProject: vi.fn(),
    reserveDomainForServer: vi.fn(),
  }
})

describe("domain add orchestration", () => {
  it("keeps an unknown provider outcome provisioning", async () => {
    vi.mocked(dependencies.reserveDomainForServer).mockResolvedValue(
      lifecycle("provisioning", 1)
    )
    vi.mocked(dependencies.addProjectDomain).mockResolvedValue(
      Result.ok("unknown")
    )

    const result = await addPublishingDomainOrchestration(
      { serverId: SERVER_ID, domain: DOMAIN },
      dependencies
    )

    expect(result).toMatchObject({
      status: "ok",
      data: { lifecycleStatus: "provisioning", generation: 1 },
    })
    expect(dependencies.completeDomainProvisioning).not.toHaveBeenCalled()
    expect(dependencies.releaseDomainProvisioning).not.toHaveBeenCalled()
  })

  it("releases only the reservation whose provider add failed", async () => {
    const provider =
      deferred<
        Awaited<
          ReturnType<PublishingOrchestrationDependencies["addProjectDomain"]>
        >
      >()
    vi.mocked(dependencies.reserveDomainForServer).mockResolvedValue(
      lifecycle("provisioning", 7)
    )
    vi.mocked(dependencies.addProjectDomain).mockReturnValue(provider.promise)
    vi.mocked(dependencies.releaseDomainProvisioning).mockResolvedValue(false)

    const resultPromise = addPublishingDomainOrchestration(
      { serverId: SERVER_ID, domain: DOMAIN },
      dependencies
    )
    await vi.waitFor(() =>
      expect(dependencies.addProjectDomain).toHaveBeenCalled()
    )
    provider.resolve(Result.err(providerFailure("unavailable")))

    await expect(resultPromise).resolves.toMatchObject({
      status: "error",
      code: "domain_changed",
    })
    expect(dependencies.releaseDomainProvisioning).toHaveBeenCalledWith({
      serverId: SERVER_ID,
      domain: DOMAIN,
      generation: 7,
    })
  })

  it("accepts an out-of-order attached add when a newer add completed", async () => {
    const provider =
      deferred<
        Awaited<
          ReturnType<PublishingOrchestrationDependencies["addProjectDomain"]>
        >
      >()
    vi.mocked(dependencies.reserveDomainForServer).mockResolvedValue(
      lifecycle("provisioning", 1)
    )
    vi.mocked(dependencies.addProjectDomain).mockReturnValue(provider.promise)
    vi.mocked(dependencies.completeDomainProvisioning).mockResolvedValue(null)
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(
      lifecycle("pending", 3)
    )

    const resultPromise = addPublishingDomainOrchestration(
      { serverId: SERVER_ID, domain: DOMAIN },
      dependencies
    )
    await vi.waitFor(() =>
      expect(dependencies.addProjectDomain).toHaveBeenCalled()
    )
    provider.resolve(Result.ok("attached"))

    await expect(resultPromise).resolves.toMatchObject({
      status: "ok",
      data: { lifecycleStatus: "pending", generation: 3 },
    })
    expect(dependencies.removeDomainFromProject).not.toHaveBeenCalled()
  })

  it("compensates an attached add when its lifecycle was replaced", async () => {
    vi.mocked(dependencies.reserveDomainForServer).mockResolvedValue(
      lifecycle("provisioning", 1)
    )
    vi.mocked(dependencies.addProjectDomain).mockResolvedValue(
      Result.ok("attached")
    )
    vi.mocked(dependencies.completeDomainProvisioning).mockResolvedValue(null)
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(
      lifecycle("pending", 4, "other.example.com")
    )
    vi.mocked(dependencies.removeDomainFromProject).mockResolvedValue(
      Result.ok()
    )

    const result = await addPublishingDomainOrchestration(
      { serverId: SERVER_ID, domain: DOMAIN },
      dependencies
    )

    expect(result).toMatchObject({ status: "error", code: "domain_changed" })
    expect(dependencies.removeDomainFromProject).toHaveBeenCalledWith(DOMAIN)
  })

  it("reports failed compensation after a stale attached add", async () => {
    vi.mocked(dependencies.reserveDomainForServer).mockResolvedValue(
      lifecycle("provisioning", 1)
    )
    vi.mocked(dependencies.addProjectDomain).mockResolvedValue(
      Result.ok("attached")
    )
    vi.mocked(dependencies.completeDomainProvisioning).mockResolvedValue(null)
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(
      lifecycle("removing", 2)
    )
    vi.mocked(dependencies.removeDomainFromProject).mockResolvedValue(
      Result.err(providerFailure("unavailable"))
    )

    const result = await addPublishingDomainOrchestration(
      { serverId: SERVER_ID, domain: DOMAIN },
      dependencies
    )

    expect(result).toMatchObject({ status: "error", code: "save_failed" })
  })
})

describe("domain verification orchestration", () => {
  it("reconciles a missing provisioning attachment and CASes the check", async () => {
    const check = domainCheck(false)
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(
      lifecycle("provisioning", 5)
    )
    vi.mocked(dependencies.getDomainStatus)
      .mockResolvedValueOnce(Result.err(providerFailure("not_found")))
      .mockResolvedValueOnce(Result.ok(check))
    vi.mocked(dependencies.addProjectDomain).mockResolvedValue(
      Result.ok("attached")
    )
    vi.mocked(dependencies.completeDomainVerification).mockResolvedValue(
      lifecycle("pending", 5)
    )

    const result = await verifyPublishingDomainOrchestration(
      SERVER_ID,
      dependencies
    )

    expect(result).toEqual({ status: "ok", data: check })
    expect(dependencies.getDomainLifecycle).toHaveBeenCalledOnce()
    expect(dependencies.addProjectDomain).toHaveBeenCalledWith(DOMAIN)
    expect(dependencies.completeDomainVerification).toHaveBeenCalledWith({
      serverId: SERVER_ID,
      domain: DOMAIN,
      generation: 5,
      verified: false,
    })
  })

  it("does not apply an out-of-order verification result", async () => {
    const provider =
      deferred<
        Awaited<
          ReturnType<PublishingOrchestrationDependencies["getDomainStatus"]>
        >
      >()
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(
      lifecycle("pending", 2)
    )
    vi.mocked(dependencies.getDomainStatus).mockReturnValue(provider.promise)
    vi.mocked(dependencies.completeDomainVerification).mockResolvedValue(null)

    const resultPromise = verifyPublishingDomainOrchestration(
      SERVER_ID,
      dependencies
    )
    await vi.waitFor(() =>
      expect(dependencies.getDomainStatus).toHaveBeenCalled()
    )
    provider.resolve(Result.ok(domainCheck(true)))

    await expect(resultPromise).resolves.toMatchObject({
      status: "error",
      code: "domain_changed",
    })
    expect(dependencies.completeDomainVerification).toHaveBeenCalledWith(
      expect.objectContaining({ generation: 2, verified: true })
    )
  })
})

describe("domain removal orchestration", () => {
  it("rejects provisioning without calling the provider", async () => {
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(
      lifecycle("provisioning", 1)
    )

    const result = await removePublishingDomainOrchestration(
      SERVER_ID,
      dependencies
    )

    expect(result).toMatchObject({
      status: "error",
      code: "domain_provisioning",
    })
    expect(dependencies.beginDomainRemoval).not.toHaveBeenCalled()
    expect(dependencies.removeDomainFromProject).not.toHaveBeenCalled()
  })

  it("retries a removing lifecycle idempotently", async () => {
    const removing = lifecycle("removing", 3)
    vi.mocked(dependencies.getDomainLifecycle).mockResolvedValue(removing)
    vi.mocked(dependencies.beginDomainRemoval).mockResolvedValue(removing)
    vi.mocked(dependencies.removeDomainFromProject).mockResolvedValue(
      Result.ok()
    )
    vi.mocked(dependencies.completeDomainRemoval).mockResolvedValue(true)

    const result = await removePublishingDomainOrchestration(
      SERVER_ID,
      dependencies
    )

    expect(result).toEqual({ status: "ok" })
    expect(dependencies.removeDomainFromProject).toHaveBeenCalledWith(DOMAIN)
    expect(dependencies.completeDomainRemoval).toHaveBeenCalledWith({
      serverId: SERVER_ID,
      domain: DOMAIN,
      generation: 3,
    })
  })

  it("accepts a failed completion when removal already completed locally", async () => {
    vi.mocked(dependencies.getDomainLifecycle)
      .mockResolvedValueOnce(lifecycle("pending", 1))
      .mockResolvedValueOnce(lifecycle("unconfigured", 3, null))
    vi.mocked(dependencies.beginDomainRemoval).mockResolvedValue(
      lifecycle("removing", 2)
    )
    vi.mocked(dependencies.removeDomainFromProject).mockResolvedValue(
      Result.ok()
    )
    vi.mocked(dependencies.completeDomainRemoval).mockResolvedValue(false)

    await expect(
      removePublishingDomainOrchestration(SERVER_ID, dependencies)
    ).resolves.toEqual({ status: "ok" })
  })

  it("accepts removal when another retry completes before it starts", async () => {
    vi.mocked(dependencies.getDomainLifecycle)
      .mockResolvedValueOnce(lifecycle("removing", 2))
      .mockResolvedValueOnce(lifecycle("unconfigured", 3, null))
    vi.mocked(dependencies.beginDomainRemoval).mockResolvedValue(null)

    await expect(
      removePublishingDomainOrchestration(SERVER_ID, dependencies)
    ).resolves.toEqual({ status: "ok" })
    expect(dependencies.removeDomainFromProject).not.toHaveBeenCalled()
  })

  it("re-adds after a stale successful removal races a newer lifecycle", async () => {
    const provider =
      deferred<
        Awaited<
          ReturnType<
            PublishingOrchestrationDependencies["removeDomainFromProject"]
          >
        >
      >()
    vi.mocked(dependencies.getDomainLifecycle)
      .mockResolvedValueOnce(lifecycle("verified", 4))
      .mockResolvedValueOnce(lifecycle("pending", 7))
    vi.mocked(dependencies.beginDomainRemoval).mockResolvedValue(
      lifecycle("removing", 5)
    )
    vi.mocked(dependencies.removeDomainFromProject).mockReturnValue(
      provider.promise
    )
    vi.mocked(dependencies.completeDomainRemoval).mockResolvedValue(false)
    vi.mocked(dependencies.addProjectDomain).mockResolvedValue(
      Result.ok("attached")
    )

    const resultPromise = removePublishingDomainOrchestration(
      SERVER_ID,
      dependencies
    )
    await vi.waitFor(() =>
      expect(dependencies.removeDomainFromProject).toHaveBeenCalled()
    )
    provider.resolve(Result.ok())

    await expect(resultPromise).resolves.toMatchObject({
      status: "error",
      code: "domain_changed",
    })
    expect(dependencies.addProjectDomain).toHaveBeenCalledWith(DOMAIN)
  })

  it("reports an indeterminate reattachment after stale removal", async () => {
    vi.mocked(dependencies.getDomainLifecycle)
      .mockResolvedValueOnce(lifecycle("verified", 4))
      .mockResolvedValueOnce(lifecycle("pending", 7))
    vi.mocked(dependencies.beginDomainRemoval).mockResolvedValue(
      lifecycle("removing", 5)
    )
    vi.mocked(dependencies.removeDomainFromProject).mockResolvedValue(
      Result.ok()
    )
    vi.mocked(dependencies.completeDomainRemoval).mockResolvedValue(false)
    vi.mocked(dependencies.addProjectDomain).mockResolvedValue(
      Result.ok("unknown")
    )

    const result = await removePublishingDomainOrchestration(
      SERVER_ID,
      dependencies
    )

    expect(result).toMatchObject({ status: "error", code: "save_failed" })
  })
})

function lifecycle(
  status: "unconfigured" | "provisioning" | "pending" | "verified" | "removing",
  generation: number,
  domain: string | null = DOMAIN
) {
  return {
    serverId: SERVER_ID,
    domain,
    status,
    generation,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

function domainCheck(verified: boolean): DomainCheckResult {
  return {
    domain: DOMAIN,
    verified,
    status: verified ? "verified" : "pending",
    failureReason: null,
    checkedAt: new Date(0).toISOString(),
    message: "Checked.",
    records: [],
  }
}

function providerFailure(code: "not_found" | "unavailable") {
  return new DomainProviderFailure({
    code,
    message: "Provider failed.",
    providerCode: null,
    statusCode: code === "not_found" ? 404 : 503,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}
