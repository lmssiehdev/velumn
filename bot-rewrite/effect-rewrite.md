# Velumn Bot Effect Rewrite

Status: implemented; live smoke and production cutover verification remain

Last updated: 2026-08-09

## Purpose

Document the implemented `apps/bot` rewrite around discord.js and Effect 4, including the research and decisions that produced its current foundation.

This was a full bot rewrite, not an incremental Sapphire migration. Sapphire and the legacy bot/indexing tree are deleted; Effect owns the bot process, resources, concurrency, failures, scheduling, and tests.

Effect is intentionally contained to `apps/bot`. The web applications, backend code, database package, and shared packages do not need to adopt Effect. Existing Promise-based packages are dependencies of the bot and will be adapted once at the bot boundary.

Indexing moved after the runtime foundation and is now wired into the root layer. Its implemented status and retained research live in [`indexing.md`](./indexing.md).

## Implemented Status

`apps/bot/src/main.ts` launches one scoped `AppLayer`. The runtime owns validated configuration, Discord login and listener lifecycles, explicit commands, Hono/tRPC, readiness, indexing gateway parity, durable reconciliation jobs and fairness cursors, the daily scheduler, permanent container tombstones/offline delete repair, and the Meili projection worker with terminal max-attempt failure state. Existing web/dashboard callers retain the Promise-based `BotRouter` contract through one supervised Effect bridge.

### Module map

| Responsibility                 | Implementation                                                                                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrypoint and composition     | `apps/bot/src/main.ts`, `apps/bot/src/runtime/app-layer.ts`                                                                                                                                                                                                                       |
| Configuration/readiness        | `apps/bot/src/config/bot-config.ts`, `apps/bot/src/runtime/readiness.ts`                                                                                                                                                                                                          |
| Discord resource and callbacks | `apps/bot/src/discord/client.ts`, `apps/bot/src/discord/events.ts`                                                                                                                                                                                                                |
| Explicit commands              | `apps/bot/src/commands/registry.ts`, `apps/bot/src/commands/manage-account.ts`                                                                                                                                                                                                    |
| Scoped HTTP/Effect bridge      | `apps/bot/src/http/server.ts`, `apps/bot/src/http/operations.ts`, `apps/bot/src/helpers/trpc.ts`                                                                                                                                                                                  |
| Workspace adapters             | `apps/bot/src/adapters/repository.ts`, `indexing-repository.ts`, `search.ts`, `storage.ts`                                                                                                                                                                                        |
| Indexing runtime               | `apps/bot/src/indexing/`; see [`indexing.md`](./indexing.md) for the detailed map                                                                                                                                                                                                 |
| Database migration/boundary    | `packages/db/src/drizzle/20260809030731_nervous_landau/`, `20260809143437_fair_reconciliation/`, `20260809144204_dizzy_shadow_king/`, `20260809160803_pale_puck/`, `20260809163522_deep_big_bertha/`, `packages/db/src/helpers/indexing.ts`, `packages/db/src/schema/indexing.ts` |

### Migration and cutover

1. Apply migrations in journal order through `20260809163522_deep_big_bertha` before starting the rewritten bot: `20260809030731_nervous_landau`, `20260809143437_fair_reconciliation`, `20260809144204_dizzy_shadow_king`, `20260809160803_pale_puck`, and `20260809163522_deep_big_bertha`. The final two create the durable gateway mutation inbox and enforce unique submission IDs. The dashboard publishing flow also requires the earlier `20260809015405_lively_wendigo` domain-lifecycle migration.
2. Configure the existing Discord token plus `BOT_API_SECRET`; MeiliSearch and R2 remain optional complete configuration groups.
3. Start only `apps/bot/src/main.ts`, verify `/health` readiness, command reconciliation, indexing coordinator/projector readiness, then run a scoped reconciliation and inspect its persisted job/projection results.
4. The old `src/index.ts`, `.sapphirerc.json`, Sapphire commands/listeners, conversion helper, and legacy indexing modules are deleted. There is no parallel runtime or rollback path inside the bot package.

### Automated tests

Run `bun --filter bot test` and `bun --filter bot type-check`. The current suite has 115 tests: 16 Bun unit tests and 99 Effect/Vitest tests across 18 files. It covers Discord lifecycle, commands/privacy, HTTP, projection exhaustion, deterministic persisted fairness, offline delete repair, permanent tombstones, and root indexing lifecycle. The complete migration chain and indexing helpers were separately validated against isolated PostgreSQL.

### Remaining live-smoke risks

- Validate Discord login, command deployment, reconnect behavior, real gateway partials, permissions, archived-thread REST pagination, and graceful signal shutdown against a test guild.
- Validate Meili backlog recovery, max-attempt failure visibility, and deletion with a real outage/restart; search is intentionally unavailable when Meili is omitted.
- Browser-smoke public thread/search create, edit, delete, offline repair, and privacy behavior at desktop and narrow widths. `AttachmentStorage` is not connected to indexing persistence/projection, so R2 mirroring must not be assumed.
- `getRawMessageData` remains intentionally unavailable. The protected `health` procedure still returns legacy `OK`; use `/health` for structured readiness.
- PostHog/Axiom telemetry, centralized terminal error capture, and production proxy/CORS behavior still require separate implementation or live validation. The unused legacy Next.js cache invalidation client has been removed; publication-sensitive web responses use `no-store`.

## Goals

- Own the discord.js client, HTTP server, listeners, workers, and schedules through one scoped Effect runtime.
- Replace implicit Sapphire discovery with explicit, typed registration.
- Make startup, readiness, failure, and shutdown behavior deterministic.
- Preserve useful failures in the Effect error channel until a deliberate policy boundary.
- Make accepted work supervised, bounded, ordered where necessary, and drainable.
- Keep third-party and workspace Promise APIs behind Effect-returning adapters.
- Establish test seams before porting the indexing pipeline.
- Preserve product behavior while deliberately fixing accidental behavior and known defects.
- Keep the architecture small enough that a contributor can follow one event from Discord to its final side effects.

## Non-goals

- Rewriting `packages/db`, the dashboards, the web app, or the rest of the backend with Effect.
- Copying AnswerOverflow's architecture or code.
- Building a generic Discord framework.
- Abstracting every discord.js object behind a second object model.
- Turning every helper into a service.
- Introducing distributed workers before the deployment topology requires them.
- Preserving bugs merely because they exist in the current bot.
- Porting indexing before the runtime, adapters, command routing, and event lifecycle are proven.
- Running the stale Sapphire bot and rewritten bot in parallel.

