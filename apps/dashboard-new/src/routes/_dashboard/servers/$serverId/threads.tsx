import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  ChevronDown,
  CircleAlert,
  Files,
  FilterX,
  Hash,
  Pin,
  RadioTower,
  Search,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { threadsPageQueryOptions } from "@/features/threads/queries"
import {
  hasThreadFilters,
  threadsSearchSchema,
  type ThreadsSearch,
} from "@/features/threads/search"
import { ThreadsTable } from "@/features/threads/threads-table"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/servers/$serverId/threads")({
  validateSearch: threadsSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps, params }) => {
    const result = await context.queryClient.ensureQueryData(
      threadsPageQueryOptions(context.user.id, params.serverId, deps.search)
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
  pendingComponent: ThreadsPending,
  component: ThreadsPage,
})

function ThreadsPage() {
  const { user } = Route.useRouteContext()
  const { serverId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const query = useQuery(threadsPageQueryOptions(user.id, serverId, search))
  const result = query.data

  if (query.isError || !result) {
    return (
      <ThreadsError
        onRetry={() => query.refetch()}
        onSwitchServer={() => router.navigate({ to: "/servers" })}
      />
    )
  }
  if (result.status === "error") {
    return (
      <ThreadsError
        onRetry={() => query.refetch()}
        onSwitchServer={() => router.navigate({ to: "/servers" })}
      />
    )
  }

  const data = result.data
  const filtered = hasThreadFilters(search)
  const updateSearch = (updates: Partial<ThreadsSearch>) =>
    navigate({
      search: (current) => ({
        ...current,
        ...updates,
        page: updates.page,
      }),
    })

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
      {data.disconnected && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <CircleAlert className="size-4 text-amber-600" />
          Discord is disconnected. Published threads remain available while the
          bot is reconnected.
        </div>
      )}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BookOpenText className="size-3.5" /> Content library
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Published threads
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
            Review the conversations {data.server.name} has made searchable on
            the web.
          </p>
        </div>
        <a
          href={data.forumUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: "sm" })}
        >
          Visit forum <ArrowUpRight data-icon="inline-end" />
        </a>
      </header>

      <dl className="mt-7 grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-4">
        <LibraryMetric
          icon={Files}
          label="Published"
          value={data.summary.published.toLocaleString()}
          description="public threads"
        />
        <LibraryMetric
          icon={Hash}
          label="Channels"
          value={data.summary.channels.toLocaleString()}
          description="with published content"
        />
        <LibraryMetric
          icon={Pin}
          label="Pinned"
          value={data.summary.pinned.toLocaleString()}
          description="featured in Discord"
        />
        <LibraryMetric
          icon={RadioTower}
          label="Connection"
          value={data.disconnected ? "Offline" : "Live"}
          description={
            data.disconnected ? "reconnect required" : "syncing from Discord"
          }
          positive={!data.disconnected}
        />
      </dl>

      <section className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
          <form
            className="relative w-full lg:max-w-md"
            onSubmit={(event) => {
              event.preventDefault()
              const value = new FormData(event.currentTarget).get("q")
              updateSearch({
                q:
                  typeof value === "string"
                    ? value.trim() || undefined
                    : undefined,
              })
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={search.q ?? ""}
              name="q"
              defaultValue={search.q ?? ""}
              placeholder="Search by thread title"
              aria-label="Search threads"
              className="h-9 pr-3 pl-9"
            />
            <button type="submit" className="sr-only">
              Search threads
            </button>
          </form>

          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-between"
                  />
                }
              >
                Channels
                {search.channels?.length ? ` (${search.channels.length})` : ""}
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Parent channels</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {data.channels.map((channel) => {
                    const selected =
                      search.channels?.includes(channel.id) ?? false
                    return (
                      <DropdownMenuCheckboxItem
                        key={channel.id}
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...(search.channels ?? []), channel.id]
                            : (search.channels ?? []).filter(
                                (channelId) => channelId !== channel.id
                              )
                          updateSearch({
                            channels: channels.length ? channels : undefined,
                          })
                        }}
                      >
                        #{channel.name}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                {search.pinned === "pinned"
                  ? "Pinned"
                  : search.pinned === "unpinned"
                    ? "Not pinned"
                    : "All content"}
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={search.pinned ?? "all"}
                  onValueChange={(value) =>
                    updateSearch({
                      pinned:
                        value === "pinned" || value === "unpinned"
                          ? value
                          : undefined,
                    })
                  }
                >
                  <DropdownMenuRadioItem value="all">
                    All content
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pinned">
                    Pinned
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="unpinned">
                    Not pinned
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {filtered && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate({ search: {} })}
              >
                <FilterX data-icon="inline-start" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-h-10 items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <p className="tabular-nums">
            {filtered
              ? `${data.pagination.total.toLocaleString()} matching ${data.summary.published.toLocaleString()} published threads`
              : `${data.summary.published.toLocaleString()} published threads`}
          </p>
          {query.isFetching && (
            <span className="flex items-center gap-1.5" role="status">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Refreshing
            </span>
          )}
        </div>

        {data.threads.length > 0 ? (
          <ThreadsTable
            threads={data.threads}
            search={search}
            onSort={(sort) => {
              if (search.sort !== sort) {
                updateSearch({
                  sort,
                  direction:
                    sort === "title" || sort === "parentChannel"
                      ? "asc"
                      : undefined,
                })
                return
              }

              if (search.direction === "asc") {
                updateSearch({ sort, direction: "desc" })
                return
              }
              if (search.direction === "desc") {
                updateSearch({ sort: undefined, direction: undefined })
                return
              }
              updateSearch({ sort, direction: "asc" })
            }}
          />
        ) : data.pagination.total > 0 ? (
          <EmptyThreads
            title="This page is no longer available"
            description="The thread list changed while you were browsing. Return to the first page to continue."
            action={
              <Button onClick={() => updateSearch({ page: undefined })}>
                Return to first page
              </Button>
            }
          />
        ) : filtered ? (
          <EmptyThreads
            title="No threads match"
            description="Try a different search or clear the active filters."
            action={
              <Button
                variant="outline"
                onClick={() => navigate({ search: {} })}
              >
                Clear filters
              </Button>
            }
          />
        ) : data.disconnected ? (
          <EmptyThreads
            title="Reconnect Discord to resume publishing"
            description="Your existing forum remains available, but Velumn cannot discover or publish new conversations until the bot is reconnected."
            action={
              <Link
                to="/servers/$serverId/setup"
                params={{ serverId }}
                className={buttonVariants()}
              >
                Reconnect Discord
              </Link>
            }
          />
        ) : (
          <EmptyThreads
            title="No published threads yet"
            description="Choose which Discord channels Velumn should index. New public threads will appear here after their conversations are processed."
            action={
              <Link
                to="/servers/$serverId/channels"
                params={{ serverId }}
                className={buttonVariants({ variant: "outline" })}
              >
                Choose channels
              </Link>
            }
          />
        )}

        {data.pagination.total > 0 && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground tabular-nums">
              {(data.pagination.page - 1) * data.pagination.pageSize + 1}–
              {Math.min(
                data.pagination.page * data.pagination.pageSize,
                data.pagination.total
              )}{" "}
              of {data.pagination.total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={data.pagination.page <= 1 || query.isPlaceholderData}
                onClick={() =>
                  updateSearch({
                    page:
                      data.pagination.page - 1 === 1
                        ? undefined
                        : data.pagination.page - 1,
                  })
                }
              >
                <ArrowLeft data-icon="inline-start" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  data.pagination.page >= data.pagination.totalPages ||
                  query.isPlaceholderData
                }
                onClick={() => updateSearch({ page: data.pagination.page + 1 })}
              >
                Next <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyThreads({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Files className="size-4" />
      </span>
      <h2 className="mt-4 text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-5">{action}</div>
    </div>
  )
}

function LibraryMetric({
  icon: Icon,
  label,
  value,
  description,
  positive = false,
}: {
  icon: typeof Files
  label: string
  value: string
  description: string
  positive?: boolean
}) {
  return (
    <div className="border-b p-4 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0 sm:[&:nth-child(even)]:border-r-0 lg:[&:nth-child(even)]:border-r">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </dt>
      <dd className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            "text-xl font-semibold tracking-[-0.03em] tabular-nums",
            positive && "text-emerald-700"
          )}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </dd>
    </div>
  )
}

