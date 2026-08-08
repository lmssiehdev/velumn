import { Vercel } from "@vercel/sdk"
import type { GetDomainConfigResponseBody } from "@vercel/sdk/models/getdomainconfigop"
import type { GetProjectDomainResponseBody } from "@vercel/sdk/models/getprojectdomainop"
import { Result, TaggedError, type Result as ResultType } from "better-result"

const REQUEST_TIMEOUT_MS = 15_000
const CUSTOM_DOMAIN_PROJECT_ID = "prj_DtTSKM60p1hUvxppi3O3pR5nzDdr"

const requestOptions = { timeoutMs: REQUEST_TIMEOUT_MS }

export type DomainCheckResult = {
  domain: string
  verified: boolean
  status: "pending" | "verified"
  failureReason: null
  checkedAt: string
  message: string
  records: Array<{ type: string; name: string; value: string }>
}

type DomainProviderErrorCode =
  "domain_taken" | "forbidden" | "not_found" | "unavailable" | "unknown"
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

function getVercel() {
  return new Vercel({ bearerToken: process.env.VERCEL_BEARER_TOKEN })
}

function getTeamId() {
  return process.env.VERCEL_TEAM_ID
}

export async function addProjectDomain(
  domain: string
): Promise<ProviderResult<void>> {
  const result = await providerRequest(
    () =>
      getVercel().projects.addProjectDomain(
        {
          idOrName: CUSTOM_DOMAIN_PROJECT_ID,
          teamId: getTeamId(),
          requestBody: { name: domain },
        },
        requestOptions
      ),
    "add"
  )

  if (result.isErr() && result.error.providerCode === "domain_already_in_use") {
    return Result.ok()
  }
  return result.map(() => undefined)
}

export async function removeDomainFromProjectAndAccount(
  domain: string
): Promise<ProviderResult<void>> {
  const vercel = getVercel()
  const teamId = getTeamId()
  const projectRemoval = await providerRequest(
    () =>
      vercel.projects.removeProjectDomain(
        { idOrName: CUSTOM_DOMAIN_PROJECT_ID, teamId, domain },
        requestOptions
      ),
    "remove"
  )
  if (projectRemoval.isErr() && projectRemoval.error.code !== "not_found") {
    return Result.err(projectRemoval.error)
  }

  const accountRemoval = await providerRequest(
    () => vercel.domains.deleteDomain({ domain, teamId }, requestOptions),
    "remove"
  )
  if (accountRemoval.isErr() && accountRemoval.error.code !== "not_found") {
    return Result.err(accountRemoval.error)
  }
  return Result.ok()
}

export async function getDomainStatus(
  domain: string
): Promise<ProviderResult<DomainCheckResult>> {
  const checkedAt = new Date().toISOString()
  const vercel = getVercel()
  const teamId = getTeamId()
  const [projectDomainResult, domainConfigResult] = await Promise.all([
    providerRequest(
      () =>
        vercel.projects.getProjectDomain(
          { idOrName: CUSTOM_DOMAIN_PROJECT_ID, teamId, domain },
          requestOptions
        ),
      "check"
    ),
    providerRequest(
      () =>
        vercel.domains.getDomainConfig(
          {
            domain,
            projectIdOrName: CUSTOM_DOMAIN_PROJECT_ID,
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
        vercel.projects.verifyProjectDomain(
          { idOrName: CUSTOM_DOMAIN_PROJECT_ID, teamId, domain },
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
      ? "Domain is configured and ready to serve your forum."
      : records.length > 0
        ? "Add the required DNS records, then verify again."
        : "DNS changes are still propagating. Check again shortly.",
    records,
  })
}

export function getVercelErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null
  const body = "body" in error ? error.body : null
  if (typeof body !== "string") return null

  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: unknown }
      code?: unknown
    }
    const code = parsed.error?.code ?? parsed.code
    return typeof code === "string" ? code : null
  } catch {
    return null
  }
}

function getVercelStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error))
    return null
  return typeof error.statusCode === "number" ? error.statusCode : null
}

function toDomainProviderError(error: unknown, action: DomainProviderAction) {
  const providerCode = getVercelErrorCode(error)
  const statusCode = getVercelStatusCode(error)

  if (providerCode === "domain_taken") {
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
  if (statusCode === null || statusCode === 408 || statusCode >= 500) {
    return new DomainProviderFailure({
      code: "unavailable",
      message:
        "Vercel is temporarily unavailable. Your last known domain state has not been changed.",
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
  return [
    {
      name,
      type: isApexDomain ? "A" : "CNAME",
      value: isApexDomain
        ? (domainConfig.recommendedIPv4[0]?.value[0] ?? "76.76.21.21")
        : (domainConfig.recommendedCNAME[0]?.value ?? "cname.vercel-dns.com"),
    },
  ]
}
