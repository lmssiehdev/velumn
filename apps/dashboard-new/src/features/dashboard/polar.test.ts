import { beforeAll, describe, expect, it, vi } from "vitest"

import type { normalizePolarSubscription as NormalizePolarSubscription } from "./polar.server"

vi.mock("@repo/db/helpers/dashboard-billing", () => ({
  applyPolarSubscriptionSnapshot: vi.fn(),
  createPolarWebhookFingerprint: vi.fn(),
  getPolarCheckoutAttempt: vi.fn(),
  markPolarCustomerReconciliationNeeded: vi.fn(),
}))

let normalizePolarSubscription: typeof NormalizePolarSubscription
type SubscriptionInput = Parameters<typeof NormalizePolarSubscription>[2]

beforeAll(async () => {
  ;({ normalizePolarSubscription } = await import("./polar.server"))
})

describe("Polar subscription normalization", () => {
  it("maps a server-bound provider payload", () => {
    const eventAt = new Date("2026-08-11T12:00:00.000Z")
    const snapshot = normalizePolarSubscription(
      "subscription.updated",
      eventAt,
      subscription()
    )

    expect(snapshot).toMatchObject({
      id: "sub_1",
      serverId: "123456789012345678",
      purchaserUserId: "user_1",
      checkoutAttemptId: "attempt_1",
      productId: "product_1",
      status: "active",
      amount: 12_500,
      currency: "usd",
      eventAt,
      eventType: "subscription.updated",
    })
  })

  it("rejects mismatched server metadata", () => {
    expect(
      normalizePolarSubscription(
        "subscription.updated",
        new Date(),
        subscription({ serverId: "different-server" })
      )
    ).toBeNull()
  })
})

function subscription(
  metadata: SubscriptionInput["metadata"] = {
    referenceId: "123456789012345678",
    serverId: "123456789012345678",
    checkoutAttemptId: "attempt_1",
  }
): SubscriptionInput {
  const now = new Date("2026-08-11T11:00:00.000Z")
  return {
    id: "sub_1",
    customerId: "customer_1",
    customer: { externalId: "user_1" },
    checkoutId: "checkout_1",
    productId: "product_1",
    metadata,
    status: "active",
    recurringInterval: "month",
    recurringIntervalCount: 1,
    amount: 12_500,
    currency: "usd",
    cancelAtPeriodEnd: false,
    pauseAtPeriodEnd: false,
    trialStart: null,
    trialEnd: null,
    currentPeriodStart: now,
    currentPeriodEnd: new Date("2026-09-11T11:00:00.000Z"),
    currentMeterPeriodStart: now,
    currentMeterPeriodEnd: new Date("2026-09-11T11:00:00.000Z"),
    startedAt: now,
    canceledAt: null,
    pastDueAt: null,
    pausedAt: null,
    resumesAt: null,
    endsAt: null,
    endedAt: null,
    discountId: null,
    seats: null,
    customerCancellationReason: null,
    customerCancellationComment: null,
    createdAt: now,
    modifiedAt: now,
  } satisfies SubscriptionInput
}
