import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  RadioTower,
  Search,
} from "lucide-react"
import { useDeferredValue, useState } from "react"

import { ServerAvatar } from "@/components/server-avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChannelSelectionRow } from "@/features/channels/channel-selection-row"
import { useChannelSelection } from "@/features/channels/use-channel-selection"
import type { SetupChannel } from "@/features/dashboard/contracts"
import {
  OnboardingFrame,
  OnboardingHeading,
  OnboardingProgress,
} from "@/features/onboarding/components"
import { trackOnboardingEvent } from "@/features/onboarding/analytics"
import {
  onboardingQueryKeys,
  serverSetupQueryOptions,
  serverSetupStatusQueryOptions,
  useServerSetupMutations,
} from "@/features/onboarding/queries"
import { formatLocalTime } from "@/lib/date"
import { cn } from "@/lib/utils"

function parseSetupSearch(search: Record<string, unknown>) {
  return typeof search.q === "string" ? { q: search.q } : {}
}

export const Route = createFileRoute(
  "/dashboard/_authenticated/servers/$serverId/setup"
)({
  validateSearch: parseSetupSearch,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      serverSetupQueryOptions(context.user.id, params.serverId)
    ),
  component: ServerSetupPage,
})

function ServerSetupPage() {
  const { user } = Route.useRouteContext()
  const { serverId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: initialSetup } = useSuspenseQuery(
    serverSetupQueryOptions(user.id, serverId)
  )
  const setupStatus = useQuery(
    serverSetupStatusQueryOptions({
      enabled: initialSetup.state === "waiting_for_bot",
      serverId,
      userId: user.id,
    })
  )
  const setup = setupStatus.data?.setup ?? initialSetup
  const { createInvite, finishSetup } = useServerSetupMutations(
    user.id,
    serverId
  )
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [mutationError, setMutationError] = useState<string | null>(null)

  if (setup.state === "ready") {
    return <ReadyState />
  }

  const setupState = setup.state
  return (
    <OnboardingFrame>
      <div className="flex items-center gap-3">
        <ServerAvatar
          name={setup.server.name}
          icon={setup.server.icon}
          className="size-10 bg-primary text-primary-foreground"
        />
        <div>
          <p className="text-sm font-semibold">{setup.server.name}</p>
          <p className="text-xs text-muted-foreground">Server setup</p>
        </div>
      </div>

      <div className="mt-8">
        <OnboardingProgress
          current={
            setupState === "invite_required" ||
            setupState === "reconnect_required" ||
            setupState === "waiting_for_bot"
              ? 2
              : 3
          }
        />
      </div>

      <div className="mt-12">
        {setup.state === "invite_required" ||
        setup.state === "reconnect_required" ? (
          <InviteState
            reconnecting={setup.state === "reconnect_required"}
            permissions={setup.requiredPermissions}
            pending={createInvite.isPending}
            error={mutationError}
            onInvited={async () => {
              setMutationError(null)
              const popup = window.open("about:blank", "_blank")
              if (popup) popup.opener = null

              try {
                const result = await createInvite.mutateAsync()
                if (result.status === "error") {
                  popup?.close()
                  setMutationError(result.message)
                  return
                }

                if (popup) popup.location.replace(result.inviteUrl)
                else window.location.assign(result.inviteUrl)
              } catch {
                popup?.close()
                setMutationError("Discord authorization could not be prepared.")
              }
            }}
          />
        ) : setup.state === "waiting_for_bot" ? (
          <WaitingState
            lastCheckedAt={setupStatus.data?.checkedAt ?? setup.lastCheckedAt}
            inviteUrl={setup.inviteUrl}
            checking={setupStatus.isFetching}
            onCheck={() => setupStatus.refetch()}
            onDiscordOpened={() =>
              void trackOnboardingEvent({
                data: {
                  event: "discord_authorization_opened",
                  serverId,
                },
              })
            }
          />
        ) : setup.state === "select_channels" ? (
          <ChannelState
            channels={setup.channels}
            query={q ?? ""}
            onQueryChange={(nextQuery) =>
              navigate({
                search: { q: nextQuery || undefined },
                replace: true,
              })
            }
            pending={finishSetup.isPending}
            error={mutationError}
            onContinue={async (selectedChannelIds) => {
              setMutationError(null)
              try {
                const result = await finishSetup.mutateAsync(selectedChannelIds)
                if (result.status === "error") {
                  setMutationError(result.message)
                  return
                }

                await router.invalidate()
              } catch {
                setMutationError("Setup could not be completed. Try again.")
              }
            }}
          />
        ) : setup.state === "starting_index" ? (
          <QueuedState serverId={setup.server.id} />
        ) : (
          <FailedState
            message={setup.message}
            retryable={setup.retryable}
            onRetry={() =>
              queryClient.invalidateQueries({
                queryKey: onboardingQueryKeys.setup(user.id, serverId),
              })
            }
          />
        )}
      </div>
    </OnboardingFrame>
  )
}

