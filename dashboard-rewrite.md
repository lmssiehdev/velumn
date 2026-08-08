# Dashboard Rewrite

## Goal

Rewrite `apps/dashboard` with TanStack Start as a fast, tenant-aware management application. Preserve the product behavior that is useful, but do not copy the current route structure, loading patterns, client providers, or database helper shapes.

The rewrite should feel intentional and operational rather than like a generic admin template.

## References

- [Latitude](https://github.com/latitude-dev/latitude-llm) is the primary product and visual reference: restrained information density, a persistent resource-scoped shell, clear page headers, grouped navigation, settings composition, and distinct loading, empty, and error states.
- [OpenSEO](https://github.com/every-app/open-seo) is the secondary implementation reference: approachable TanStack Start patterns, authenticated resource scoping, loaders, mutations, and project switching.
- [Open Dashboard](https://github.com/ahpxex/open-dashboard) may be used as a pattern catalogue for tables, filters, forms, and admin interactions. It is not the application architecture.

Use these as references, not templates to copy. Velumn needs its own visual identity and Discord-specific authorization and lifecycle model.

## Product Model

The managed tenant is a Discord server. A signed-in user can manage multiple servers and switch between them.

```text
User
└── Server membership
    └── Discord server
        ├── Setup and bot connection
        ├── Indexed channels
        ├── Published threads
        └── Publishing domain
```

Discord is an external authority during server installation. Once a server is linked, normal dashboard requests should authorize from Velumn's membership and capability data instead of calling Discord on every navigation.

## Stack

- TanStack Start and TanStack Router
- React Query for server state, query caching, mutations, and invalidation
- TanStack Table for real tables with server-backed sorting, filtering, and pagination
- [Base UI](https://base-ui.com/) for accessible unstyled UI primitives
- Tailwind CSS for styling
- Better Auth for authentication
- Existing Drizzle/PostgreSQL database packages
- TanStack Router validated search parameters are the sole owner of URL-backed filters, sorting, pagination, tabs, and other shareable view state.
- Zustand only for genuinely shared ephemeral client state that cannot live in the URL, route context, React Query, or local component state.

Do not add global stores or client providers for server data that is already owned by a route or React Query.

Shared page payloads use these minimal shapes:

```ts
type ServerIdentity = {
  id: string
  name: string
  icon: string | null
}

type SetupChannel = {
  id: string
  name: string
  type: 'forum' | 'text'
  selected: boolean
}

type IndexingJob = {
  id: string
  status: 'queued' | 'running' | 'failed' | 'succeeded'
  progress: null | { completed: number; total: number }
  startedAt: string | null
  error: string | null
}
```

## Global Shell Data

The authenticated shell needs one minimal payload:

```ts
type DashboardShell = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  servers: Array<{
    id: string
    name: string
    icon: string | null
    role: 'owner' | 'admin' | 'manager'
    capabilities: string[]
    lifecycle: 'setup_required' | 'ready' | 'bot_disconnected'
  }>
  activeServer: null | {
    id: string
    name: string
    icon: string | null
    lifecycle: 'setup_required' | 'ready' | 'bot_disconnected'
    forumUrl: string
  }
  lastUsedServerId: string | null
}
```

The shell displays:

- Current user and sign-out action
- A compact top bar with route breadcrumbs and a searchable active-server switcher
- Add-server action
- Grouped active-server navigation: Overview, Threads, and Channels under Manage; Publishing under Publish
- Server setup or connection warning when applicable
- Domain-aware link to the public forum
- Help link

Navigation is filtered by capability. A setup-required server exposes Setup plus safe server-switching and add-server actions instead of normal management navigation. A disconnected server keeps normal navigation visible, but bot-dependent controls explain why they are disabled.

The shell is full-height with independently scrolling page content. Its desktop navigation can collapse and must remain understandable through accessible labels and tooltips when icon-only. On narrow screens, use a temporary drawer or compact rail without reducing the content below a usable width.

The server switcher displays each server's icon, name, role, and lifecycle status, sorts results alphabetically, and keeps Add server available when searching or when no result matches. Breadcrumb and server labels truncate instead of expanding the top bar.

Do not send complete server database rows to the browser. Fields such as member count, invite metadata, anonymization settings, raw domain records, and Discord tokens are not shell data.

## Pages

Normal pages use a consistent content header with a title, a one-sentence description, and right-aligned primary actions. Search and filters occupy a separate row below the header. Header actions wrap below the title at narrow content widths.

| Route | Title | Description | Primary header action |
| --- | --- | --- | --- |
| `/servers` | Servers | Choose a Discord server to manage. | Add server |
| `/servers/$serverId` | Overview | Connection, indexing, content, and publishing status for this server. | Visit forum |
| `/servers/$serverId/threads` | Threads | Content currently available through Velumn. | Visit forum |
| `/servers/$serverId/channels` | Channels | Choose which eligible Discord channels Velumn indexes. | Save changes when dirty |
| `/servers/$serverId/publishing` | Publishing | Manage the public URL and custom-domain verification. | Verify or refresh when applicable |

### `/auth/sign-in`

Purpose: authenticate with Discord.

Display:

- Velumn identity and short product explanation
- Discord sign-in action
- Authentication error when present

Data:

- Optional validated return URL
- Current session only to redirect an already authenticated user

Access:

- Guest-only
- Authenticated users redirect to `/servers` or a safe return URL

### `/`

Purpose: route resolver only. This is not a dashboard page.

Data:

- Session
- Last-used ready server ID
- Available server summaries when no last-used server exists

Behavior:

- Redirect to the last-used ready server
- Otherwise redirect to `/servers`

### `/servers`

Purpose: choose and manage a server installation.

Display for each server:

- Name and icon
- User role
- Setup, ready, or disconnected status
- Enabled channel count
- Indexed thread count
- Last successful indexing time
- Public forum link when available
- Continue setup, reconnect, or open-dashboard action

Data:

```ts
type ServerListItem = {
  id: string
  name: string
  icon: string | null
  role: 'owner' | 'admin' | 'manager'
  lifecycle: 'setup_required' | 'ready' | 'bot_disconnected'
  enabledChannelCount: number
  indexedThreadCount: number
  lastIndexedAt: string | null
  forumUrl: string | null
}
```

The page also displays an add-server action. It must not load channels, threads, domain records, or full Discord guild objects for every server.

Status is always a labeled badge, not color alone. Counts use explicit labels such as `3 channels` and `1,284 threads`. A missing indexing timestamp displays `Never indexed`; an existing timestamp is relative with its full localized value available on demand.

Each card has exactly one lifecycle-driven primary action: Continue setup, Reconnect bot, or Open dashboard. The public-forum link is a secondary external action and only appears when `forumUrl` exists. When no servers exist, explain that no manageable server has been added and present Add server as the primary action.

### `/servers/new`

Purpose: select a Discord server to add to Velumn.

Display for each eligible Discord server:

- Name and icon
- Owner or manageable role
- Existing Velumn installation state
- Add, continue setup, or open action

Data:

```ts
type EligibleDiscordServer = {
  id: string
  name: string
  icon: string | null
  owner: boolean
  canManage: boolean
  installation: 'not_added' | 'awaiting_bot' | 'selecting_channels' | 'ready'
}
```

Access:

- Valid session
- Fresh or short-lived Discord guild permission data
- Only guilds where the user has the required management permission are actionable

This is the only normal page that needs the user's full Discord guild list.

Search by server name and sort manageable servers alphabetically. Each row displays a labeled role and installation state with one action: Add, Continue setup, or Open. A non-manageable server may only be shown if it is clearly disabled with `Requires Manage Server permission`; otherwise omit it.

Initial loading uses a page skeleton. A Discord API failure is an inline error with Retry, not an empty result. Adding a server shows row-local pending state and prevents duplicate submission without disabling unrelated rows.

### `/servers/$serverId/setup`

Purpose: complete installation through one canonical setup flow.

This replaces separate invite-bot and select-channel page trees. The page is driven by one explicit state payload:

```ts
type ServerSetup =
  | { state: 'invite_required'; server: ServerIdentity; requiredPermissions: string[] }
  | { state: 'waiting_for_bot'; server: ServerIdentity; lastCheckedAt: string }
  | { state: 'select_channels'; server: ServerIdentity; channels: SetupChannel[] }
  | { state: 'starting_index'; server: ServerIdentity; job: IndexingJob }
  | { state: 'failed'; server: ServerIdentity; message: string; retryable: boolean }
  | { state: 'ready'; serverId: string }
```

Display by state:

- Bot permissions and invite action
- Lightweight bot-connection status while waiting
- Searchable eligible-channel selection
- Initial indexing progress
- Useful failure reason and retry action

Setup is an immersive authenticated flow. Suppress ordinary management navigation while preserving server switching, Help, and a safe return to `/servers`. The backend state is authoritative; URL or client state cannot skip setup steps.

Every state displays the server identity, current step, concise explanation, and one primary action. Channel selection shows `#name`, Forum or Text type, selected count, and disables Continue when nothing is selected. Indexing displays completed and total work when available. Failure displays a backend-safe reason, only offers Retry when retryable, and always offers Help.

Creating a pending invitation is an explicit mutation, never a side effect of rendering the page. Poll only lightweight setup status, not the entire server payload.

### `/servers/$serverId`

Purpose: operational overview of the selected server.

Display:

- Server identity and public forum URL
- Bot connection status
- Indexing status, last successful run, and current failure if any
- Eligible and enabled channel counts
- Indexed thread count
- Custom-domain status
- Recent indexed threads
- Clear actions for setup, reconnecting the bot, selecting channels, viewing content, and configuring publishing

Data:

```ts
type ServerOverview = {
  server: ServerIdentity
  forumUrl: string
  bot: {
    status: 'connected' | 'disconnected' | 'unknown'
    lastSeenAt: string | null
  }
  indexing: {
    status: 'idle' | 'queued' | 'running' | 'failed'
    lastSucceededAt: string | null
    error: string | null
  }
  channels: {
    eligible: number
    enabled: number
  }
  threads: {
    total: number
    recent: ThreadListItem[]
  }
  publishing: {
    domain: string | null
    status: 'default' | 'pending' | 'verified' | 'failed'
  }
}
```

The overview must distinguish a new empty server, active initial indexing, a failed job, and a genuinely empty result. Zero threads does not automatically mean indexing is running.

Present four concise summary areas:

- Bot connection: textual status, last-seen time, and reconnect or help action
- Indexing: idle, queued, running, or failed status; last successful time; retry when supported
- Content coverage: enabled versus eligible channels and total indexed threads
- Publishing: canonical hostname and default, pending, verified, or failed status

Recent indexed threads contains at most the five newest rows with title, parent channel, and last-indexed time plus View all. Hide this section during genuine first-time setup. After a successful indexing run with no results, show a specific empty result instead of setup messaging.

### `/servers/$serverId/threads`

Purpose: inspect the content Velumn has published.

Display in a TanStack Table with these initial columns:

1. Title: primary text linked to the public thread
2. Parent channel: displayed as `#channel-name`
3. Messages: right-aligned formatted count
4. Pinned: labeled indicator only when true
5. Last indexed: relative time with exact timestamp available; `Not indexed` when null
6. Actions: separately labeled links to the public thread and Discord

Data per row:

```ts
type ThreadListItem = {
  id: string
  title: string
  parentChannel: { id: string; name: string }
  messageCount: number
  pinned: boolean
  lastIndexedAt: string | null
  discordUrl: string
  publicUrl: string
}
```

Query state:

- Cursor or page
- Search text
- Parent-channel filter
- Pinned/publication filter if retained
- Sort key and direction

Default sorting is newest `lastIndexedAt` first. Search uses `Search threads`; channel filters show names and a selected count. A filtered empty result says that no threads match and offers Clear filters, never onboarding copy.

Pagination, sorting, and filtering are server-backed and represented in the URL. Do not paginate a partial server result again on the client. Do not include row selection until a real bulk action exists. Secondary external actions must not trigger the primary row link.

### `/servers/$serverId/channels`

Purpose: control which Discord channels Velumn indexes.

Display in a searchable table or list:

- Channel name and type
- Indexing enabled state
- Indexed thread count
- Last indexed time
- Current indexing or error state

Data per row:

```ts
type ChannelListItem = {
  id: string
  name: string
  type: 'forum' | 'text'
  indexingEnabled: boolean
  indexedThreadCount: number
  lastIndexedAt: string | null
  status: 'idle' | 'queued' | 'indexing' | 'failed'
  error: string | null
}
```

Display `#name`, Forum or Text type, indexing control, right-aligned thread count, relative last-indexed time, and a labeled status. Failed rows expose a concise safe error without replacing the rest of the table.

Changes are staged. Display enabled and selected counts with explicit Save and Discard actions, and warn before navigating away with unsaved changes. While saving, disable only affected controls. When the bot is disconnected, retain the data but disable changes with an explanation.

Channel mutations must validate that every submitted channel belongs to the authorized server. Setup and ongoing channel management should share the same channel-selection feature rather than duplicate implementations.

### `/servers/$serverId/publishing`

Purpose: explain where the public forum is available and manage its custom domain.

Display:

- Default Velumn forum URL
- Active canonical URL
- Custom domain input
- Verification status and last check time
- Required DNS records
- Add, verify/refresh, and remove actions
- Actionable provider error when verification fails

Data:

```ts
type PublishingSettings = {
  defaultUrl: string
  canonicalUrl: string
  customDomain: string | null
  verification: {
    status: 'not_configured' | 'pending' | 'verified' | 'failed'
    checkedAt: string | null
    message: string | null
    records: Array<{ type: string; name: string; value: string }>
  }
}
```

Return cached verification state in the initial payload. Refresh external Vercel verification independently so it does not block the shell or entire page.

Treat Publishing as a focused settings surface rather than creating a generic settings area. Show the default and canonical URLs as read-only copyable values. The custom-domain form uses a labeled hostname input and explicit Add or Save action; it never saves on blur.

Verification is a separate status card with a labeled state, relative and exact checked time, safe provider message, and independent Verify or Refresh action. DNS records use Type, Name, and Value columns with copy controls for Name and Value. Pending verification keeps the form and records visible instead of replacing the page with a spinner.

Removing a domain requires confirmation and explains that the default URL remains available. Add/Save, Verify, and Remove have independent pending states. Actionable errors remain inline; concise success feedback may use a toast.

## Pages Not Needed Initially

- A dashboard thread-detail page; link to the public thread or Discord source instead
- Generic account settings without an actual editable account feature
- Billing until the product has an active billing flow
- Analytics charts without a specific operational decision they help the user make
- Separate setup pages for each installation step

## Authorization Rules

- Every non-auth page requires a verified server-side session. A cookie-presence check is not authorization.
- Every server route requires an active membership and the capability needed by that page.
- Unknown or unauthorized server IDs return not found or access denied; they do not redirect into onboarding.
- Pre-installation setup requires current Discord management permission. Pending setup records must belong to the signed-in user.
- Every mutation repeats authorization on the server and scopes child resources, such as channels and domains, to the authorized server.
- Incomplete servers redirect ordinary management routes to setup. A disconnected bot keeps the overview available but disables operations that require the bot.
- Transport endpoints enforce their own procedure-level authorization regardless of route guards.

Unknown servers display a not-found state with Return to servers. Known servers without the required membership or capability display access denied without revealing additional server details. Route-data failures display a page-level error with Retry and Switch server. These states may render inside authenticated chrome when safe, but they are never presented as onboarding.

## Required Lifecycle Data

The current schema cannot reliably represent all page states. The rewrite needs authoritative values for:

- Membership role and capabilities
- Server setup lifecycle
- Bot installation and connection state
- Indexing job status, progress, failure reason, and timestamps
- Last successful channel and server indexing times
- Cached domain verification status, error, and checked time
- Last-used server preference

Do not infer these states from unrelated data such as whether channels exist, whether the thread count is zero, or whether one user-server row says onboarding is complete.

## Data and Loading Requirements

- Define page-specific payloads rather than returning complete ORM rows.
- Fetch the shell once and reuse its active membership result for route authorization.
- Load independent page aggregates in parallel after authorization.
- Do not call Discord during ordinary server navigation.
- Render critical route data on the initial response and let React Query own subsequent freshness and mutations.
- Prefetch likely server navigation targets where it is cheap and safe.
- Give every page explicit pending, empty, error, and disconnected states.
- Keep table filters and pagination in the URL so links are shareable and browser navigation works.
- Never maintain the same server data in a route loader, React context, Zustand, and React Query simultaneously.

List and table states follow this matrix:

| State | Required display |
| --- | --- |
| Initial loading | Preserve the page header and expected column widths; show approximately eight skeleton rows. |
| Background refresh | Keep existing data visible and show a subtle refreshing indicator. |
| First-use empty | Explain the feature and provide the relevant setup action. |
| Filtered empty | Explain that nothing matches and offer Clear filters. |
| Error | Show an inline safe error with Retry; never present it as empty. |
| Disconnected | Retain existing data, show a warning, and disable only bot-dependent mutations. |
| Loading another page | Keep loaded rows visible and append loading rows or a local pagination indicator. |
| Mutation pending | Disable only the affected control or row and expose its busy state accessibly. |

Relative timestamps expose full localized timestamps. Numeric columns are right-aligned with tabular figures. Meaningful null values use domain copy such as `Never indexed` rather than an unexplained dash.

## Latitude-Derived Patterns

These patterns are inspired by Latitude's current dashboard. Adopt the underlying behavior without copying its components or product-specific styling.

### Route-Composed Breadcrumbs

Each route defines its own breadcrumb label or component alongside its route configuration. The authenticated shell renders the breadcrumb definitions from the active route matches in hierarchy order.

This lets dynamic segments use already-authorized route data instead of parsing the URL or fetching the same record again. For Velumn, the server route contributes the searchable server segment and child routes contribute labels such as Threads, Channels, or Publishing. Intermediate segments are links; the current page is plain text.

### Breadcrumb Server Switcher

The active server breadcrumb also opens the server switcher. It supports keyboard navigation, search by server name, clear active-state indication, and lifecycle or role context where useful.

The result list scrolls independently. Add server remains pinned in the footer, so it is available while searching, when results overflow, and when no server matches. Switching servers should preserve the closest equivalent child page when allowed; otherwise open the target server overview or setup flow.

### Route-Requested Sidebar Collapse

The shell owns the user's persisted desktop sidebar preference. A route may request a collapsed presentation when it needs additional horizontal space, but it does not permanently overwrite that preference.

This is useful for future dense tables or split views. The initial Velumn routes should not force collapse unless the content demonstrably benefits. A collapsed sidebar retains tooltips, accessible names, active-state indication, and a clear expansion control.

### Shared Navigation Definitions

Define server sections once with their label, icon, group, path builder, active-route matcher, capability requirement, and lifecycle availability. The sidebar, breadcrumbs, mobile navigation, and any future command palette derive navigation from these definitions.

This prevents links and access hints from drifting across multiple components. These definitions control presentation only; route loaders and mutations remain the authorization authority.

If Velumn later adds a command palette, it should reuse the same section definitions and allow the active page to contribute contextual commands. Do not add a command palette merely to imitate Latitude while the route inventory remains small.

### Preview-Backed First-Use States

For an important empty feature, render a noninteractive skeleton representing the eventual populated page, fade it into the background, and place a concise setup explanation and primary action above it.

This can help the Threads first-use state communicate what indexing will produce while clearly distinguishing the preview from real data. Decorative preview content is hidden from assistive technology, cannot receive pointer events, and never uses realistic fake records that could be mistaken for user data.

Use this only for first-use onboarding. Filtered-empty, failed, disconnected, and genuinely empty-after-indexing states retain their direct state-specific messaging.

### Responsive Split-Screen Setup

The setup flow may use two coordinated panes on wide screens: the active controls and explanation in the primary pane, and contextual visuals or guidance in the secondary pane. The secondary pane follows the authoritative setup state and does not own navigation or progress.

The primary pane scrolls independently and remains fully usable by itself. Below the large-screen breakpoint, remove the secondary pane rather than compressing both panes. Respect reduced-motion preferences, and never delay setup actions while waiting for decorative transitions.

### Accessible Resizable Detail Drawers

If Velumn later adds in-dashboard inspection, use a side drawer that preserves list context rather than introducing a full thread-detail page by default. The drawer may remember its width locally, clamp itself to the available viewport, and become full-width or modal on narrow screens.

Its resize handle uses separator semantics and supports pointer dragging, Arrow keys, Home, and End. Opening a drawer is represented in route or URL state when deep linking and browser history are useful. Focus moves into the drawer appropriately and returns to the originating row when it closes.

This pattern is deferred until Velumn has detail data or actions that are materially better inside the dashboard than on the public thread or Discord.

### Selection Across All Matching Rows

If a real bulk operation is introduced, distinguish between explicitly selected row IDs and all rows matching the current server-side filters. The latter is a query selection, not a list of only the rows currently loaded in the browser.

The UI must state whether the current page or every matching result is selected, show the affected count when available, and send the validated filter plus explicit exclusions to the server. The server re-runs authorization and determines the final affected records. Changing filters clears or explicitly reconfirms query-wide selection.

Do not implement this model, or any selection checkbox, until a concrete bulk thread or channel operation exists.

### Clean Default URL State

Search parameters represent user choices, not every effective default. Default sort, page, and empty filters may remain absent from the URL until the user changes them. Route validation applies the effective defaults when parameters are missing.

This keeps URLs short while preserving shareability once users choose a non-default search, filter, sort, or page. Returning a control to its default removes the redundant parameter. Parsing, validation, defaults, and serialization remain centralized in TanStack Router.

## Vercel Constraint

The application will deploy to Vercel. TanStack Start's current hosting documentation directs Vercel deployments through the Nitro Vite plugin and Vercel deployment flow. The rewrite must keep server code compatible with that runtime, avoid relying on a persistent in-process server, and treat external work such as indexing as background service work rather than request-lifetime work.

Before implementation, verify the current TanStack Start, Nitro, and Vercel deployment guidance and pin compatible versions. Do not assume deployment behavior from the existing Next.js application.
