import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { ServerConfig } from "./Config.ts";
import { Health } from "./Health.ts";
import { McpHttp } from "./Mcp.ts";

const HealthRoute = HttpRouter.add(
  "GET",
  "/health",
  Health.use((health) => health.status).pipe(
    Effect.flatMap((status) => HttpServerResponse.json(status)),
  ),
);

const Routes = Layer.mergeAll(HealthRoute, McpHttp);

const Server = Layer.unwrap(
  Effect.gen(function* () {
    const { host, port } = yield* ServerConfig;
    return HttpRouter.serve(Routes).pipe(
      Layer.provide(BunHttpServer.layer({ hostname: host, port })),
    );
  }),
);

Layer.launch(Server.pipe(Layer.provide(Health.layer))).pipe(BunRuntime.runMain);