function ThreadsPending() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8"
      role="status"
      aria-label="Loading published threads"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-7 w-52" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="mt-7 grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-b p-4 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0 sm:[&:nth-child(even)]:border-r-0 lg:[&:nth-child(even)]:border-r"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:justify-between">
          <Skeleton className="h-9 w-full sm:max-w-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="border-b bg-muted/20 px-4 py-3">
          <Skeleton className="h-3 w-32" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "grid grid-cols-[2.25rem_minmax(10rem,1fr)_4rem] items-center gap-3 px-4 py-4 sm:grid-cols-[2.25rem_minmax(12rem,1fr)_8rem_5rem_5rem]",
              index > 0 && "border-t"
            )}
          >
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="hidden h-6 w-20 sm:block" />
            <Skeleton className="h-4 w-10 justify-self-end" />
            <Skeleton className="hidden h-4 w-16 justify-self-end sm:block" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading published threads...</span>
    </div>
  )
}

function ThreadsError({
  onRetry,
  onSwitchServer,
}: {
  onRetry: () => void
  onSwitchServer: () => void
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold">Threads</h1>
      <div className="mt-6 rounded-xl border bg-card px-6 py-12 text-center">
        <CircleAlert className="mx-auto size-5 text-destructive" />
        <h2 className="mt-4 text-sm font-semibold">Threads could not load</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again or switch to another server.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={onRetry}>Retry</Button>
          <Button variant="outline" onClick={onSwitchServer}>
            Switch server
          </Button>
        </div>
      </div>
    </div>
  )
}