## Sources Of Truth

### Primary references

- `@bubblebuddy`: the primary discord.js and Effect 4 integration reference.
- `@effect-smol`: the canonical source for current Effect 4 APIs, behavior, tests, and semantics.
- `@executor`: the primary application-architecture reference for Effect 4 boundaries and operational discipline.

These are configured as OpenCode references in `opencode.json`.

BubbleBuddy is useful for:

- Scoped discord.js client acquisition and destruction.
- Scoped event registration and removal.
- Capturing the registration context for callback execution.
- Supervising callback fibers with `FiberSet`.
- Waiting briefly for active handlers during teardown.
- Per-channel state, locks, workers, and finalizers.
- Testing scoped and time-dependent behavior with `@effect/vitest`.

`effect-smol` is authoritative when BubbleBuddy, Executor, older documentation, or memory disagree about Effect 4 behavior. In particular, verify current semantics for `Layer`, `Context.Service`, `FiberSet`, `Queue`/`TxQueue`, `Scope`, `Schedule`, `ManagedRuntime`, and the testing APIs before relying on beta-era examples.

### Secondary research source

- `../AnswerOverflow`: research material for selected principles and indexing behavior. It is not an OpenCode reference and is not a template.
- [`discord-api-spec-source.md`](./discord-api-spec-source.md): pinned manifest for Discord's preview HTTP API specification; reference only, with no vendored JSON.

Executor is useful as a set of constraints rather than a structure to reproduce:

- Client and SDK service surfaces return Effects, not Promises.
- Expected failures remain typed instead of becoming defects.
- Third-party Promise APIs are wrapped at narrow boundaries.
- `acquireRelease` owns resources.
- Public errors are deliberately shaped and tested for information leaks.

AnswerOverflow contributes selected principles:

- Separate raw Discord client ownership from higher-level operations.
- Register feature handlers before login.
- Treat event handlers as Effects run in the application runtime.
- Put spans and metrics around integration boundaries.
- Use real discord.js structures in focused tests where practical.
- Combine live events with later reconciliation for indexing correctness.

We should not copy its generic Discord operation wrapper, manually maintained active-fiber map, unbounded queue design, catch-all error policy, or full layer graph.

### Reference synthesis

Use each reference for the problem it handles best:

| Concern                           | Primary reference                       | Velumn decision                                                                                                                          |
| --------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Current Effect APIs and semantics | `effect-smol` / installed Effect source | Verify every runtime, scope, queue, scheduling, and test primitive against the pinned version.                                           |
| Promise/framework boundary        | Executor                                | Keep Effect as the canonical API and expose one narrow Promise facade at tRPC/Hono.                                                      |
| Typed integration contracts       | Executor                                | Use operation-specific inputs, outputs, and error unions instead of generic SDK callback escape hatches.                                 |
| Public error shaping and capture  | Executor                                | Capture once at the terminal boundary, return opaque errors with correlation IDs, and preserve typed failures internally.                |
| Discord span and metric placement | AnswerOverflow                          | Follow its event, command, Discord REST, guild/channel/thread, and indexing hierarchy.                                                   |
| Outcome truthfulness              | Executor                                | Annotate recovered and success-channel failures explicitly so traces and analytics do not report false success.                          |
| Discord callback lifecycle        | Velumn current implementation           | Keep scoped listeners and `FiberSet`; do not replace them with AnswerOverflow's manual active-fiber map.                                 |
| Gateway plus reconciliation       | AnswerOverflow                          | Use live events for freshness and reconciliation for correctness through one mutation coordinator.                                       |
| Worker ownership                  | Executor                                | Use scoped workers with bounded buffers, explicit final flush/drain, and no detached daemon ownership.                                   |
| Keyed ordering                    | AnswerOverflow, improved                | Keep per-entity serialization but add bounded capacity, atomic creation, idle eviction, completion receipts, and typed failure outcomes. |
| Analytics privacy and delivery    | Executor                                | Use a typed metadata-only catalog, opt-out, bounded buffering, best-effort delivery, and root-owned flush.                               |

Do not reproduce Executor's broad execution framework or AnswerOverflow's full layer graph. Velumn needs one process runtime, a small HTTP Promise facade, narrow capabilities, and feature-specific workflows.

### Explicitly not a primary reference

T3 Code is not a guiding repository for this rewrite. Some standalone worker ideas are technically transferable, but its orchestration and product architecture are too far from this bot. If we need a drainable or keyed worker, implement the smallest version required by Velumn and validate its primitives against `effect-smol`.

## Legacy System Summary

Before cutover, the bot combined four responsibilities in one process:

- Discord gateway and interactions through Sapphire.
- A Bun/Hono/tRPC HTTP API on port `8001`.
- Live guild, channel, thread, and message synchronization.
- Scheduled and manually triggered historical indexing into PostgreSQL and MeiliSearch.

Deleted or replaced legacy entry points:

- `apps/bot/src/index.ts`
- `apps/bot/src/api-server.ts`
- `apps/bot/src/helpers/trpc.ts`
- `apps/bot/src/listeners/`
- `apps/bot/src/commands/`
- `apps/bot/src/indexing/`

The legacy lifecycle problems included an unawaited Discord login, HTTP readiness before Discord readiness, a mutable exported client singleton, no signal-driven shutdown, no listener removal, no cron cancellation, and no draining of in-flight work.

Superseded gate: the rewrite removed those lifecycle failure modes before composing indexing into `AppLayer`.

## Design Rules

### One runtime owns the process

There is one root Effect program for `apps/bot`. It owns every long-lived resource and fiber. Module imports must not start clients, connect services, install listeners, create schedules, or launch detached work.

The root uses `BunRuntime.runMain` and `Layer.launch`, verified against the pinned Effect 4 implementation.

### Scope owns lifecycle

Resources that start or register something must also define how it stops or unregisters:

- Discord client: construct/login, then `destroy` on release.
- Discord listener: `on`, then `off` on release.
- HTTP server: bind, then stop accepting requests and close on release.
- Worker: start in the current scope, stop intake, drain accepted work, then terminate.
- Schedule: run as a scoped fiber and interrupt on shutdown.

No cleanup should depend on `process.exit` running after best-effort callbacks.

### Application services return Effects

Bot-facing service methods return `Effect.Effect`, even when the underlying workspace helper or SDK returns a Promise.

Promise conversion belongs in concrete adapters such as:

