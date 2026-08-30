# Dashboard Migration Progress

Last updated: 2026-08-08

This file tracks the migration from `apps/dashboard` to `apps/dashboard-new`.
An item is complete only when it uses authorized production-shaped data and has
been verified. Fixture-backed UI is tracked separately from completed work.

## Current Status

The TanStack Start application, authentication, onboarding, shell, server list,
overview, Threads, Channels, and Publishing management surfaces are implemented
against real data. No fixture server data remains in the rewrite. Production
readiness and cutover verification remain before it can replace the existing
dashboard.

## Completed

- [x] Create the TanStack Start application on port 3001.
- [x] Configure Better Auth with Discord OAuth.
- [x] Protect authenticated routes with a server-side session check.
- [x] Validate safe authentication return URLs.
- [x] Add sign-in and sign-out behavior.
- [x] Configure local PostgreSQL and apply the existing Drizzle migrations.
- [x] Add the authenticated dashboard shell and responsive navigation.
- [x] Add server switching and immersive onboarding shells.
- [x] Implement fixture-backed server list and overview presentations.
- [x] Implement the fixture-backed unified setup presentation.
- [x] Adopt the old dashboard's global CSS and Outfit typography.
- [x] Add a tested schema-free onboarding lifecycle resolver.
- [x] Apply invite freshness and consume invites after bot installation.
- [x] Make bot installation persistence transactional.
- [x] Preserve memberships on bot removal and clear `kicked_at` on rejoin.
- [x] Scope channel selection writes to validated server-owned channels.
- [x] Mark onboarding complete only after the indexing trigger is accepted.
- [x] Replace fixture guild discovery with refresh-aware Discord API data.
- [x] Batch guild lifecycle projection without per-guild database queries.
- [x] Replace fixture shell, server list, and overview reads with authorized
      Drizzle projections.
- [x] Enforce membership on every implemented server read.
- [x] Replace local setup transitions with persisted reads and server mutations.
- [x] Add explicit invite, reconnect, channel selection, and indexing actions.
- [x] Poll lightweight persisted setup state while waiting for the bot.
- [x] Hydrate route-critical onboarding data through React Query.
- [x] Move onboarding mutations to scoped React Query invalidation.
- [x] Add waiting-state recovery actions, channel-level publishing consequences,
      and an inline indexing-scope review.
- [x] Instrument server selection, Discord authorization, bot connection,
      channel submission, and successful indexing start in PostHog.
- [x] Remove direct `useEffect` usage from the rewrite and enforce that boundary
      with ESLint.
- [x] Cache successful Discord guild reads in React Query's request/browser
      cache; failures remain explicitly retryable and no access tokens enter a
      process-global cache.
- [x] Replace the Threads placeholder with an authorized TanStack Table.
- [x] Add server-backed thread search, channel/pinned filters, sorting, and
      pagination with validated URL state.
- [x] Align dashboard thread totals with public threads that have valid parents.
- [x] Make custom-domain add, verification, and removal transitions race-safe
      with conditional database updates and compensating add cleanup.
- [x] Map stable Vercel failures to actionable UI states, preserve last-known
      activation during outages, and poll only while verification is pending.
- [x] Resolve public custom-domain routing from indexed PostgreSQL reads instead
      of coordinating a private cache across dashboard and web deployments.
- [x] Model expected Vercel failures with `better-result` at the provider
      boundary and translate them to serializable TanStack server responses.
- [x] Verify formatting, type checking, linting, tests, and production builds.

## In Progress

- [x] Enforce membership checks on Publishing reads and writes.
- [ ] Define membership roles and capabilities. Deferred: `user_servers` has no
      role column, so every member is currently a single `manager` tier with
      full capabilities. Authorization is enforced by membership, not by this
      label, and the label is not shown in the UI.

## Remaining Backend Work

- [ ] Add indexing jobs with status, progress, errors, and timestamps.
- [ ] Add server and channel last-successful-index timestamps.
- [ ] Cache domain verification status, errors, DNS records, and check time.
- [ ] Persist each user's last-used server.
- [ ] Backfill lifecycle and membership data for existing servers.
- [x] Add a page-specific authorized query for publishing.
- [ ] Add procedure-level authorization to every mutation.

## Remaining Onboarding Work

