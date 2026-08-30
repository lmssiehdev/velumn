import {
  createPolarCheckoutAttempt,
  failPolarCheckoutAttempt,
  getPurchaserPortalAccess,
  getServerBillingProjection,
  type BillingSubscription,
} from "@repo/db/helpers/dashboard-billing"
import { getDashboardServerForUser } from "@repo/db/helpers/dashboard-servers"
import { discordSnowflakeSchema } from "@repo/utils/helpers/discord"
import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { requireServerAuth } from "@/lib/server-auth"

import { fetchDiscordGuilds } from "../onboarding/discord-server"
import { getBillingDisplayState, PRO_MONTHLY_PRICE } from "./billing"
import { getManagementAccess } from "./management-access"
import {
  getPolarCheckoutUrls,
  getPolarConfiguration,
  polarClient,
} from "./polar.server"
import { authorizeManagementServer } from "./server-context"
import { toServerIdentity } from "./urls"

const serverInputSchema = z.object({ serverId: discordSnowflakeSchema })
const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000

export const getBillingPage = createServerFn({ method: "GET" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store")
    const authorization = await authorizeManagementServer(
      data.serverId,
      "billing"
    )
    if (authorization.status === "error") return authorization

    const { session } = await requireServerAuth()
    const projection = await getServerBillingProjection({
      serverId: data.serverId,
    })
    if (!projection) {
      return billingError("server_not_found", "The server could not be found.")
    }

    const checkoutPending = projection.checkoutAttempt?.status === "pending"
    const displayState = getBillingDisplayState({
      checkoutPending,
      effectivePlan: projection.effectivePlan,
      subscriptions: projection.subscriptions,
    })
    const currentSubscription = selectCurrentSubscription(
      projection.subscriptions
    )

    return {
      status: "ok" as const,
      data: {
        server: toServerIdentity(authorization.server),
        configured: getPolarConfiguration() !== null,
        displayState,
        effectivePlan: projection.effectivePlan,
        price: PRO_MONTHLY_PRICE,
        currency: "USD" as const,
        subscription: currentSubscription,
        owners: projection.owners,
        currentUserOwnsBilling: projection.owners.some(
          (owner) => owner.id === session.user.id
        ),
        checkoutPending,
        canStartCheckout:
          getPolarConfiguration() !== null &&
          projection.effectivePlan === "FREE" &&
          !checkoutPending &&
          !projection.subscriptions.some(
            (subscription) =>
              subscription.productAllowed &&
              (subscription.status === "active" ||
                subscription.status === "trialing" ||
                subscription.status === "past_due")
          ),
      },
    }
  })

export const startProCheckout = createServerFn({ method: "POST" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store")
    const polar = getPolarConfiguration()
    if (!polar) {
      return billingError(
        "billing_unavailable",
        "Billing is not available in this environment."
      )
    }

    const context = await requireServerAuth()
    const server = await getDashboardServerForUser({
      userId: context.session.user.id,
      serverId: data.serverId,
    })
    const access = getManagementAccess(server?.lifecycle ?? null)
    if (!server || access === "not_found") {
      return billingError("server_not_found", "The server could not be found.")
    }
    if (access === "setup_required") {
      return billingError(
        "setup_required",
        "Finish setting up this server before starting Pro."
      )
    }

    const guilds = await fetchDiscordGuilds(context)
    if (guilds.status === "error") return guilds
    if (!guilds.guilds.some((guild) => guild.id === data.serverId)) {
      return billingError(
        "billing_permission_required",
        "You need Manage Server permission in Discord to start billing."
      )
    }

    const attemptResult = await createPolarCheckoutAttempt({
      serverId: data.serverId,
      userId: context.session.user.id,
      expiresAt: new Date(Date.now() + CHECKOUT_ATTEMPT_TTL_MS),
    })
    if (attemptResult.type === "already_entitled") {
      return billingError(
        "already_subscribed",
        "This server already has Pro access."
      )
    }
    if (attemptResult.type === "pending_attempt_exists") {
      return billingError(
        "checkout_in_progress",
        "A checkout is already in progress. Wait a few minutes and try again."
      )
    }
    if (attemptResult.type === "server_not_found") {
      return billingError("server_not_found", "The server could not be found.")
    }

    const attempt = attemptResult.attempt
    const urls = getPolarCheckoutUrls(data.serverId)
    try {
      const result = await context.auth.api.checkout({
        headers: context.headers,
        body: {
          slug: "pro",
          referenceId: data.serverId,
          metadata: {
            schemaVersion: 1,
            serverId: data.serverId,
            checkoutAttemptId: attempt.id,
          },
          successUrl: urls.successUrl,
          returnUrl: urls.returnUrl,
          redirect: false,
        },
      })
      return { status: "ok" as const, data: { url: result.url } }
    } catch {
      await failPolarCheckoutAttempt(
        attempt.id,
        context.session.user.id,
        "provider_error"
      )
      return billingError(
        "provider_error",
        "Checkout could not start. Try again in a moment."
      )
    }
  })

export const openBillingPortal = createServerFn({ method: "POST" })
  .validator(serverInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store")
    if (!getPolarConfiguration()) {
      return billingError(
        "billing_unavailable",
        "Billing is not available in this environment."
      )
    }
    const context = await requireServerAuth()
    const access = await getPurchaserPortalAccess({
      serverId: data.serverId,
      userId: context.session.user.id,
    })
    if (!access.purchased) {
      return billingError(
        "portal_forbidden",
        "Only the person who started this subscription can manage it."
      )
    }

    try {
      const result = await polarClient.customerSessions.create({
        externalCustomerId: context.session.user.id,
        returnUrl: `${getPolarConfiguration()?.dashboardOrigin}/dashboard/servers/${data.serverId}/billing`,
      })
      return {
        status: "ok" as const,
        data: { url: result.customerPortalUrl },
      }
    } catch {
      return billingError(
        "provider_error",
        "The billing portal could not open. Try again in a moment."
      )
    }
  })

function billingError(code: string, message: string) {
  return { status: "error" as const, code, message }
}

function selectCurrentSubscription(
  subscriptions: BillingSubscription[]
): BillingSubscription | null {
  for (const subscription of subscriptions) {
    if (
      subscription.productAllowed &&
      subscription.status === "active" &&
      !subscription.cancelAtPeriodEnd
    ) {
      return subscription
    }
  }
  for (const subscription of subscriptions) {
    if (
      subscription.productAllowed &&
      subscription.status === "trialing" &&
      !subscription.cancelAtPeriodEnd
    ) {
      return subscription
    }
  }
  for (const subscription of subscriptions) {
    if (
      subscription.productAllowed &&
      (subscription.status === "active" || subscription.status === "trialing")
    ) {
      return subscription
    }
  }
  for (const subscription of subscriptions) {
    if (subscription.productAllowed && subscription.status === "past_due") {
      return subscription
    }
  }
  return subscriptions.length > 0 ? subscriptions[0] : null
}
