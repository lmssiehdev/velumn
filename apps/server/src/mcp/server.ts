/** The MCP server, served over Streamable HTTP or stdio. */
import { BunStdio } from "@effect/platform-bun";
import { Layer, Logger } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { serverInfo } from "../server-info.ts";
import { VelumnToolkit, VelumnToolkitLayer } from "./tools.ts";

export const registrations = McpServer.toolkit(VelumnToolkit).pipe(
  Layer.provide(VelumnToolkitLayer),
);

const instructions =
  "Velumn indexes a Discord server. Use its tools to read what the community has said.";

/** Sessionful revisions first for stdio; HTTP also serves the stateless 2026-07-28 revision. */
const sessionful = [McpProtocol.v2025_11_25, McpProtocol.v2025_06_18] as const;

export const McpHttp = McpServer.layerHttp({
  ...serverInfo,
  instructions,
  path: "/mcp",
  protocols: [McpProtocol.v2026_07_28, ...sessionful],
  registrations,
});

/** stdout carries the protocol, so logs go to stderr. */
export const McpStdio = McpServer.layerStdio({
  ...serverInfo,
  instructions,
  protocols: sessionful,
  registrations,
}).pipe(
  Layer.provide(BunStdio.layer),
  Layer.provide(Layer.succeed(Logger.LogToStderr, true)),
);
