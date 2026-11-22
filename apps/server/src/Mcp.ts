import { Effect, Layer, Schema } from "effect";
import { McpProtocol, McpServer, Tool, Toolkit } from "effect/ai";
import { Health, version } from "./Health.ts";

export const HealthTool = Tool.make("health", {
  description:
    "Report whether the Velumn server is up, its version and uptime.",
  success: Schema.Struct({
    ok: Schema.Boolean,
    version: Schema.String,
    uptimeSeconds: Schema.Finite,
  }),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.OpenWorld, false);

export const VelumnToolkit = Toolkit.make(HealthTool);

const handlers = VelumnToolkit.toLayer(
  Effect.gen(function* () {
    const health = yield* Health;
    return { health: () => health.status };
  }),
);

const registrations = McpServer.toolkit(VelumnToolkit).pipe(
  Layer.provide(handlers),
);

export const McpHttp = McpServer.layerHttp({
  name: "velumn",
  version,
  path: "/mcp",
  protocols: [McpProtocol.v2026_07_28, McpProtocol.v2025_11_25],
  registrations,
});