- `RepoBotRepository`
- `MeiliSearchIndex`
- `HttpCacheInvalidator`
- `RedisRateLimiter`
- discord.js operation helpers

Application code must not repeatedly call `Effect.tryPromise` around the same dependency.

### Services represent capabilities

Use a service when it provides a replaceable capability, owns state/resources, or defines an important integration boundary. Prefer ordinary functions for pure transformations and feature-local composition.

Likely services:

- `BotConfig`
- `DiscordClient`
- `DiscordEvents`
- `CommandRegistry`
- `BotRepository`
- `SearchIndex`
- `CacheInvalidator`
- `RateLimiter`
- `BotApi`
- `BotTelemetry`
- `IndexingCoordinator`

Likely ordinary modules/functions:

- Command definitions.
- Discord component builders.
- Message-link parsing.
- Conversion of already-resolved Discord data.
- Cache-tag calculation.
- Index planning algorithms.

### Typed errors remain useful

Expected failures should be tagged according to the policy they require, not merely their source library.

Initial categories:

- Configuration failure.
- Discord login or gateway failure.
- Discord request failure with operation and retry classification.
- Permission or policy rejection.
- Database operation failure.
- Search operation failure.
- Cache invalidation failure.
- Rate-limit storage failure.
- Validation or conversion failure.
- Shutdown timeout.

Use serializable schema-backed errors when an error crosses HTTP or another process boundary. Internal errors can use lightweight tagged errors. Every error intended for logs or telemetry must have a meaningful, safe message and structured fields.

Do not catch errors merely to log and convert the effect to success. Catch only where the caller can retry, degrade, translate, report a terminal outcome, or intentionally ignore a best-effort action.

### Defects are defects

Expected Discord, database, search, permission, and validation failures stay in the error channel. Defects are reserved for broken invariants and programmer errors.

Avoid `die`, `orDie`, detached Promise rejections, raw `throw`, and process-level `uncaughtException` as ordinary control flow.

### Callback bridges capture the runtime once

discord.js is callback-based. Listener registration should capture the Effect context/runtime once, then use a supervised fiber set to execute each callback effect.

The bridge must:

- Preserve the dependencies available when the listener is registered.
- Suspend handler creation so synchronous throws become managed failures.
- Report unhandled causes once at the event boundary.
- Track active handler fibers.
- Remove the listener when its scope closes.
- Stop accepting callbacks before shutdown draining starts.
- Wait for active handlers for a bounded period during teardown.

Use BubbleBuddy as the behavioral reference and `effect-smol` as the API reference.

### Work acceptance is not completion

The design must distinguish:

- Discord callback received.
- Work accepted into a worker.
- Work started.
- Authoritative write committed.
- Projection write submitted/completed.
- Cache invalidation attempted/completed.

An event handler that only enqueues work must not be reported as durably synchronized. Tests and metrics should use the correct state.

### Ordering is explicit

Discord events for the same entity can overlap. Where order affects correctness, all relevant mutations must share one ordering domain.

Examples:

- Message create, update, and delete for one thread/channel.
- Thread create, delayed initial index, update, and delete.
- Full thread indexing and live message events.
- Search add/update/delete for the same message or thread.

Global serialization is unnecessary. Keyed serialization by thread or channel is likely sufficient. The indexing design will decide the exact key and overload behavior.

### Concurrency is bounded

Every use of parallelism should specify why it is safe and how much is allowed. Avoid unbounded queues and unbounded fan-out for guild channels, thread histories, message conversion, internal-link fetches, attachments, or search writes.

### Retries belong at integration boundaries

Retries should be based on typed classification:

- Retry transient network failures, selected Discord server failures, and retry-safe downstream failures.
- Respect discord.js REST rate-limit behavior rather than layering blind retries over it.
- Do not retry permission denial, invalid input, missing opt-in, privacy rejection, or unsupported channel types.
- Use capped attempts, backoff, jitter, timeouts, and retry telemetry.
- Ensure the operation is idempotent before retrying it.

### PostgreSQL is authoritative

PostgreSQL remains the source of truth. MeiliSearch and web cache invalidation are projections. They cannot participate in the PostgreSQL transaction and must have explicit retry/reconciliation semantics instead of pretending the entire flow is atomic.

## Historical Proposed Structure

Superseded by the implemented module map near the top. This proposal is retained to preserve the design history; the implementation split only where concrete boundaries emerged.

```text
apps/bot/src/
  main.ts
  config/
    bot-config.ts
  runtime/
    app-layer.ts
    readiness.ts
  discord/
    client.ts
    events.ts
    operations.ts
    errors.ts
  commands/
    registry.ts
    manage-account.ts
  events/
    guild.ts
    channel.ts
    thread.ts
    message.ts
  adapters/
    repository.ts
    search.ts
    cache.ts
    rate-limit.ts
  api/
    server.ts
    router.ts
    auth.ts
  observability/
    telemetry.ts
  indexing/
    ...implemented last
  testing/
    discord.ts
    layers.ts
```

Start with fewer modules and split only when a boundary or reusable capability becomes real.

## Runtime Lifecycle

### Startup order

1. Decode and validate configuration without starting resources.
2. Construct adapter layers.
3. Acquire the discord.js client.
4. Register commands, components, and event listeners.
5. Start the HTTP server.
6. Login to Discord and await `ClientReady` with a timeout.
7. Reconcile slash commands.
8. Start schedules and background workers.
9. Mark the process ready.
10. Remain alive until interruption or a terminal root failure.

Listener registration must happen before login so ready and early gateway events cannot be missed.

Whether HTTP binds before or after Discord login is an implementation choice, but readiness must remain false until all required dependencies are ready. Liveness and readiness must be separate.

### Readiness

Liveness means the process and HTTP event loop are alive.

Readiness means at minimum:

- Configuration decoded.
- HTTP server bound.
- Discord client logged in and ready.
- Command registration completed or deliberately degraded according to policy.
- Required workers started.
- Required adapters passed their startup checks.

The health response should expose a small structured status instead of returning unconditional `OK`.

### Shutdown order

1. Mark the service unready.
2. Stop accepting mutating API jobs.
3. Stop schedules and new Discord event intake.
4. Drain accepted command/event work for a bounded period.
5. Drain indexing/search workers when they exist.
6. Close the HTTP server.
7. Destroy the Discord client.
8. Release adapter resources.
9. Flush logs/traces within a timeout.
10. Let the root runtime determine the exit code.

