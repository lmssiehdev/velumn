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
        className="community-search__trigger"
        onClick={() => changeOpen(true)}
        ref={registerShortcut}
        type="button"
        variant="outline"
      >
        <Search aria-hidden="true" />
        <span>Search community...</span>
        <kbd aria-hidden="true">⌘K</kbd>
      </Button>
      <CommandDialog
        className="community-search-dialog"
        description="Find public discussions and answers in this community."
        onOpenChange={changeOpen}
        open={open}
        showCloseButton={false}
        title="Search this community"
      >
        <Command className="community-search__command" shouldFilter={false}>
          <div className="community-search__input-row">
            <CommandInput
              aria-label="Search this community"
              autoComplete="off"
              maxLength={120}
              onValueChange={updateInput}
              placeholder="Search community..."
              value={input}
            />
            <kbd aria-hidden="true" className="community-search__escape">
              ESC
            </kbd>
          </div>

          <p className="community-search__sr-status" role="status">
            {status}
          </p>
          <CommandList className="community-search__list">
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
        icon={<LoaderCircle className="community-search__spinner" />}
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
            className="community-search__retry"
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
    <CommandGroup className="community-search__results" heading="Result">
      {data.hits.map((hit) => {
        const Icon = hit.isThreadStarter ? MessageSquareText : MessageCircle
        return (
          <CommandItem
            asChild
            className="community-search__result"
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
                className="community-search__result-icon"
              />
              <span className="community-search__result-copy">
                <span className="community-search__result-path">
                  <span>{hit.channelName}</span>
                  <ChevronRight aria-hidden="true" />
                  <span className="community-search__result-title">
                    <HighlightedText
                      fallback={hit.title}
                      segments={hit.highlights.title}
                    />
                  </span>
                </span>
                {hit.content && (
                  <span className="community-search__result-excerpt">
                    <HighlightedText
                      fallback={hit.content}
                      segments={hit.highlights.content}
                    />
                  </span>
                )}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="community-search__result-arrow"
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
    <div className="community-search__state">
      {icon && (
        <span aria-hidden="true" className="community-search__state-icon">
          {icon}
        </span>
      )}
      {title && <strong>{title}</strong>}
      <p>{children}</p>
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
