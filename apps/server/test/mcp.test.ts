import { afterAll, beforeAll, expect, test } from "bun:test";

const port = 39000 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const headers = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};
let server: ReturnType<typeof Bun.spawn>;

const rpc = async (body: unknown, extra: Record<string, string> = {}) => {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
  });
  return res;
};

beforeAll(async () => {
  server = Bun.spawn(["bun", "src/main.ts"], {
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdout: "ignore",
    stderr: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    const up = await fetch(`${base}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (up) return;
    await Bun.sleep(100);
  }
  throw new Error("server did not start");
});

afterAll(() => server.kill());

test("GET /health reports ok", async () => {
  const body = (await (await fetch(`${base}/health`)).json()) as {
    ok: boolean;
  };
  expect(body.ok).toBe(true);
});

test("MCP 2026-07-28 (stateless): call health without a session", async () => {
  const version = "2026-07-28";
  const res = await rpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "health",
        arguments: {},
        _meta: {
          "io.modelcontextprotocol/protocolVersion": version,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    },
    {
      "mcp-protocol-version": version,
      "mcp-method": "tools/call",
      "mcp-name": "health",
    },
  );
  expect(res.status).toBe(200);
  const call = (await res.json()) as {
    result: { structuredContent: { ok: boolean }; isError: boolean };
  };
  expect(call.result.isError).toBe(false);
  expect(call.result.structuredContent.ok).toBe(true);
});

test("MCP 2025-11-25 (stateful): initialize, list tools, call health", async () => {
  const init = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    },
  });
  expect(init.status).toBe(200);
  expect(init.headers.get("mcp-session-id")).toBeTruthy();
  const session = {
    "mcp-session-id": init.headers.get("mcp-session-id") ?? "",
    "mcp-protocol-version": "2025-11-25",
  };
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, session);

  const list = (await (
    await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, session)
  ).json()) as {
    result: { tools: { name: string }[] };
  };
  expect(list.result.tools.map((t) => t.name)).toEqual(["health"]);

  const call = (await (
    await rpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "health", arguments: {} },
      },
      session,
    )
  ).json()) as {
    result: { structuredContent: { ok: boolean }; isError: boolean };
  };
  expect(call.result.isError).toBe(false);
  expect(call.result.structuredContent.ok).toBe(true);
});
