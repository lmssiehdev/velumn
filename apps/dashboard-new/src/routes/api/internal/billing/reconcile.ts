import { randomUUID } from "node:crypto"

import {
  claimPolarReconciliationBatch,
  completePolarCheckoutReconciliation,
  completePolarSubscriptionReconciliation,
  deferPolarSubscriptionReconciliation,
  recordPolarSubscriptionMissing,
  releasePolarCheckoutReconciliation,
} from "@repo/db/helpers/dashboard-billing"
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js"
import { createFileRoute } from "@tanstack/react-router"

import { requireCronSecret } from "@/env.server"
import {
  getPolarConfiguration,
  polarClient,
  reconcilePolarSubscription,
} from "@/features/dashboard/polar.server"

const BATCH_SIZE = 20
const CONCURRENCY = 5

export const Route = createFileRoute("/api/internal/billing/reconcile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let expectedSecret: string
        try {
          expectedSecret = requireCronSecret()
        } catch {
          return Response.json({ error: "not_configured" }, { status: 503 })
        }
        if (
          request.headers.get("authorization") !== `Bearer ${expectedSecret}`
        ) {
          return Response.json({ error: "unauthorized" }, { status: 401 })
        }
        if (!getPolarConfiguration()) {
          return Response.json(
            { error: "billing_not_configured" },
            { status: 503 }
          )
        }

        const leaseOwner = randomUUID()
        const batch = await claimPolarReconciliationBatch({
          leaseOwner,
          limit: BATCH_SIZE,
        })
        const work = [
          ...batch.subscriptions.map((subscription) => async () => {
            try {
              const current = await polarClient.subscriptions.get({
                id: subscription.id,
              })
              await reconcilePolarSubscription(current)
              await completePolarSubscriptionReconciliation(
                subscription.id,
                leaseOwner
              )
              return true
            } catch (error) {
              if (error instanceof ResourceNotFound) {
                await recordPolarSubscriptionMissing(
                  subscription.id,
                  leaseOwner
                )
              } else {
                await deferPolarSubscriptionReconciliation(
                  subscription.id,
                  leaseOwner,
                  "provider_error"
                )
              }
              return false
            }
          }),
          ...batch.attempts.map((attempt) => async () => {
            try {
              if (!attempt.userId) {
                await releasePolarCheckoutReconciliation(attempt.id, leaseOwner)
                return false
              }
              const state = await polarClient.customers.getStateExternal({
                externalId: attempt.userId,
              })
              const subscription = state.activeSubscriptions.find(
                (candidate) =>
                  candidate.metadata.checkoutAttemptId === attempt.id &&
                  candidate.metadata.referenceId === attempt.serverId
              )
              if (subscription) {
                const current = await polarClient.subscriptions.get({
                  id: subscription.id,
                })
                await reconcilePolarSubscription(current)
              }
              await completePolarCheckoutReconciliation(attempt.id, leaseOwner)
              return true
            } catch (error) {
              if (error instanceof ResourceNotFound) {
                await completePolarCheckoutReconciliation(
                  attempt.id,
                  leaseOwner
                )
              } else {
                await releasePolarCheckoutReconciliation(attempt.id, leaseOwner)
              }
              return false
            }
          }),
        ]

        let completed = 0
        for (let offset = 0; offset < work.length; offset += CONCURRENCY) {
          const results = await Promise.all(
            work.slice(offset, offset + CONCURRENCY).map((run) => run())
          )
          completed += results.filter(Boolean).length
        }

        return Response.json({ claimed: work.length, completed })
      },
    },
  },
})
