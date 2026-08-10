import type {
  beginDomainRemoval,
  completeDomainProvisioning,
  completeDomainRemoval,
  completeDomainVerification,
  getDomainLifecycle,
  releaseDomainProvisioning,
  reserveDomainForServer,
} from "@repo/db/helpers/domains"

import {
  DomainProviderFailure,
  type addProjectDomain,
  type getDomainStatus,
  type removeDomainFromProject,
} from "./vercel"

export type PublishingOrchestrationDependencies = {
  addProjectDomain: typeof addProjectDomain
  beginDomainRemoval: typeof beginDomainRemoval
  completeDomainProvisioning: typeof completeDomainProvisioning
  completeDomainRemoval: typeof completeDomainRemoval
  completeDomainVerification: typeof completeDomainVerification
  getDomainLifecycle: typeof getDomainLifecycle
  getDomainStatus: typeof getDomainStatus
  releaseDomainProvisioning: typeof releaseDomainProvisioning
  removeDomainFromProject: typeof removeDomainFromProject
  reserveDomainForServer: typeof reserveDomainForServer
}

type DomainInput = { serverId: string; domain: string }

export async function addPublishingDomainOrchestration(
  { serverId, domain }: DomainInput,
  dependencies: PublishingOrchestrationDependencies
) {
  let reservation: Awaited<ReturnType<typeof reserveDomainForServer>>
  try {
    reservation = await dependencies.reserveDomainForServer({
      serverId,
      domain,
    })
  } catch {
    return domainError(
      "domain_unavailable",
      "This domain is already linked to another server."
    )
  }
  if (!reservation) {
    return domainError("domain_exists", "A custom domain is already linked.")
  }

  const providerResult = await dependencies.addProjectDomain(domain)
  if (providerResult.isErr()) {
    try {
      const released = await dependencies.releaseDomainProvisioning({
        serverId,
        domain,
        generation: reservation.generation,
      })
      if (!released) {
        return domainError(
          "domain_changed",
          "The linked domain changed while it was being added. Refresh the page."
        )
      }
    } catch {
      return domainError(
        "save_failed",
        "The domain could not be added and its local reservation could not be released. Refresh before trying again."
      )
    }
    return domainError("provider_error", providerResult.error.message)
  }

  let currentLifecycle = reservation
  if (providerResult.value === "attached") {
    const completed = await dependencies.completeDomainProvisioning({
      serverId,
      domain,
      generation: reservation.generation,
    })
    if (!completed) {
      const current = await dependencies.getDomainLifecycle(serverId)
      if (
        current?.domain === domain &&
        (current.status === "pending" || current.status === "verified")
      ) {
        currentLifecycle = current
      } else {
        const compensation = await dependencies.removeDomainFromProject(domain)
        if (compensation.isErr()) {
          return domainError(
            "save_failed",
            "The domain changed while it was being added, and Vercel cleanup could not be confirmed. Try removal again shortly."
          )
        }
        return domainError(
          "domain_changed",
          "The linked domain changed while it was being added. Refresh the page."
        )
      }
    } else {
      currentLifecycle = completed
    }
  }

  return {
    status: "ok" as const,
    data: {
      domain,
      lifecycleStatus: currentLifecycle.status,
      generation: currentLifecycle.generation,
    },
  }
}