Shutdown must be idempotent. A second signal may shorten the grace period, but ordinary shutdown should not call `process.exit` before finalizers run.

## Discord Boundary

### `DiscordClient`

Own exactly one `Client<true>` after readiness.

Responsibilities:

- Construct the client with the minimum required intents and partials.
- Login using redacted configuration.
- Resolve ready versus login error with a typed timeout.
- Register base error/warn diagnostics.
- Destroy the client on release.

Do not expose a mutable module singleton.

The current intent list should be reduced. The rewrite should initially justify each intent from a registered feature. Moderation, expressions, voice, and DM intents should not survive by default if no feature consumes them.

### `DiscordEvents`

Provide scoped `on`, `once`, and effectful registration. Keep raw `ClientEvents` typing. The event bridge is infrastructure; filtering and product policy belong in feature handlers.

### Discord operations

Do not create one giant wrapper around every discord.js method. Add narrow operation helpers where they provide a shared policy:

- Fetching partial messages.
- Cache-first versus fetch-required channel lookup.
- Interaction reply/defer/update semantics.
- Permission calculation.
- Retry/error classification.

Feature code may still use resolved discord.js objects directly for pure reads and builder construction.

Use Executor's operation-contract discipline for helpers added later: each operation has a semantic name, narrow input, explicit cache/fetch policy, typed result, and classified failures such as not found, permission denied, unsupported type, transient Discord request, or terminal Discord request. Use AnswerOverflow to identify useful Discord operation and span boundaries, but do not add its generic `use(operationName, callback)` or `callClient` escape hatches.

## Commands And Components

Filesystem discovery was replaced with an explicit registry of command definitions and handlers.

The registry should own:

- Global and development-guild command definitions.
- Deployment/reconciliation.
- Interaction dispatch.
- Unknown-command behavior.
- Common span/log annotations.
- Error-to-user-response translation.

Preserve `/manage-account` as an ephemeral self-service flow with a three-minute timeout and invoking-user ownership.

Fix during the rewrite:

- Acknowledge button interactions immediately.
- Serialize destructive actions for one interaction session.
- Ensure failures cannot render success.
- Remove or update search documents during deletion/anonymization.
- Ensure future ingestion honors ignored users.
- Ensure full indexing cannot undo anonymization.

Superseded plan: `/print-embed` and its unused random component generators were removed.

## HTTP API Boundary

Keep the existing Hono and tRPC transport during the bot-only rewrite. Effect ownership means the root scope starts, supervises, marks ready, drains, and stops the HTTP server; it does not require the rest of the monorepo to adopt Effect or a new protocol.

Existing web and dashboard clients remain ordinary Promise-based tRPC consumers. Preserve `BotRouter` procedure names and response contracts initially. The bot-side router should be constructed with explicit dependencies instead of importing the mutable Sapphire singleton or other module globals.

Use one runtime bridge at the HTTP boundary:

- tRPC continues to validate transport input and expose its current TypeScript contract.
- Procedures invoke narrow Effect application services through a captured runtime or dependency facade.
- Typed application errors are translated once into appropriate `TRPCError` codes.
- Unexpected failures are captured once at the terminal HTTP boundary and receive an opaque correlation ID where useful.
- Effect types, Layers, and Causes do not cross into web or dashboard applications.

The implemented bridge uses `FiberSet.makeRuntimePromise` inside the scoped HTTP layer. This is the Effect 4 API appropriate when `Layer.launch` already owns the application: it captures the current service/tracing context, supervises callback fibers in the HTTP scope, rejects work after closure, and accepts request `AbortSignal`s. Do not create a second `ManagedRuntime`, which would independently build and own another application layer.

tRPC receives a narrow `BotApiOperations` Promise facade rather than the Effect runtime or arbitrary `runEffect` access. Current readiness, search, and search-health operations pass through this facade and attach request-owned spans; tRPC and Hono forward client cancellation signals. Add future operations deliberately instead of exposing a generic runner.

Still deferred after implementation:

- Map typed application failures centrally into stable `TRPCError` codes while preserving existing `TRPCError` values.
- Add `ErrorCapture`, opaque correlation IDs, and interruption-aware terminal reporting.
- Add request identity/log/span annotations without including raw query text, IP addresses, or user content.
- Distinguish request-owned effects from durable jobs that continue after client disconnect.

The server lifecycle belongs to Effect:

- Bind the Bun/Hono server as a scoped resource.
- Mark HTTP readiness only after the port is bound.
- Mark it unready before shutdown, stop accepting requests, drain in-flight handlers within a bound, and close the server.
- Keep liveness and structured readiness separate from the existing protected tRPC health contract.

The current API mixes bot-control operations, public search/voting, and diagnostics. That separation can be reconsidered independently after the bot rewrite. Moving `search` or `updateVote`, replacing direct `BotRouter` type imports, or adopting OpenAPI would affect other applications and is not required to introduce Effect safely.

Known API follow-ups that can be handled incrementally without changing tRPC:

- Separate the bot API credential and cache invalidation credential from the Discord token, with a compatibility migration for existing callers.
- Supervised indexing job acceptance and status are implemented; retain their compatibility procedures while consumers migrate deliberately.
- Reevaluate legacy raw-message and MeiliSearch diagnostics against concrete operator workflows.
- Define trusted proxy behavior before relying on forwarded client IPs.
- Move the router contract to a neutral package only if direct type imports become a concrete build or deployment problem.

### Post-migration tRPC audit

This retained audit is post-cutover follow-up work. Command, gateway, HTTP, and indexing migration are complete, so future API changes can now be evaluated against the implemented responsibilities.

#### Process and lifecycle

- Decide whether HTTP liveness must bind before Discord login. The current router requires a ready Discord client, so a login failure prevents the API from binding; the alternative is to expose liveness immediately, report readiness as `503`, and reject only Discord-dependent procedures while degraded.
- Verify that a later Discord disconnect does not terminate unrelated health or diagnostic endpoints unless the root process is intentionally considered unhealthy.
- Verify `stop(false)` behavior with active tRPC requests, batch requests, long indexing calls, client disconnects, and shutdown timeout escalation.
- Confirm that every procedure and background operation is owned by the root scope and that no detached Promise continues after HTTP shutdown.

#### Procedure inventory and ownership

