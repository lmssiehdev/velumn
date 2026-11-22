# Velumn

A self-hosted MCP server for your Discord. Velumn indexes a Discord server and lets AI agents (Claude, ChatGPT, Hermes, any MCP client) search what your community has said.

> **Status: foundation.** The MCP server, auth, Docker image and tooling work. Discord ingest and search are next. The only tool today is `status`.

## Run it

```sh
cp .env.example .env          # then set VELUMN_TOKEN (openssl rand -hex 32)
docker compose up -d --build
curl localhost:3000/health
```

Point an MCP client at `http://localhost:3000/mcp` with the header `Authorization: Bearer <VELUMN_TOKEN>`.

For a local client that launches processes (Claude Desktop, Claude Code), use stdio instead. It needs no token:

```json
{
  "command": "bun",
  "args": ["/path/to/velumn/apps/server/src/main.ts", "stdio"]
}
```

## Develop

Needs [Bun](https://bun.sh) 1.4.4.

| Command                        | Does                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `bun install`                  | Install dependencies                                                          |
| `VELUMN_TOKEN=dev bun run dev` | Run the server with reload                                                    |
| `bun run fmt`                  | Format                                                                        |
| `bun run check`                | Format check, lint, typecheck (with Effect diagnostics), tests. CI runs this. |

## Stack

[Bun](https://bun.sh), [Effect](https://effect.website) v4 and its MCP server (`effect/ai`), served over Streamable HTTP (MCP revisions 2026-07-28, 2025-11-25, 2025-06-18) and stdio. Typecheck and lint use [`@effect/tsgo`](https://github.com/Effect-TS/tsgo) and oxlint. Tests use `@effect/vitest`.

## License

[AGPL-3.0-only](LICENSE)
