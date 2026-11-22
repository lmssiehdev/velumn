/** Entry point: `velumn` serves HTTP, `velumn stdio` speaks MCP over stdin/stdout. */
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpConfig } from "./config.ts";
import { routes } from "./http.ts";
import { McpStdio } from "./mcp/server.ts";

const Http = Layer.unwrap(
  Effect.gen(function* () {
    const { host, port, token } = yield* HttpConfig;
    return HttpRouter.serve(routes(token)).pipe(
      Layer.provide(BunHttpServer.layer({ hostname: host, port })),
    );
  }),
);

const mode = process.argv[2] ?? "http";
if (mode !== "http" && mode !== "stdio") {
  process.stderr.write(`Unknown mode "${mode}". Use "http" or "stdio".\n`);
  process.exit(2);
}

BunRuntime.runMain(
  mode === "stdio" ? Layer.launch(McpStdio) : Layer.launch(Http),
);
