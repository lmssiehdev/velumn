# TanStack Application Migration

The product specification remains in `../../dashboard-rewrite.md`. This file tracks the completed dashboard rewrite and the migration of `../web` into one TanStack Start application. The final production application serves the public site, public forums, verified custom domains, and the authenticated dashboard under `/dashboard`.

The migration target is this application. Do not create a third application. Keep the existing Next.js app serving production while public route islands move here and pass parity gates.

## Reference Policy

The shallow sibling clones are implementation references, not dependencies or specifications:

- `../../../openstory` is the primary TanStack Start reference for route organization, server-function middleware, scoped data access, environment adapters, logging, and production-built tests.
- `../../../dub` is a reference for custom-domain lifecycle, provider failure handling, cache invalidation, and asynchronous cleanup.
- `../../../AnswerOverflow` is a reference for pure host-routing decisions, Discord community tenancy, custom-domain metadata, and tenant/resource ownership checks.
- Official TanStack Start and Router documentation is authoritative when a reference conflicts with current framework behavior.

Copy no architecture blindly. Preserve the useful constraint, then use the smallest implementation that is safer, clearer, or more measurable for Velumn. Reference repositories may contain framework-version assumptions, missing CSRF middleware, broad host matching, oversized middleware, client-first auth, or product-specific complexity that must not be carried forward.

## Decisions

- TanStack Router exclusively owns URL search state. Do not add `nuqs`.
- shadcn/ui is the component source, using its Base UI-backed Nova style.
- `better-result` is limited to expected external-provider failures. Route boundaries translate failures into redirects, not-found responses, or serializable UI errors.
- Unexpected defects throw and reach TanStack error boundaries and observability.
- No fixture adapter remains in the production route data path.
- TanStack package versions are pinned. Upgrade them as a tested set rather than allowing `latest` to drift between installs.
- React and React DOM use the root Bun catalog so SSR and workspace packages share one runtime instance.
- Local database inspection uses an ignored, expiring PlanetScale role with only `pg_read_all_data`; production credentials are never copied into the rewrite.
- `apps/dashboard-new` becomes the combined application. Dashboard routes move under `/dashboard`; `/` remains the marketing home.
- The root route is neutral and minimal. It performs no session lookup, tenant database lookup, dashboard query, or dashboard-only import.
- Public, dashboard, and tenant routes are separate route islands with route-local components, data contracts, styles, fonts, and heavy dependencies.
- Route modules orchestrate validation, loaders, metadata, and rendering. They are not reusable barrels and do not contain provider or database implementations.
- Server functions authorize and load. Query modules cache. Feature models transform. Synchronous components render explicit serializable DTOs.
- Public content reads go through one publication-aware repository. Pages, metadata, Open Graph, Markdown, search, and sitemaps cannot bypass publication rules with raw database helpers.
- Browser-safe modules cannot import `@repo/db`, `node:*`, provider SDKs, secret-bearing modules, or sibling application source.
- `useEffect` and `useLayoutEffect` are banned in first-party application code, including aliased and namespace imports. Synchronization uses loaders, events, CSS, `useSyncExternalStore`, callback refs with cleanup, or query state.
- Production builds fail on type errors. The Next.js `typescript.ignoreBuildErrors` escape hatch is not preserved.
- Public-to-dashboard links disable preloading unless the user is already inside the dashboard. Hovering a marketing CTA must not fetch dashboard chunks or execute auth loaders.
- Custom domains cannot reach `/dashboard`, auth handlers, internal cache endpoints, private server-function surfaces, or internal tenant paths.
- Defining `src/start.ts` requires explicitly installing the current TanStack CSRF middleware; do not assume the framework default remains installed.
- TanStack Start, Router, Router plugin, SSR Query integration, and devtools are upgraded and tested as one compatible version set before the combined migration.

## Target Request Surfaces

| Surface                      | Host                                        | Public paths                                                       | Data boundary                      |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| Marketing and platform forum | Canonical Velumn host and approved previews | `/`, `/pricing`, `/blog/*`, `/server/*`, `/channel/*`, `/thread/*` | Anonymous public repository        |
| Dashboard                    | Canonical Velumn host only                  | `/dashboard/*`, `/api/auth/*`                                      | Authenticated managed-server scope |
| Tenant forum                 | Verified custom domain only                 | `/`, `/channel/*`, `/thread/*`, `/robots.txt`, `/sitemap.xml*`     | Verified public-tenant scope       |

