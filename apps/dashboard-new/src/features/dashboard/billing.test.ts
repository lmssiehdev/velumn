import { describe, expect, it } from "vitest"

import { getBillingDisplayState } from "./billing"

const subscription = {
  id: "subscription-id",
  purchaserUserId: "user-id",
  productId: "product-id",
  productAllowed: true,
  status: "active" as const,
  recurringInterval: "month",
  recurringIntervalCount: 1,
  amount: 12_500,
  currency: "usd",
  cancelAtPeriodEnd: false,
  pauseAtPeriodEnd: false,
  trialStart: null,
  trialEnd: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  startedAt: null,
  endsAt: null,
  endedAt: null,
}

describe("billing display state", () => {
  it("preserves open-source grants over Polar state", () => {
    expect(
      getBillingDisplayState({
        checkoutPending: false,
        effectivePlan: "OPEN_SOURCE",
        subscriptions: [subscription],
      })
    ).toBe("open_source")
  })

  it("distinguishes scheduled cancellation from ended access", () => {
    expect(
      getBillingDisplayState({
        checkoutPending: false,
        effectivePlan: "PAID",
        subscriptions: [{ ...subscription, cancelAtPeriodEnd: true }],
      })
    ).toBe("canceling")
    expect(
      getBillingDisplayState({
        checkoutPending: false,
        effectivePlan: "FREE",
        subscriptions: [{ ...subscription, status: "canceled" }],
      })
    ).toBe("ended")
  })

  it("fails closed while payment is past due", () => {
    expect(
      getBillingDisplayState({
        checkoutPending: false,
        effectivePlan: "FREE",
        subscriptions: [{ ...subscription, status: "past_due" }],
      })
    ).toBe("past_due")
  })

  it("does not show canceling while another subscription continues", () => {
    expect(
      getBillingDisplayState({
        checkoutPending: false,
        effectivePlan: "PAID",
        subscriptions: [
          { ...subscription, id: "ending", cancelAtPeriodEnd: true },
          { ...subscription, id: "continuing" },
        ],
      })
    ).toBe("active")
  })
})
