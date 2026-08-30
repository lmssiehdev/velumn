import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ChevronRight,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  RotateCcw,
  Search,
} from "lucide-react"
import { startTransition, useCallback, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  publicSearchResponseSchema,
  type PublicSearchResponse,
  type PublicSearchScope,
} from "./contracts"

const searchQueryKey = "public-community-search"
const minimumQueryLength = 2
const debounceMilliseconds = 300

export function CommunitySearch({ scope }: { scope?: PublicSearchScope }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <CommunitySearchDialog scope={scope} />
    </QueryClientProvider>
  )
}

function CommunitySearchDialog({ scope }: { scope?: PublicSearchScope }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()
  const normalizedInput = input.trim()
  const search = useQuery({
    queryKey: [searchQueryKey, scope ?? "tenant", query],
    queryFn: ({ signal }) => requestSearch(scope, query, signal),
    enabled: open && query.length >= minimumQueryLength,
    retry: false,
    staleTime: 30_000,
  })
  const waitingForDebounce =
    normalizedInput.length >= minimumQueryLength && normalizedInput !== query
  const searching = waitingForDebounce || search.isFetching
  const data = normalizedInput === query ? search.data : undefined
  const error = normalizedInput === query ? search.error : null

  function updateInput(value: string) {
    setInput(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    const normalized = value.trim()
    if (normalized.length < minimumQueryLength) {
      startTransition(() => setQuery(""))
      return
    }
    debounceTimer.current = setTimeout(() => {
      startTransition(() => setQuery(normalized))
    }, debounceMilliseconds)
  }

  const changeOpen = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) return

      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = null
      setInput("")
      setQuery("")
      void queryClient.cancelQueries({ queryKey: [searchQueryKey] })
    },
    [queryClient]
  )

  const status = getSearchStatus({
    input: normalizedInput,
    searching,
    data,
    error,
  })
  const registerShortcut = useCallback(
    (button: HTMLButtonElement | null) => {
      if (!button) return

      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key.toLowerCase() === "k" &&
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.isComposing
        ) {
          event.preventDefault()
          changeOpen(!open)
        }
      }

      button.ownerDocument.addEventListener("keydown", handleKeyDown)
      return () =>
        button.ownerDocument.removeEventListener("keydown", handleKeyDown)
    },
    [changeOpen, open]
  )

  return (
    <>
      <Button
        aria-label="Search community"
        className="h-10 w-[15.6875rem] min-w-[15.6875rem] justify-start gap-2 rounded-none border-neutral-300 bg-transparent px-3 font-[inherit] text-sm text-neutral-500 transition-[background-color,border-color,color,transform] duration-[120ms] hover:border-neutral-400 hover:bg-white hover:text-neutral-900 focus-visible:border-violet-700 focus-visible:ring-violet-700/20 motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-neutral-300 dark:bg-transparent dark:hover:bg-white [&_svg]:size-5 [&_svg]:stroke-[1.75]"
        onClick={() => changeOpen(true)}
        ref={registerShortcut}
        type="button"
        variant="outline"
      >
        <Search aria-hidden="true" />
        <span className="me-8 w-full overflow-hidden text-start text-ellipsis whitespace-nowrap">
          Search community...
        </span>
        <kbd
          aria-hidden="true"
          className="inline-flex items-center rounded-sm border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.625rem] leading-none font-medium text-neutral-500"
        >
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        className="inset-x-0 top-[35%] left-0 mx-auto block max-h-[min(30rem,100svh)] w-[min(48rem,100vw)] max-w-[min(48rem,100vw)] translate-x-0 -translate-y-1/2 gap-0 rounded-lg! border border-neutral-300 bg-white p-0 font-['Questrial',ui-sans-serif,system-ui,sans-serif] text-neutral-900 shadow-[0_24px_64px_rgb(26_20_35/0.18),0_2px_8px_rgb(26_20_35/0.08)] ring-neutral-900/10 motion-reduce:animate-none max-[30rem]:rounded-none! data-open:zoom-in-100 data-closed:zoom-out-100"
        description="Find public discussions and answers in this community."
        onOpenChange={changeOpen}
        open={open}
        overlayClassName="bg-black/50! backdrop-blur-none! data-open:animate-in! data-closed:animate-out! motion-reduce:animate-none!"
        showCloseButton={false}
        title="Search this community"
      >
        <Command
          className="min-h-0 rounded-none! bg-neutral-100 p-0 text-neutral-900"
          shouldFilter={false}
        >
          <div className="relative h-12 border-b border-neutral-300">
            <CommandInput
              addonClassName="order-first p-0 text-neutral-500 [&_svg]:size-[1.125rem] [&_svg]:stroke-[1.75]"
              aria-label="Search this community"
              autoComplete="off"
              className="w-full min-w-0 border-0 bg-transparent text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              inputGroupClassName="h-12! min-h-12 gap-2 rounded-none! border-0 bg-transparent p-0 shadow-none! has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-transparent"
              maxLength={120}
              onValueChange={updateInput}
              placeholder="Search community..."
              value={input}
              wrapperClassName="h-12 p-0 pe-16 ps-3"
            />
            <kbd
              aria-hidden="true"
              className="absolute end-3 top-1/2 inline-flex -translate-y-1/2 items-center rounded-sm border border-neutral-300 bg-neutral-100 px-1.5 py-[0.1875rem] font-mono text-[0.6875rem] leading-none font-normal tracking-[0.01em] whitespace-nowrap text-neutral-500"
            >
              Esc
            </kbd>
          </div>

          <p className="sr-only" role="status">
            {status}
          </p>
          <CommandList className="max-h-[18.75rem] overscroll-contain">
            <SearchContent
              data={data}
              error={error}
              input={normalizedInput}
              onClose={() => changeOpen(false)}
              onRetry={() => void search.refetch()}
              searching={searching}
            />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

export function SearchContent({
  input,
  searching,
  data,
  error,
  onRetry,
  onClose,
}: {
  input: string
  searching: boolean
  data?: PublicSearchResponse
  error: Error | null
  onRetry: () => void
  onClose: () => void
}) {
  if (input.length < minimumQueryLength) {
    return (
      <SearchState icon={<Search />}>
        Start typing to search the community
      </SearchState>
    )
  }

  if (searching) {
    return (
      <SearchState
        icon={<LoaderCircle className="motion-safe:animate-spin" />}
        title="Searching discussions"
      >
        Looking for the most relevant public answers.
      </SearchState>
    )
  }

  if (error) {
    const rateLimited =
      error instanceof PublicSearchRequestError && error.status === 429
    return (
      <SearchState
        action={
          <button
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 font-[inherit] text-sm text-neutral-900 outline-none hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-700 [&_svg]:size-3.5"
            onClick={onRetry}
            type="button"
          >
            <RotateCcw aria-hidden="true" />
            Try again
          </button>
        }
        icon={<Search />}
        title={rateLimited ? "Search paused" : "Search is unavailable"}
      >
        {rateLimited
          ? "Too many searches were made at once. Wait about a minute and try again."
          : "Check your connection and try again."}
      </SearchState>
    )
  }

  if (!data || data.hits.length === 0) {
    return (
      <SearchState title="No results found">
        <span>
          We couldn’t find anything for <b>“{input}”</b>
        </span>
        <small>Try different keywords or remove filters</small>
      </SearchState>
    )
  }

  return (
    <CommandGroup
      className="p-0 text-neutral-900 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-sm **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:tracking-normal **:[[cmdk-group-heading]]:text-neutral-700 **:[[cmdk-group-heading]]:normal-case"
      heading="Result"
    >
      {data.hits.map((hit) => {
        const Icon = hit.isThreadStarter ? MessageSquareText : MessageCircle
        return (
          <CommandItem
            asChild
            className="group mx-2 my-1.5 flex min-w-0 cursor-pointer items-start gap-3 rounded-md! border border-neutral-300 p-3 text-inherit no-underline outline-none hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-700 data-selected:bg-neutral-100 data-selected:text-neutral-900 [&_mark]:rounded-[0.2rem] [&_mark]:bg-violet-100 [&_mark]:text-violet-800"
            key={hit.id}
            onSelect={() => {
              onClose()
              window.location.assign(hit.threadUrl)
            }}
            value={hit.id}
          >
            <a href={hit.threadUrl} onClick={onClose}>
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 [stroke-width:1.75] text-neutral-800"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex min-w-0 items-center gap-1 text-xs leading-[1.3] text-neutral-500 [&_svg]:size-3 [&_svg]:shrink-0">
                  <span className="shrink-0">{hit.channelName}</span>
                  <ChevronRight aria-hidden="true" className="size-3" />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    <HighlightedText
                      fallback={hit.title}
                      segments={hit.highlights.title}
                    />
                  </span>
                </span>
                {hit.content && (
                  <span className="line-clamp-2 overflow-hidden text-sm leading-[1.625] text-neutral-900">
                    <HighlightedText
                      fallback={hit.content}
                      segments={hit.highlights.content}
                    />
                  </span>
                )}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 self-center text-neutral-500 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 motion-reduce:transition-none"
              />
            </a>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

function SearchState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center max-[30rem]:px-5">
      {icon && (
        <span
          aria-hidden="true"
          className="mb-3 grid size-10 place-items-center text-neutral-400 [&_svg]:size-10 [&_svg]:stroke-[1.75]"
        >
          {icon}
        </span>
      )}
      {title && <strong className="text-lg font-medium">{title}</strong>}
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-pretty text-neutral-500 [&_b]:font-medium [&_b]:text-neutral-800 [&_small]:mt-3 [&_small]:block [&_small]:text-xs [&>span]:block">
        {children}
      </p>
      {action}
    </div>
  )
}

function HighlightedText({
  fallback,
  segments,
}: {
  fallback: string
  segments: PublicSearchResponse["hits"][number]["highlights"]["title"]
}) {
  if (segments.length === 0) return fallback
  return segments.map((segment, index) =>
    segment.highlighted ? (
      <mark key={`${index}:${segment.value}`}>{segment.value}</mark>
    ) : (
      <span key={`${index}:${segment.value}`}>{segment.value}</span>
    )
  )
}

function getSearchStatus({
  input,
  searching,
  data,
  error,
}: {
  input: string
  searching: boolean
  data?: PublicSearchResponse
  error: Error | null
}) {
  if (input.length < minimumQueryLength) return ""
  if (searching) return `Searching for ${input}.`
  if (error) return "Search failed."
  if (!data?.hits.length) return `No results found for ${input}.`
  return `${data.hits.length} results found for ${input}.`
}

async function requestSearch(
  scope: PublicSearchScope | undefined,
  query: string,
  signal: AbortSignal
) {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scope ? { query, scope } : { query }),
    signal,
  })
  if (!response.ok) {
    throw new PublicSearchRequestError(response.status)
  }
  return publicSearchResponseSchema.parse(await response.json())
}

export class PublicSearchRequestError extends Error {
  constructor(readonly status: number) {
    super(`Public search failed with status ${status}`)
  }
}
