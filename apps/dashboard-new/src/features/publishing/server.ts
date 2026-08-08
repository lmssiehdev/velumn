import {
  getServerByCustomDomain,
  updateDomainLinkToServerIfCurrent,
} from "@repo/db/helpers/domains"
import { buildHostUrl, normalizeDomain } from "@repo/utils/helpers/domains"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authorizeManagementServer } from "@/features/dashboard/server-context"
import { toServerIdentity } from "@/features/dashboard/urls"

import {
  addProjectDomain,
  type DomainProviderFailure,
  getDomainStatus,
  removeDomainFromProjectAndAccount,
} from "./vercel"

const serverIdSchema = z.string().regex(/^\d+$/)
const serverInputSchema = z.object({ serverId: serverIdSchema })

export const getPublishingPage = createServerFn({ method: "GET" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization

    const { server } = authorization
    const defaultUrl = buildHostUrl("velumn.com", `/server/${server.id}`)
    const customDomain = server.customDomain
    return {
      status: "ok" as const,
      data: {
        server: toServerIdentity(server),
        disconnected: server.lifecycle === "bot_disconnected",
        defaultUrl,
        canonicalUrl:
          customDomain && server.domainVerified
            ? buildHostUrl(customDomain, "/")
            : defaultUrl,
        customDomain,
        verification: {
          status: customDomain
            ? server.domainVerified
              ? ("verified" as const)
              : ("pending" as const)
            : ("not_configured" as const),
          checkedAt: null,
          failureReason: null,
          message: customDomain
            ? server.domainVerified
              ? "This domain was verified previously."
              : "Verify the domain to load its current DNS requirements."
            : null,
          records: [] as Array<{
            type: string
            name: string
            value: string
          }>,
        },
      },
    }
  })

export const addPublishingDomain = createServerFn({ method: "POST" })
  .validator(
    z.object({ serverId: serverIdSchema, domain: z.string().min(1).max(253) })
  )
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization
    if (authorization.server.customDomain) {
      return domainError("domain_exists", "A custom domain is already linked.")
    }

    let domain: string
    try {
      domain = normalizeDomain(data.domain)
    } catch (error) {
      return domainError(
        "invalid_domain",
        error instanceof Error ? error.message : "Enter a valid hostname."
      )
    }

    const existingOwner = await getServerByCustomDomain(domain)
    if (existingOwner && existingOwner.id !== data.serverId) {
      return domainError(
        "domain_unavailable",
        "This domain is already linked to another server."
      )
    }

    let reserved = false
    try {
      reserved = await updateDomainLinkToServerIfCurrent({
        serverId: data.serverId,
        expectedCustomDomain: null,
        payload: { customDomain: domain, domainVerified: false },
      })
    } catch {
      return domainError(
        "domain_unavailable",
        "This domain is already linked to another server."
      )
    }
    if (!reserved) {
      return domainError("domain_exists", "A custom domain is already linked.")
    }

    const providerResult = await addProjectDomain(domain)
    if (providerResult.isErr()) {
      try {
        const released = await updateDomainLinkToServerIfCurrent({
          serverId: data.serverId,
          expectedCustomDomain: domain,
          payload: { customDomain: null, domainVerified: false },
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

    return { status: "ok" as const, data: { domain } }
  })

export const verifyPublishingDomain = createServerFn({ method: "POST" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization
    const domain = authorization.server.customDomain
    if (!domain) return domainError("domain_missing", "Add a domain first.")

    const providerResult = await getDomainStatus(domain)
    if (providerResult.isErr()) {
      return {
        status: "ok" as const,
        data: failedDomainCheck(domain, providerResult.error),
      }
    }
    const result = providerResult.value
    if (result.verified !== authorization.server.domainVerified) {
      const updated = await updateDomainLinkToServerIfCurrent({
        serverId: data.serverId,
        expectedCustomDomain: domain,
        payload: { customDomain: domain, domainVerified: result.verified },
      })
      if (!updated) {
        return domainError(
          "domain_changed",
          "The linked domain changed while verification was running. Refresh the page."
        )
      }
    }
    return { status: "ok" as const, data: result }
  })

export const removePublishingDomain = createServerFn({ method: "POST" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization
    const domain = authorization.server.customDomain
    if (!domain) return domainError("domain_missing", "No domain is linked.")

    const providerResult = await removeDomainFromProjectAndAccount(domain)
    if (providerResult.isErr()) {
      return domainError("provider_error", providerResult.error.message)
    }
    const removed = await updateDomainLinkToServerIfCurrent({
      serverId: data.serverId,
      expectedCustomDomain: domain,
      payload: { customDomain: null, domainVerified: false },
    })
    if (!removed) {
      return domainError(
        "domain_changed",
        "The linked domain changed while removal was running. Refresh the page."
      )
    }
    return { status: "ok" as const }
  })

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