Custom-host requests may be rewritten internally to a reserved namespace such as `/__tenant/$host/*`. That namespace is never a public URL, and direct requests to it return `404` on every host. Host classification is a pure function behind a thin Start server-entry adapter.

## Non-Negotiable Migration Blockers

The following findings are defects or unsafe boundaries, not parity requirements. They must be corrected before the combined application becomes authoritative.

### Public Content Boundary

- Raw public helpers do not consistently enforce `indexingEnabled`, supported thread type, active server state, a visible starter message, or parent-channel visibility.
- Create one `PublicContentRepository` with narrow methods for page, metadata, OG, Markdown, list, search, and sitemap projections.
- Disabling a channel, removing the bot, deleting content, or removing a domain must make every public representation unavailable within the documented invalidation SLA.
- Inaccessible and nonexistent tenant resources remain indistinguishable.

Primary audit references: `../../packages/db/src/helpers/channels.ts`, `../../packages/db/src/helpers/servers.ts`, and `../web/src/app/(forum)`.

### Search Isolation And Sanitization

- The public bot search procedure interpolates an arbitrary `serverId` into MeiliSearch filter syntax. Validate Discord snowflakes as digits and construct or escape filters safely.
- Search currently computes asynchronous sanitized fields but renders unsanitized provider `_formatted` HTML with `dangerouslySetInnerHTML`.
- Return a deliberately shaped DTO containing text plus safely represented highlight ranges, or allow only sanitized `<mark>` output.
- Proxy search through the same TanStack origin. Resolve tenant identity from the verified host server-side instead of allowing arbitrary custom domains to call the bot API directly.
- Add adversarial cross-tenant filter and executable-markup tests.

Primary audit references: `../../apps/bot/src/helpers/trpc.ts`, `../../apps/bot/src/indexing/search.ts`, and `../web/src/components/search/search-modal.tsx`.

### Privacy Purge

- Ignoring a Discord user mutates database content but does not reliably purge cached HTML, serialized data, Markdown, JSON-LD, OG output, sitemap entries, or MeiliSearch documents.
- Implement privacy removal as a durable purge workflow with affected-thread discovery, database mutation, search deletion, hard cache expiry, CDN purge where applicable, retries, and observability.
- Privacy, deletion, unpublishing, and domain removal use hard invalidation. They never use stale-while-revalidate.

Primary audit reference: `../../packages/db/src/helpers/user.ts`.

### Tenant Route Isolation

- The current internal `[domain]` path can be requested directly on the main host, creating crawlable tenant aliases.
- A request cannot select a tenant through its pathname. Tenant identity is bound to the normalized verified request host.
- Main-host tenant aliases, malformed hosts, malicious trusted-host suffixes, and direct internal paths return `404` or one canonical `308`.

### Cache Correctness

- Current `revalidateTag(tag, "max")` may serve stale content after invalidation. Separate hard purge from soft refresh.
- Existing domain invalidation tags do not map consistently to real cache entries, and `dashboard-new` does not invoke the legacy domain invalidation flow.
- Cache keys include representation, normalized host or tenant, entity ID, and content version.
- Cross-request caching requires a durable shared store or verified platform cache, not process memory.
- Cold-key regeneration uses single-flight request coalescing.
- The bot uses a dedicated scoped invalidation credential, not `DISCORD_BOT_TOKEN`.

### Effect-Free React

The Next app contains ten `useEffect` calls and one `useLayoutEffect`. None are ported as effects:

