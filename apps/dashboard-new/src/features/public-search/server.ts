import { isIP } from "node:net"

import {
  resolvePublicChannel,
  resolvePublicServer,
  resolvePublicThreadServer,
  resolveVerifiedPublicTenant,
} from "@repo/db/helpers/public-content"
import type { BotRouter } from "@repo/api/client"
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client"

import { requireIndexingEnv } from "@/env.server"
import {
  canonicalPublicSearchRequestSchema,
  publicSearchResponseSchema,
  tenantPublicSearchRequestSchema,
  type PublicSearchResponse,
  type PublicSearchScope,
} from "./contracts"

const maxRequestBytes = 4_096
const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Origin",
}

type SearchRequestDependencies = {
  clientIp: (request: Request) => string | null
  search: (
    serverId: string,
    query: string,
    clientIp: string,
    signal: AbortSignal
  ) => Promise<PublicSearchResponse>
}

const defaultDependencies: SearchRequestDependencies = {
  clientIp: getTrustedRequestIp,
  search: requestBotSearch,
}

export async function handleCanonicalPublicSearch(
  request: Request,
  dependencies: SearchRequestDependencies = defaultDependencies,
  resolveScope: (
    scope: PublicSearchScope
  ) => Promise<string | null> = resolveCanonicalScope
) {
  const body = await readSearchBody(request)
  if (body instanceof Response) return body

  const parsed = canonicalPublicSearchRequestSchema.safeParse(body)
  if (!parsed.success) return errorResponse(400, "invalid_request")

  const serverId = await resolveScope(parsed.data.scope)
  if (!serverId) return errorResponse(404, "not_found")

  return executeSearch(request, serverId, parsed.data.query, dependencies)
}

export async function handleTenantPublicSearch(
  request: Request,
  hostname: string,
  dependencies: SearchRequestDependencies = defaultDependencies,
  resolveTenant: (hostname: string) => Promise<string | null> = async (host) =>
    (await resolveVerifiedPublicTenant(host))?.serverId ?? null
) {
  const body = await readSearchBody(request)
  if (body instanceof Response) return body

  const parsed = tenantPublicSearchRequestSchema.safeParse(body)
  if (!parsed.success) return errorResponse(400, "invalid_request")

  const serverId = await resolveTenant(hostname)
  if (!serverId) return errorResponse(404, "not_found")

  return executeSearch(request, serverId, parsed.data.query, dependencies)
}

async function readSearchBody(request: Request): Promise<unknown | Response> {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
    return errorResponse(403, "invalid_origin")
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return errorResponse(415, "invalid_content_type")
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return errorResponse(413, "request_too_large")
  }

  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > maxRequestBytes) {
      return errorResponse(413, "request_too_large")
    }
    return JSON.parse(text) as unknown
  } catch {
    return errorResponse(400, "invalid_json")
  }
}

async function executeSearch(
  request: Request,
  serverId: string,
  query: string,
  dependencies: SearchRequestDependencies
) {
  const clientIp = dependencies.clientIp(request)
  if (!clientIp) return errorResponse(503, "search_unavailable")

  try {
    const result = await dependencies.search(
      serverId,
      query,
      clientIp,
      request.signal
    )
    return Response.json(result, { headers: responseHeaders })
  } catch (error) {
    if (request.signal.aborted) throw error

    const code = error instanceof TRPCClientError ? error.data?.code : undefined
    if (code === "TOO_MANY_REQUESTS") {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { ...responseHeaders, "Retry-After": "60" },
        }
      )
    }
    if (code === "SERVICE_UNAVAILABLE") {
      return errorResponse(503, "search_unavailable")
    }
    return errorResponse(502, "search_failed")
  }
}

async function resolveCanonicalScope(scope: PublicSearchScope) {
  if (scope.kind === "server") {
    return (await resolvePublicServer(scope.id))?.serverId ?? null
  }
  if (scope.kind === "channel") {
    return (await resolvePublicChannel(scope.id))?.serverId ?? null
  }
  return (await resolvePublicThreadServer(scope.id))?.serverId ?? null
}

async function requestBotSearch(
  serverId: string,
  query: string,
  clientIp: string,
  signal: AbortSignal
) {
  const { apiOrigin, secret } = requireIndexingEnv()
  const client = createTRPCClient<BotRouter>({
    links: [
      httpLink({
        url: `${apiOrigin}/trpc`,
        headers: {
          "x-velumn-client-ip": clientIp,
          "x-velumn-secret": secret,
        },
      }),
    ],
  })
  const result = await client.searchPublic.query(
    { serverId, query },
    { signal }
  )
  return publicSearchResponseSchema.parse(result)
}

export function getTrustedRequestIp(request: Request) {
  const rawIp =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip")
  const firstIp = rawIp?.split(",", 1)[0]?.trim()
  if (firstIp && isIP(firstIp) !== 0) return normalizeIp(firstIp)

  const hostname = new URL(request.url).hostname
  return ["localhost", "127.0.0.1", "::1"].includes(hostname)
    ? "127.0.0.1"
    : null
}

function normalizeIp(ip: string) {
  if (ip === "::1") return "127.0.0.1"
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip
}

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status, headers: responseHeaders })
}
