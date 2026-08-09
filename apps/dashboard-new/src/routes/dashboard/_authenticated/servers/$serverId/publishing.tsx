import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  publishingPageQueryOptions,
  publishingVerificationQueryOptions,
  useAddPublishingDomain,
  useRemovePublishingDomain,
  type PublishingPageData,
  type PublishingVerification,
} from "@/features/publishing/queries"
import { cn } from "@/lib/utils"

export const Route = createFileRoute(
  "/dashboard/_authenticated/servers/$serverId/publishing"
)({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(
      publishingPageQueryOptions(context.user.id, params.serverId)
    )
    if (result.status === "error") {
      if (result.code === "setup_required") {
        throw redirect({
          to: "/dashboard/servers/$serverId/setup",
          params: { serverId: params.serverId },
        })
      }
      throw notFound()
    }
    return result
  },
  pendingComponent: PublishingPending,
  component: PublishingPage,
})

function PublishingPage() {
  const { user } = Route.useRouteContext()
  const { serverId } = Route.useParams()
  const router = useRouter()
  const query = useQuery(publishingPageQueryOptions(user.id, serverId))
  const result = query.data

  if (query.isError || !result || result.status === "error") {
    return (
      <PublishingError
        onRetry={() => query.refetch()}
        onSwitchServer={() => router.navigate({ to: "/dashboard/servers" })}
      />
    )
  }

  return (
    <PublishingSettings
      key={result.data.customDomain ?? "no-domain"}
      data={result.data}
      userId={user.id}
      serverId={serverId}
    />
  )
}