- Inventory every procedure and its consumer before removing or moving anything. Current consumers exist in `apps/web`, `apps/dashboard`, and `apps/dashboard-new`.
- Resolve the duplicate or overlapping `reindexServer` and `indexServer` procedures.
- Decide whether `getRawMessageData` and `meiliHealth` have real operator workflows. Remove them or place them behind explicit operator authorization instead of leaving diagnostics in the general application API.
- Reevaluate whether public `search` and `updateVote` belong in the Discord process. Moving them is optional and must be a separately scoped cross-application change.
- Keep procedures that genuinely require Discord close to the bot, such as guild membership checks and indexing control.

#### Contracts and coupling

- Preserve current procedure names and payloads through the migration, then version or deprecate deliberate contract changes.
- Replace direct source imports such as `apps/web -> apps/bot/src/helpers/trpc` with a supported package export or generated declaration boundary. Downstream type checking currently traverses the bot implementation, which is a concrete coupling and build-cost problem.
- Do not duplicate inferred input/output types by hand merely to remove the import. Prefer a package entry point that exposes declarations without importing bot runtime modules or triggering environment validation.
- Verify all three consumers against the published contract in CI.

#### Authentication and network trust

- Complete the migration from `DISCORD_BOT_TOKEN` to a dedicated `BOT_API_SECRET`; remove the fallback only after every caller has rotated.
- Use constant-time secret comparison where practical and define secret rotation behavior if zero-downtime rotation becomes necessary.
- Separate application, operator, cache-invalidation, and future worker credentials by capability rather than sharing one all-powerful secret.
- Treat CORS as browser policy, not authentication.
- Configure trusted proxies before accepting `x-forwarded-for`; otherwise rate limiting and audit attribution must use the socket peer address.
- Review public endpoint abuse limits, payload limits, query length, batch size, and timeout policy.

#### Effect bridge and errors

- Introduce one tRPC-to-Effect execution bridge that preserves tracing context and maps typed application failures to `TRPCError`. Do not scatter `Effect.runPromise` and repetitive catches through procedures.
- Preserve known `TRPCError` values instead of wrapping `NOT_FOUND`, `FORBIDDEN`, or `TOO_MANY_REQUESTS` as `INTERNAL_SERVER_ERROR`. Several legacy catch-all blocks currently risk losing the intended status.
- Capture unexpected failures once at the terminal HTTP boundary and return opaque messages plus a correlation ID. Do not expose internal exception messages from Hono's general error handler.
- Define cancellation behavior when the HTTP client disconnects. Interrupt request-owned Effects where safe without interrupting work already accepted as a durable job.
- Ensure recovered failures annotate span outcome explicitly so successful Promise resolution does not make failed work look healthy.

#### Indexing job semantics

- Completed: long/fire-and-forget indexing mutations now return persisted jobs through the supervised coordinator.
- Define whether each mutation means work was accepted, started, durably completed, or fully projected to search. Names and responses must not imply stronger completion than occurred.
- Prefer an explicit job result containing a stable ID and status when work can outlive the request. Add status and cancellation procedures only if the product or operations workflow uses them.
- Make retries and idempotency explicit so client retry, tRPC batch retry, or network timeout cannot create conflicting indexing runs.

#### Data handling and observability

- Remove raw search queries, IP addresses, message content, tokens, and third-party payloads from routine logs and exception properties unless a reviewed diagnostic policy explicitly permits them.
- Use stable operation names, safe entity IDs, outcome, duration, retry classification, and correlation IDs across tRPC spans and logs.
- Keep PostHog product events best effort and separate from API correctness. Use PostHog Error Tracking only at the terminal capture policy described above.
- Add request counts, latency histograms, error classification, active request count, and indexing job acceptance/completion metrics in Axiom.

#### Verification

- Add router tests for authentication, Zod input rejection, public/protected access, typed error mapping, and response compatibility.
- Add Hono integration tests for `/health`, `/trpc`, CORS, batching, malformed requests, payload limits, and unexpected error redaction.
- Add lifecycle tests for bind failure, degraded readiness, active-request drain, forced timeout, and idempotent shutdown.
- Add consumer contract checks for web and both dashboards without requiring their TypeScript programs to traverse bot implementation files.
- Run a controlled production-like check through the real proxy so client IP, CORS, secret headers, timeout, and batch behavior match deployment assumptions.

## Workspace Adapters

The rewrite remains confined to `apps/bot`, so adapters may initially wrap existing workspace helpers.

### `BotRepository`

Expose bot use cases rather than mirroring every DB helper:

- Installation lifecycle.
- Server and channel metadata mutations.
- Indexing policy and checkpoint access.
- Message batch persistence.
- Privacy lookup and mutation.
- Thread/message deletion.
- Vote updates.

If an existing helper has unsafe semantics, the adapter may use exported database primitives directly. Do not preserve a broken helper solely to avoid touching the boundary.

### `SearchIndex`

Every search write must be represented by an Effect and have an explicit completion policy. Submitting a Meili task and completing a Meili task are separate states.

The live adapter provides typed add, partial update, message deletion, thread deletion, thread-title update, search, and health operations. Every direct mutation waits for MeiliSearch task completion and rejects failed or cancelled tasks. Active tRPC and the durable projector use this service; the legacy singleton and callers were deleted.

### `AttachmentStorage`

R2/S3 storage is a bot-local Effect capability rather than an Effect dependency in `packages/db`. The live adapter owns and destroys its `S3Client`, exposes upload-from-Discord-CDN, direct object write, and batched object deletion, and keeps configuration, interruption, and typed failures at the bot boundary.

R2 is optional as a complete configuration group: either endpoint, bucket, access key, and secret are all present or startup configuration fails. Calling storage while it is disabled returns `StorageNotConfiguredError`. URL uploads accept only HTTPS Discord CDN hosts, enforce the existing five-megabyte limit before and after download, pass interruption to fetch and AWS requests, and rely on the AWS SDK's retry policy rather than adding blind retries.

The legacy database message helper still performs its own R2 upload internally, but the migrated indexing persistence does not route through it. `AttachmentStorage` projection and attachment-key privacy/reconciliation remain follow-up work.

### `CacheInvalidator`

Cache invalidation is best effort only if the product explicitly accepts stale reads. Failures should be typed, measured, and eligible for bounded retry or later reconciliation.

### `RateLimiter`

Use atomic Redis operations. Define behavior when Redis is unavailable. Do not trust `x-forwarded-for` without a configured trusted proxy boundary.

## Observability

Instrument boundaries and outcomes, not every function.

### Backend roles

The proposed production stack does not require Sentry:

