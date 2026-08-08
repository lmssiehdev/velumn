import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  redirect,
  useBlocker,
  useRouter,
} from "@tanstack/react-router"
import {
  Check,
  CircleAlert,
  FilterX,
  ListFilter,
  Minus,
  RadioTower,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ChannelSelectionRow } from "@/features/channels/channel-selection-row"
import {
  channelsPageQueryOptions,
  useSaveChannelSelection,
  type ChannelsPageData,
} from "@/features/channels/queries"
import { filterChannels } from "@/features/channels/selection"
import { useChannelSelection } from "@/features/channels/use-channel-selection"
import { cn } from "@/lib/utils"

const channelsSearchSchema = z.object({
  q: z.string().max(100).optional(),
  type: z.enum(["forum", "text"]).optional(),
})

export const Route = createFileRoute("/_dashboard/servers/$serverId/channels")({
  validateSearch: channelsSearchSchema,
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(
      channelsPageQueryOptions(context.user.id, params.serverId)
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
  pendingComponent: ChannelsPending,
  component: ChannelsPage,
})

function ChannelsPage() {
  const { user } = Route.useRouteContext()
  const { serverId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const query = useQuery(channelsPageQueryOptions(user.id, serverId))
  const result = query.data

  if (query.isError || !result || result.status === "error") {
    return (
      <ChannelsError
        onRetry={() => query.refetch()}
        onSwitchServer={() => router.navigate({ to: "/servers" })}
      />
    )
  }

  const selectionKey = result.data.channels
    .filter((channel) => channel.indexingEnabled)
    .map((channel) => channel.id)
    .join(",")

  return (
    <ChannelsEditor
      key={selectionKey}
      data={result.data}
      search={search}
      onSearchChange={(updates) =>
        navigate({
          search: (current) => ({ ...current, ...updates }),
          replace: true,
        })
      }
      userId={user.id}
      serverId={serverId}
      refreshing={query.isFetching}
    />
  )
}

function ChannelsEditor({
  data,
  onSearchChange,
  refreshing,
  search,
  serverId,
  userId,
}: {
  data: ChannelsPageData
  onSearchChange: (updates: { q?: string; type?: "forum" | "text" }) => void
  refreshing: boolean
  search: z.infer<typeof channelsSearchSchema>
  serverId: string
  userId: string
}) {
  const initialSelection = data.channels
    .filter((channel) => channel.indexingEnabled)
    .map((channel) => channel.id)
  const { changeCount, dirty, reset, selectedIds, setMany, toggle } =
    useChannelSelection(initialSelection)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveSelection = useSaveChannelSelection(userId, serverId)
  const type = search.type ?? "all"
  const visibleChannels = filterChannels(data.channels, search.q ?? "", type)
  const visibleSelectedCount = visibleChannels.filter((channel) =>
    selectedIds.has(channel.id)
  ).length
  const allVisibleSelected =
    visibleChannels.length > 0 &&
    visibleSelectedCount === visibleChannels.length
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && current.pathname !== next.pathname,
    enableBeforeUnload: dirty,
    disabled: !dirty,
    withResolver: true,
  })

  const toggleChannel = (channelId: string) => {
    setSaveError(null)
    toggle(channelId)
  }

  const toggleVisibleChannels = () => {
    setSaveError(null)
    setMany(
      visibleChannels.map((channel) => channel.id),
      !allVisibleSelected
    )
  }

  const discard = () => {
    reset()
    setSaveError(null)
  }

  const save = async () => {
    setSaveError(null)
    try {
      const result = await saveSelection.mutateAsync(
        data.channels.map((channel) => ({
          id: channel.id,
          indexingEnabled: selectedIds.has(channel.id),
        }))
      )
      if (result.status === "error") setSaveError(result.message)
    } catch {
      setSaveError("Channel settings could not be saved. Try again.")
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      {data.disconnected && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-4 shrink-0 text-amber-600" />
            Discord is disconnected. Channel settings remain visible but cannot
            be changed.
          </p>
          <Link
            to="/servers/$serverId/setup"
            params={{ serverId }}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Reconnect Discord
          </Link>
        </div>
      )}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Indexing scope
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Channels
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose which Discord conversations Velumn can turn into searchable
            public pages. Changes remain staged until you save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Refreshing
            </span>
          )}
          <Badge variant="outline" className="h-7 px-3 font-normal">
            {initialSelection.length} enabled, {selectedIds.size} selected
          </Badge>
        </div>
      </header>

      <Card className="mt-7 gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q ?? ""}
              onChange={(event) =>
                onSearchChange({ q: event.target.value || undefined })
              }
              placeholder="Search channels"
              aria-label="Search channels"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 lg:ml-auto">
            <ListFilter className="mr-1 size-4 text-muted-foreground" />
            {(["all", "forum", "text"] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={type === filter ? "secondary" : "ghost"}
                onClick={() =>
                  onSearchChange({
                    type: filter === "all" ? undefined : filter,
                  })
                }
              >
                {filter === "all"
                  ? "All"
                  : filter === "forum"
                    ? "Forums"
                    : "Text"}
              </Button>
            ))}
          </div>
        </div>

        {data.channels.length === 0 ? (
          <ChannelsEmpty
            title="No eligible channels found"
            description="Velumn can index visible Discord text and forum channels. Create one in Discord or reconnect the bot to refresh access."
          />
        ) : visibleChannels.length === 0 ? (
          <ChannelsEmpty
            title="No channels match"
            description="Try another search or clear the active channel filters."
            action={
              <Button
                variant="outline"
                onClick={() =>
                  onSearchChange({ q: undefined, type: undefined })
                }
              >
                <FilterX data-icon="inline-start" /> Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <button
              type="button"
              role="checkbox"
              aria-checked={someVisibleSelected ? "mixed" : allVisibleSelected}
              disabled={data.disconnected || saveSelection.isPending}
              className="flex w-full items-center gap-3 border-b bg-muted/20 px-4 py-3 text-left text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
              onClick={toggleVisibleChannels}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded border",
                  (allVisibleSelected || someVisibleSelected) &&
                    "border-primary bg-primary text-primary-foreground"
                )}
                aria-hidden="true"
              >
                {someVisibleSelected && <Minus className="size-3" />}
                {allVisibleSelected && <Check className="size-3" />}
              </span>
              {allVisibleSelected
                ? `Disable ${visibleChannels.length} visible channels`
                : `Enable ${visibleChannels.length} visible channels`}
              <span className="ml-auto font-normal text-muted-foreground">
                {visibleSelectedCount} selected
              </span>
            </button>
            <div className="divide-y">
              {visibleChannels.map((channel) => (
                <ChannelSelectionRow
                  key={channel.id}
                  channel={channel}
                  selected={selectedIds.has(channel.id)}
                  disabled={data.disconnected || saveSelection.isPending}
                  detail={
                    selectedIds.has(channel.id)
                      ? "Existing and future public threads remain searchable"
                      : "Future messages will not be indexed"
                  }
                  trailing={
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge
                        variant="outline"
                        className="hidden font-normal capitalize sm:inline-flex"
                      >
                        {channel.type}
                      </Badge>
                      <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                        {channel.indexedThreadCount.toLocaleString()} threads
                      </span>
                    </span>
                  }
                  onToggle={() => toggleChannel(channel.id)}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      {data.channels.length > 0 && (dirty || saveError) && (
        <div className="sticky bottom-4 z-10 mt-5 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              {`${selectedIds.size} channels selected, ${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Disabling a channel stops future indexing. Existing published
              threads are not removed.
            </p>
            {saveError && (
              <p className="mt-2 text-xs font-medium text-destructive">
                {saveError}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!dirty || saveSelection.isPending}
              onClick={discard}
            >
              Discard
            </Button>
            <Button
              disabled={
                !dirty ||
                selectedIds.size === 0 ||
                data.disconnected ||
                saveSelection.isPending
              }
              onClick={save}
            >
              {saveSelection.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      {selectedIds.size === 0 && dirty && (
        <p className="mt-3 text-sm text-destructive">
          Keep at least one channel enabled for indexing.
        </p>
      )}

      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset()
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard unsaved channel changes?</DialogTitle>
            <DialogDescription>
              Your staged channel selection has not been saved. Leaving now will
              restore the previous indexing scope.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (blocker.status === "blocked") blocker.reset()
              }}
            >
              Stay here
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed()
              }}
            >
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChannelsEmpty({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description: string
  title: string
}) {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <RadioTower className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

function ChannelsPending() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8"
      role="status"
      aria-label="Loading channels"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-36" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-7 overflow-hidden rounded-xl border">
        <div className="flex gap-3 border-b p-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-48" />
        </div>
        {Array.from({ length: 7 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b px-4 py-4 last:border-b-0"
          >
            <Skeleton className="size-5" />
            <Skeleton className="size-4" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading channels...</span>
    </div>
  )
}

function ChannelsError({
  onRetry,
  onSwitchServer,
}: {
  onRetry: () => void
  onSwitchServer: () => void
}) {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-6 py-12 text-center">
      <Card>
        <CardContent className="py-4">
          <CircleAlert className="mx-auto size-6 text-destructive" />
          <CardTitle className="mt-4">Channels could not be loaded</CardTitle>
          <CardDescription className="mt-2">
            The server may be unavailable or your access may have changed.
          </CardDescription>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={onRetry}>Retry</Button>
            <Button variant="outline" onClick={onSwitchServer}>
              Switch server
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
