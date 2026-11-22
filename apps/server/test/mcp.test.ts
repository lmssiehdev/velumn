/** MCP tools, exercised through Effect's in-memory MCP client on every served revision. */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { McpProtocol, McpTest } from "effect/ai";
import { TestClock } from "effect/testing";
import { registrations } from "../src/mcp/server.ts";

const revisions = [
  McpProtocol.v2026_07_28,
  McpProtocol.v2025_11_25,
  McpProtocol.v2025_06_18,
] as const;

describe.each(revisions)("MCP $protocolVersion", (protocol) => {
  it.effect("lists the status tool as read-only", () =>
    Effect.gen(function* () {
      const client = yield* McpTest.makeClient(registrations, {
        protocols: [protocol],
      });
      const { tools } = yield* client.listTools({});
      assert.deepStrictEqual(
        tools.map((tool) => tool.name),
        ["status"],
      );
      assert.strictEqual(tools[0]?.annotations?.readOnlyHint, true);
    }),
  );

  it.effect("status reports version and uptime", () =>
    Effect.gen(function* () {
      const client = yield* McpTest.makeClient(registrations, {
        protocols: [protocol],
      });
      yield* TestClock.adjust("90 seconds");
      const result = yield* client.callTool({ name: "status", arguments: {} });
      assert.isFalse(result.isError ?? false);
      assert.deepStrictEqual(result.structuredContent, {
        version: "0.0.0",
        uptimeSeconds: 90,
      });
    }),
  );
});
