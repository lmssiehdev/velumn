# Dashboard Migration

The product specification remains in `../../dashboard-rewrite.md`. This file tracks implementation checkpoints for the rewrite.

## Decisions

- TanStack Router exclusively owns URL search state. Do not add `nuqs`.
- shadcn/ui is the component source, using its Base UI-backed Nova style.
- `better-result` is limited to expected external-provider failures. Route boundaries translate failures into redirects, not-found responses, or serializable UI errors.
- Unexpected defects throw and reach TanStack error boundaries and observability.
- No fixture adapter remains in the production route data path.
- TanStack package versions are pinned. Upgrade them as a tested set rather than allowing `latest` to drift between installs.
- React and React DOM use the root Bun catalog so SSR and workspace packages share one runtime instance.
- Local database inspection uses an ignored, expiring PlanetScale role with only `pg_read_all_data`; production credentials are never copied into the rewrite.

## Checkpoint 1: Foundation And Vertical Slice

Status: complete

- Current TanStack Start scaffold with SSR and generated file routes
- Tailwind 4 and shadcn/Base UI design system
- Responsive authenticated-shell composition with desktop navigation and mobile sheet
- `/servers` directory with lifecycle-specific states and actions
- `/servers/$serverId` operational overview with disconnected, indexing, coverage, publishing, and recent-content states
- Typed minimal browser payloads
- Typed provider failures translated to serializable route results
- Placeholder routes preserving the target information architecture
- Typecheck, lint, production build, and SSR route smoke tests

## Checkpoint 2: Authentication And Live Read Model

Status: in progress

- [x] Move the application to `apps/dashboard-new` so it can consume workspace packages
- [x] Configure Better Auth with `tanstackStartCookies()` and mount `/api/auth/$`
- [x] Add `/auth/sign-in` with a validated, same-origin return URL
- [x] Protect the pathless dashboard layout using a server-side session check on every navigation
- [x] Normalize dashboard environment variable names and isolate the local rewrite origin
- [x] Add sign-out and session-expiry redirects on navigation
- [x] Remove the development demo-session override so login and logout always use Better Auth
- [x] Replace the in-memory shell, server list, and overview adapters with narrow Drizzle projections
- [x] Enforce membership checks before every server query; non-members and unknown servers are indistinguishable
- [x] Represent missing lifecycle fields explicitly rather than inferring them from unrelated rows
- [ ] Add fixture-backed tests for authenticated, unauthorized, missing-server, setup-required, and disconnected states

Acceptance gate: no fixture server data reaches a production build. **Met** — `features/dashboard/server.ts` holds no fixtures.

Reads are batched: one membership query plus three parallel aggregate queries, regardless of how many servers a user belongs to. Fields the schema cannot answer are returned `null`/`unknown` and are not rendered; see the "Unbacked Contract Fields" table in `../../PROGRESS.md`.

## Checkpoint 3: Setup Flow

Status: in progress

- [x] Implement `/servers/new` with refresh-aware Discord guild discovery
- [x] Batch installation lifecycle reads for the Discord guild list
- [x] Implement authoritative `/servers/$serverId/setup` state resolution
- [x] Add explicit invite, reconnect, and channel-selection mutations
- [x] Add Discord guild permission refresh only where installation requires it
- [x] Poll persisted bot-installation state without client lifecycle ownership
- [x] Hydrate critical route data through a request-scoped QueryClient
- [x] Poll database-only setup status with a conditional React Query interval
- [x] Add scoped mutation invalidation and route-scoped Discord guild caching
- [x] Share channel-selection composition with ongoing channel management
- [ ] Add durable indexing progress and failure state when backend data exists

## Checkpoint 4: Management Surfaces

Status: in progress

- [x] Threads table with validated URL search, server pagination, sorting, and filtering
- [x] Channels table with staged changes, discard/save behavior, and navigation blocking
- [x] Publishing settings with persisted domain state and independent verification mutations
- [x] Explicit loading, first-use empty, filtered empty, disconnected, mutation, and error states
- [x] Race-safe domain transitions, idempotent Vercel errors, pending-only polling, and provider-outage recovery

Threads use a narrow authorized projection of public Discord threads with valid
same-server parents. Search, parent-channel and pinned filters, sorting, and
pagination execute in PostgreSQL. The current schema has no successful-index
timestamp, so the default is truthful Discord thread creation order and the
`lastIndexedAt` field remains `null` rather than deriving a misleading value
from the indexing cursor.

Publishing verifies ownership after reading the current Vercel state and uses
the verification response immediately. Domain writes use compare-and-set
transitions so stale verification cannot restore a removed domain. Detailed DNS
records, provider errors, and check times remain session state until additive
schema work makes them durable. Public custom-host and redirect decisions read
the indexed domain state directly rather than relying on cross-application cache
revalidation.

## Checkpoint 5: Production Readiness

Status: pending

- [x] React Query hydration and targeted invalidation for onboarding
- Vercel/Nitro deployment configuration
- Error reporting, structured logging, and safe user-facing messages
- Accessibility and keyboard review
- Desktop and mobile visual regression coverage
- Bundle analysis and server-query review
- Cutover plan from `apps/dashboard`