- [x] Fetch manageable Discord guilds using the authenticated Discord account.
- [x] Handle expired Discord access tokens and Discord API failures.
- [x] Create a pending installation through an explicit mutation.
- [x] Generate the real Discord bot invitation.
- [x] Poll lightweight persisted bot-connection status.
- [x] Load eligible channels from the authorized Discord server.
- [x] Persist selected channels after validating server ownership.
- [x] Queue initial indexing in the background service.
- [ ] Display authoritative indexing progress and retryable failures.
- [x] Remove local-only onboarding transitions from the route component.

## Remaining Pages

- [x] Replace the Threads placeholder with a server-backed TanStack Table.
- [x] Add URL-backed thread search, filters, sorting, and pagination.
- [x] Replace the Channels placeholder with staged Save and Discard behavior.
- [x] Add unsaved-change protection and disconnected-bot handling to Channels.
- [x] Replace the Publishing placeholder with domain management.
- [x] Port Vercel domain verification and DNS record operations.
- [x] Complete loading, empty, error, refresh, and disconnected states.

## Testing And Cutover

- [ ] Add database query and mutation integration tests.
- [ ] Add membership and capability authorization tests.
- [x] Add onboarding lifecycle tests.
- [x] Add table URL-state tests.
- [ ] Add authenticated end-to-end coverage.
- [ ] Validate migrations and backfills against production-shaped data.
- [ ] Configure and verify the Vercel deployment adapter.
- [ ] Run parity and rollback testing before switching traffic.
- [ ] Retire `apps/dashboard` after the rollback window.

## State Model Decision

The existing schema and its real production data are compatibility constraints.
Do not add or reinterpret columns casually. Any proposed schema change must
identify a state that cannot be represented safely, include a backfill and
rollback plan, and be reviewed before implementation.

The old dashboard previously derived onboarding from `pending_discord_invite`,
the existence of server/channel rows, `user_servers.finished_onboarding`, and
`db_server.kicked_at`. The shared resolver now preserves those tables while
centralizing their interpretation and no longer treats channel count as bot
presence.

The rewrite exposes a clean discriminated `ServerSetup` contract with these
states: `invite_required`, `waiting_for_bot`, `select_channels`,
`starting_index`, `failed`, and `ready`. That contract is now populated from the
shared resolver, not fixtures.

The database remains authoritative; URL state and local React state must never
advance onboarding.

## Unbacked Contract Fields

Some contract fields have no column in the current schema. They are returned as
`null` or `unknown` and **no surface renders them**, rather than being filled
with plausible-looking values. This matches how the unreachable `starting_index`
job detail was handled.

| Field                                           | Status                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `lastIndexedAt` (server and thread)             | no column; omitted from UI                                                                            |
| `indexing.status` / `lastSucceededAt` / `error` | no job table; card removed                                                                            |
| `bot.lastSeenAt`                                | no heartbeat persisted; not rendered                                                                  |
| `lastUsedServerId`                              | no preference persisted; always `null`                                                                |
| `role` / `capabilities`                         | flat `manager`; not rendered                                                                          |
| domain verification details                     | only domain and verified boolean persist; records, provider errors, and check time are refreshed live |

Each becomes real only when the corresponding additive migration lands, under
the review rules in "State Model Decision" above.

## Schema-Free Lifecycle Plan

Use the existing data with this precedence:

1. No valid Discord management permission means access denied, not onboarding.
2. A current user's pending invite without a linked `user_servers` row means
   `waiting_for_bot`.
3. No pending invite and no linked server means `invite_required`.
4. A linked server with `kicked_at` set means `bot_disconnected`.
5. A linked server with `finished_onboarding = false` means `select_channels`.
   An empty channel result is an explicit empty or synchronization error, not
   evidence that the bot has not joined.
6. A linked server with `finished_onboarding = true` means `ready` under the
   current schema.

Schema-free reliability work:

- [x] Validate pending-invite ownership and apply an `updated_at` freshness
      window.
- [x] Remove pending invites after the bot links the server.
- [x] Preserve `user_servers` links when the bot leaves so `kicked_at` can
      represent a reconnectable server, and clear `kicked_at` when it rejoins.
- [x] Validate every submitted channel against the authorized server.
- [x] Update channel selections before setting `finished_onboarding`.
- [x] Do not mark onboarding finished unless the indexing trigger is accepted.
- [x] Make bot installation persistence transactional.
- [x] Cover resolver combinations with table-driven tests.
- [x] Move pending invite creation out of server rendering and behind an
      explicit user action in the rewrite.

The existing schema cannot faithfully expose queued/running indexing progress,
durable indexing failures, role/capability distinctions, or precise bot
last-seen health. Keep those as known limitations. Propose additive schema only
if product behavior requires those states after the schema-free path ships.
