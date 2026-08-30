import {
  applyPolarSubscriptionSnapshot,
  createPolarWebhookFingerprint,
  getPolarCheckoutAttempt,
  markPolarCustomerReconciliationNeeded,
  type PolarSubscriptionSnapshot,
  type PolarSubscriptionStatus,
} from "@repo/db/helpers/dashboard-billing"
import { checkout, polar, webhooks } from "@polar-sh/better-auth"
import { Polar } from "@polar-sh/sdk"
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js"
import { z } from "zod"

import { getPolarEnv } from "@/env.server"

const configuredPolar = getPolarEnv()
const unavailableCredential = "billing-not-configured"

export const polarClient = new Polar({
  accessToken: configuredPolar?.accessToken ?? unavailableCredential,
  server: configuredPolar?.server ?? "sandbox",
})

export function isPolarBillingConfigured() {
  return configuredPolar !== null
}

export function getPolarConfiguration() {
  return configuredPolar
}

export function getPolarCheckoutUrls(serverId: string) {
  const origin = configuredPolar?.dashboardOrigin ?? "http://localhost:3001"
  const billingUrl = `${origin}/dashboard/servers/${serverId}/billing`
  return {
    successUrl: `${billingUrl}?checkout=success&checkout_id={CHECKOUT_ID}`,
    returnUrl: billingUrl,
  }
}

const polarSubscriptionStatusSchema = z.enum([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
])

const polarSubscriptionMetadataSchema = z.object({
  referenceId: z.string().min(1),
  serverId: z.string().min(1),
  checkoutAttemptId: z.string().min(1).nullable().optional(),
})

const polarCheckoutRequestSchema = z
  .object({
    slug: z.literal("pro"),
    referenceId: z.string().min(1),
    metadata: z
      .object({
        checkoutAttemptId: z.string().min(1),
        schemaVersion: z.literal(1),
        serverId: z.string().min(1),
      })
      .strict(),
    successUrl: z.string(),
    returnUrl: z.string(),
    redirect: z.literal(false),
  })
  .strict()

type BillingLogValue = boolean | number | string | null | undefined
type BillingLogFields = Readonly<Record<string, BillingLogValue>>
type PolarSubscriptionInput = Pick<
  Subscription,
  | "amount"
  | "cancelAtPeriodEnd"
  | "canceledAt"
  | "checkoutId"
  | "createdAt"
  | "currency"
  | "currentMeterPeriodEnd"
  | "currentMeterPeriodStart"
  | "currentPeriodEnd"
  | "currentPeriodStart"
  | "customerCancellationComment"
  | "customerCancellationReason"
  | "customerId"
  | "discountId"
  | "endedAt"
  | "endsAt"
  | "id"
  | "metadata"
  | "modifiedAt"
  | "pastDueAt"
  | "pauseAtPeriodEnd"
  | "pausedAt"
  | "productId"
  | "recurringInterval"
  | "recurringIntervalCount"
  | "resumesAt"
  | "seats"
  | "startedAt"
  | "status"
  | "trialEnd"
  | "trialStart"
> & {
  customer: Pick<Subscription["customer"], "externalId">
}

