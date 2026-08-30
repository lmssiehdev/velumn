import type { BillingSubscription } from "@repo/db/helpers/dashboard-billing"

export const PRO_MONTHLY_PRICE = 125

export type BillingDisplayState =
  | "free"
  | "processing"
  | "trialing"
  | "active"
  | "canceling"
  | "past_due"
  | "ended"
  | "open_source"
  | "legacy_paid"

export function getBillingDisplayState({
  checkoutPending,
  effectivePlan,
  subscriptions,
}: {
  checkoutPending: boolean
  effectivePlan: "FREE" | "OPEN_SOURCE" | "PAID"
  subscriptions: BillingSubscription[]
}): BillingDisplayState {
  if (effectivePlan === "OPEN_SOURCE") return "open_source"

  const entitled = subscriptions.filter(
    (subscription) =>
      subscription.productAllowed &&
      (subscription.status === "active" || subscription.status === "trialing")
  )
  const continuing = entitled.filter(
    (subscription) => !subscription.cancelAtPeriodEnd
  )
  if (continuing.some((subscription) => subscription.status === "active"))
    return "active"
  if (continuing.some((subscription) => subscription.status === "trialing"))
    return "trialing"
  if (entitled.length > 0) return "canceling"
  if (
    subscriptions.some(
      (subscription) =>
        subscription.productAllowed && subscription.status === "past_due"
    )
  ) {
    return "past_due"
  }
  if (checkoutPending) return "processing"
  if (subscriptions.length > 0) return "ended"
  if (effectivePlan === "PAID") return "legacy_paid"
  return "free"
}