| Current behavior                                   | Replacement                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Local storage mirroring and `storage` subscription | `useSyncExternalStore` store with deterministic server snapshot and event-driven setter |
| Hash subscription                                  | Router location or a `useSyncExternalStore` hash store                                  |
| Timed thread highlight                             | CSS `:target` and keyframes                                                             |
| Search request lifecycle                           | TanStack Query keyed by normalized query, with cancellation and explicit states         |
| Search lazy-open state                             | Update all related state in the opening event                                           |
| Portal element lookup                              | Shell ownership, context, or a callback ref; prefer removing the portal                 |
| Global keyboard shortcut                           | Shell/root event boundary or an explicit external shortcut store                        |
| Intersection and resize observers                  | React 19 callback refs that return cleanup, or CSS when sufficient                      |
| Hydration mounted flag                             | Deterministic external-store server snapshot                                            |

The lint rule must ban named imports, aliases, `React.useEffect`, `useLayoutEffect`, and equivalent namespace access.

## Next.js Patterns To Remove

| Next.js pattern                                                   | Current role                                       | TanStack target                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| App Router `layout.tsx`, `page.tsx`, route groups, and `[param]`  | Route discovery and nested layouts                 | File routes, pathless layouts, `$param`, `loader`, `beforeLoad`, and route boundaries                      |
| Async Server Components                                           | Database, filesystem, and Shiki work during render | Server functions/loaders returning serializable view models; synchronous components                        |
| `next/link`                                                       | Navigation                                         | Typed TanStack `Link`; plain anchors for cross-host/external/content-negotiated links                      |
| `next/navigation`                                                 | Redirects and not found                            | Thrown TanStack redirects/not-found from loaders or standard redirect responses where exact status matters |
| `next/server` and `NextResponse.rewrite`                          | Request parsing and host rewrites                  | Standard `Request`/`Response` plus a custom Start server entry or verified request middleware adapter      |
| `next/cache`, `unstable_cache`, `revalidateTag`, `revalidatePath` | Request and cross-request caching                  | Request-scoped dedupe plus an explicit durable cache and invalidation contract                             |
| Route `revalidate`                                                | Sitemap ISR                                        | Explicit cache headers and durable generation caching                                                      |
| `next/dynamic` with `ssr: false`                                  | Browser-only islands                               | Route splitting, lazy components, and browser-safe module boundaries                                       |
| `next/image`                                                      | One blog image                                     | Responsive image component or explicit `<img>` dimensions, sources, loading, and decoding                  |
| `next/font`                                                       | Questrial                                          | Self-hosted WOFF2 or Fontsource with surface-scoped font variables                                         |
| `next/og`                                                         | Dynamic images                                     | One standard image server route using a verified runtime-compatible renderer                               |
| `@next/mdx`, `generateStaticParams`, `dynamicParams`              | Blog compilation and static routes                 | Vite content manifest or `import.meta.glob`, metadata validation, and Start prerender discovery            |
| `instrumentation-client.ts`                                       | Automatic PostHog initialization                   | Explicit idempotent client bootstrap with documented privacy and bundle budget                             |
| `next.config.ts` redirects and rewrites                           | Discord, sticker, and PostHog proxies              | Start server routes or deployment-level redirects/streaming proxies                                        |
| `NEXT_PUBLIC_*` conventions                                       | Public and server configuration                    | Validated server-only env plus minimal explicit `VITE_*` client config                                     |
| `"use client"`                                                    | RSC graph boundary                                 | Removed; browser/server safety is enforced structurally                                                    |

## Existing Behavior To Improve Instead Of Preserve

### Data Loading And Payloads

- Metadata and OG requests currently load full thread graphs. Add slim `getPublicThreadMetadata` and `getPublicThreadOgData` projections.
- Thread and channel pages perform redundant server queries even when the loaded relation already contains server identity.
- The full thread relation graph is serialized into `ThreadProvider` for controls that need only thread, channel, and server IDs. Replace it with tiny action DTOs.
- Nested `Boards` and Shiki `Code` components perform async server work during render. Move that work to the route data boundary.
- Main-host and custom-domain server, channel, thread, Markdown, metadata, and JSON-LD implementations are duplicated. Use one public view and one public data contract with a host-derived route context.
- Route modules are terminal route definitions, not reusable APIs. Move shared pagination, FAQ, and forum shell code out of route files.

### Pagination And Database Queries