export function normalizePolarSubscription(
  eventType: string,
  eventAt: Date,
  subscription: PolarSubscriptionInput
): PolarSubscriptionSnapshot | null {
  const metadata = polarSubscriptionMetadataSchema.safeParse(
    subscription.metadata
  )
  const status = polarSubscriptionStatusSchema.safeParse(subscription.status)
  const serverId = metadata.data?.referenceId
  const metadataServerId = metadata.data?.serverId
  const checkoutAttemptId = metadata.data?.checkoutAttemptId ?? null
  const purchaserUserId = subscription.customer.externalId

  if (
    !metadata.success ||
    !status.success ||
    !serverId ||
    metadataServerId !== serverId ||
    !purchaserUserId
  ) {
    billingLog("billing.webhook.ignored", {
      eventType,
      subscriptionId: subscription.id,
      reason: "invalid_subscription_binding",
    })
    return null
  }

  return {
    id: subscription.id,
    serverId,
    purchaserUserId,
    checkoutAttemptId,
    customerId: subscription.customerId,
    checkoutId: subscription.checkoutId,
    productId: subscription.productId,
    status: status.data satisfies PolarSubscriptionStatus,
    recurringInterval: subscription.recurringInterval,
    recurringIntervalCount: subscription.recurringIntervalCount,
    amount: subscription.amount,
    currency: subscription.currency,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    pauseAtPeriodEnd: subscription.pauseAtPeriodEnd,
    trialStart: subscription.trialStart,
    trialEnd: subscription.trialEnd,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    currentMeterPeriodStart: subscription.currentMeterPeriodStart,
    currentMeterPeriodEnd: subscription.currentMeterPeriodEnd,
    startedAt: subscription.startedAt,
    canceledAt: subscription.canceledAt,
    pastDueAt: subscription.pastDueAt ?? null,
    pausedAt: subscription.pausedAt,
    resumesAt: subscription.resumesAt,
    endsAt: subscription.endsAt,
    endedAt: subscription.endedAt,
    discountId: subscription.discountId,
    seats: subscription.seats ?? null,
    customerCancellationReason:
      z.string().safeParse(subscription.customerCancellationReason).data ??
      null,
    customerCancellationComment: subscription.customerCancellationComment,
    providerCreatedAt: subscription.createdAt,
    providerModifiedAt: subscription.modifiedAt,
    eventAt,
    eventType,
  }
}

async function applySubscriptionEvent(payload: {
  type: string
  timestamp: Date
  data: Subscription
}) {
  if (!configuredPolar) return
  const snapshot = normalizePolarSubscription(
    payload.type,
    payload.timestamp,
    payload.data
  )
  if (!snapshot) return

  const eventFingerprint = createPolarWebhookFingerprint({
    eventType: payload.type,
    eventAt: payload.timestamp,
    resourceId: snapshot.id,
    snapshot,
  })
  const result = await applyPolarSubscriptionSnapshot({
    snapshot,
    allowedProductId: configuredPolar.productId,
    eventFingerprint,
  })
  billingLog("billing.subscription.updated", {
    eventType: payload.type,
    subscriptionId: snapshot.id,
    serverId: snapshot.serverId,
    result: result.type,
  })
}

export async function reconcilePolarSubscription(subscription: Subscription) {
  await applySubscriptionEvent({
    type: "subscription.reconciled",
    timestamp: new Date(),
    data: subscription,
  })
}

export const polarAuthPlugin = polar({
  client: polarClient,
  createCustomerOnSignUp: false,
  use: [
    checkout({
      products: [
        {
          productId: configuredPolar?.productId ?? unavailableCredential,
          slug: "pro",
        },
      ],
      authenticatedUsersOnly: true,
      successUrl: "/dashboard/servers",
      returnUrl: "/dashboard/servers",
    }),
    webhooks({
      secret: configuredPolar?.webhookSecret ?? unavailableCredential,
      onSubscriptionCreated: applySubscriptionEvent,
      onSubscriptionUpdated: applySubscriptionEvent,
      onSubscriptionActive: applySubscriptionEvent,
      onSubscriptionCanceled: applySubscriptionEvent,
      onSubscriptionUncanceled: applySubscriptionEvent,
      onSubscriptionRevoked: applySubscriptionEvent,
      onCustomerStateChanged: async ({ data }) => {
        if (!configuredPolar) return
        await markPolarCustomerReconciliationNeeded(data.id)
      },
    }),
  ],
})

export async function validatePolarCheckoutRequest(
  body: Parameters<typeof polarCheckoutRequestSchema.safeParse>[0],
  userId: string
): Promise<boolean> {
  if (!configuredPolar) return false
  const parsed = polarCheckoutRequestSchema.safeParse(body)
  if (!parsed.success) return false
  const request = parsed.data
  if (request.metadata.serverId !== request.referenceId) return false

  const expected = getPolarCheckoutUrls(request.referenceId)
  if (
    request.successUrl !== expected.successUrl ||
    request.returnUrl !== expected.returnUrl
  ) {
    return false
  }

  const attempt = await getPolarCheckoutAttempt(
    request.metadata.checkoutAttemptId
  )
  return Boolean(
    attempt &&
    attempt.status === "pending" &&
    attempt.userId === userId &&
    attempt.serverId === request.referenceId &&
    new Date(attempt.expiresAt) > new Date()
  )
}

function billingLog(event: string, fields: BillingLogFields) {
  console.info(JSON.stringify({ event, ...fields }))
}