- PostHog Error Tracking is the issue-management and exception backend. It supplies exception grouping, stack traces, releases, source-map support, assignment and alerts, affected-user analysis, and correlation with existing product analytics and session replay.
- Axiom is the operational telemetry backend for Effect/OpenTelemetry spans, structured logs, metrics, latency, worker state, and cross-operation investigation.
- PostHog product events remain best-effort product analytics. They are not substitutes for durable application work or operational spans.

This split is deliberate. PostHog answers "which grouped failures affect which users and product flows?" Axiom answers "what happened across the bot, dependency calls, workers, retries, and projections?" Do not send every log to PostHog or model every expected product event as an Axiom error.

PostHog tracing is not a dependency of this design. Effect spans should use OTLP and remain queryable in Axiom. Exceptions sent to PostHog and the corresponding Axiom trace or log entry must share a generated correlation ID plus the current trace and span IDs when available.

The existing `packages/logger` Axiom transport is legacy infrastructure and is not the target bot integration. The rewritten bot should install root-scoped Effect OTLP trace, log, and metric exporters, own their flush and finalization, and keep them alive until supervised handlers and workers drain.

### Error capture semantics

Use Executor's error semantics rather than copying AnswerOverflow's Sentry-specific catch/report helpers. Define a small bot-local `ErrorCapture` Effect service whose implementation can change without feature code importing PostHog:

```ts
interface ErrorCapture {
	readonly capture: (
		cause: Cause.Cause<unknown>,
		context: ErrorContext,
	) => Effect.Effect<string>;
}
```

The returned string is a correlation ID. The initial live implementation should:

1. Normalize the complete Effect `Cause` and choose real `Error` values for `posthog.captureException`; do not pass the internal `Cause` object as though it were an exception.
2. Capture one representative exception in PostHog with safe structured properties such as service, environment, operation, error classification, correlation ID, trace ID, span ID, release, and handled status.
3. Preserve composite-cause detail in the correlated Axiom error log rather than creating one PostHog issue event per cause leaf.
4. Annotate the current Effect span with the correlation ID and terminal outcome.
5. Return the correlation ID for an opaque HTTP or interaction error when exposing it helps support, without exposing internal messages or stacks.

Capture a failure once, at the boundary that owns its final policy:

- A command boundary that converts an unrecoverable failure into a Discord response.
- A Discord event boundary when a failure escapes the feature handler.
- A worker-item or batch-isolation boundary that records failure and deliberately continues.
- An HTTP boundary that translates an internal failure into a public error.
- The root runtime for a terminal process failure.

Lower layers add span and log annotations and preserve typed errors. They do not capture an exception merely because they observed it. Once a boundary captures and recovers a failure, the outer boundary must not capture it again.

Expected validation, policy rejection, not-found, permission, and retryable integration errors are not automatically exception events. Record their typed outcome and relevant metrics; capture them only after retries are exhausted or when the owning boundary classifies the result as operationally exceptional. Defects and escaped unexpected failures are captured.

Avoid generic helpers that report and return `undefined` or `null`. Reporting is not successful handling. Recovery should be expressed by a narrowly named policy that makes continued operation explicit.

### PostHog Error Tracking policy

Use manual boundary capture for the bot rather than relying only on global uncaught-error autocapture. Effect intentionally represents and handles failures that never become unhandled Promise rejections, while global hooks lack the domain context needed for useful grouping.

- Use `captureException`, never a hand-built `$exception` event.
- Set service, feature or operation, release, environment, and error classification properties so grouping, assignment, alerts, and filtering remain useful.
- Prefer PostHog's default fingerprinting. Add a custom fingerprint only when verified stack-based grouping creates noise; one issue should correspond to one fix.
- Configure `before_send` redaction and suppression before enabling capture. Never send Discord tokens, message content, usernames, email addresses, raw request bodies, attachment URLs, database URLs, or full third-party payloads.
- Associate a Discord or account identity only when allowed by the analytics privacy policy and needed to understand affected users. Background and system failures should use a stable service identity rather than inventing a user.
- Enable burst and rate protection plus billing limits. High-volume repeated failures must remain visible through Axiom counters and alerts if PostHog sampling or suppression drops individual exception events.
- Create release metadata for deployments. Upload source maps if the production bot is bundled or minified; Bun source execution should still be verified for useful source locations before assuming uploads are unnecessary.
- Own the PostHog client in the root scope and flush it with a bounded timeout during shutdown. Telemetry failure must not fail application work or prevent shutdown.

PostHog Error Tracking is sufficient for the current team and product stage. Sentry should be reconsidered only if concrete requirements emerge that PostHog plus Axiom cannot meet, such as materially better low-level profiling, native crash symbolication, or mature distributed-APM workflows. Do not add Sentry merely to reproduce AnswerOverflow's implementation.

### Spans, logs, and metrics

Use AnswerOverflow as a placement reference and Executor as an outcome and correlation reference:

- Root spans for Discord events, commands, scheduled runs, API jobs, and reconciliation runs.
- Child spans for Discord REST calls, PostgreSQL operations, MeiliSearch task submission and completion, cache invalidation, and bounded worker batches.
- Separate accepted, started, durable-write-completed, projection-completed, recovered, and failed outcomes. A recovered Effect must explicitly annotate the span outcome so the trace does not appear healthy merely because the error channel was consumed.
- Put queryable attributes on the span operators will query; parent spans do not inherit child attributes automatically.
- Attach safe IDs, operation names, counts, durations, attempts, and enumerated classifications. Keep user-provided content out of span names and attributes.

Required dimensions:

- Discord event and operation.
- Guild, channel, thread, message, and user IDs when safe.
- Job source: gateway, scheduled, API, startup reconciliation, or manual.
- Queue accepted/started/completed/failed state.
- Retry attempt and classification.
- Durable DB result.
- Search projection result.
- Cursor lag and last successful reconciliation once indexing exists.
- Shutdown drain durations and timeouts.

One failure should be reported once at its terminal ownership boundary. Lower layers add context and preserve the failure; they do not all send duplicate error reports.

## Testing Strategy

Use `@effect/vitest` and current Effect 4 testing APIs from `effect-smol`.

### Unit tests

- Pure command routing and conversion.
- Permission and policy decisions.
- Error classification.
- Cache tag calculation.
- Retry schedule decisions.

### Service tests

- Test layers for repository, search, cache, and rate limiting.
- Discord client/event adapter with a real discord.js client where practical.
- Listener registration/removal and active-fiber draining.
- Login timeout and error paths.
- API runtime bridge.
- `ErrorCapture` test layer and capture-once boundary behavior.
- PostHog cause normalization, redaction, correlation properties, and bounded flush behavior.
- OTLP exporter configuration and failure isolation.