- Replace high-cardinality offset pagination with validated cursor/keyset pagination.
- Bound pagination inputs and cache cardinality; huge arbitrary page numbers must not trigger expensive offsets.
- The pinned-thread query is unbounded while the view renders only one pin. Define and enforce a product limit or render every fetched pin.
- Add production-shaped `EXPLAIN (ANALYZE, BUFFERS)` review and matching composite indexes for server lists, channel lists, and sitemap exports.
- Fix the downvote update that increments from the upvote column.

### SEO

- Build platform and tenant SEO from one neutral model adapted to TanStack `head()` output.
- Load route data once, then derive rendering and `head` from the same result.
- Custom domains use tenant title, description, icon, canonical origin, OG site name, and structured-data identity instead of inheriting Velumn branding accidentally.
- Wrong slugs use one permanent canonical redirect before full thread rendering.
- Define pagination SEO intentionally: self-canonical pages or `noindex,follow` after page one.
- Internal tenant paths and internal Markdown paths are not indexable public URLs.
- JSON-LD remains server-only, contains only public data, uses accurate update times, and has an explicit size budget.
- Sitemaps use stable keyset or versioned range partitions instead of independently cached offsets.
- Sitemap `lastmod` reflects a real public update timestamp. Omit it when unknown; do not fabricate daily marketing updates.
- Domain and publication transitions invalidate both main and tenant sitemap generations.
- Published blog content is validated at build time; placeholder or empty content cannot enter the sitemap.

### Open Graph And Machine Routes

- Replace duplicate `/og` and `/og/thread` implementations with one route and remove the empty `/og/server` artifact unless a real server image is implemented.
- Fix the thread/server lookup, reply-count precedence bug, missing ID handling, foreign-tenant access, font naming, and full-thread overfetch.
- Correct robots paths; current rules allow `/api/og/*` while OG routes live under `/og`.
- Parse Markdown `Accept` quality correctly or standardize on an explicit `.md` representation. `text/markdown;q=0` must not select Markdown.
- Missing, empty, private, or removed Markdown content returns semantic `404` or `410`, never a successful error document.

### Performance And Bundles

- Public routes do not import dashboard UI, Better Auth server code, TanStack Table, Vercel SDK, dashboard fonts, dashboard CSS, or devtools.
- Forum routes do not eagerly ship Shiki, Lottie, PostHog, marketing animation libraries, or complete Markdown provider responses.
- Markdown parsing and syntax highlighting are server-owned where possible. Optional code preview and Lottie behavior load only when content and interaction require them.
- Use one router-scoped QueryClient. Do not port the Next singleton and per-widget dynamic Query providers.
- Scope marketing, forum, and dashboard tokens under explicit surface roots. The two current global token systems cannot be merged by import order.
- Keep one intentional UI primitive system. Namespace legacy forum primitives temporarily when behavior is not yet equivalent.
- Self-host only used font files and reserve media dimensions to prevent layout shift.
- Define an analytics privacy and transfer budget before loading PostHog on anonymous forum and custom-domain traffic.

## Target Server Boundaries

Use explicit file roles:

```text
feature/contracts.ts           serializable schemas and DTOs
feature/query-options.ts       browser-safe query factories
feature/mutations.client.ts    mutation hooks and cache transitions
feature/functions.ts           createServerFn declarations/stubs
feature/repository.server.ts   database and cache implementation
feature/provider.server.ts     external provider SDK implementation
feature/view.tsx               synchronous rendering
```

Dependency rules are executable through ESLint restricted paths, package export maps, import-protection builds, and bundle scans:

- Browser and route modules cannot import raw database, Node, provider, or secret modules.
- Server modules cannot import browser clients or React views.
- Query-option modules cannot import mutation hooks or provider implementations.
- Applications cannot import private source files from sibling applications. Shared bot/web contracts move behind an intentional workspace export.
- Auth middleware returns a managed-server capability already bound to the authenticated user and server. Public tenant middleware returns a verified public-tenant capability. Ordinary handlers should not receive an unrestricted database handle.

## Cache Model

The replacement cache has two distinct layers:

1. Request-scoped deduplication prevents repeated tenant, server, and entity queries during one request.
2. Durable cross-request caching serves public SEO traffic across deployment instances.

Cache operations are representation-aware and observable. Required event classes:

| Event                                                             | Policy                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Privacy removal, deletion, unpublish, bot removal, domain removal | Immediate hard purge before acknowledgement                           |
| Domain verification or canonical-host change                      | Purge old and new host mappings, public content, robots, and sitemaps |
| New reply, count update, non-sensitive metadata                   | Bounded soft refresh with documented maximum staleness                |

The migration preserves the bot invalidation HTTP contract until all producers move safely. Path-based invalidation is removed when no page-cache consumer remains. Every emitted tag or key must map to a real cache entry and have a test.

## Domain Lifecycle

Do not preserve `customDomain` plus `domainVerified` as the eventual complete provider state. Additive schema work should support at least:

```text
unconfigured
provisioning
pending_dns
verified
removing
provider_error
```

Removal makes the domain unservable in the database first, hard-purges routing caches, then performs provider cleanup idempotently with retries. Copy Dub's tombstone/background-cleanup principle, not its implementation complexity.

## Quality Gates

### Browser And Bundle Isolation

- `/`, `/pricing`, and public thread hard loads fetch no dashboard chunk, stylesheet, server function, or auth request.
- Public HTML contains no dashboard stylesheet or dashboard module preload.
- Public chunks contain no DB drivers, `@vercel/sdk`, Better Auth server adapters, bot implementation, secret variable names, or production devtools.
- Threads without code or animated stickers load no Shiki or Lottie chunk.
- Bundle reports are generated for root, public thread, dashboard shell, publishing, search, and optional rich-content chunks.

### Query And Request Isolation

- Marketing requests perform no session or tenant database lookup.
- Main-host forum requests perform no session lookup.
- Tenant requests resolve the tenant at most once and perform no dashboard query.
- Metadata and OG latency does not scale with reply count.
- Query-count ceilings are asserted for server, channel, thread, metadata, and OG routes.

### SEO And Privacy

- Every sampled sitemap URL returns `200`, is indexable, and self-canonicals on exactly one host.
- No internal tenant alias, disabled content, kicked server, empty thread, redirect, or `404` enters a sitemap.
- Opt-out test content disappears from HTML, serialized data, metadata, JSON-LD, Markdown, OG, search, and caches within 60 seconds.
- Main, preview, and two tenant hosts have HTTP-level head, robots, sitemap, and redirect snapshots.

### Web Performance

- p75 LCP under 2.5 seconds, CLS under 0.1, and INP under 200 milliseconds on representative public pages.
- Representative 20-message thread serialized route data stays under 50 KB compressed, excluding media.
- Establish the public initial-JS budget from the clean migrated baseline; dashboard code contributes zero bytes to it.
- Below-fold video and code-preview resources do not download before proximity or interaction.

### Runtime And Security

- Built-server tests cover CSRF, auth, server functions, server routes, custom-host isolation, and redirects.
- Host tests cover canonical host, `www`, localhost, IPv4/IPv6, ports, uppercase, trailing dot, preview host, malformed host, trusted-host suffix attacks, custom host, assets, Markdown, robots, sitemaps, dashboard, auth, API, and internal paths.
- Scoped repository tests prove cross-server channel, thread, domain, and dashboard access fails.
- Search filter and highlighted-markup adversarial tests pass.
- Production builds cannot skip typecheck and do not publish unintended source maps.

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

## Checkpoint 6: Combined-App Foundation

Status: pending

- [ ] Align the TanStack Start, Router, router plugin, SSR Query, and devtools versions
- [ ] Configure and verify the production Vercel/Nitro adapter
- [ ] Capture public route, metadata, response, request-count, and bundle baselines from the Next app
- [ ] Move existing dashboard URLs and auth UI beneath `/dashboard`
- [ ] Make `__root.tsx` a neutral document with no dashboard-only imports or requests
- [ ] Scope dashboard metadata, fonts, styles, devtools, Query preloading, and shell behavior to the dashboard route island
- [ ] Add validated server-only and client-safe environment modules
- [ ] Add server/browser dependency restrictions and production bundle scans
- [ ] Add `src/start.ts` with explicit CSRF, request IDs, structured request logging, and server-function logging
- [ ] Replace generic unauthorized errors with stable typed HTTP outcomes