function InviteState({
  permissions,
  reconnecting,
  pending,
  error,
  onInvited,
}: {
  permissions: Array<string>
  reconnecting: boolean
  pending: boolean
  error: string | null
  onInvited: () => Promise<void>
}) {
  return (
    <div className="max-w-xl">
      <OnboardingHeading
        eyebrow={reconnecting ? "Reconnect Discord" : "Connect Discord"}
        title={
          reconnecting
            ? "Bring Velumn back online."
            : "Bring Velumn into the conversation."
        }
        description={
          reconnecting
            ? "Authorize the bot again to resume indexing your selected channels."
            : "Add the bot so Velumn can see the channels you choose. It cannot moderate members or change your server settings."
        }
      />

      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="text-sm">What you’re approving</CardTitle>
          <CardDescription>
            The smallest permission set Velumn needs to index selected threads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {permissions.map((permission) => (
              <li
                key={permission}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="size-4 text-chart-2" /> {permission}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="mt-6 w-full rounded-full px-5 sm:w-auto"
        disabled={pending}
        onClick={onInvited}
      >
        {pending
          ? "Preparing Discord…"
          : reconnecting
            ? "Reconnect in Discord"
            : "Authorize in Discord"}{" "}
        {!pending && <ExternalLink data-icon="inline-end" />}
      </Button>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Discord opens in a new tab. Return here when authorization is complete.
      </p>
    </div>
  )
}

function WaitingState({
  checking,
  inviteUrl,
  lastCheckedAt,
  onCheck,
  onDiscordOpened,
}: {
  checking: boolean
  inviteUrl: string
  lastCheckedAt: string
  onCheck: () => void
  onDiscordOpened: () => void
}) {
  return (
    <div className="max-w-xl">
      <span className="grid size-11 place-items-center rounded-xl bg-chart-4/15 text-chart-4">
        <LoaderCircle className="size-5 animate-spin" />
      </span>
      <div className="mt-6">
        <OnboardingHeading
          eyebrow="Checking connection"
          title="Waiting for the bot to arrive."
          description="This usually takes less than a minute. Finish the Discord step in the other tab and this page will continue automatically."
        />
      </div>
      <Card className="mt-7">
        <CardContent className="flex items-center gap-3">
          <RadioTower className="size-4 text-chart-4" />
          <div>
            <CardTitle className="text-sm">Listening for Discord</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Last checked {formatLocalTime(lastCheckedAt)}. You can safely
              leave and continue setup later.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          onClick={onDiscordOpened}
          className={cn(buttonVariants(), "rounded-full")}
        >
          Open Discord again <ExternalLink data-icon="inline-end" />
        </a>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={checking}
          onClick={onCheck}
        >
          {checking ? "Checking…" : "Check connection"}
        </Button>
        <Link
          to="/dashboard/servers/new"
          className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}
        >
          Choose another server
        </Link>
      </div>
    </div>
  )
}

function ChannelState({
  channels,
  query,
  onQueryChange,
  pending,
  error,
  onContinue,
}: {
  channels: Array<SetupChannel>
  query: string
  onQueryChange: (query: string) => void
  pending: boolean
  error: string | null
  onContinue: (selectedChannelIds: Array<string>) => Promise<void>
}) {
  const { selectedIds, toggle } = useChannelSelection(
    channels.filter((channel) => channel.selected).map((channel) => channel.id)
  )
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const visibleChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(deferredQuery)
  )
  const existingThreadCount = channels.reduce(
    (total, channel) =>
      selectedIds.has(channel.id) ? total + channel.existingThreadCount : total,
    0
  )

  return (
    <div>
      <OnboardingHeading
        eyebrow="Choose what publishes"
        title="Keep the answers. Leave the noise."
        description="Start with channels where people solve durable problems. You can change this selection later without losing indexed content."
      />

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search channels"
            aria-label="Search channels"
            className="h-10 pl-9"
          />
        </div>
        <Badge variant="outline" className="h-8 px-3 font-normal">
          {selectedIds.size} of {channels.length} selected
        </Badge>
      </div>

      <Card className="mt-3 gap-0 py-0">
        {visibleChannels.map((channel, index) => {
          const selected = selectedIds.has(channel.id)
          return (
            <div key={channel.id} className={cn(index > 0 && "border-t")}>
              <ChannelSelectionRow
                channel={channel}
                selected={selected}
                detail="Existing and future threads will become searchable"
                onToggle={() => toggle(channel.id)}
              />
            </div>
          )
        })}
        {visibleChannels.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {query
              ? "No channels match your search."
              : "No eligible text or forum channels are available yet."}
          </div>
        )}
      </Card>

      <Card className="mt-5 bg-muted/25">
        <CardContent>
          <CardTitle className="text-sm">
            Review your publishing scope
          </CardTitle>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              {selectedIds.size} channels selected
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              {existingThreadCount > 0
                ? `${existingThreadCount.toLocaleString()} existing threads available`
                : "Existing threads will be discovered when indexing starts"}
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-4 text-primary" /> New messages will be
              indexed
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-4 text-primary" /> Nothing is published
              until it meets your publishing rules
            </li>
          </ul>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Private channels remain private unless the bot can already view
              them.
            </p>
            <Button
              size="lg"
              className="rounded-full px-5"
              disabled={selectedIds.size === 0 || pending}
              onClick={() => onContinue([...selectedIds])}
            >
              {pending
                ? "Starting indexing…"
                : `Start indexing ${selectedIds.size} channels`}
              {!pending && <ArrowRight data-icon="inline-end" />}
            </Button>
          </div>
        </CardContent>
      </Card>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}

function QueuedState({ serverId }: { serverId: string }) {
  return (
    <div className="max-w-xl">
      <span className="grid size-11 place-items-center rounded-xl bg-chart-2/15 text-chart-2">
        <CheckCircle2 className="size-5" />
      </span>
      <div className="mt-6">
        <OnboardingHeading
          eyebrow="Setup complete"
          title="Your best answers are on their way."
          description="Use the dashboard now while Velumn works through the selected channels in the background. Threads appear as they are indexed."
        />
      </div>
      <Card className="mt-7">
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <CardTitle className="text-sm">Preparing channel history</CardTitle>
            <span className="text-muted-foreground">Queued</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[12%] rounded-full bg-primary" />
          </div>
        </CardContent>
      </Card>
      <Link
        to="/dashboard/servers/$serverId"
        params={{ serverId }}
        className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-5")}
      >
        Open dashboard <ArrowRight data-icon="inline-end" />
      </Link>
    </div>
  )
}

function ReadyState() {
  return (
    <OnboardingFrame>
      <OnboardingProgress current={3} />
      <div className="mt-12 max-w-xl">
        <span className="grid size-11 place-items-center rounded-xl bg-chart-2/15 text-chart-2">
          <CheckCircle2 className="size-5" />
        </span>
        <div className="mt-6">
          <OnboardingHeading
            eyebrow="Setup complete"
            title="Velumn is indexing your server."
            description="Your selected channels are saved and the initial indexing run has started in the background."
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/dashboard/servers"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-5")}
          >
            View servers <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </div>
    </OnboardingFrame>
  )
}

function FailedState({
  message,
  retryable,
  onRetry,
}: {
  message: string
  retryable: boolean
  onRetry: () => void
}) {
  return (
    <div className="max-w-xl">
      <OnboardingHeading
        eyebrow="Setup paused"
        title="This needs your attention."
        description={message}
      />
      <div className="mt-6 flex gap-3">
        {retryable && (
          <Button className="rounded-full" onClick={onRetry}>
            Try again
          </Button>
        )}
        <a
          href="https://velumn.app"
          className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
        >
          Get help
        </a>
      </div>
    </div>
  )
}
