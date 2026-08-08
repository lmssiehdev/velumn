# Velumn Dashboard

The TanStack Start rewrite of Velumn's Discord management dashboard.

## Stack

- TanStack Start and TanStack Router
- shadcn/ui using Base UI primitives
- Tailwind CSS 4
- React Query for client-side server-state freshness
- Better Auth for authentication
- `better-result` for expected external-provider failures

## Development

Node 22 or newer is recommended.

```bash
bun install
bun run dev
```

The dashboard uses authorized, narrow Drizzle projections backed by the shared Better Auth database. See `MIGRATION.md` for the active checkpoint and integration gates.

Discord authentication requires `NEXT_PUBLIC_DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `BETTER_AUTH_SECRET`. `DATABASE_URL` must use a write-capable role because Better Auth persists OAuth state, users, accounts, and sessions. Configure Discord's redirect URI as `http://localhost:3001/api/auth/callback/discord` for local development.

## Verification

```bash
bun run typecheck
bun run lint
bun test
bun run build
```

## UI Components

Components are owned in `src/components/ui` and generated with shadcn's Base UI-backed Nova style:

```bash
bunx shadcn@latest add <component>
```