function PublishingSettings({
  data,
  serverId,
  userId,
}: {
  data: PublishingPageData
  serverId: string
  userId: string
}) {
  const [domainInput, setDomainInput] = useState(data.customDomain ?? "")
  const [addError, setAddError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const addDomain = useAddPublishingDomain(userId, serverId)
  const removeDomain = useRemovePublishingDomain(userId, serverId)
  const removalPending = data.domainLifecycle.status === "removing"
  const verification = useQuery(
    publishingVerificationQueryOptions(
      userId,
      serverId,
      data.customDomain,
      data.domainLifecycle.status,
      data.domainLifecycle.generation
    )
  )
  const currentVerification =
    verification.data?.status === "ok"
      ? verification.data.data
      : data.verification
  const verificationError = verification.isError
    ? "Unable to verify the domain. Check your connection and try again."
    : verification.data?.status === "error"
      ? verification.data.message
      : null
  const lastKnownCustomActive = data.canonicalUrl !== data.defaultUrl
  const customDomainActive =
    currentVerification.status === "verified" ||
    (currentVerification.status === "failed" && lastKnownCustomActive)
  const canonicalUrl =
    data.customDomain && customDomainActive
      ? `https://${data.customDomain}/`
      : data.defaultUrl

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAddError(null)
    try {
      const result = await addDomain.mutateAsync(domainInput)
      if (result.status === "error") setAddError(result.message)
    } catch {
      setAddError(
        "Unable to add the domain. Check your connection and try again."
      )
    }
  }

  const handleRemove = async () => {
    setRemoveError(null)
    try {
      const result = await removeDomain.mutateAsync()
      if (result.status === "error") {
        setRemoveError(result.message)
        return
      }
      setRemoveOpen(false)
    } catch {
      setRemoveError(
        "Unable to remove the domain. Check your connection and try again."
      )
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe2 className="size-3.5" /> Publishing
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-balance">
            Custom domain
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-pretty text-muted-foreground">
            Host {data.server.name} at a domain you control.
          </p>
        </div>
        <Button
          variant="outline"
          render={<a href={canonicalUrl} target="_blank" rel="noreferrer" />}
        >
          Visit forum <ArrowUpRight data-icon="inline-end" />
        </Button>
      </header>

      {data.disconnected && (
        <div className="mt-6 flex gap-3 rounded-lg border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium">Discord is disconnected</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Domain management remains available. Reconnect Discord to publish
              new conversations.
            </p>
          </div>
        </div>
      )}

      <section className="mt-7 grid gap-8 border-t pt-7 md:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.5fr)] md:gap-12">
        <div>
          <h2 className="text-base font-semibold">Set up your domain</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-6 text-pretty text-muted-foreground">
            Your custom domain will become the public address for this forum.
          </p>
        </div>

        <div className="min-w-0">
          <form onSubmit={handleAdd}>
            <label htmlFor="custom-domain" className="text-sm font-medium">
              Enter your domain URL
            </label>
            <p
              id="custom-domain-help"
              className="mt-1 text-sm leading-6 text-pretty text-muted-foreground"
            >
              Use a root domain or subdomain, without a path or query string.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <InputGroup
                className={cn("h-9 flex-1", data.customDomain && "bg-muted/40")}
              >
                <InputGroupAddon className="border-r pr-2.5">
                  <InputGroupText>https://</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="custom-domain"
                  autoComplete="url"
                  className={cn(data.customDomain && "cursor-default")}
                  readOnly={Boolean(data.customDomain)}
                  disabled={addDomain.isPending}
                  onChange={(event) => {
                    setDomainInput(event.target.value)
                    setAddError(null)
                  }}
                  placeholder="community.example.com"
                  value={domainInput}
                  aria-describedby={
                    addError
                      ? "custom-domain-help custom-domain-error"
                      : "custom-domain-help"
                  }
                  aria-invalid={Boolean(addError)}
                />
              </InputGroup>

              {data.customDomain ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="icon-lg"
                    variant="outline"
                    aria-label={
                      removalPending
                        ? "Retry custom domain removal"
                        : "Remove custom domain"
                    }
                    title={
                      removalPending
                        ? "Retry custom domain removal"
                        : "Remove custom domain"
                    }
                    disabled={removeDomain.isPending}
                    onClick={() => {
                      setRemoveError(null)
                      setRemoveOpen(true)
                    }}
                  >
                    {removeDomain.isPending ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    disabled={removalPending || verification.isFetching}
                    onClick={() => verification.refetch()}
                  >
                    <RefreshCw
                      className={cn(verification.isFetching && "animate-spin")}
                    />
                    Refresh
                  </Button>
                </div>
              ) : (
                <Button
                  type="submit"
                  className="h-9"
                  disabled={!domainInput.trim() || addDomain.isPending}
                >
                  {addDomain.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  Add domain
                </Button>
              )}
            </div>
            {addError && (
              <InlineError id="custom-domain-error" className="mt-3">
                {addError}
              </InlineError>
            )}
          </form>

          {data.customDomain && (
            <DomainConfiguration
              checking={verification.isFetching}
              domain={data.customDomain}
              lastKnownActive={lastKnownCustomActive}
              removalPending={removalPending}
              queryError={verificationError}
              verification={currentVerification}
            />
          )}
        </div>
      </section>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {removalPending
                ? "Retry custom domain removal?"
                : "Remove custom domain?"}
            </DialogTitle>
            <DialogDescription>
              {removalPending
                ? `${data.customDomain} is no longer serving the forum, but Vercel has not confirmed removal. Retry the cleanup now.`
                : `The forum will return to its Velumn URL. Removing ${data.customDomain} does not delete your forum or published content.`}
            </DialogDescription>
          </DialogHeader>
          {removeError && <InlineError>{removeError}</InlineError>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={removeDomain.isPending}
              onClick={handleRemove}
            >
              {removeDomain.isPending && (
                <LoaderCircle className="animate-spin" />
              )}
              {removalPending ? "Retry removal" : "Remove domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DomainConfiguration({
  checking,
  domain,
  lastKnownActive,
  removalPending,
  queryError,
  verification,
}: {
  checking: boolean
  domain: string
  lastKnownActive: boolean
  removalPending: boolean
  queryError: string | null
  verification: PublishingVerification
}) {
  const checkedAt = verification.checkedAt
    ? new Date(verification.checkedAt)
    : null
  const failed = Boolean(queryError) || verification.status === "failed"

  return (
    <div className="mt-3">
      <DomainStatus
        checking={checking}
        failed={failed}
        removalPending={removalPending}
        status={verification.status}
      />

      {removalPending ? (
        <p className="mt-4 text-sm leading-6 text-pretty text-muted-foreground">
          This domain is disabled. Retry removal to finish detaching it from
          Vercel.
        </p>
      ) : queryError ? (
        <InlineError className="mt-4">{queryError}</InlineError>
      ) : (
        verification.message &&
        verification.status !== "verified" && (
          <p className="mt-4 text-sm leading-6 text-pretty text-muted-foreground">
            {verification.message}
          </p>
        )
      )}

      {verification.status === "failed" && lastKnownActive && (
        <div className="mt-4 flex gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-900 ring-1 ring-blue-500/15 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-400/20">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          The domain remains active based on its last successful verification.
        </div>
      )}

      {checkedAt && (
        <p
          className="mt-2 text-xs text-muted-foreground tabular-nums"
          title={checkedAt.toLocaleString()}
        >
          Checked {formatDistanceToNow(checkedAt, { addSuffix: true })}
        </p>
      )}

      {verification.records.length > 0 && (
        <DnsConfiguration domain={domain} records={verification.records} />
      )}
    </div>
  )
}

function DomainStatus({
  checking,
  failed,
  removalPending,
  status,
}: {
  checking: boolean
  failed: boolean
  removalPending: boolean
  status: PublishingVerification["status"]
}) {
  const verified = status === "verified" && !failed
  const label = checking
    ? "Fetching DNS configuration…"
    : removalPending
      ? "Removal pending"
      : verified
        ? "Domain connected"
        : failed
          ? "Verification unavailable"
          : "DNS configuration required"

  return (
    <span
      role="status"
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md bg-amber-500/8 px-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/20",
        removalPending &&
          "bg-blue-500/10 text-blue-900 ring-blue-500/20 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-400/20",
        verified &&
          "bg-emerald-500/10 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-400/20",
        failed && "bg-destructive/8 text-destructive ring-destructive/20"
      )}
    >
      {checking ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : removalPending ? (
        <Clock3 className="size-3.5" />
      ) : verified ? (
        <Check className="size-3.5" />
      ) : failed ? (
        <CircleAlert className="size-3.5" />
      ) : (
        <Clock3 className="size-3.5" />
      )}
      {label}
    </span>
  )
}

function DnsConfiguration({
  domain,
  records,
}: {
  domain: string
  records: PublishingVerification["records"]
}) {
  const requiresOwnership = records.some((record) => record.type === "TXT")

  return (
    <section className="mt-8">
      <h3 className="text-base font-semibold">DNS configuration</h3>
      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-pretty text-muted-foreground">
        Add these records with your DNS provider to connect {domain}. DNS
        changes can take time to propagate.
      </p>
      {requiresOwnership && (
        <p className="mt-3 flex gap-2 text-xs leading-5 text-amber-900 dark:text-amber-200">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          The TXT record verifies ownership. If this domain belongs to another
          Vercel project, verification may transfer it.
        </p>
      )}
      <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <div className="hidden grid-cols-[5rem_minmax(7rem,0.7fr)_minmax(0,1.5fr)] bg-muted/35 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>Type</span>
          <span>Name</span>
          <span>Value</span>
        </div>
        <div className="divide-y">
          {records.map((record) => (
            <div
              key={`${record.type}-${record.name}-${record.value}`}
              className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[5rem_minmax(7rem,0.7fr)_minmax(0,1.5fr)] sm:items-center"
            >
              <div>
                <span className="mr-2 text-xs text-muted-foreground sm:hidden">
                  Type
                </span>
                <Badge variant="secondary">{record.type}</Badge>
              </div>
              <RecordValue label="Name" value={record.name} />
              <RecordValue label="Value" value={record.value} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RecordValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 sm:items-center">
      <span className="w-10 shrink-0 pt-0.5 text-xs text-muted-foreground sm:hidden">
        {label}
      </span>
      <code className="min-w-0 flex-1 text-xs break-all" title={value}>
        {value}
      </code>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  )
  const copied = copyStatus === "copied"
  const failed = copyStatus === "failed"

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={copied ? "Copied" : failed ? "Copy failed" : label}
      title={copied ? "Copied" : failed ? "Copy failed" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopyStatus("copied")
        } catch {
          setCopyStatus("failed")
        }
      }}
    >
      {copied ? <Check /> : failed ? <CircleAlert /> : <Copy />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : failed ? "Copy failed" : ""}
      </span>
    </Button>
  )
}

function InlineError({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive",
        className
      )}
      id={id}
      role="alert"
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function PublishingPending() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-44" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <div className="mt-7 grid gap-8 border-t pt-7 md:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.5fr)] md:gap-12">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-3 h-16 w-full max-w-sm" />
        </div>
        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-9 w-full" />
        </div>
      </div>
    </div>
  )
}

function PublishingError({
  onRetry,
  onSwitchServer,
}: {
  onRetry: () => void
  onSwitchServer: () => void
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="rounded-xl border bg-card p-8 text-center">
        <CircleAlert className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold">Publishing did not load</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Unable to load this server's publishing settings. Retry or choose a
          different server.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={onSwitchServer}>
            Switch server
          </Button>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      </div>
    </div>
  )
}
