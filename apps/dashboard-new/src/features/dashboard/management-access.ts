import type { OnboardingLifecycle } from "@repo/db/lifecycle"

export function getManagementAccess(
  lifecycle: OnboardingLifecycle | null
): "allowed" | "not_found" | "setup_required" {
  if (!lifecycle) return "not_found"
  if (lifecycle === "ready" || lifecycle === "bot_disconnected") {
    return "allowed"
  }
  return "setup_required"
}