### Temporal and concurrency tests

- Use `TestClock` rather than real sleeps.
- Verify no new callback work is accepted after scope closure begins.
- Verify shutdown waits for accepted handlers and times out predictably.
- Verify keyed operations cannot resurrect deleted state.
- Verify retries apply only to retryable errors.

### Compatibility tests

- Keep the existing message-link regex suite.
- Preserve command names and registration scope.
- Preserve tRPC procedure contracts.
- Add golden fixtures for important Discord conversion behavior before replacing indexing.

### Telemetry contract tests

- Verify representative command, Discord event, dependency, and worker spans reach an OTLP test collector with the required outcome attributes.
- Verify a terminal failure produces one PostHog capture request and one correlated Axiom error record, not duplicate exception events at nested boundaries.
- Verify expected handled failures remain typed outcomes and do not become PostHog issues by default.
- Verify exporter or PostHog outages do not change application outcomes.
- Verify source locations against the actual Bun production launch mode and source maps when bundling is introduced.

## Rewrite Sequence (Completed)

The phase checklists below preserve the original migration plan. Their future-tense wording is historical; the status headings and current-state sections record completion and remaining smoke work.

### Phase 0: lock behavior and dependencies (completed)

- Record current command and tRPC behavior before replacing internal implementations.
- Decide which current intents and partials are actually required.
- Pin `effect`, `@effect/platform-bun`, and `@effect/vitest` to the same exact Effect 4 beta. As of 2026-08-08, the matching published set is `4.0.0-beta.106`; recheck immediately before installation.
- Keep Bun as runtime and package manager. Use Vitest only as the Effect-aware test runner because `@effect/vitest` supplies scoped tests, test services, `TestClock`, and Effect-aware failure handling that `bun:test` does not currently provide.
- Verify every API against `effect-smol` because Effect 4 is still moving.

### Phase 1: runtime skeleton (completed)

- Add validated config.
- Add the root app layer/program.
- Add liveness/readiness state.
- Add signal-driven graceful shutdown.
- Replace the stale bot directly; do not build dual-runtime or compatibility machinery.

### Phase 2: discord.js lifecycle (completed)

- Implement scoped client acquisition.
- Implement scoped callback registration and `FiberSet` supervision.
- Add event adapter lifecycle tests.
- Login and await readiness.
- Remove the mutable exported client bridge.

### Phase 3: explicit commands (completed)

- Implement command registry and deployment.
- Port `/manage-account` and fix its interaction/privacy defects.
- Remove `/print-embed` and its unused generators.
- Remove Sapphire command infrastructure.

### Phase 4: HTTP and adapters (completed for cutover)

- Wrap existing DB/search/cache/rate-limit dependencies.
- Make the existing Hono/tRPC server a scoped Effect-owned resource.
- Preserve external tRPC clients while replacing mutable globals with injected bot services.
- Add a single Effect runtime and error-translation bridge for procedures.
- Introduce supervised indexing-job semantics when the indexing coordinator is implemented.
- Separate secrets through a compatibility migration.

### Phase 5: gateway parity (completed with indexing)

- Port guild installation/removal/update.
- Port channel/thread metadata events.
- Establish explicit event ordering and tests.
- Do not port historical indexing yet.

### Phase 6: indexing (completed)

- Implement the design developed in [`indexing.md`](./indexing.md).
- Port conversion with golden fixtures.
- Add reconciliation, retries, permission syncing, cursor correctness, projection recovery, and privacy invariants.
- Remove the old indexing code only after parity and failure-path tests pass.

### Phase 7: cleanup completed; live hardening remains

- Remove Sapphire and unused dependencies/configuration.
- Add Effect-oriented lint constraints where they have proven value.
- Verify shutdown under active handlers and indexing jobs.
- Verify production and development command deployment.
- Run a controlled reconciliation against test guilds before production rollout.

## Historical Decisions Before Implementation

These questions drove the implementation. Current answers are: Effect `4.0.0-beta.106`, HTTP readiness after owned resources start, terminal command deployment failure, bounded scoped drains, a single-replica first release, and retained tRPC contracts. Remaining production checks are listed near the top.

- Reconfirm that `4.0.0-beta.106` remains the matching current Effect 4 set immediately before installation.
- Whether HTTP binding is required before Discord readiness.
- Whether command deployment failure is terminal or degraded readiness.
- Graceful shutdown timeout and forced-shutdown behavior.
- Maximum active Discord handler fibers.
- Whether the bot remains single-replica during the first rewrite release.
- Whether a future non-bot consumer justifies moving the tRPC contract to a neutral package or adding OpenAPI.

## Foundation Acceptance Status

The foundation met these criteria before indexing was implemented:

- One scoped runtime owns the complete bot process.
- Discord listeners are explicitly registered and removed.
- Callback effects run in the captured application context and are supervised.
- The bot reaches readiness only after Discord and required services are ready.
- Shutdown stops intake and drains accepted work within a tested timeout.
- Commands work without Sapphire.
- The tRPC/Hono server is root-scoped and handlers use runtime capabilities rather than a mutable client singleton.
- Promise-based dependencies are isolated behind Effect adapters.
- Expected failures remain typed through application logic.
- There are tests for lifecycle, command routing, callback failure, readiness, and shutdown.
- Historical indexing was ported only after the foundation; it now uses the same scoped runtime and coordinator.

## Research Log

### 2026-08-08

- Confirmed BubbleBuddy uses discord.js `14.27.0` with Effect `4.0.0-beta.101` and provides the most directly relevant scoped callback integration.
- Added BubbleBuddy and `Effect-TS/effect-smol` as OpenCode references.
- Added Executor as an OpenCode reference for Effect 4 boundary discipline; it should inform constraints without dictating the bot's structure.
- Removed T3 Code from the primary reference set because its architecture is not close enough to this bot.
- Chose Bun for the production runtime/package manager and retained Vitest only for the official `@effect/vitest` integration.
- Initially proposed replacing tRPC with an OpenAPI job API; later investigation narrowed the rewrite to the bot process and retained tRPC as the stable Promise-based boundary for existing consumers.
- Confirmed `/print-embed` is legacy and will not be ported.
- Confirmed the stale bot is offline, so the rewrite does not need a dual-runtime migration path.
- Pinned `effect`, `@effect/platform-bun`, and `@effect/vitest` to `4.0.0-beta.106`, upgraded discord.js to `14.27.0`, and retained Vitest only for Effect-aware tests.
- Replaced the package entrypoint with `src/main.ts` using `BunRuntime.runMain` and `Layer.launch`.
- Added the scoped Discord client, scoped plain/effectful listener registration, `FiberSet` supervision and draining, typed login failures/timeouts, and client destruction finalization.
- Removed the legacy `/print-embed` command.
- Added lifecycle tests covering listener removal, active-handler draining, and client destruction.
- Audited the current bot and identified lifecycle, privacy, checkpointing, ordering, search, and readiness defects that must not be preserved.
- Completed a focused AnswerOverflow indexing audit. Useful findings are tracked in `indexing.md`.

