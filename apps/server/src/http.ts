/** HTTP routes: an open /health check and the token-protected /mcp endpoint. */
import { createHash, timingSafeEqual } from "node:crypto";
import { Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { McpHttp } from "./mcp/server.ts";
import { serverInfo } from "./server-info.ts";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time check of an `Authorization: Bearer <token>` header. */
export const bearerMatches = (
  header: string | undefined,
  token: Redacted.Redacted<string>,
): boolean =>
  header !== undefined &&
  header.startsWith("Bearer ") &&
  timingSafeEqual(digest(header.slice(7)), digest(Redacted.value(token)));

const bearerAuth = (token: Redacted.Redacted<string>) =>
  HttpRouter.middleware((handler) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (!bearerMatches(request.headers["authorization"], token)) {
        return HttpServerResponse.empty({
          status: 401,
          headers: { "www-authenticate": 'Bearer realm="velumn"' },
        });
      }
      return yield* handler;
    }),
  );

const Health = HttpRouter.add(
  "GET",
  "/health",
  HttpServerResponse.json({ ok: true, version: serverInfo.version }),
);

export const routes = (token: Redacted.Redacted<string>) =>
  Layer.mergeAll(Health, McpHttp.pipe(Layer.provide(bearerAuth(token).layer)));
