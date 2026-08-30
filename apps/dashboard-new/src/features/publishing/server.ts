import {
  beginDomainRemoval,
  completeDomainProvisioning,
  completeDomainRemoval,
  completeDomainVerification,
  getDomainLifecycle,
  getServerByCustomDomain,
  releaseDomainProvisioning,
  reserveDomainForServer,
} from "@repo/db/helpers/domains"
import { isServerProEntitled } from "@repo/db/helpers/dashboard-billing"
import { buildHostUrl, normalizeDomain } from "@repo/utils/helpers/domains"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authorizeManagementServer } from "@/features/dashboard/server-context"
import { toServerIdentity } from "@/features/dashboard/urls"
import { getHostRoutingEnv } from "@/env.server"

import {
  addProjectDomain,
  getDomainStatus,
  removeDomainFromProject,
} from "./vercel"
import {
  addPublishingDomainOrchestration,
  removePublishingDomainOrchestration,
  verifyPublishingDomainOrchestration,
  type PublishingOrchestrationDependencies,
} from "./orchestration"

const orchestrationDependencies: PublishingOrchestrationDependencies = {
  addProjectDomain,
  beginDomainRemoval,
  completeDomainProvisioning,
  completeDomainRemoval,
  completeDomainVerification,
  getDomainLifecycle,
  getDomainStatus,
  releaseDomainProvisioning,
  removeDomainFromProject,
  reserveDomainForServer,
}

const serverInputSchema = z.object({ serverId: discordSnowflakeSchema })

export const getPublishingPage = createServerFn({ method: "GET" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization

    const { server } = authorization
    const [lifecycle, canAddCustomDomain] = await Promise.all([
      getDomainLifecycle(server.id),
      isServerProEntitled(server.id),
    ])
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
        canAddCustomDomain,
        domainLifecycle: {
          status:
            lifecycle?.status ??
            (customDomain
              ? server.domainVerified
                ? ("verified" as const)
                : ("pending" as const)
              : ("unconfigured" as const)),
          generation: lifecycle?.generation ?? 0,
        },
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
    z.object({
      serverId: discordSnowflakeSchema,
      domain: z.string().min(1).max(253),
    })
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
    if (!(await isServerProEntitled(data.serverId))) {
      return domainError(
        "upgrade_required",
        "Upgrade to Pro to add a custom domain."
      )
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
    const canonicalHost = new URL(getHostRoutingEnv().canonicalOrigin).hostname
    if (
      domain === canonicalHost ||
      domain.endsWith(`.${canonicalHost}`) ||
      domain.endsWith(".vercel.app")
    ) {
      return domainError(
        "invalid_domain",
        "Use a domain that is not reserved by Velumn or Vercel."
      )
    }

    const existingOwner = await getServerByCustomDomain(domain)
    if (existingOwner && existingOwner.id !== data.serverId) {
      return domainError(
        "domain_unavailable",
        "This domain is already linked to another server."
      )
    }

    return addPublishingDomainOrchestration(
      { serverId: data.serverId, domain },
      orchestrationDependencies
    )
  })

export const verifyPublishingDomain = createServerFn({ method: "POST" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization
    return verifyPublishingDomainOrchestration(
      data.serverId,
      orchestrationDependencies
    )
  })

export const removePublishingDomain = createServerFn({ method: "POST" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    const authorization = await authorizeManagementServer(
      data.serverId,
      "publishing"
    )
    if (authorization.status === "error") return authorization
    return removePublishingDomainOrchestration(
      data.serverId,
      orchestrationDependencies
    )
  })

function domainError(code: string, message: string) {
  return { status: "error" as const, code, message }
}
