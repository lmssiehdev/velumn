const fallback = "/dashboard/servers"
const baseUrl = "https://velumn.invalid"

export function safeReturnTo(value: string | undefined) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback
  }

  const url = new URL(value, baseUrl)
  const dashboardPath =
    url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")

  return dashboardPath ? `${url.pathname}${url.search}${url.hash}` : fallback
}
