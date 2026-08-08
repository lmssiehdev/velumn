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
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  "/_dashboard/servers/$serverId/publishing"
)({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(
      publishingPageQueryOptions(context.user.id, params.serverId)
    )
    if (result.status === "error") {
      if (result.code === "setup_required") {
        throw redirect({
          to: "/servers/$serverId/setup",
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
        onSwitchServer={() => router.navigate({ to: "/servers" })}
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
  const verification = useQuery(
    publishingVerificationQueryOptions(userId, serverId, data.customDomain)
  )
  const currentVerification =
    verification.data?.status === "ok"
      ? verification.data.data
      : data.verification
  const verificationError = verification.isError
    ? "Verification could not be completed. Check your connection and try again."
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
      setAddError("The domain could not be added. Try again shortly.")
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
      setRemoveError("The domain could not be removed. Try again shortly.")
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Publish
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Publishing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose where readers find {data.server.name}. Your Velumn URL always
            remains available, even when you connect or remove a custom domain.
          </p>
        </div>
        <Button
          variant="outline"
          render={<a href={canonicalUrl} target="_blank" rel="noreferrer" />}
        >
          Open forum <ArrowUpRight data-icon="inline-end" />
        </Button>
      </header>

      {data.disconnected && (
        <div className="mt-6 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium">Discord is disconnected</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Existing forum content and domain management remain available.
              Reconnect Discord to resume publishing new conversations.
            </p>
          </div>
        </div>
      )}

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <UrlCard
          label="Default URL"
          value={data.defaultUrl}
          description="Permanent Velumn address"
        />
        <UrlCard
          label="Active canonical URL"
          value={canonicalUrl}
          description={
            customDomainActive
              ? "Readers are directed to your custom domain"
              : "Uses the default URL until verification succeeds"
          }
          active
        />
      </section>

      <Card className="mt-6">
        <CardHeader className="border-b">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Globe2 className="size-4" />
            </span>
            <div>
              <CardTitle>Custom domain</CardTitle>
              <CardDescription className="mt-1">
                Connect one public hostname that you control.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleAdd}>
            <label htmlFor="custom-domain" className="text-sm font-medium">
              Hostname
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="custom-domain"
                autoComplete="off"
                disabled={Boolean(data.customDomain) || addDomain.isPending}
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
              {data.customDomain ? (
                <Button
                  type="button"
                  variant="destructive"
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
                  Remove
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!domainInput.trim() || addDomain.isPending}
                >
                  {addDomain.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Globe2 />
                  )}
                  Add domain
                </Button>
              )}
            </div>
            <p
              id="custom-domain-help"
              className="mt-2 text-xs text-muted-foreground"
            >
              Enter only the hostname, without a path or query string.
            </p>
            {addError && (
              <InlineError id="custom-domain-error" className="mt-3">
                {addError}
              </InlineError>
            )}
          </form>
        </CardContent>
      </Card>

      {data.customDomain && (
        <VerificationCard
          domain={data.customDomain}
          verification={currentVerification}
          checking={verification.isFetching}
          lastKnownActive={lastKnownCustomActive}
          queryError={verificationError}
          onRefresh={() => verification.refetch()}
        />
      )}

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove custom domain?</DialogTitle>
            <DialogDescription>
              Readers will use {data.defaultUrl}. Removing {data.customDomain}{" "}
              does not delete your forum or published content.
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
              Remove domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VerificationCard({
  checking,
  domain,
  lastKnownActive,
  onRefresh,
  queryError,
  verification,
}: {
  checking: boolean
  domain: string
  lastKnownActive: boolean
  onRefresh: () => void
  queryError: string | null
  verification: PublishingVerification
}) {
  const checkedAt = verification.checkedAt
    ? new Date(verification.checkedAt)
    : null
  const failed = Boolean(queryError) || verification.status === "failed"
  const ownershipRecords = verification.records.filter(
    (record) => record.type === "TXT"
  )
  const routingRecords = verification.records.filter(
    (record) => record.type !== "TXT"
  )

  return (
    <Card className="mt-6">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-700",
                verification.status === "verified" &&
                  "bg-emerald-500/10 text-emerald-700",
                failed && "bg-destructive/10 text-destructive"
              )}
            >
              {verification.status === "verified" ? (
                <ShieldCheck className="size-4" />
              ) : failed ? (
                <CircleAlert className="size-4" />
              ) : (
                <Clock3 className="size-4" />
              )}
            </span>
            <div>
              <div
                className="flex flex-wrap items-center gap-2"
                aria-live="polite"
              >
                <CardTitle>Domain verification</CardTitle>
                <StatusBadge
                  status={failed ? "failed" : verification.status}
                  checking={checking}
                />
              </div>
              <CardDescription className="mt-1">{domain}</CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={checking}
            onClick={onRefresh}
          >
            <RefreshCw className={cn(checking && "animate-spin")} />
            {checkedAt ? "Refresh" : "Verify"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {queryError ? (
          <InlineError>{queryError}</InlineError>
        ) : (
          verification.message && (
            <p
              className={cn(
                "text-sm leading-6 text-muted-foreground",
                failed && "text-destructive"
              )}
            >
              {verification.message}
            </p>
          )
        )}

        {verification.status === "failed" && lastKnownActive && (
          <div className="mt-3 flex gap-2 rounded-lg border border-blue-500/20 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Your domain remains active based on its last successful
            verification. A failed provider check does not take it offline.
          </div>
        )}

        <p
          className="mt-2 text-xs text-muted-foreground"
          title={checkedAt?.toLocaleString()}
        >
          {checking && !checkedAt
            ? "Checking Vercel now"
            : checkedAt
              ? `Checked ${formatDistanceToNow(checkedAt, { addSuffix: true })}`
              : "Not checked during this session"}
        </p>

        {ownershipRecords.length > 0 && (
          <DnsRecordSection
            title="Verify domain ownership"
            description="Add this TXT record to prove that you control the domain. If it belongs to another Vercel project, verification can transfer it away from that project."
            records={ownershipRecords}
            warning
          />
        )}
        {routingRecords.length > 0 && (
          <DnsRecordSection
            title="Route traffic to Velumn"
            description="Add these records with your DNS provider. DNS changes can take time to propagate."
            records={routingRecords}
          />
        )}
      </CardContent>
    </Card>
  )
}

function DnsRecordSection({
  description,
  records,
  title,
  warning = false,
}: {
  description: string
  records: PublishingVerification["records"]
  title: string
  warning?: boolean
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p
        className={cn(
          "mt-1 text-xs leading-5 text-muted-foreground",
          warning && "text-amber-800"
        )}
      >
        {description}
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[90px_1fr_1.6fr] border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>Type</span>
          <span>Name</span>
          <span>Value</span>
        </div>
        <div className="divide-y">
          {records.map((record) => (
            <div
              key={`${record.type}-${record.name}-${record.value}`}
              className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[90px_1fr_1.6fr] sm:items-center"
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
    </div>
  )
}

function UrlCard({
  active = false,
  description,
  label,
  value,
}: {
  active?: boolean
  description: string
  label: string
  value: string
}) {
  return (
    <Card className={cn(active && "border-primary/20 bg-primary/[0.025]")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
        </div>
        <p
          className="mt-4 truncate font-mono text-sm font-medium"
          title={value}
        >
          {value}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function RecordValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-muted-foreground sm:hidden">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate text-xs" title={value}>
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

function StatusBadge({
  checking,
  status,
}: {
  checking: boolean
  status: "not_configured" | "pending" | "verified" | "failed"
}) {
  const label = checking
    ? "Checking"
    : status === "verified"
      ? "Verified"
      : status === "failed"
        ? "Check failed"
        : "Action required"
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-amber-500/30 bg-amber-500/10 text-amber-800",
        status === "verified" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
        status === "failed" &&
          "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {checking && <LoaderCircle className="animate-spin" />}
      {label}
    </Badge>
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-7 w-36" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="mt-6 h-56 rounded-xl" />
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
          We could not load this server's publishing settings. Retry or choose a
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