### 2026-08-09

- Added explicit command registration and interaction dispatch without Sapphire. Production reconciles global commands; development and test reconcile commands in `DISCORD_DEVELOPMENT_GUILD_ID`.
- Made command deployment failure terminal during startup. Readiness becomes true only after Discord login and command reconciliation complete, and returns false during scoped shutdown.
- Ported `/manage-account` as a supervised, ephemeral three-minute session with invoking-user ownership, immediate button acknowledgement, explicit irreversible-deletion confirmation/cancellation, and an atomic one-shot claim that prevents duplicate destructive actions.
- Added `PrivacyRepository` and `SearchIndex` Effect boundaries. Account data deletion is transactional in PostgreSQL, returns all affected message IDs, and waits for the corresponding MeiliSearch deletion task before reporting success.
- Confirmed search documents contain no author identity, so name anonymization does not require a MeiliSearch update. Future ingestion must still preserve the authoritative anonymization and ignore flags.
- Added tests for readiness, privacy action ordering, failure responses, and menu expiry.
- Investigated PostHog Error Tracking as the Sentry replacement. Chose PostHog for grouped exceptions, releases, and user-impact context, and Axiom for Effect OTLP traces, logs, metrics, and operational investigation; no Sentry dependency is planned.
- Chose Executor's backend-neutral `ErrorCapture` and terminal-boundary semantics over AnswerOverflow's Sentry-specific report-and-recover helpers, while retaining AnswerOverflow's Discord and indexing span-placement ideas.
- Recorded capture-once, PostHog and Axiom correlation, cause normalization, PII redaction, release and source-map, rate protection, exporter lifecycle, and telemetry contract-test requirements. This is design research only; no telemetry integration has been implemented yet.
- Kept Hono and tRPC for the bot-only rewrite. Effect will own server lifecycle and internal execution while web and dashboard callers retain their existing Promise-based contracts; OpenAPI and moving public procedures are separate future decisions.
- Refactored the tRPC router to receive the ready discord.js client and API secret explicitly, removed the stale Sapphire entrypoint side effect, and added the scoped Bun/Hono server with structured HTTP readiness and graceful `stop(false)` shutdown.
- Historical (superseded): preserved existing tRPC procedure names and downstream inferred client types while indexing and raw-message diagnostics returned `SERVICE_UNAVAILABLE`; indexing now delegates to the implemented coordinator, while only the raw-message diagnostic remains unavailable.
- Added optional `BOT_API_SECRET` and `BOT_API_PORT` configuration. The API secret temporarily falls back to `DISCORD_BOT_TOKEN` so existing callers continue working until a separate credential migration is coordinated.
- Added a post-migration tRPC audit checklist covering lifecycle/degraded startup, procedure ownership, contract packaging, credential and proxy trust, the Effect runtime bridge, error translation, indexing jobs, observability, privacy, and end-to-end contract verification. No additional API redesign is part of the current migration.
- Expanded `SearchIndex` to cover all required MeiliSearch reads and writes with typed failures and confirmed task completion, then moved active tRPC search and Meili health calls off the legacy singleton.
- Historical (partially superseded): added optional, scoped `AttachmentStorage` for R2/S3 uploads, direct writes, and batched deletion. PostgreSQL indexing persistence is now migrated, but attachment object projection remains deferred as recorded in the live-smoke risks.
- Compared the proposed upgrades against Executor and AnswerOverflow. Chose Executor for Promise facades, typed operation contracts, capture-once errors, truthful outcomes, scoped workers, and analytics privacy; chose AnswerOverflow for Discord span/metric placement, gateway reconciliation, and keyed-ordering requirements; retained Velumn's stronger `FiberSet` callback lifecycle.
- Implemented the current HTTP upgrade with one scoped `FiberSet.makeRuntimePromise` bridge and a narrow `BotApiOperations` Promise facade. Readiness, search, and search health now run in the captured application context and receive Hono/tRPC cancellation signals without constructing a second runtime.
- Made MeiliSearch an optional complete capability. With no Meili host configured, projection mutations are intentional no-ops, privacy deletion still succeeds, and search/health return explicit unavailable errors; partial configuration fails decoding instead of silently falling back to localhost.
- Historical (superseded): removed active tRPC imports of legacy indexing and conversion modules and temporarily reported migration unavailability. The retained procedure shapes now delegate to the implemented coordinator without restoring the old production import graph.

### 2026-08-09: indexing completion and cutover candidate

- Implemented and composed the indexing coordinator, Discord history boundary, gateway events, policy/conversion/mutation path, reconciliation jobs, scheduler, and durable Meili projector.
- Restored guild/thread tRPC indexing as persisted job acceptance with status and cancellation while keeping the external Promise contract.
- Added the PostgreSQL indexing migration and repository boundary, plus focused concurrency, restart recovery, lifecycle, and API tests.
- Deleted Sapphire, the stale entrypoint, old listeners/conversion helper, `/print-embed`, and all legacy indexing modules.
- Superseded the earlier deferred/quarantined indexing claims above; only the raw-message diagnostic remains unavailable. Live smoke and production cutover risks are listed at the top.

### 2026-08-09: final indexing hardening

- Added ten-attempt terminal projection failure, deterministic persisted active/stored thread rotation, permanent hierarchy tombstones, and authoritative offline container-delete repair.
- Added the fairness and tombstone changes as additive migrations and validated the full migration/helper path in isolated PostgreSQL.
- Confirmed 115 bot tests: 16 Bun unit tests and 99 Effect/Vitest tests. The legacy runtime/indexing deletion remains complete.
- Superseded the prior container-tombstone residual risk; only live Discord, live Meili, and browser smoke gaps remain for this cutover.
