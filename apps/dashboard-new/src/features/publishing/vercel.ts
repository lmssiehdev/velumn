import { Vercel } from "@vercel/sdk"
import type { GetDomainConfigResponseBody } from "@vercel/sdk/models/getdomainconfigop"
import type { GetProjectDomainResponseBody } from "@vercel/sdk/models/getprojectdomainop"
import { Result, TaggedError, type Result as ResultType } from "better-result"
import { z } from "zod"

import { requireVercelEnv } from "@/env.server"

const REQUEST_TIMEOUT_MS = 15_000

const requestOptions = { timeoutMs: REQUEST_TIMEOUT_MS }

const vercelProviderErrorSchema = z.object({
  body: z.string().optional(),
  statusCode: z.number().optional(),
})

const vercelErrorBodySchema = z.object({
  error: z.object({ code: z.string().optional() }).optional(),
  code: z.string().optional(),
})

export type DomainCheckResult = {
  domain: string
  verified: boolean
  status: "pending" | "verified"
  failureReason: null
  checkedAt: string
  message: string
  records: Array<{ type: string; name: string; value: string }>
}

export type DomainAddResult = "attached" | "unknown"

type DomainProviderErrorCode =
  | "domain_taken"
  | "forbidden"
  | "not_found"
  | "unavailable"
  | "unknown"
type DomainProviderAction = "add" | "check" | "remove"

export class DomainProviderFailure extends TaggedError(
  "DomainProviderFailure"
)<{
  code: DomainProviderErrorCode
  message: string
  providerCode: string | null
  statusCode: number | null
}> {}

type ProviderResult<T> = ResultType<T, DomainProviderFailure>

function getVercel(action: DomainProviderAction) {
  try {
    const config = requireVercelEnv()
    return Result.ok({
      client: new Vercel({ bearerToken: config.bearerToken }),
      projectId: config.projectId,
      teamId: config.teamId,
    })
  } catch (error) {
    return Result.err(toDomainProviderError(error, action))
  }
}

export async function addProjectDomain(
  domain: string
): Promise<ProviderResult<DomainAddResult>> {
  const vercel = getVercel("add")
  if (vercel.isErr()) return Result.err(vercel.error)
  const { client, projectId, teamId } = vercel.value
  const result = await providerRequest(
    () =>
      client.projects.addProjectDomain(
        {
          idOrName: projectId,
          teamId,
          requestBody: { name: domain },
        },
        requestOptions
      ),
    "add"
  )

  if (
    result.isErr() &&
    (result.error.code === "domain_taken" ||
      isAmbiguousProviderFailure(result.error))
  ) {
    const reconciliation = await providerRequest(
      () =>
        client.projects.getProjectDomain(
          { idOrName: projectId, teamId, domain },
          requestOptions
        ),
      "check"
    )
    if (reconciliation.isOk() && reconciliation.value.name === domain) {
      return Result.ok("attached")
    }
    if (
      reconciliation.isErr() &&
      (reconciliation.error.code !== "not_found" ||
        isAmbiguousProviderFailure(result.error))
    ) {
      // The add may have succeeded. Keep the local reservation until Vercel's
      // project state can be checked conclusively.
      return Result.ok("unknown")
    }
  }
  return result.map(() => "attached" as const)
}

export async function removeDomainFromProject(
  domain: string
): Promise<ProviderResult<void>> {
  const vercel = getVercel("remove")
  if (vercel.isErr()) return Result.err(vercel.error)
  const { client, projectId, teamId } = vercel.value
  const projectRemoval = await providerRequest(
    () =>
      client.projects.removeProjectDomain(
        { idOrName: projectId, teamId, domain },
        requestOptions
      ),
    "remove"
  )
  if (projectRemoval.isOk() || projectRemoval.error.code === "not_found")
    return Result.ok()
  if (!isAmbiguousProviderFailure(projectRemoval.error))
    return Result.err(projectRemoval.error)

  const reconciliation = await providerRequest(
    () =>
      client.projects.getProjectDomain(
        { idOrName: projectId, teamId, domain },
        requestOptions
      ),
    "check"
  )
  return reconciliation.isErr() && reconciliation.error.code === "not_found"
    ? Result.ok()
    : Result.err(projectRemoval.error)
}

