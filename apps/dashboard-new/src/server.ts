import defaultServerEntry, {
  createServerEntry,
} from "@tanstack/react-start/server-entry"
import { withDatabaseRequestCache } from "@repo/db/helpers/request-cache"

import { getHostRoutingEnv } from "@/env.server"
import {
  decideHostRouting,
  normalizeConfiguredHost,
  type HostRoutingConfig,
} from "@/lib/host-routing"

export default createServerEntry({
  async fetch(request, options) {
    return withDatabaseRequestCache(async () => {
      const routedRequest = forceHtmlThreadRepresentation(request)
      const decision = decideHostRouting(
        request.url,
        request.headers.get("host"),
        getConfig()
      )

      if (decision.type === "reject") {
        return new Response(null, { status: decision.status })
      }
      if (decision.type === "pass") {
        return defaultServerEntry.fetch(routedRequest, options)
      }

      const url = new URL(request.url)
      url.pathname = decision.pathname
      return defaultServerEntry.fetch(new Request(url, routedRequest), options)
    })
  },
})

function forceHtmlThreadRepresentation(request: Request) {
  const { pathname } = new URL(request.url)
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    !/^\/thread\/[^/]+\/[^/]+$/.test(pathname) ||
    pathname.endsWith(".md")
  ) {
    return request
  }

  const headers = new Headers(request.headers)
  headers.set("accept", "text/html")
  return new Request(request.url, { method: request.method, headers })
}

function getConfig(): HostRoutingConfig {
  const env = getHostRoutingEnv()
  const canonicalHost = normalizeConfiguredHost(env.canonicalOrigin)
  if (!canonicalHost) throw new Error("VELUMN_CANONICAL_URL is invalid")

  const previewHosts = new Set<string>()
  for (const value of env.previewHosts) {
    const hostname = normalizeConfiguredHost(value)
    if (!hostname) throw new Error(`Invalid Vercel deployment host: ${value}`)
    previewHosts.add(hostname)
  }

  return {
    canonicalHost,
    previewHosts,
    allowLocalHosts: !env.production,
    requireHttps: env.production,
  }
}