export async function verifyPublishingDomainOrchestration(
  serverId: string,
  dependencies: PublishingOrchestrationDependencies
) {
  const lifecycle = await dependencies.getDomainLifecycle(serverId)
  if (
    !lifecycle?.domain ||
    lifecycle.status === "unconfigured" ||
    lifecycle.status === "removing"
  ) {
    return domainError("domain_missing", "Add a domain first.")
  }
  const domain = lifecycle.domain

  let providerResult = await dependencies.getDomainStatus(domain)
  if (
    providerResult.isErr() &&
    providerResult.error.code === "not_found" &&
    lifecycle.status === "provisioning"
  ) {
    const addResult = await dependencies.addProjectDomain(domain)
    if (addResult.isErr()) {
      return {
        status: "ok" as const,
        data: failedDomainCheck(domain, addResult.error),
      }
    }
    if (addResult.value === "unknown") {
      return {
        status: "ok" as const,
        data: failedDomainCheck(
          domain,
          new DomainProviderFailure({
            code: "unavailable",
            message:
              "Vercel could not confirm whether the domain was attached. Try verification again shortly.",
            providerCode: null,
            statusCode: null,
          })
        ),
      }
    }
    providerResult = await dependencies.getDomainStatus(domain)
  }
  if (providerResult.isErr()) {
    return {
      status: "ok" as const,
      data: failedDomainCheck(domain, providerResult.error),
    }
  }

  const result = providerResult.value
  const updated = await dependencies.completeDomainVerification({
    serverId,
    domain,
    generation: lifecycle.generation,
    verified: result.verified,
  })
  if (!updated) {
    return domainError(
      "domain_changed",
      "The linked domain changed while verification was running. Refresh the page."
    )
  }
  return { status: "ok" as const, data: result }
}

export async function removePublishingDomainOrchestration(
  serverId: string,
  dependencies: PublishingOrchestrationDependencies
) {
  const current = await dependencies.getDomainLifecycle(serverId)
  if (!current?.domain || current.status === "unconfigured") {
    return missingRemovalDomain()
  }
  if (current.status === "provisioning") {
    return domainError(
      "domain_provisioning",
      "Wait for the domain to finish being added before removing it."
    )
  }

  const lifecycle = await dependencies.beginDomainRemoval(serverId)
  if (!lifecycle?.domain) {
    const latest = await dependencies.getDomainLifecycle(serverId)
    return latest?.status === "unconfigured"
      ? { status: "ok" as const }
      : missingRemovalDomain()
  }
  const expectedGeneration =
    current.status === "removing" ? current.generation : current.generation + 1
  if (
    lifecycle.domain !== current.domain ||
    lifecycle.generation !== expectedGeneration
  ) {
    return domainError(
      "domain_changed",
      "The linked domain changed before removal started. Refresh the page."
    )
  }
  const domain = lifecycle.domain

  const providerResult = await dependencies.removeDomainFromProject(domain)
  if (providerResult.isErr()) {
    return domainError("provider_error", providerResult.error.message)
  }

  const removed = await dependencies.completeDomainRemoval({
    serverId,
    domain,
    generation: lifecycle.generation,
  })
  if (removed) return { status: "ok" as const }

  const latest = await dependencies.getDomainLifecycle(serverId)
  if (latest?.status === "unconfigured") return { status: "ok" as const }

  if (
    latest?.domain === domain &&
    latest.generation > lifecycle.generation &&
    (latest.status === "provisioning" ||
      latest.status === "pending" ||
      latest.status === "verified")
  ) {
    const compensation = await dependencies.addProjectDomain(domain)
    if (compensation.isErr() || compensation.value === "unknown") {
      return domainError(
        "save_failed",
        "The domain changed while removal was running, and its Vercel attachment could not be restored. Verify the domain again shortly."
      )
    }
  }
  return domainError(
    "domain_changed",
    "The linked domain changed while removal was running. Refresh the page."
  )
}

function missingRemovalDomain() {
  return domainError(
    "domain_missing",
    "No domain is linked, or its state changed. Refresh the page."
  )
}

function domainError(code: string, message: string) {
  return { status: "error" as const, code, message }
}

function failedDomainCheck(domain: string, error: DomainProviderFailure) {
  return {
    domain,
    verified: false,
    status: "failed" as const,
    failureReason:
      error.code === "not_found"
        ? ("not_found" as const)
        : error.code === "forbidden"
          ? ("permission" as const)
          : ("unavailable" as const),
    checkedAt: new Date().toISOString(),
    message: error.message,
    records: [],
  }
}