Acceptance gate: the existing dashboard works at `/dashboard`, marketing `/` can render without session work, and the production artifact contains no accidental root-level dashboard dependency.

## Checkpoint 7: Host Routing Spike

Status: pending

- [ ] Extract a pure host and path decision function from the current proxy behavior
- [ ] Implement a thin custom Start server-entry adapter that rewrites tenant requests before route matching
- [ ] Preserve explicit `.md` and negotiated Markdown behavior intentionally
- [ ] Reject dashboard, auth, private API, server-function, and internal tenant paths on custom hosts
- [ ] Verify trusted proxy handling for forwarded host and protocol
- [ ] Test canonical, preview, localhost, tenant, unknown, malformed, and malicious suffix hosts
- [ ] Deploy one staging tenant domain against the real Vercel adapter

Acceptance gate: `tenant-test` reaches a hidden tenant route in a production deployment; unknown hosts and privileged tenant-host paths fail closed; direct internal paths are unreachable.

If the pinned Start/Nitro stack cannot safely transform the request before Router matching, stop and choose between a custom fetch server entry or host-aware shared loaders. Do not spread hostname branching through every component.

## Checkpoint 8: Public Repository And Cache

Status: pending

- [ ] Define publication rules once and cover them with a visibility matrix
- [ ] Add verified public-tenant and managed-server database capabilities
- [ ] Add narrow list, page, metadata, OG, Markdown, search, and sitemap projections
- [ ] Add request-scoped deduplication for tenant and public entity reads
- [ ] Choose and implement the durable shared cache backend
- [ ] Add hard-purge, soft-refresh, and single-flight behavior
- [ ] Preserve bot invalidation endpoints with a dedicated scoped credential
- [ ] Add domain transition invalidation to the new publishing workflow
- [ ] Implement a durable privacy purge and search deletion workflow
- [ ] Replace offset pagination and sitemap traversal with validated cursors or stable ranges
- [ ] Review production-shaped query plans and add measured indexes

Acceptance gate: all public representations consume the publication-aware boundary; hard purge never returns acknowledged stale content; concurrent cold requests produce one regeneration per key.

## Checkpoint 9: Static Public Routes And Blog

Status: pending

- [ ] Migrate `/`, `/pricing`, `/oss-program`, and `/discord`
- [ ] Resolve the duplicate `/` and `/new-landing` ownership intentionally
- [ ] Replace `next/font` with intentional self-hosted route-scoped fonts
- [ ] Establish one shared reset and scoped marketing/forum/dashboard token roots
- [ ] Replace the Next MDX pipeline with a validated Vite content manifest
- [ ] Add build-time draft, placeholder, metadata, date, and empty-body checks
- [ ] Migrate `/blog` and `/blog/$slug` with prerender and unknown-slug behavior
- [ ] Migrate responsive images with explicit dimensions and loading policy
- [ ] Update all dashboard links to `/dashboard`

Acceptance gate: marketing and blog routes pass metadata and visual parity without downloading dashboard CSS, fonts, JS, or auth data.

## Checkpoint 10: Shared Public Forum

Status: pending

- [ ] Build one shared server, channel, and thread view model independent of host
- [ ] Convert async nested components into loader/server-function data
- [ ] Move Markdown parsing and syntax highlighting behind server-safe boundaries
- [ ] Remove the full-thread client context and pass minimal action DTOs
- [ ] Migrate search as a same-origin, tenant-resolved query with explicit idle, pending, error, rate-limit, empty, and success states
- [ ] Migrate feedback with pending, idempotency, visible errors, and minimal payloads
- [ ] Replace effect-based local storage, hash, observers, portals, and shortcuts with the documented alternatives
- [ ] Correct spoiler, link, icon-button, dialog-close, and action-row semantics
- [ ] Preserve pagination, pinned-content, backlinks, canonical slug, and Discord continuation behavior intentionally

Acceptance gate: one forum implementation serves main and tenant contexts; route components are synchronous; no first-party effect hook exists; representative thread payload and bundle budgets pass.

## Checkpoint 11: Tenant SEO And Machine Routes

