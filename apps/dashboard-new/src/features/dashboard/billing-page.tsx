import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"
import { format } from "date-fns"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import type { BillingPageData } from "./billing.queries"
import { useOpenBillingPortal, useStartProCheckout } from "./billing.queries"

export function BillingPage({
  data,
  serverId,
  userId,
  checkoutReturned,
  isRefreshing,
  onRefresh,
}: {
  data: BillingPageData
  serverId: string
  userId: string
  checkoutReturned: boolean
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const checkout = useStartProCheckout(userId, serverId)
  const portal = useOpenBillingPortal()
  const [actionError, setActionError] = useState<string | null>(null)
  const subscription = data.subscription
  const relevantEnd =
    data.displayState === "trialing"
      ? subscription?.trialEnd
      : subscription?.currentPeriodEnd
  const periodEnd = relevantEnd ? new Date(relevantEnd) : null
  const liveStatus = data.checkoutPending
    ? "Waiting for Polar to confirm the subscription."
    : checkoutReturned &&
        ["trialing", "active", "canceling"].includes(data.displayState)
      ? "Subscription confirmed."
      : ""

  const startCheckout = async () => {
    setActionError(null)
    try {
      const result = await checkout.mutateAsync()
      if (result.status === "error") {
        setActionError(result.message)
        return
      }
      window.location.assign(result.data.url)
    } catch {
      setActionError(
        "Checkout could not start. Check your connection and try again."
      )
    }
  }

  const openPortal = async () => {
    setActionError(null)
    try {
      const result = await portal.mutateAsync(serverId)
      if (result.status === "error") {
        setActionError(result.message)
        return
      }
      window.location.assign(result.data.url)
    } catch {
      setActionError(
        "The billing portal could not open. Check your connection and try again."
      )
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      <header>
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CreditCard aria-hidden="true" className="size-3.5" /> Billing
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-balance">
          Plan and billing
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-pretty text-muted-foreground">
          Manage Pro access for {data.server.name}. Payments, invoices, and card
          details stay in Polar's secure portal.
        </p>
      </header>

      <p className="sr-only" aria-live="polite">
        {liveStatus}
      </p>

      {!data.configured && (
        <InlineStatus tone="warning" title="Billing is unavailable">
          Checkout is not available right now. Existing server access is
          unchanged. Contact support if this persists.
        </InlineStatus>
      )}

      {data.checkoutPending && (
        <InlineStatus tone="info" title="Waiting for subscription confirmation">
          Checkout has started. This page updates when Polar confirms the
          subscription.
          <Button
            className="ml-2 h-auto p-0 align-baseline"
            variant="link"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            Check again
          </Button>
        </InlineStatus>
      )}

      {data.displayState === "past_due" && (
        <InlineStatus tone="error" title="Payment needs attention">
          Pro access is paused. The billing owner can update the payment method
          in Polar.
        </InlineStatus>
      )}

      <section className="mt-7 grid gap-8 border-t pt-7 md:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.5fr)] md:gap-12">
        <div>
          <h2 className="text-base font-semibold">Current plan</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-6 text-pretty text-muted-foreground">
            Pro adds custom domains and priority support while keeping every
            Free feature.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">
                  {planName(data.displayState)}
                </h3>
                <PlanBadge state={data.displayState} />
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {planDescription(data.displayState, periodEnd)}
              </p>
            </div>
            <PlanPrice data={data} />
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
            {data.canStartCheckout && (
              <Button disabled={checkout.isPending} onClick={startCheckout}>
                {checkout.isPending && (
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                )}
                {data.displayState === "ended"
                  ? "Restart Pro"
                  : "Start 7-day trial"}
              </Button>
            )}
            {data.currentUserOwnsBilling && (
              <Button
                variant="outline"
                disabled={portal.isPending}
                onClick={openPortal}
              >
                {portal.isPending ? (
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <ArrowUpRight />
                )}
                Manage billing
              </Button>
            )}
            {!data.canStartCheckout &&
              !data.currentUserOwnsBilling &&
              data.owners.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Billing is managed by{" "}
                  {data.owners.map((owner) => owner.name).join(", ")}.
                </p>
              )}
          </div>

          {actionError && (
            <p
              className="mt-4 flex gap-2 text-sm text-destructive"
              role="alert"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {actionError}
            </p>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-8 border-t pt-7 md:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.5fr)] md:gap-12">
        <div>
          <h2 className="text-base font-semibold">Included with Pro</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-6 text-pretty text-muted-foreground">
            Your indexed channels, page views, and public pages remain unlimited
            on every plan.
          </p>
        </div>
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            "Your own custom domain",
            "Priority support",
            "Everything in Free",
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-4 text-emerald-600" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PlanPrice({ data }: { data: BillingPageData }) {
  if (data.displayState === "free" || data.displayState === "ended") {
    return <Price value="$0" detail="forever" />
  }
  if (data.displayState === "processing") {
    return <Price value="Pending" detail="awaiting confirmation" />
  }
  if (data.displayState === "open_source") {
    return <Price value="Included" detail="open-source grant" />
  }
  if (data.displayState === "legacy_paid") {
    return <Price value="Managed" detail="outside Polar" />
  }

  const subscription = data.subscription
  const value =
    subscription?.amount != null && subscription.currency
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: subscription.currency,
          maximumFractionDigits: 0,
        }).format(subscription.amount / 100)
      : `$${data.price}`
  const interval = subscription?.recurringInterval ?? "month"
  const count = subscription?.recurringIntervalCount ?? 1
  const detail = count === 1 ? `per ${interval}` : `every ${count} ${interval}s`
  return <Price value={value} detail={detail} />
}

