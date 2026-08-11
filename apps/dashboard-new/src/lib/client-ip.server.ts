import { isIP } from "node:net"

export function getTrustedClientIp(
  headers: Headers,
  hostname?: string
): string | null {
  const rawIp = headers.get("x-vercel-forwarded-for")
  const firstIp = rawIp?.split(",", 1)[0]?.trim()
  if (firstIp && isIP(firstIp) !== 0) return normalizeIp(firstIp)

  const requestHost = hostname ?? headers.get("host")?.split(":", 1)[0]
  return requestHost && ["localhost", "127.0.0.1", "::1"].includes(requestHost)
    ? "127.0.0.1"
    : null
}

function normalizeIp(ip: string) {
  if (ip === "::1") return "127.0.0.1"
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip
}