Status: pending

- [ ] Migrate tenant home, channel, thread, Markdown, robots, and sitemap routes
- [ ] Derive tenant metadata, icons, canonicals, social identity, and JSON-LD from the verified tenant context
- [ ] Preserve main-host-to-verified-domain permanent redirects
- [ ] Define and test pagination canonical/noindex behavior
- [ ] Implement stable sitemap partitions and accurate update timestamps
- [ ] Replace duplicate Next OG handlers with one validated tenant-aware route
- [ ] Migrate PostHog and Discord sticker proxies as explicit streaming server routes or verified deployment rewrites
- [ ] Define analytics loading, consent, bot, and custom-domain policy
- [ ] Validate all route parameters before storage access and return semantic status codes

Acceptance gate: the main host and two tenant hosts pass HTTP-level SEO snapshots, sitemap coverage, canonical uniqueness, Markdown negotiation, OG isolation, and unknown-resource behavior.

## Checkpoint 12: Production Isolation And Cutover

Status: pending

- [ ] Run production client/server bundle analysis and prohibited-module scans
- [ ] Run request and database query instrumentation across every route island
- [ ] Run built-server integration, Playwright, accessibility, narrow-width, and visual regression suites
- [ ] Exercise custom-domain add, verify, provider failure, stale verification, remove, retry, and cache purge states
- [ ] Register and verify a stable staging Discord OAuth callback
- [ ] Test production-shaped invalidation from bot and dashboard services
- [ ] Keep the existing Next deployment available as the alias-level rollback target
- [ ] Point the existing public Vercel project at the combined application so attached customer domains remain on the same project
- [ ] Smoke-test main host, dashboard, one tenant, robots, sitemap, Markdown, OG, search, auth, and invalidation immediately after cutover
- [ ] Retire the old dashboard deployment only after a stable observation period
- [ ] Remove the Next app, stale dependencies, dead assets, and compatibility code only after rollback is no longer required
- [ ] Rename `dashboard-new` after production stabilization rather than during migration

Acceptance gate: all quality gates in this document pass against the production build, the rollback procedure has been rehearsed, and no customer domain must be transferred between Vercel projects during cutover.

## Initial Exploration Findings

The first audit identified these concrete cleanup items for migration tracking:

- `../web/src/app/_opengraph-image.tsx` is likely a dead/misnamed Next convention while a static image also exists.
- `../web/src/app/og/route.tsx` and `../web/src/app/og/thread/route.tsx` duplicate one another; `../web/src/app/og/server/route.tsx` is empty.
- Current OG code passes a thread ID to a channel-oriented server lookup and computes replies with incorrect nullish-coalescing precedence.
- Robots allows `/api/og/*`, which does not match the current OG routes.
- Main and tenant forum implementations have drifted through duplication.
- Current pagination metadata ignores the page number.
- Current sitemap offsets can overlap or omit content when independently cached pages shift after inserts.
- Static sitemap `lastmod` values claim daily changes, while thread `lastmod` reflects creation rather than update.
- The only inspected blog article is placeholder content but is currently eligible for indexing and sitemap inclusion.
- Current custom-domain search is expected to fail the bot API's static browser CORS allowlist.
- Search errors are console-only and can present as empty results.
- The public feedback mutation has race, pending, and visible-error gaps.
- Production `next.config.ts` can ignore TypeScript build errors and contains likely ineffective transpile package names.
- The web package relies on undeclared direct dependencies through workspace hoisting.
- The web README and several scaffold SVG/font assets are stale.
- Dashboard route modules for publishing, setup, channels, and threads are oversized; split them by feature ownership before adding public route complexity.
- Dashboard devtools are currently imported from the root and must be development-only lazy imports.
- `auth-functions.ts` dynamically imports the auth module; current TanStack guidance prefers static server-function imports.
- The Vercel project ID is hardcoded in the publishing adapter and must be validated runtime configuration.
- The current synthetic role, bot-online, indexing, and publication labels remain separate schema/product debt and must not be mistaken for authoritative runtime data.

These findings are a starting point, not a closed list. Each migrated route requires a change-scoped review against its old behavior and this target architecture.