function Price({ value, detail }: { value: string; detail: string }) {
  return (
    <div className="shrink-0 sm:text-right">
      <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function PlanBadge({ state }: { state: BillingPageData["displayState"] }) {
  const ended = state === "ended" || state === "past_due"
  return (
    <Badge variant={ended ? "destructive" : "secondary"}>
      {state === "trialing"
        ? "Trial"
        : state === "canceling"
          ? "Cancels soon"
          : state === "past_due"
            ? "Past due"
            : state === "open_source"
              ? "Open source"
              : state === "processing"
                ? "Processing"
                : state === "active" || state === "legacy_paid"
                  ? "Active"
                  : state === "ended"
                    ? "Ended"
                    : "Free"}
    </Badge>
  )
}

function planName(state: BillingPageData["displayState"]) {
  return state === "free" || state === "ended" ? "Free" : "Pro"
}

function planDescription(
  state: BillingPageData["displayState"],
  periodEnd: Date | null
) {
  const date = periodEnd ? format(periodEnd, "MMMM d, yyyy") : null
  if (state === "trialing")
    return date ? `Your trial ends ${date}.` : "Your Pro trial is active."
  if (state === "canceling")
    return date
      ? `Pro remains active until ${date}.`
      : "Pro remains active through the current period."
  if (state === "active")
    return date ? `Your plan renews ${date}.` : "Your Pro plan is active."
  if (state === "past_due")
    return "Update the payment method to restore Pro access."
  if (state === "processing") return "Polar is confirming the subscription."
  if (state === "open_source")
    return "Full Pro access through the Velumn open-source program."
  if (state === "legacy_paid") return "Pro access is managed manually."
  if (state === "ended") return "The previous subscription has ended."
  return "Publish on Velumn with unlimited indexed channels and page views."
}

function InlineStatus({
  children,
  title,
  tone,
}: {
  children: React.ReactNode
  title: string
  tone: "error" | "info" | "warning"
}) {
  const Icon =
    tone === "error" ? CircleAlert : tone === "warning" ? Clock3 : ShieldCheck
  return (
    <div
      className="mt-6 flex gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm"
      role={tone === "error" ? "alert" : undefined}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  )
}

export function BillingPending() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-7 grid gap-8 border-t pt-7 md:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.5fr)] md:gap-12">
        <div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-3 h-16 w-full max-w-sm" />
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    </div>
  )
}
