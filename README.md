# Velumn

Open-source, self-hosted search over your Discord server, exposed to AI agents over MCP.

> Status: foundation only. The server runs and exposes one `health` tool. Discord ingest and search come next.

## Run

```sh
bun install
bun run dev        # http://localhost:3000  (MCP at /mcp, health at /health)
```

## Develop

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `bun run fmt`       | Format with Bun                                    |
| `bun run lint`      | Oxlint with the Effect rules (`@effect/tsgo`)      |
| `bun run typecheck` | Type check with `effect-tsgo tsc`                  |
| `bun run test`      | Bun tests (starts the server and speaks MCP to it) |
| `bun run check`     | All of the above, as CI runs it                    |

Stack: Bun, Effect v4, MCP over Streamable HTTP.

## License

[AGPL-3.0-only](LICENSE)
