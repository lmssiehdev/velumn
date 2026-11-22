/** MCP tool contracts and their handlers. */
import { Clock, Effect, Schema } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { serverInfo } from "../server-info.ts";

export const ServerStatus = Schema.Struct({
  version: Schema.String,
  uptimeSeconds: Schema.Int,
});

export const StatusTool = Tool.make("status", {
  description:
    "Report the Velumn server version and how many seconds it has been running.",
  success: ServerStatus,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

export const VelumnToolkit = Toolkit.make(StatusTool);

export const VelumnToolkitLayer = VelumnToolkit.toLayer(
  Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    return VelumnToolkit.of({
      status: Effect.fn("VelumnToolkit.status")(function* () {
        const now = yield* Clock.currentTimeMillis;
        return {
          version: serverInfo.version,
          uptimeSeconds: Math.floor((now - startedAt) / 1000),
        };
      }),
    });
  }),
);
