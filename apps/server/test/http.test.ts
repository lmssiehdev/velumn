/** The HTTP surface: /health is open, /mcp requires the bearer token. */
import { afterAll, assert, describe, it } from "@effect/vitest";
import { Redacted } from "effect";
import { HttpRouter } from "effect/http";
import { bearerMatches, routes } from "../src/http.ts";

const token = Redacted.make("test-token");
const { handler, dispose } = HttpRouter.toWebHandler(routes(token), {
  disableLogger: true,
});
afterAll(() => dispose());

const mcp = (body: unknown, headers: Record<string, string> = {}) =>
  handler(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

const statusCall = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "status",
    arguments: {},
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
    },
  },
};
const statelessHeaders = {
  "mcp-protocol-version": "2026-07-28",
  "mcp-method": "tools/call",
  "mcp-name": "status",
};

describe("HTTP", () => {
  it("serves /health without a token", async () => {
    const res = await handler(new Request("http://localhost/health"));
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { ok: true, version: "0.0.0" });
  });

  it("rejects /mcp without a token", async () => {
    const res = await mcp(statusCall, statelessHeaders);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(
      res.headers.get("www-authenticate"),
      'Bearer realm="velumn"',
    );
  });

  it("rejects /mcp with the wrong token", async () => {
    const res = await mcp(statusCall, {
      ...statelessHeaders,
      authorization: "Bearer nope",
    });
    assert.strictEqual(res.status, 401);
  });

  it("answers a stateless tool call with the token", async () => {
    const res = await mcp(statusCall, {
      ...statelessHeaders,
      authorization: "Bearer test-token",
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      result: { structuredContent: { version: string } };
    };
    assert.strictEqual(body.result.structuredContent.version, "0.0.0");
  });

  it("opens a stateful session with the token", async () => {
    const res = await mcp(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "0" },
        },
      },
      { authorization: "Bearer test-token" },
    );
    assert.strictEqual(res.status, 200);
    assert.isNotNull(res.headers.get("mcp-session-id"));
  });
});

describe("bearerMatches", () => {
  it("needs the Bearer scheme and the exact token", () => {
    assert.isTrue(bearerMatches("Bearer test-token", token));
    assert.isFalse(bearerMatches("test-token", token));
    assert.isFalse(bearerMatches("Bearer test-token2", token));
    assert.isFalse(bearerMatches(undefined, token));
  });
});
