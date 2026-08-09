const INTERNAL_TENANT_PREFIX = "/__tenant"

export type HostRoutingConfig = {
  canonicalHost: string
  previewHosts: ReadonlySet<string>
  allowLocalHosts: boolean
  requireHttps: boolean
}

export type HostRoutingDecision =
  | {
      type: "pass"
      hostType: "canonical" | "preview" | "local" | "shared-asset"
    }
  | { type: "rewrite"; hostname: string; pathname: string }
  | { type: "reject"; status: 400 | 404; reason: string }

export function decideHostRouting(
  requestUrl: string,
  hostHeader: string | null,
  config: HostRoutingConfig
): HostRoutingDecision {
  const authority = readRequestAuthority(requestUrl, hostHeader)
  if (!authority) {
    return { type: "reject", status: 400, reason: "invalid_authority" }
  }

  const { url, hostname } = authority
  if (hasPathPrefix(url.pathname, INTERNAL_TENANT_PREFIX)) {
    return { type: "reject", status: 404, reason: "internal_path" }
  }

  const hostType = classifyPlatformHost(hostname, config)
  if (hostType) {
    if (config.requireHttps && url.protocol !== "https:") {
      return { type: "reject", status: 400, reason: "insecure_protocol" }
    }
    return { type: "pass", hostType }
  }

  if (isSharedAssetPath(url.pathname)) {
    return { type: "pass", hostType: "shared-asset" }
  }
  if (isPrivateTenantPath(url.pathname)) {
    return { type: "reject", status: 404, reason: "private_tenant_path" }
  }
  if (!isTenantPublicPath(url.pathname)) {
    return { type: "reject", status: 404, reason: "unsupported_tenant_path" }
  }

  return {
    type: "rewrite",
    hostname,
    pathname: `${INTERNAL_TENANT_PREFIX}/${encodeURIComponent(hostname)}${url.pathname === "/" ? "" : url.pathname}`,
  }
}

export function normalizeConfiguredHost(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.port
    ) {
      return null
    }
    return normalizeHostname(url.hostname)
  } catch {
    return null
  }
}

function readRequestAuthority(requestUrl: string, hostHeader: string | null) {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null

  const hostname = normalizeHostname(url.hostname)
  if (!hostname) return null

  if (hostHeader) {
    const headerAuthority = parseHostHeader(hostHeader, url.protocol)
    if (!headerAuthority) return null
    if (
      headerAuthority.hostname !== hostname ||
      headerAuthority.port !== url.port
    ) {
      return null
    }
  }

  return { url, hostname }
}

function parseHostHeader(value: string, protocol: "http:" | "https:") {
  if (
    value !== value.trim() ||
    containsInvalidAuthorityCharacter(value) ||
    value.endsWith(":")
  ) {
    return null
  }

  try {
    const url = new URL(`${protocol}//${value}`)
    const hostname = normalizeHostname(url.hostname)
    if (!hostname || url.pathname !== "/" || url.search || url.hash) return null
    return { hostname, port: url.port }
  } catch {
    return null
  }
}

function containsInvalidAuthorityCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 32 || codePoint === 127 || ",/?#@\\".includes(character)
  })
}

function normalizeHostname(value: string) {
  let hostname = value.toLowerCase()
  if (hostname.endsWith("..")) return null
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1)
  if (!hostname || hostname.length > 253) return null

  if (hostname.startsWith("[") && hostname.endsWith("]")) return hostname
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname

  const labels = hostname.split(".")
  if (
    labels.some(
      (label) =>
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) &&
        !/^[a-z0-9]$/.test(label)
    )
  ) {
    return null
  }
  return hostname
}

function classifyPlatformHost(
  hostname: string,
  config: HostRoutingConfig
): "canonical" | "preview" | "local" | null {
  if (hostname === config.canonicalHost) return "canonical"
  if (config.previewHosts.has(hostname)) return "preview"
  if (config.allowLocalHosts && isLocalHost(hostname)) return "local"
  return null
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  )
}

function isSharedAssetPath(pathname: string) {
  return pathname === "/favicon.svg" || hasPathPrefix(pathname, "/assets")
}

function isPrivateTenantPath(pathname: string) {
  if (pathname === "/api/search") return false
  return [
    "/dashboard",
    "/api",
    "/auth",
    "/trpc",
    "/_serverFn",
    "/_internal",
    "/markdown",
    "/og",
  ].some((prefix) => hasPathPrefix(pathname, prefix))
}

function isTenantPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/api/search" ||
    hasPathPrefix(pathname, "/channel") ||
    hasPathPrefix(pathname, "/thread") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    hasPathPrefix(pathname, "/sitemap.xml")
  )
}

function hasPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}
