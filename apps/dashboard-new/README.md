# Velumn TanStack Application

The combined TanStack Start application for Velumn's public site, forums, and
Discord management dashboard.

## Stack

- TanStack Start and TanStack Router
- shadcn/ui using Base UI primitives
- Tailwind CSS 4
- React Query for client-side server-state freshness
- Better Auth for authentication
- `better-result` for expected external-provider failures
- Oxfmt and Oxlint for formatting and linting

## Development

Node 22.12 or newer is required by TanStack Start.

```bash
bun install
bun run dev
```

The dashboard uses authorized, narrow Drizzle projections backed by the shared Better Auth database. See `MIGRATION.md` for the active checkpoint and integration gates.

Discord authentication requires `NEXT_PUBLIC_DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, and `BETTER_AUTH_SECRET`. Production also requires
`VELUMN_DASHBOARD_NEW_URL`. `DATABASE_URL` must use a write-capable role because
Better Auth persists OAuth state, users, accounts, and sessions. Configure
Discord's redirect URI as `http://localhost:3001/api/auth/callback/discord` for
local development.

Initial indexing requires `NEXT_PUBLIC_VELUMN_API_URL` and `DISCORD_BOT_TOKEN`.
Domain publishing requires `VERCEL_BEARER_TOKEN` and `VERCEL_PROJECT_ID`, with
`VERCEL_TEAM_ID` when the project belongs to a team. Optional feature groups
must be either complete or absent. Domain mutations are scoped to that project.
Routine removal deletes only the project-domain association, never the
account-level domain.

`VELUMN_CANONICAL_URL` sets the exact production platform origin and defaults
to `https://velumn.com`. Vercel preview hosts are accepted only from the exact
`VERCEL_URL` and `VERCEL_BRANCH_URL` values provided by the runtime.
`VERCEL_PROJECT_PRODUCTION_URL` is never trusted as request authority because
Vercel may set it to the shortest customer custom domain.

Public Markdown uses `/thread/:threadId/:slug.md` with
`text/markdown; charset=utf-8`. The application does not expose `/markdown/*`
or select Markdown from the `Accept` header. Thread HTML advertises the
representation with `rel="alternate"`, and Markdown responses include canonical
HTTP links plus YAML metadata for agent clients. Both HTML and Markdown remain
`no-store` until durable privacy-aware invalidation is available.

## Verification

```bash
bun run typecheck
bun run lint
bun test
bun run verify:production
```

`verify:production` builds with Nitro's Vercel preset and validates the emitted
Build Output API v3 function, public bundle isolation, request IDs, and CSRF
rejection.

## Preview Deployment

Use a separate Vercel project while this application is under migration:

- Root Directory: `apps/dashboard-new`
- Build Command: `bun run build`
- Output Directory: leave unset
- Runtime: Node.js 22.x, emitted by the pinned Nitro preset

Keep framework detection automatic. Do not attach production domains until the
host-routing and cutover checkpoints pass. Use domains owned only by this
staging project: Vercel domain attachment and verification mutate project state,
so production and migration testing must not share a project. DNS verification
does not prove TLS readiness; validate certificate issuance and HTTPS requests
on the real staging hostname before cutover.

## UI Components

Components are owned in `src/components/ui` and generated with shadcn's Base UI-backed Nova style:

```bash
bunx shadcn@latest add <component>
```