export async function getDomainStatus(
  domain: string
): Promise<ProviderResult<DomainCheckResult>> {
  const checkedAt = new Date().toISOString()
  const vercel = getVercel("check")
  if (vercel.isErr()) return Result.err(vercel.error)
  const { client, projectId, teamId } = vercel.value
  const [projectDomainResult, domainConfigResult] = await Promise.all([
    providerRequest(
      () =>
        client.projects.getProjectDomain(
          { idOrName: projectId, teamId, domain },
          requestOptions
        ),
      "check"
    ),
    providerRequest(
      () =>
        client.domains.getDomainConfig(
          {
            domain,
            projectIdOrName: projectId,
            teamId,
          },
          requestOptions
        ),
      "check"
    ),
  ])

  if (projectDomainResult.isErr()) return Result.err(projectDomainResult.error)
  if (domainConfigResult.isErr()) return Result.err(domainConfigResult.error)

  let projectDomain = projectDomainResult.value
  const domainConfig = domainConfigResult.value

  if (!projectDomain.verified) {
    const verificationResult = await providerRequest(
      () =>
        client.projects.verifyProjectDomain(
          { idOrName: projectId, teamId, domain },
          requestOptions
        ),
      "check"
    )
    if (verificationResult.isOk()) {
      const verification = verificationResult.value
      projectDomain = {
        ...projectDomain,
        verified: verification.verified,
        verification: verification.verified ? [] : projectDomain.verification,
      }
    } else if (
      verificationResult.error.statusCode !== 400 &&
      verificationResult.error.statusCode !== 409
    ) {
      return Result.err(verificationResult.error)
    }
  }

  const records = [
    ...toVerificationRecords(
      projectDomain.verification,
      projectDomain.apexName
    ),
    ...toMisconfigurationRecords(domain, projectDomain, domainConfig),
  ]
  const verified =
    records.length === 0 &&
    !domainConfig.misconfigured &&
    projectDomain.verified

  return Result.ok({
    domain,
    verified,
    status: verified ? "verified" : "pending",
    failureReason: null,
    checkedAt,
    message: verified
      ? "DNS is configured. Vercel may still be issuing the TLS certificate."
      : records.length > 0
        ? "Add the required DNS records, then verify again."
        : domainConfig.misconfigured
          ? "Vercel has not returned a recommended DNS record yet. Try again shortly."
          : "DNS changes are still propagating. Check again shortly.",
    records,
  })
}

export function getVercelErrorCode(
  cause: Parameters<typeof vercelProviderErrorSchema.safeParse>[0]
) {
  const providerError = vercelProviderErrorSchema.safeParse(cause)
  const body = providerError.data?.body
  if (!body) return null

  try {
    const parsed = vercelErrorBodySchema.safeParse(JSON.parse(body))
    return parsed.data?.error?.code ?? parsed.data?.code ?? null
  } catch {
    return null
  }
}

function getVercelStatusCode(
  cause: Parameters<typeof vercelProviderErrorSchema.safeParse>[0]
) {
  return vercelProviderErrorSchema.safeParse(cause).data?.statusCode ?? null
}

function toDomainProviderError(cause: unknown, action: DomainProviderAction) {
  const providerCode = getVercelErrorCode(cause)
  const statusCode = getVercelStatusCode(cause)

  if (
    providerCode === "domain_already_in_use" ||
    providerCode === "domain_taken"
  ) {
    return new DomainProviderFailure({
      code: "domain_taken",
      message:
        "This domain is attached to another Vercel project. Verify ownership there or use a different hostname.",
      providerCode,
      statusCode,
    })
  }
  if (providerCode === "not_found" || statusCode === 404) {
    return new DomainProviderFailure({
      code: "not_found",
      message:
        action === "check"
          ? "This domain is no longer attached to Velumn in Vercel. Remove it here, then add it again."
          : "The domain could not be found in Vercel.",
      providerCode,
      statusCode,
    })
  }
  if (
    providerCode === "forbidden" ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return new DomainProviderFailure({
      code: "forbidden",
      message:
        "Velumn cannot manage this domain in Vercel right now. Try again later or contact support.",
      providerCode,
      statusCode,
    })
  }
  if (
    statusCode === null ||
    statusCode === 408 ||
    statusCode === 429 ||
    statusCode >= 500
  ) {
    return new DomainProviderFailure({
      code: "unavailable",
      message:
        statusCode === 429
          ? "Vercel is checking too many domains right now. Wait a moment and try again."
          : "Vercel is temporarily unavailable. Your last known domain state has not been changed.",
      providerCode,
      statusCode,
    })
  }
  return new DomainProviderFailure({
    code: "unknown",
    message: `Vercel could not ${action} this domain. Try again shortly.`,
    providerCode,
    statusCode,
  })
}

function isAmbiguousProviderFailure(error: DomainProviderFailure) {
  return (
    error.statusCode === null ||
    error.statusCode === 408 ||
    error.statusCode >= 500
  )
}

function providerRequest<T>(
  request: () => Promise<T>,
  action: DomainProviderAction
) {
  return Result.tryPromise({
    try: request,
    catch: (error) => toDomainProviderError(error, action),
  })
}

function toVerificationRecords(
  records: GetProjectDomainResponseBody["verification"] | undefined,
  apexName: string | undefined
) {
  return (records ?? []).map((record) => ({
    name: !apexName
      ? record.domain
      : record.domain === apexName
        ? "@"
        : record.domain.endsWith(`.${apexName}`)
          ? record.domain.slice(0, -`.${apexName}`.length)
          : record.domain,
    type: (record.type || "TXT").toUpperCase(),
    value: record.value,
  }))
}

function toMisconfigurationRecords(
  domain: string,
  projectDomain: GetProjectDomainResponseBody,
  domainConfig: GetDomainConfigResponseBody
) {
  if (!domainConfig.misconfigured) return []

  const isApexDomain = projectDomain.apexName === domain
  const name = isApexDomain
    ? "@"
    : projectDomain.name.replace(`.${projectDomain.apexName}`, "")
  const value = isApexDomain
    ? domainConfig.recommendedIPv4[0]?.value[0]
    : domainConfig.recommendedCNAME[0]?.value
  return value ? [{ name, type: isApexDomain ? "A" : "CNAME", value }] : []
}
