# Velumn Indexing Research

Status: implemented; live smoke and production cutover verification remain

Last updated: 2026-08-09

Implementation completed after the Effect runtime foundation. Historical design and research claims remain below and are marked when superseded.

## Purpose

Record the indexing design, its implemented form, and the research that led to it. The current implementation is the source of truth when historical target language below differs.

This document is expected to grow as implementation research uncovers new behavior, edge cases, Discord API constraints, database semantics, search projection behavior, and privacy requirements.

The implementation status and file map below describe the cutover candidate. Retained target language and open questions document research history; they are not evidence that the corresponding subsystem is still deferred.

## Implemented Status

The rewritten bot now runs live gateway parity and scheduled/manual reconciliation through one scoped Effect application. Per-content ordering uses a bounded, idle-evicted coordinator; capped reconciliation rotates through a persisted deterministic cursor so active threads cannot starve stored repair work. PostgreSQL commits enforce policy/privacy, source-version ordering, and permanent container tombstones; authoritative 404s and guild-set comparison repair deletes missed while offline. The durable Meili projector leases and retries rows, then records a terminal `failed` state after ten attempts so later partition work can continue. tRPC guild/thread starts return persisted job IDs, with status and cancellation procedures.

### Module map

| Responsibility | Implementation |
| --- | --- |
| Root ownership/readiness | `apps/bot/src/runtime/app-layer.ts`, `apps/bot/src/runtime/readiness.ts`, `apps/bot/src/main.ts` |
| Discord lifecycle and event bridge | `apps/bot/src/discord/client.ts`, `apps/bot/src/discord/events.ts` |
| Gateway parity | `apps/bot/src/indexing/events.ts` |
| Bounded keyed ordering and receipts | `apps/bot/src/indexing/coordinator.ts`, `apps/bot/src/indexing/model.ts` |
| Discord reads and error classification | `apps/bot/src/indexing/discord-history.ts`, `apps/bot/src/indexing/policy.ts` |
| Conversion and authoritative mutation | `apps/bot/src/indexing/conversion.ts`, `apps/bot/src/indexing/mutation.ts` |
| Planning, jobs, and schedule | `apps/bot/src/indexing/reconciliation.ts`, `apps/bot/src/indexing/jobs.ts`, `apps/bot/src/indexing/scheduler.ts` |
| Durable Meili projection | `apps/bot/src/indexing/projector.ts`, `apps/bot/src/adapters/search.ts` |
| Database boundary | `apps/bot/src/adapters/indexing-repository.ts`, `packages/db/src/helpers/indexing.ts`, `packages/db/src/schema/indexing.ts` |
| HTTP job facade | `apps/bot/src/http/operations.ts`, `apps/bot/src/helpers/trpc.ts` |

### Migration and cutover

1. Apply `packages/db/src/drizzle/20260809030731_nervous_landau/migration.sql`, then the additive `20260809143437_fair_reconciliation` and `20260809144204_dizzy_shadow_king` migrations. They add the indexing model, persisted reconciliation-selection cursor, and permanent container tombstones without rewriting an already-applied migration.
2. Deploy the single `apps/bot/src/main.ts` Effect runtime with the existing bot configuration and optional complete Meili/R2 configuration groups.
3. Verify structured readiness, then start a scoped guild/thread reconciliation through `indexServer`, `reindexServer`, or `reindexThread`; poll `getIndexingJob` and inspect projection drain before broad reconciliation.
4. The Sapphire entrypoint/config, listeners, conversion helper, `/print-embed`, and legacy indexing implementation were deleted. There is no dual-runtime or fallback cutover path. `getRawMessageData` alone remains intentionally unavailable as an unported legacy diagnostic.

### Automated tests

`bun --filter bot test` runs 115 tests: 16 Bun unit tests and 99 Effect/Vitest tests across 18 files. `bun --filter bot type-check` checks the package. Coverage includes projection exhaustion, persisted fairness, authoritative offline-delete repair, tombstone resurrection prevention, root lifecycle, and API contracts. The complete migration chain and indexing helper behavior were also validated against an isolated PostgreSQL instance.

### Remaining live-smoke risks

- Exercise real Discord gateway and REST behavior for partial messages, public/announcement threads, archived pagination, category permission inheritance, guild leave/rejoin, bulk deletes, and rate limits.
- With live Meili configured, confirm task completion, ten-attempt failure visibility, outage/restart recovery, deletion, title refresh, privacy purge, and backlog inspection.
- Browser-smoke public thread/search behavior after create, edit, delete, offline repair, and privacy purge at desktop and narrow widths. Attachment URLs must remain source URLs; R2 mirroring is not connected.

## How To Maintain This Document

When new indexing behavior is discovered:

1. Add a dated entry to the research log.
2. Link the exact source file and line range.
3. Classify it as confirmed behavior, defect, useful pattern, rejected pattern, or open question.
4. Update the target invariant if the finding changes the intended design.
5. Add or update a required test when the behavior is observable.
6. Do not silently replace an old conclusion; mark it superseded and explain why.

Research should distinguish:

- Discord data fetched or observed.
- Work accepted into memory.
- PostgreSQL writes committed.
- MeiliSearch projection submitted.
- MeiliSearch task completed.
- Cache invalidation completed.
- Cursor/checkpoint advanced.

These states are currently conflated in both codebases in different ways.

## Scope

This document covers:

- Guild/server synchronization.
- Parent channel and thread synchronization.
- Message and author synchronization.
- Historical indexing and reconciliation.
- Bot permissions and indexing eligibility.
- Cursors, pagination, retries, and rate limits.
- Ordering, batching, backpressure, and shutdown.
- PostgreSQL, MeiliSearch, and cache consistency.
- Privacy, ignore, anonymization, and deletion behavior.
- Operational controls, observability, and recovery.
- Tests required before replacing the current pipeline.

Command routing, general runtime lifecycle, and non-indexing architecture belong in [`effect-rewrite.md`](./effect-rewrite.md).

## Research Sources

### Legacy Velumn

Deleted legacy files retained as research citations:

- `apps/bot/src/indexing/server.ts`
- `apps/bot/src/indexing/channel.ts`
- `apps/bot/src/indexing/helpers.ts`
- `apps/bot/src/indexing/store.ts`
- `apps/bot/src/indexing/search.ts`
- `apps/bot/src/helpers/convertion.ts`
- `apps/bot/src/listeners/updates/server.ts`
- `apps/bot/src/listeners/updates/channels.ts`
- `apps/bot/src/listeners/updates/messages.ts`
- `apps/bot/src/helpers/trpc.ts`

### AnswerOverflow

AnswerOverflow is available locally at `../AnswerOverflow`. It is research material, not a direct OpenCode reference and not code to copy.

The accepted behavioral snapshot is vendored in [`answeroverflow-indexing-reference.md`](./answeroverflow-indexing-reference.md) so later implementation does not depend on the upstream workspace remaining unchanged.

The Discord HTTP API preview used as an additional pinned reference is recorded in [`discord-api-spec-source.md`](./discord-api-spec-source.md); its 1.18 MB JSON is intentionally not vendored.

Primary files:

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/server.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/channel.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/message.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/user.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/bot-permissions.ts`
- `../AnswerOverflow/apps/discord-bot/src/core/discord-service.ts`
- `../AnswerOverflow/apps/discord-bot/src/utils/channel-batched-queue.ts`
- `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts`
- `../AnswerOverflow/packages/database/convex/schema.ts`
- `../AnswerOverflow/packages/database/convex/shared/messages.ts`
- `../AnswerOverflow/packages/database/convex/private/messages.ts`
- `../AnswerOverflow/packages/ui/src/components/discord-message/`

### Effect references

- `@effect-smol` is authoritative for Effect 4 primitives and semantics.
- `@bubblebuddy` is useful for scoped Discord event handling, per-channel state, and worker lifecycle.
- `@executor` is useful for typed integration boundaries, resource ownership, retry policy placement, and Promise adapter discipline.

## Core Model

The target system should combine two paths:

### Live parity

Discord gateway events provide low-latency updates for guilds, channels, threads, messages, users, and permission-affecting changes.

Live events are not a durable log. Events can be missed during downtime, invalid sessions, cache gaps, deployment, or handler failure.

### Reconciliation

Periodic and manually triggered reconciliation fetches authoritative Discord state and repairs gaps. Historical indexing is one reconciliation mode, not a separate unrelated system.

This is the strongest high-level idea confirmed in AnswerOverflow. Effect makes it easier for both paths to share adapters, typed errors, ordering, retries, spans, schedules, and shutdown semantics.

The critical rule is that live parity and reconciliation must share the same mutation ordering and persistence invariants. They cannot be two writers that race each other.

### Executor and AnswerOverflow synthesis

Historical design rule, now implemented: use AnswerOverflow for Discord-specific topology and Executor for operational semantics. The current module map above records the resulting Velumn implementation.

#### Coordinator and non-overlap

- Every entry point must use one `IndexingCoordinator`: scheduled reconciliation, manual global/guild/thread requests, gateway create/update/delete, delayed thread initialization, privacy purge, and projection recovery.
- A process-local one-permit semaphore is acceptable only while deployment explicitly guarantees one bot replica.
- Scheduled full runs may skip or coalesce when another full run is active. Manual requests must return an existing job or explicit conflict. Gateway mutations must never be silently skipped.
- Manual guild indexing must not bypass the coordinator or lock. AnswerOverflow's current all-guild and single-guild commands use its process-local lock, but unlocked core functions remain exported and live parity remains outside that ordering domain.
- A later multi-replica deployment requires a durable lease, advisory lock, or expiring job ownership record rather than a larger in-memory semaphore.

#### Bounded keyed workers

- Preserve order within the selected entity key while allowing independent keys to progress concurrently. Thread ID is the leading candidate for message/content mutations; parent/channel coordination remains an open decision.
- Use bounded queues with a named overload policy. Do not copy AnswerOverflow's unbounded queue.
- Make keyed worker creation atomic and evict idle partitions so high-cardinality guild activity cannot retain fibers forever.
- Route create, update, delete, reconciliation, and privacy mutations through the same ordering domain when they can conflict.
- Stop intake before shutdown drain, await accepted authoritative writes, and expose queue depth, oldest work age, active partitions, rejected/coalesced offers, retries, and failed batches.

#### Work receipts and truthful outcomes

- Distinguish callback received, work accepted, work started, PostgreSQL committed, projection submitted, projection completed, retry scheduled, partial failure, cancellation, and terminal failure.
- Handler completion proves only handler completion. Tests and API responses must wait on a worker receipt, projection receipt, or job status for the guarantee they claim.
- A worker may isolate one failed batch and continue, but it must resolve a typed batch outcome and update job/metric state instead of reporting and converting the failure to success.
- Recovered or value-level failures must annotate span outcome explicitly, following Executor's `ToolResult` discipline.

#### Durable projection recovery

- In-memory retries are insufficient for PostgreSQL-to-Meili correctness across restart.
- Prefer a transactional outbox or projection ledger written with the authoritative PostgreSQL mutation.
- Process projection records in entity order, mark confirmed Meili task completion, and reconcile stale or failed records after restart.
- Executor's bounded analytics requeue is appropriate for best-effort analytics, not authoritative search projection.

#### Spans and metrics

- Use AnswerOverflow's hierarchy as placement guidance: indexing run, guild, channel, thread, page fetch, conversion, authoritative commit, media projection, and search projection.
- Improve stage semantics so fetched or queued messages are never counted as indexed.
- Required outcomes include accepted, started, DB completed, projection submitted, projection completed, retry scheduled, recovered, failed, and cancelled.
- Use Executor's metadata discipline: stable IDs, counts, classifications, and durations only; no message content, names, raw queries, attachment URLs, or internal exception text.

## Target Invariants

These are the working invariants for the new design.

### Authority

- Discord is authoritative for guild/channel/thread/message source data and effective permissions.
- PostgreSQL is authoritative for Velumn's indexed state, privacy state, indexing policy, and durable checkpoints.
- MeiliSearch is a rebuildable projection of PostgreSQL state.
- Web cache invalidation is a rebuildable/best-effort projection signal.

### Eligibility

- The target publication boundary includes eligible public-thread and announcement-thread messages plus messages in explicitly opted-in root announcement channels.
- Root text-channel messages remain excluded. Storing parent text-channel metadata does not imply publishing its messages.
- Private threads, DMs, voice-channel messages, and media-channel content are excluded unless explicitly designed with an access and privacy model.
- NSFW and non-viewable content is never indexed.
- The bot must currently have `ViewChannel` and `ReadMessageHistory` near the Discord read.
- The parent channel must currently be opted into indexing.
- The same policy applies to scheduled indexing, manual/API reindexing, thread creation, and live message events.

### Privacy

- Ignored users never contribute message content to new PostgreSQL writes or search projections.
- Anonymization cannot be reset by user synchronization or historical indexing.
- Account deletion/anonymization has explicit effects on PostgreSQL, MeiliSearch, cache, and future events.
- Privacy enforcement occurs at the authoritative persistence boundary even if callers also filter earlier.
- A retry cannot reintroduce content that became ineligible after the original event.

### Ordering

- Create, update, delete, live event, and reconciliation writes for the same thread share one ordering domain.
- Search mutations for one message/thread follow authoritative PostgreSQL mutation order.
- A delayed initial thread index cannot resurrect a deleted thread.
- A queued create/update cannot commit after a later delete.
- Full indexing cannot overwrite a newer live update with older fetched data without version checks.

### Checkpoints

- A checkpoint represents the greatest Discord snowflake whose required authoritative writes committed successfully.
- Checkpoints never advance based only on fetched, attempted, filtered, or failed messages.
- A failed conversion cannot become a permanent gap.
- A page containing only intentionally skipped messages must still make progress through a separately defined scan cursor or explicit skip record.
- Replaying from an earlier checkpoint is safe and idempotent.
- Operators can reset or replay checkpoints through a reachable, audited control.

### Completion

- Queue acceptance is not reported as durable synchronization.
- An indexing job result states which stages completed and which projections remain pending.
- Shutdown stops new intake and drains accepted authoritative work within a bounded period.
- Metrics count durable outcomes, not merely attempts.

## Legacy Velumn Findings

### Lifecycle and triggering

Scheduled indexing starts on Discord ready only when the process is launched with `--index`:

- `apps/bot/src/listeners/ready.ts:21-56`

The legacy process performs one full pass, then schedules an hourly Croner job with overlap protection. Manual tRPC procedures could trigger indexing concurrently and frequently launched it without awaiting or observing failure:

- `apps/bot/src/helpers/trpc.ts:65-68`
- `apps/bot/src/helpers/trpc.ts:259-286`

Confirmed defect: cron overlap protection does not coordinate scheduled indexing with API indexing, thread-create indexing, live events, or another process.

### Server planning

Guilds are ordered by paid, open-source, then free plan, with randomization inside tiers:

- `apps/bot/src/indexing/server.ts:85-142`

This is product behavior worth preserving, but the limits need clearer names and semantics. The current `maxThreads` path actually counts parent channels:

- `apps/bot/src/indexing/server.ts:47-68`
- `apps/bot/src/helpers/trpc.ts:259-286`

### Channel policy

Scheduled parent-channel indexing checks type, visibility, NSFW state, `ViewChannel`, `ReadMessageHistory`, and production `indexingEnabled`:

- `apps/bot/src/indexing/channel.ts:38-64`

Confirmed policy gap: `ThreadCreate` calls `indexThread` directly and bypasses the parent's current `indexingEnabled` decision:

- `apps/bot/src/listeners/updates/channels.ts:97-123`
- `apps/bot/src/indexing/channel.ts:149-180`

Live message handlers use “thread exists in the database” as a proxy for current eligibility:

- `apps/bot/src/listeners/updates/messages.ts:45-69`

Target consequence: indexing policy must be one capability used by every ingestion path.

### Thread discovery

Velumn fetches archived pages recursively and active threads separately:

- `apps/bot/src/indexing/channel.ts:78-104`
- `apps/bot/src/indexing/channel.ts:229-267`

Confirmed defect: archived threads are placed before active threads and then the combined list is capped, so a large archive can exclude active threads.

Confirmed defect: the archived cutoff reads a parent-channel checkpoint that normal thread storage does not maintain correctly.

### Message pagination

Messages are fetched in pages of 100 using `after`, sorted ascending, and capped at 20,000:

- `apps/bot/src/indexing/helpers.ts:36-70`

There is no domain retry policy around transient Discord failures. discord.js handles REST rate-limit buckets, but the application does not classify retryable indexing failures or persist failed work.

### Checkpoint correctness

Confirmed critical defect: `storeIndexedData` persists `getTheOldestSnowflakeId(messages)`:

- `apps/bot/src/indexing/store.ts:66-84`
- `apps/bot/src/indexing/helpers.ts:16-34`

Subsequent pagination uses `after`, so the checkpoint must represent the greatest successfully committed snowflake, not the oldest fetched message.

Confirmed critical defect: the checkpoint/thread metadata write occurs before user, message, backlink, and search work:

- `apps/bot/src/indexing/store.ts:66-189`

A correct high-watermark written at that point would skip data after a later failure.

### Conversion

Current conversion contains real product semantics and should be ported with golden tests rather than redesigned casually:

- Message content and clean content.
- Embeds, attachments, stickers, components, polls, snapshots, and reactions.
- Thread-starter and `primaryChannelId` behavior.
- Internal Discord links and backlinks.
- Thread owner and channel metadata.

Primary source:

- `apps/bot/src/helpers/convertion.ts:43-592`

Confirmed risk: internal-link conversion can create unbounded Discord fetch fan-out. The rewrite needs bounded resolution concurrency and explicit failure behavior.

Confirmed search defect: Meili documents use `channelId` rather than `primaryChannelId` for `threadId`, which can misassociate starter messages:

- `apps/bot/src/indexing/search.ts:33-42`

### PostgreSQL writes

Messages are inserted in chunks and conflicts are ignored. “Force” does not update existing DB messages:

- `packages/db/src/helpers/messages.ts:62-119`

Backlinks are conflict-ignore and stale backlinks are not removed after edits:

- `packages/db/src/helpers/messages.ts:55-60`

Target consequence: define explicit idempotent upsert semantics for metadata, content, attachments, and backlinks. “Force reindex” must have a precise meaning.

### Search projection

Confirmed defect: `insertBulkSearchMessages` does not return or await `addDocuments`, so its catch cannot observe asynchronous rejection:

- `apps/bot/src/indexing/search.ts:28-53`

Confirmed defect: the async sanitizer is called inside a synchronous map and yields Promises instead of strings:

- `apps/bot/src/indexing/search.ts:80-89`
- `apps/bot/src/indexing/search.ts:155-163`

Confirmed ordering defect: live add/update/delete submissions can race and recreate deleted search data.

Target consequence: search writes need a clear submitted-versus-completed policy, ordering with DB mutations, retry/reconciliation, and privacy purge behavior.

The bot-local `SearchIndex` adapter covers add, partial update, message/thread deletion, thread-title update, search, and health. Configured mutations wait for the MeiliSearch task to reach `succeeded`; active tRPC search and health calls use it. MeiliSearch is optional: when no host is configured, projection mutations are intentional no-ops and read/health operations return a typed unavailable error. The implemented ledger/projector now provides workflow ordering and restart recovery; the legacy search singleton and its callers were deleted.

The `AttachmentStorage` adapter owns optional R2 configuration and a scoped `S3Client`, supports Discord-CDN upload, direct writes, and batched deletion, and returns typed failures. The migrated indexing persistence does not route through the legacy database helper's hidden upload path. Attachment object projection, key retention, and object privacy deletion remain follow-up work.

### Privacy

Confirmed critical defect: live message create/update does not check `isIgnored` before storing or indexing content:

- `apps/bot/src/listeners/updates/messages.ts:45-92`

The rewritten `/manage-account` path clears PostgreSQL content and attachments in one transaction and returns every affected message ID. Privacy deletion and indexing now enqueue durable Meili projection work from authoritative database transactions; current privacy state is rechecked at the persistence boundary so the deleted legacy writer cannot reintroduce content.

Search documents currently contain no author identity. Name anonymization therefore needs no search projection update, but PostgreSQL user upserts must preserve `anonymizeName`.

Confirmed critical defect: full indexing can upsert user defaults that reset anonymization:

- `apps/bot/src/helpers/convertion.ts:77-85`
- `apps/bot/src/indexing/store.ts:101-126`
- `packages/db/src/helpers/user.ts:253-269`

These are mandatory fixes, not compatibility behavior.

## AnswerOverflow Findings

### Useful: events plus reconciliation

AnswerOverflow combines gateway parity with a six-hour historical indexing job:

- `../AnswerOverflow/apps/discord-bot/src/bot.ts:37-71`
- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:1147-1191`

Useful principle: gateway events optimize freshness; periodic idempotent reconciliation supplies correctness.

### Useful: entity-specific parity

Guild, channel, message, user, and bot-permission concerns are separated:

- `../AnswerOverflow/apps/discord-bot/src/sync/server.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/channel.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/message.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/user.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/bot-permissions.ts`

Useful principle: define what “parity” means per entity and field. Guild metadata parity, message history, permissions, member access, and privacy state do not need identical retention policies.

### Useful: per-channel write ordering

Message writes are partitioned by channel:

- `../AnswerOverflow/apps/discord-bot/src/sync/message.ts:43-66`
- `../AnswerOverflow/apps/discord-bot/src/utils/channel-batched-queue.ts:30-135`

Useful principle: preserve ordering within an identity while allowing independent identities to progress concurrently.

Rejected implementation detail: deletes bypass the queue, so queued upserts can commit afterward and resurrect messages. Velumn must route every mutation in an ordering domain through the same coordinator.

Rejected implementation detail: queues are unbounded, workers are never evicted, and failed batches are logged then lost.

### Useful: privacy at persistence

AnswerOverflow's message mutation layer enforces account deletion and per-user indexing opt-out:

- `../AnswerOverflow/packages/database/convex/private/messages.ts:81-155`

Useful principle: privacy enforcement belongs at the authoritative write boundary so both live and historical writers are protected.

### Useful: effective permission snapshots

AnswerOverflow calculates effective permissions through discord.js and stores the bitfield as a string:

- `../AnswerOverflow/apps/discord-bot/src/core/discord-service.ts:316-338`
- `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts:112-160`

Useful principle: store effective permission snapshots for product/UI diagnostics, but enforce indexing permissions against current Discord state near the read.

String storage avoids truncation as Discord permission bitfields expand.

### Useful: permission-affecting events

AnswerOverflow resyncs channel permissions when the bot member or one of its roles changes:

- `../AnswerOverflow/apps/discord-bot/src/sync/bot-permissions.ts:11-91`

Useful principle: permission synchronization must account for bot member roles and channel/category overwrite changes, not only direct channel updates.

Gaps to avoid:

- Role create/delete are not explicitly handled.
- Category inheritance does not explicitly invalidate children.
- Permission resync is cache-only.
- A role change can cause a guild-wide burst with no deliberate debounce/coalescing policy.

### Useful: declarative scheduling and overlap control

AnswerOverflow uses `Schedule.cron` and a semaphore for a process-local indexing lock:

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:53-65`
- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:1057-1166`

Useful principle: recurrence and overlap control become explicit, scoped, and testable with Effect.

Limitation: a process semaphore is not a distributed lock. This is sufficient only while Velumn guarantees one indexing process. Multi-replica deployment needs a durable lease or partition ownership.

### Useful: cache-first versus fetch-required boundaries

AnswerOverflow distinguishes cache-only lookups from historical indexing operations that fetch missing channels:

- `../AnswerOverflow/apps/discord-bot/src/core/discord-service.ts:202-338`

Useful principle: every lookup path should state whether it is cache-only, cache-first, or fetch-required. Fallback and cache-miss rates should be observable.

### Useful: test layers using discord.js structures

AnswerOverflow composes its real Discord service over a mock client and provides utilities to seed caches and emit events:

- `../AnswerOverflow/apps/discord-bot/src/core/discord-client-test-layer.ts:9-36`
- `../AnswerOverflow/apps/discord-bot/src/core/discord-client-mock.ts:25-404`

Useful principle: test adapters with realistic discord.js structures where their behavior matters. Add controllable failures, pagination, partials, and time rather than only happy-path construction.

### Rejected: catch-all success

Many AnswerOverflow sync operations catch, report, and return success. Examples include guild sync and batch workers:

- `../AnswerOverflow/apps/discord-bot/src/sync/server.ts:297-302`
- `../AnswerOverflow/apps/discord-bot/src/utils/channel-batched-queue.ts:59-78`

This makes traces look clean while preventing retries, partial-run summaries, and health state from observing failure.

Target consequence: preserve typed failures until the indexing coordinator decides to retry, mark partial success, defer a projection, or terminate the job.

### Rejected: cursor advancement after failed conversion

AnswerOverflow can replace failed conversions with `null` while advancing the cursor using the original fetched messages:

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:367-438`

This can turn conversion failures into permanent gaps.

Target consequence: cursor advancement must derive from durable outcomes and explicit skip decisions.

### Rejected: completion that excludes detached work

AnswerOverflow forks guild sync as a daemon during indexing:

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:957-966`

The indexing lock can release while parity work remains active.

Target consequence: job completion and lock ownership must include all work required by that job's result.

### Rejected: queue acceptance as handler completion

AnswerOverflow's event handler can finish after queue offer but before the database commit. Its handler drain does not include queued DB work.

Target consequence: expose separate handler and durable-worker drains, and use the correct one during shutdown and tests.

## Discord Coverage Parity Audit

This section records the 2026-08-09 feature-level comparison requested before any new indexing implementation. It separates four questions that must not be conflated:

1. What Discord data can be observed or fetched?
2. What source data is persisted?
3. What content is intentionally published by the product?
4. What lifecycle events keep that data accurate?

AnswerOverflow is broader than Velumn, but it is not fully inclusive of every Discord feature. It does not index DMs, private threads, voice messages, or media channels; it has no durable poll support; it drops Unicode reactions; and several rich-content and lifecycle paths are incomplete. Its code is mature research material, not a completeness oracle.

### Product boundary versus parity boundary

Velumn's legacy product boundary is narrower than its parent-channel model:

- Guild text, announcement, and forum channels are stored as selectable parents.
- Historical and live message persistence accepts only `PublicThread` messages.
- Root text/announcement messages are not published.
- Private threads and DMs are not published.

Sources:

- `apps/bot/src/indexing/server.ts:145-148`
- `apps/bot/src/indexing/channel.ts:95-103`
- `apps/bot/src/indexing/store.ts:86-88`
- `apps/bot/src/listeners/updates/messages.ts:45-54`

AnswerOverflow stores a broader public corpus:

- Messages in enabled root text and announcement channels.
- Messages in public and announcement threads.
- Forum posts and replies.
- No private-thread or DM parity indexing.

Sources:

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:703-793`
- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:851-955`
- `../AnswerOverflow/apps/discord-bot/src/sync/message.ts:249-355`
- `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts:56-95`

Target consequence: adopting AO's parity metadata does not require adopting AO's root-message publication scope. Every entity and field needs an explicit `observe`, `persist`, `publish`, and `delete` decision.

### Entity and channel matrix

| Capability | Velumn legacy | AnswerOverflow | Classification for Velumn |
| --- | --- | --- | --- |
| Guild metadata | Stored and event-updated | Stored, event-updated, and reconciled | Keep; add missed-leave reconciliation |
| Guild categories | Not stored | Stored with hierarchy | Adopt for channel selection and inherited permissions |
| Root text channels | Stored as parents; messages excluded | Stored; messages included when enabled | Keep metadata; root-message publication stays excluded until explicitly accepted |
| Announcement channels | Stored as parents; root messages excluded | Stored; root messages included | Adopt metadata and opted-in root announcement messages |
| Forum channels | Stored as parents | Stored with tags | Keep and expand tag fidelity |
| Media channels | Unsupported | Unsupported | Explicitly exclude until product requirements change |
| Public threads | Core indexed entity | Indexed | Keep |
| Announcement threads | Excluded by `PublicThread` gates | Indexed | Adopt under the same parent opt-in policy as public threads |
| Private threads | Excluded | Excluded from bot ingestion | Exclude without an access-control design |
| DMs | No intent or indexing | Operational forwarding only; no indexing | Exclude from indexing |
| Channel category and position | Missing | Stored | Adopt |
| Forum available tags | Missing | Stored | Adopt |
| Applied thread tags | Missing | Stored and updated | Adopt with replacement and deletion cleanup |
| Thread owner | Stored | Not stored as channel metadata | Preserve Velumn behavior |
| Archived, locked, pinned thread state | Stored | Archived timestamp only | Preserve Velumn behavior |
| Bot effective permissions | Checked but not stored | Stored and resynchronized | Adopt for diagnostics and drift detection |
| User identity | Stored from indexed messages | Also updated on `UserUpdate` | Update only users already present in Velumn's database |
| Guild member roster | Not stored | Selected access/settings only | Do not add solely for indexing |
| Roles | Not first-class | Role IDs used for access | Persist only what permission/dashboard policy needs |
| Solutions | Missing | First-class question/solution relation | Product feature decision, not automatic indexing scope |
| Reverse backlinks | Stored but incompletely maintained | No equivalent model | Preserve and repair Velumn's differentiator |
| Reactions | Aggregate JSON counts | Per-user custom-emoji rows | Choose display aggregate versus attribution explicitly |

Key source areas:

- Velumn channel/message schemas: `packages/db/src/schema/discord.ts:41-233`
- Velumn channel conversion: `apps/bot/src/helpers/convertion.ts:43-85`
- AO entity schemas: `../AnswerOverflow/packages/database/convex/schema.ts:10-106`, `../AnswerOverflow/packages/database/convex/schema.ts:376-425`
- AO channel conversion: `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts:56-159`
- AO channel parity: `../AnswerOverflow/apps/discord-bot/src/sync/channel.ts:23-324`
- AO solutions: `../AnswerOverflow/packages/database/convex/private/messages.ts:381-418`

### Message and rich-content matrix

| Discord feature | Velumn legacy | AnswerOverflow | Required conclusion before implementation |
| --- | --- | --- | --- |
| Default messages | Stored in public threads | Stored in enabled roots and eligible threads | Preserve thread-only publication unless product scope changes |
| Replies/references | Stores `referenceId` | Stores and enriches `referenceId` | Keep; define deleted-reference rendering |
| System messages | Historical path filters; live path can store | Same inconsistency | Define one shared message-type policy |
| Crossposts | Loses flags/source semantics | Stores flags, not full provenance | Adopt message flags and preserve available crosspost reference data |
| Forwarded snapshots | Stores first snapshot with metadata | Stores first snapshot with broader components | Keep; fixture origin and nested content |
| Thread starter messages | Fetch-reference plus `primaryChannelId` | `childThreadId` inference and query fallback | Redesign canonical identity; test search and deletion |
| Raw content | Stored | Stored | Keep |
| Search content | Discord.js `cleanContent` | Raw content through Convex | Define stable normalization independent of cache state |
| Embeds | Broad schema; retains type | Broad conversion; drops type | Preserve Velumn fidelity; decide media mirroring |
| Attachments | Relational; selective mirroring | Relational; broad mirroring | Define replacement, empty removal, failure, and object deletion |
| Stickers | Stored and rendered | Stored and rendered | Keep with fixtures |
| Polls | Stored and rendered | Not durably stored | Preserve Velumn support and test updates |
| Components v1 | Buttons only; rendered | More controls stored; pure-v1 not rendered | Add supported select menus and render every stored component |
| Components v2 | Missing | Broad but incomplete | Adopt with explicit conversion/rendering parity and unknown fallback |
| Reactions | Cached aggregate including Unicode | Up to 100 users for custom emoji only | Neither is complete; decide counts versus users |
| Reaction events | Missing | Missing | Add only if live accuracy is required |
| User mentions | Eager metadata | Lazy DB enrichment | Pick ownership and stale-name behavior |
| Channel mentions | Eager metadata | Lazy access-aware enrichment | Preserve IDs; define navigation/access fallback |
| Role mentions | Captures name/color | No durable enrichment | Preserve Velumn behavior |
| Internal Discord links | Broad parser and eager fetch | Narrow parser and lazy enrichment | Combine broad parsing with database-first lazy enrichment and bounded Discord fallback |
| Reverse backlinks | Historical-only, append-only | Missing | Recompute transactionally on create/update/delete and enforce referential cleanup |
| Webhooks | Webhook ID only | Display identity too | Store display name/avatar in message metadata |
| Applications/interactions | Application ID only | Both IDs | Store interaction ID in message metadata |
| Message flags, TTS, nonce | Missing | Stored | Store message flags in metadata; TTS/nonce remain unnecessary |
| Pinned message state | Stored | Stored | Keep |

Conversion sources:

- Velumn: `apps/bot/src/helpers/convertion.ts:92-365`, `apps/bot/src/helpers/convertion.ts:413-591`
- Velumn validation: `packages/db/src/helpers/validation.ts:25-229`
- AO: `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts:163-660`
- AO message schema: `../AnswerOverflow/packages/database/convex/schema.ts:183-425`

### Message lifecycle and relation replacement

AO treats Discord-owned dependent collections as replacement sets while preserving product-owned fields such as solution state:

- `../AnswerOverflow/packages/database/convex/shared/messages.ts:176-279`
- `../AnswerOverflow/packages/database/convex/shared/messages.ts:438-564`

Velumn currently updates only the `db_message` row on `MessageUpdate`; converted attachments and backlinks are not replaced:

- `apps/bot/src/listeners/updates/messages.ts:72-92`
- `packages/db/src/helpers/messages.ts:46-60`

AO is still incorrect when the final attachment or reaction is removed: conversion emits `undefined`, and its mutation interprets that as preserve-existing:

- `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts:654-655`
- `../AnswerOverflow/packages/database/convex/shared/messages.ts:350-388`

Target requirements:

- Define a field ownership matrix: Discord-owned, product-owned, derived, and privacy-owned.
- Distinguish absent/not-fetched from fetched-empty for every collection.
- Replace Discord-owned attachments, reactions, backlinks, embeds, components, stickers, snapshots, and polls explicitly.
- Preserve product-owned fields during Discord refreshes.
- Make create/update/delete idempotent and version-aware.

### Event and reconciliation matrix

Superseded implementation status: the rewritten runtime now loads `apps/bot/src/indexing/events.ts`. The deleted legacy listeners below remain research material only:

- Active entry: `apps/bot/src/main.ts:1-5`
- Active command events: `apps/bot/src/commands/registry.ts:39-83`
- Quarantined API: `apps/bot/src/helpers/trpc.ts:26-31`, `apps/bot/src/helpers/trpc.ts:61-75`

| Lifecycle | Velumn legacy | AnswerOverflow | Target implication |
| --- | --- | --- | --- |
| Guild create/update/delete | Present | Present | Restore through one Effect-owned parity layer |
| Missed guild leave at startup | Missing | Reconciled | Adopt |
| Root channel create | Missing | Present | Adopt |
| Root channel update/delete | Partial | Present, with dependent-cleanup gaps | Define recursive cleanup |
| Thread create/update/delete | Public-thread-focused; inconsistent gates | Public and announcement parity | Share one eligibility policy |
| Message create/update/delete/bulk | Present | Present | Route all mutations through one ordering domain |
| User profile update | Missing | Present | Adopt if identity should stay current |
| Bot permission member/role updates | Missing | Present | Adopt with category/coalescing improvements |
| Reaction add/remove | Missing | Missing | Product decision |
| Periodic create repair | Hourly forward scan | Six-hour forward scan | Required; cadence undecided |
| Missed edits/deletes repair | Missing | Missing | Design bounded repair or state limitation |
| Gateway health/event silence | Basic logging | Active checks and restart | Adopt conceptually |
| Manual run/status | API quarantined | Super-user commands with local lock | Return durable job identity/status |

### Privacy and publication behavior

AO has server publication/anonymization preferences, per-server consent and indexing opt-out, global ignored-account tombstones, and database-boundary rejection of future writes:

- `../AnswerOverflow/packages/database/convex/schema.ts:35-91`
- `../AnswerOverflow/packages/database/convex/shared/messagePrivacy.ts:10-35`
- `../AnswerOverflow/packages/database/convex/private/messages.ts:21-155`
- `../AnswerOverflow/packages/database/convex/private/discord_accounts.ts:84-176`

Velumn has global anonymization and global destructive ignore/redaction. Historical ingestion filters ignored users, but the legacy live path does not enforce the same check and user upsert can overwrite anonymization:

- `packages/db/src/helpers/user.ts:124-182`
- `apps/bot/src/indexing/store.ts:90-127`
- `apps/bot/src/listeners/updates/messages.ts:41-92`
- `packages/db/src/helpers/user.ts:214-273`

AO's exact consent model is not automatically a Velumn requirement. Decide separately:

- Whether administrator channel opt-in is sufficient publication authority.
- Whether global opt-out, per-server opt-out, publication consent, and anonymization are separate controls.
- Whether deletion removes rows or leaves redacted structural tombstones.
- Whether quotes, snapshots, backlinks, mentions, search, cache, and object bytes are included in deletion.
- Whether restore permits future indexing only or triggers historical backfill.

The invariant that transfers directly is persistence-boundary enforcement. No live, historical, retry, or projection writer may bypass current privacy state.

### Velumn capabilities worth preserving

- Poll conversion and rendering.
- Unicode reaction aggregates.
- Role mention metadata.
- Broad Discord-link syntax, including alternate Discord domains.
- Reverse thread backlinks.
- Explicit archived, locked, and pinned thread state.
- Embed type preservation.
- Per-subobject validation that isolates malformed rich content.
- Thread-only publication as a narrower privacy boundary.

Superseded prerequisite: focused conversion fixtures now cover these retained semantics, and the legacy tree has been deleted. The list remains as compatibility history.

### Mature AO patterns to adopt conceptually

- Gateway parity plus scheduled reconciliation as one subsystem.
- Entity-specific parity responsibilities.
- Active-first forum discovery.
- Parent new-thread discovery combined with per-thread staleness.
- Effective permission snapshots and permission-affecting events.
- Privacy checks inside authoritative mutations.
- Replacement semantics for Discord-owned fields while preserving product fields.
- Key-local size-or-time batching after correcting bounds and lifecycle.
- Cache-first versus fetch-required Discord contracts.
- Operator-visible scoped runs and status.
- Real discord.js structures in tests.
- Hierarchical indexing spans.

### AO defects not to copy

- Checkpoints derived from fetched/planned messages instead of durable outcomes.
- Forum checkpoints advancing after failed threads are erased.
- Upserts using keyed queues while deletes bypass them.
- Non-atomic keyed-worker creation.
- Unbounded queues, unlimited partitions, and no idle eviction.
- Queue offer treated as durable completion.
- Failures converted into successful effects at multiple levels.
- Detached guild parity outliving lock ownership.
- Message/media write races and no object orphan recovery.
- Stale relations when an edit removes the final attachment or reaction.
- Unicode reactions omitted and custom reaction users truncated at 100.
- Pure v1 components stored but not rendered.
- Embed type discarded despite type-specific rendering.
- Attempt-based indexing metrics.
- Forward-only reconciliation unable to repair old edits/deletes.
- No direct historical indexing, queue, checkpoint-failure, retry, shutdown, or overlap tests.

Operational sources:

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:239-438`
- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts:795-943`
- `../AnswerOverflow/apps/discord-bot/src/utils/channel-batched-queue.ts:42-111`
- `../AnswerOverflow/apps/discord-bot/src/sync/message.ts:92-356`

### Edge cases the target design must answer

- Message create arrives before the thread row exists.
- Thread starter wrapper identity differs from the stored message identity.
- Thread is deleted while initialization or historical work is queued.
- Public thread becomes private or moves under an ineligible parent.
- Parent becomes NSFW, disabled, or inaccessible to the bot.
- Category overwrite changes many children's effective access.
- Discord 403 permission loss versus 404 deletion.
- Partial fetch fails or returns incomplete author/content data.
- A page mixes system, privacy-skipped, and conversion-failed messages.
- Authoritative commit succeeds but Meili, cache, or storage fails.
- Privacy deletion races queued writes and projection replay.
- Edit removes every dependent rich-content item.
- Delete event is missed while the bot is offline.
- Root deletion must address descendants, backlinks, search, and objects.
- Active/archive caps must not starve current content.
- Shutdown occurs after acceptance but before durable completion.
- Unknown Discord message/component types appear after an upgrade.

Superseded gate: implementation proceeded with the accepted adaptations below and explicit first-release exclusions. Unresolved product questions remain follow-up risks, not an indication that indexing is unimplemented.

### Accepted Velumn adaptations

The following product directions were accepted on 2026-08-09. “Adopt” means reproduce the useful behavior through Velumn's PostgreSQL, MeiliSearch, R2, web, and Effect boundaries rather than copying AO's implementation literally.

| Capability | Velumn target decision |
| --- | --- |
| Channel position | Persist Discord position and use it for stable dashboard/public ordering |
| Categories | Persist category entities/relationships and account for inherited permission changes |
| Missed guild-leave repair | Reconcile Discord guild membership against stored active servers at startup and periodically |
| Announcement metadata | Maintain announcement-channel metadata through create/update/delete parity |
| Root announcement messages | Index messages from explicitly opted-in announcement channels; root text messages stay excluded |
| Forum available tags | Persist the parent forum's current tag definitions, including identity, name, moderation, and emoji |
| Applied thread tags | Replace the thread's current applied-tag set on parity updates and clean it on deletion |
| Announcement threads | Index under the same parent opt-in, permission, NSFW, privacy, and ordering policy as public threads |
| Thread archive state | Keep `archived`, `archivedTimestamp`, and `locked`; timestamp alone cannot represent current archived state |
| Effective bot permissions | Persist effective permissions and last-checked state for diagnostics while checking current permissions before reads |
| User profiles | Handle `UserUpdate` only for Discord users already represented in Velumn's database; do not import unrelated users |
| Reverse backlinks | Replace backlinks transactionally with message updates, remove stale edges, add referential cleanup, and reconcile drift |
| Deleted references | Render an explicit deleted/unavailable reference fallback instead of dropping the reply context |
| Crossposts | Store Discord message flags and available crosspost/reference identity; render provenance only where data is reliable |
| Attachment edits | Treat fetched attachments as a full replacement set, including an explicit empty set |
| Components v1 | Add supported select menus and maintain storage/rendering parity |
| Components v2 | Support a documented subset end to end, retain an unknown fallback, and never silently claim full fidelity |
| User/channel mentions | Store stable IDs, enrich from PostgreSQL at read time, and use bounded Discord fetch fallback when necessary |
| Internal Discord links | Keep Velumn's broad parser, resolve indexed entities database-first, route to Velumn when public, and retain Discord fallback |
| Webhook identity | Store webhook display name/avatar in message metadata alongside the existing `webhookId` column |
| Interaction ID | Store in message metadata; no dedicated SQL column is required |
| Root channel lifecycle | Add create, full update, and recursive delete/disable behavior for supported parents |
| Thread lifecycle | Add create, update, move/privacy transition, and recursive delete behavior through one eligibility policy |
| Bot permission lifecycle | React to bot-member roles, relevant role changes, channel overwrites, category inheritance, and reconciliation |
| Scheduled reconciliation | Run scoped periodic repair through the same coordinator and mutation ordering as gateway work |
| Search | Keep PostgreSQL authoritative and MeiliSearch rebuildable; search documents must derive from committed PostgreSQL state |
| Durable search recovery | Record pending Meili projection work durably so restart or temporary Meili failure cannot permanently lose an update/delete |

Some accepted capabilities require PostgreSQL migrations, especially category/position fields, tags, permission diagnostics, backlink constraints, and durable search projection state. Components, webhook identity, interaction ID, and message flags can extend existing JSON representations without dedicated SQL columns.

### Enrichment policy

“Eager metadata” means resolving names while indexing and storing a snapshot with every message. Current Velumn mention conversion does this for users, channels, and roles. It makes rendering self-contained, but names become stale and conversion may perform extra Discord/cache work.

“Lazy enrichment” means storing stable Discord IDs and resolving their current display data when the message is read. AO largely does this through its database. It keeps names fresher and avoids duplicating metadata, but deleted or inaccessible entities need fallbacks and read queries become more involved.

Velumn's target is hybrid:

1. Stable IDs in message content/metadata are authoritative.
2. Resolve known users, channels, threads, and servers from PostgreSQL at read time.
3. Use stored snapshots where historical presentation matters, especially webhook identity and role color/name.
4. Use bounded Discord fallback only in indexing/reconciliation, never unbounded per-link or per-mention fetch fan-out.
5. Render the raw ID or an unavailable/deleted label when resolution is impossible.

### Crosspost flags

Discord announcement channels can publish a message to follower channels. Discord message flags describe states such as `Crossposted`, `IsCrosspost`, `SourceMessageDeleted`, `HasThread`, `HasSnapshot`, and component-v2 usage. They are a bitfield, not merely display decoration.

Storing the flags allows Velumn to understand why a message has crosspost/snapshot/component behavior and to render a reliable provenance or unavailable-source state. Flags alone do not provide the complete source message; available message-reference identity must also be retained. The target stores the bitfield in message metadata rather than adding one SQL column per flag.

### Search authority and durable recovery

AO uses Convex search indexes over its authoritative Convex records. A successful message mutation and its searchable state live inside one database platform.

Velumn uses PostgreSQL plus external MeiliSearch. This creates a dual-system failure window:

```text
PostgreSQL commit succeeds
        |
        v
process crashes or Meili fails
        |
        v
search remains stale after restart
```

Waiting for a Meili task improves immediate correctness but does not repair a crash between PostgreSQL commit and Meili submission. Durable search recovery means writing a projection record in the same PostgreSQL transaction as the authoritative message/thread/backlink mutation. A scoped worker submits that record to Meili, waits for task completion, and marks it complete. Unfinished records survive restart and are retried or rebuilt.

This applies equally to additions, updates, thread-title changes, deletions, channel disablement, and privacy purges. PostgreSQL remains the truth; Meili is disposable and fully rebuildable.

## How Effect 4 Should Help

Effect does not make indexing reliable automatically. It provides primitives that make the reliability policy explicit and testable.

### Services and layers

One indexing operation can require Discord, repository, search, cache, privacy policy, telemetry, and scheduling without importing globals or threading them manually through every function.

Test layers can substitute deterministic adapters without changing application code.

### Typed failures

The error channel can retain distinctions such as:

- Discord transient failure.
- Discord permission denial.
- Missing or unsupported channel.
- Partial object fetch failure.
- Message conversion defect.
- User privacy rejection.
- PostgreSQL failure.
- Meili task submission failure.
- Meili task completion failure.
- Cache invalidation failure.
- Job cancellation or shutdown timeout.

These distinctions drive retry and completion policy.

### Schedules

Use schedules for:

- Periodic reconciliation.
- Capped transient retries.
- Backoff and jitter.
- Polling Meili task completion.
- Delayed initial thread indexing without unmanaged timers.

Recurrence and retry are separate policies even if both use `Schedule`.

### Scope and fibers

Schedules, queue workers, reconciliation jobs, and event callbacks can have one lifecycle owner. Scoped fibers stop with the bot. Long-lived work should not use detached fibers unless it has an explicit owner outside the caller scope.

### Queues and synchronization

Bounded queues, semaphores, deferred completion, refs, and keyed worker state can express:

- Global scan limits.
- Bounded cross-thread concurrency.
- Per-thread ordering.
- Backpressure.
- Job completion.
- Graceful drain.
- Testable overload behavior.

The implementation must still decide what to do when a queue is full: wait, reject, coalesce, persist, or drop. Dropping authoritative mutations silently is not acceptable.

### TestClock and deterministic tests

Retry, cron, delayed thread indexing, task polling, queue drain, and shutdown timeout behavior can be tested without real sleeps.

### Spans and annotations

Spans can compose from indexing run to guild, channel, thread, page, batch, and projection. Metrics should record outcomes rather than every helper call.

## Proposed Responsibilities

Historical proposal, now superseded by the implemented module map near the top of this document. The responsibility descriptions remain useful design rationale.

### `IndexingPolicy`

- Decide parent/thread eligibility.
- Evaluate current bot permissions.
- Read Velumn indexing settings.
- Apply NSFW and visibility policy.
- Apply privacy policy.
- Return structured rejection reasons rather than booleans.

### `IndexingPlanner`

- Select guilds and parent channels.
- Preserve plan priority and bounded fairness.
- Define active/archive ordering.
- Produce explicit work items with source and reason.

### `IndexingCoordinator`

- Own global run overlap.
- Own per-guild and per-thread ordering.
- Coordinate live parity with reconciliation.
- Bound concurrent Discord reads and downstream writes.
- Expose job status and drain semantics.
- Define single-replica versus distributed lock behavior.

### `DiscordHistory`

- Fetch channels, active threads, archived threads, and message pages.
- Resolve partials according to explicit cache/fetch policy.
- Classify Discord failures and annotate rate-limit/retry context.
- Return scan cursors separately from durable commit checkpoints.

### `MessageConverter`

- Preserve current message representation.
- Separate pure conversion from Discord resolution.
- Bound internal-link and referenced-message fetches.
- Accumulate explicit parse warnings.
- Never decide cursor advancement.

### `IndexBatchCommit`

- Revalidate privacy and policy where required.
- Commit authoritative PostgreSQL mutations.
- Update backlinks and attachments with defined replacement semantics.
- Advance the durable checkpoint only after authoritative commit.
- Emit projection work in authoritative order.

### `SearchProjector`

- Add/update/delete message and thread documents.
- Await task submission and optionally task completion according to policy.
- Retry transient failures.
- Support replay/rebuild and privacy purge.
- Report projection lag.

### `PermissionSync`

- Calculate effective permissions through discord.js.
- Store diagnostics snapshots.
- React to bot member, role, channel overwrite, and category inheritance changes.
- Coalesce safe guild-wide permission refreshes.
- Keep authoritative indexing gates near Discord reads.

### `ReconciliationScheduler`

- Run periodic scans through the coordinator.
- Expose last start, completion, outcome, and next run.
- Prevent overlapping local runs.
- Later support a durable lease if deployment becomes multi-replica.

## Cursor Design Questions

The current single `lastIndexedMessageId` concept may be insufficient.

Potential distinction:

- Scan cursor: greatest Discord item inspected, including intentionally skipped system/ineligible messages.
- Commit checkpoint: greatest item whose required authoritative writes completed.
- Projection checkpoint: greatest authoritative mutation reflected in MeiliSearch.

Open question: whether these need separate persisted fields or whether an outbox/projection ledger provides a cleaner model.

Open question: thread history can receive new messages while its starter is older than the parent-channel cursor. Parent channel cursors alone cannot reliably discover all active text-channel threads. Reconciliation may need an explicit stored-thread scan plus active/archived thread enumeration.

Superseded question: forward pagination alone cannot discover deletions, but reconciliation now fetches stored threads directly, tombstones authoritative 404s, and compares stored containers with the authoritative guild set. Arbitrary old message deletes missed by both gateway and container deletion remain outside this repair boundary.

## Retry Policy Draft

### Retry candidates

- Network transport failures.
- Selected Discord 5xx failures.
- Retry-safe database connectivity failures.
- Meili task submission/completion failures.
- Cache invalidation transport failures.

### Do not automatically retry

- Missing `ViewChannel` or `ReadMessageHistory`.
- Indexing disabled.
- NSFW or unsupported channel.
- Deleted/missing Discord entity when deletion is the expected interpretation.
- Invalid product data requiring code/schema correction.
- Privacy rejection.
- Authentication/configuration failures.

### Required properties

- Bounded attempts.
- Exponential or otherwise increasing delay.
- Jitter.
- Per-attempt timeout.
- Operation idempotency.
- Retry count and final classification in telemetry.
- Respect for bot shutdown interruption.
- No retry loops hidden beneath a successful job result.

Discord.js already manages REST rate-limit buckets. Application retries must complement that behavior, not fight it.

## Bot Permission Synchronization

The target permission model needs two outputs:

### Enforcement

Before reading history, compute current effective permissions and require:

- `ViewChannel`
- `ReadMessageHistory`

Additional permissions may be required for optional features such as invite creation, but invite failure must not necessarily block indexing.

### Diagnostics

Persist the effective bitfield and last checked time so the dashboard can explain why indexing is unavailable or stale.

Permission refresh triggers should include:

- Bot guild-member role changes.
- Updates to roles currently assigned to the bot.
- Relevant role create/delete where effective access can change.
- Channel permission-overwrite changes.
- Category permission-overwrite changes, including affected children.
- Periodic reconciliation to repair missed events.

Open question: exact debounce/coalescing policy for guild-wide permission recomputation.

Open question: whether a permission loss should immediately hide/delete already indexed content or stop future updates while retaining history. This is a product and privacy decision, not merely an implementation detail.

## Consistency And Projection Strategy

PostgreSQL and MeiliSearch cannot share a transaction.

Candidate approach:

1. Commit authoritative PostgreSQL state and checkpoint.
2. Record projection work durably in the same transaction, or make projection state derivable from committed rows.
3. Process Meili mutations in key order.
4. Mark projection completion.
5. Invalidate web caches after the authoritative write and projection policy point.

Superseded decision: `db_meili_projection` is the implemented durable projection ledger. The scoped projector leases rows in partition order and retries failed work across restarts.

Superseded question: schema and helper changes are implemented in `packages/db`, while Effect remains confined to `apps/bot`.

## Operational Controls

Required before production cutover:

- Start a full or scoped reconciliation.
- Inspect whether a run is active.
- Inspect guild/channel/thread progress.
- Cancel a run safely.
- Reset/replay a checkpoint with audit context.
- Retry failed projection work.
- Inspect last successful reconciliation and cursor lag.
- Explain permission/policy rejection.
- Run a dry plan without writes.

API-triggered work should return a job identifier and status rather than reporting success after launching an unobserved background Promise.

## Metrics And Tracing

Candidate metrics:

- Reconciliation runs started/completed/failed/cancelled.
- Guilds/channels/threads planned and skipped by reason.
- Discord pages and messages fetched.
- Messages converted successfully/failed/skipped by policy.
- Authoritative rows inserted/updated/deleted.
- Checkpoint advancement and lag.
- Projection submitted/completed/failed/retried.
- Queue depth, oldest age, and overload count.
- Permission refresh count and changes detected.
- Retry attempts by operation and classification.
- Last successful reconciliation timestamp.
- Shutdown drain duration and abandoned work count.

Span hierarchy should approximately follow:

```text
indexing.run
  indexing.guild
    indexing.channel
      indexing.thread
        indexing.page
          indexing.convert
          indexing.commit
          indexing.project
```

Avoid mixing per-guild and whole-run durations into one metric population.

## Required Test Matrix

### Policy and permissions

- Supported and unsupported parent/thread types.
- NSFW and non-viewable rejection.
- Missing `ViewChannel` or `ReadMessageHistory`.
- Parent indexing disabled across scheduled, manual, thread-create, and live-message paths.
- Bot role and category overwrite changes recalculate affected channels.
- Permission loss behavior after data is already indexed.

### Pagination and discovery

- 0, 1, 100, 101, 10,000, 20,000, and over-cap messages.
- Active threads cannot be starved by archived caps.
- Archived pagination progresses correctly.
- Old text-channel thread with new replies is rediscovered.
- System-message-only page makes progress without creating data.
- Partial message fetch success and failure.

### Checkpoints

- Greatest durable snowflake advances the checkpoint.
- Failed conversion does not create a permanent gap.
- Failed DB commit does not advance.
- Projection failure does not corrupt authoritative checkpoint semantics.
- Replay from an earlier checkpoint is idempotent.
- Reset/replay is scoped and audited.

### Ordering

- Create then update.
- Create then delete before queued commit.
- Update then delete.
- Delayed thread-create index then thread delete.
- Full indexing racing live update/delete.
- Search add racing delete cannot resurrect a document.
- Shutdown while work is queued or active.

### Privacy

- Ignored user content never reaches PostgreSQL or MeiliSearch.
- Existing indexed content is purged on deletion.
- Anonymization survives user sync and full reconciliation.
- Retry after opt-out rechecks current privacy state.
- Search and cache behavior after privacy mutation.

### Retries and overload

- Retryable Discord failure succeeds after bounded retries.
- Permission failure does not retry.
- Meili failure is recoverable after restart.
- Full queue behavior is explicit and tested.
- Retry schedules and delayed indexing use virtual time.

### Conversion compatibility

- Golden fixtures for embeds, attachments, components, polls, snapshots, stickers, reactions, mentions, internal links, backlinks, replies, thread starters, and primary channel semantics.
- Fixtures for default, reply, supported system, crosspost, webhook, application, interaction, forwarded, and unknown future message types.
- Components v1 and the explicitly supported components v2 subset, including unknown-component degradation.
- Edit-to-empty replacement for attachments, embeds, components, stickers, reactions, polls, snapshots, and backlinks.
- Deleted reference, deleted thread starter, and canonical thread identity behavior.
- Announcement-channel root-message and announcement-thread compatibility.
- Bounded internal-link resolution.
- Parsing failure isolation.

## Open Decisions

- Exact eligibility and rendering policy for non-thread messages in opted-in announcement channels.
- Components v2 first-release supported subset and fallback presentation.
- Exact crosspost provenance presentation when the source is missing or inaccessible.
- Reaction model: aggregate counts, reacting users, event maintenance, and Unicode behavior.
- System-message allowlist shared by live and historical paths.
- Field ownership matrix for Discord-owned, product-owned, derived, and privacy-owned fields.
- Absent-versus-empty replacement semantics for every dependent collection.
- Solution relationship as first-release indexing scope or separate product work.
- Administrator channel opt-in versus explicit user consent/publication controls.
- Global versus per-server privacy controls and restore behavior.
- Single-replica guarantee for the first rewritten indexing release.
- Process-local semaphore versus durable indexing lease.
- Exact per-identity ordering key: channel, thread, or another partition.
- Bounded queue size and overload behavior.
- Whether accepted gateway work is persisted before acknowledgment.
- Cursor/checkpoint/outbox schema.
- Meili task completion policy for job success.
- Search rebuild/replay mechanism.
- Permission-loss retention behavior.
- Guild removal retention and deletion policy.
- Superseded: parent-channel deletion recursively tombstones descendants and enqueues ordered search deletion.
- Force reindex semantics for current and historical messages.
- Treatment of message edits and stale backlinks.
- Superseded in part: stored thread/container deletion is repaired and permanently tombstoned; arbitrary individual-message deletion missed while offline remains a bounded-repair product decision.
- Treatment of a public thread becoming private or moving across an opt-in boundary.
- Treatment of parent NSFW, permission, and channel-type changes after publication.
- Whether invite creation belongs in indexing or a separate onboarding capability.
- Fairness and concurrency limits by plan tier.

## Formerly Deferred Until Indexing Implementation

- Implemented: file/module structure, bounded keyed coordinator, database migration, and durable Meili ledger/projector.
- Implemented defaults: three mutation retries with exponential delay, daily reconciliation at `03:00 UTC`, and conservative reconciliation/projector bounds.
- Still deferred: distributed coordination. The cutover assumes one bot replica.

Superseded timing note: the Effect runtime, event bridge, adapters, readiness, shutdown, and command/event tests were completed before indexing implementation.

## Research Log

### 2026-08-08: initial Velumn audit

Confirmed:

- Current checkpointing stores the oldest fetched snowflake even though forward pagination requires a greatest committed snowflake.
- Checkpoint metadata is written before the message batch finishes.
- Scheduled, API, delayed thread, and live event work are not coordinated.
- Thread creation and live messages can bypass current parent indexing policy.
- Search writes are fire-and-forget and can race deletion.
- Privacy deletion/anonymization is not end-to-end and can be undone by later indexing.
- Active threads can be starved by archive caps.
- Current conversion semantics are broad and need golden compatibility tests.

### 2026-08-08: AnswerOverflow indexing audit

Accepted principles:

- Gateway parity plus periodic reconciliation.
- Entity-specific parity responsibilities.
- Effective permission snapshots plus authoritative checks near reads.
- Per-identity write ordering.
- Privacy enforcement at the persistence boundary.
- Declarative scheduling, bounded concurrency, typed failures, and test layers.

Rejected patterns:

- Catching and erasing most failures.
- Unbounded per-channel queues without eviction.
- Routing upserts through a queue while deletes bypass it.
- Treating queue acceptance as durable completion.
- Advancing cursors past failed conversion.
- Letting detached parity work outlive indexing completion and lock ownership.
- Process-local locking without documenting the single-replica assumption.

New questions:

- Whether Velumn needs separate scan, commit, and projection cursors.
- Whether a durable outbox is necessary for Meili correctness across restarts.
- How to rediscover old text-channel threads with new replies.
- How permission loss affects already published content.
- Whether gateway ingestion needs durable acceptance before callback completion.

### 2026-08-09: Executor and AnswerOverflow implementation comparison

- Accepted Executor's narrow Promise-facade boundary, typed operation contracts, capture-once error policy, explicit success-channel failure annotations, scoped worker ownership, bounded analytics delivery, and metadata-only privacy defaults.
- Accepted AnswerOverflow's Discord-specific span/metric placement, gateway-plus-reconciliation model, process-local non-overlap pattern under a single-replica guarantee, and per-entity ordering concept.
- Retained Velumn's scoped `FiberSet` listener bridge instead of AnswerOverflow's manual active-fiber map.
- Rejected AnswerOverflow's unbounded keyed queues, no idle eviction, failure erasure, delete bypass, detached schedule ownership, and unlocked exported core indexing functions. Superseded the earlier claim that its current manual commands bypass the lock: both current manual all-guild and single-guild commands acquire the process-local lock.
- Rejected using Executor's best-effort in-memory analytics requeue as a model for authoritative Meili projection recovery.
- Deferred all coordinator, queue, checkpoint, repository, and projection implementation until the remaining `indexing.md` decisions are resolved.
- Quarantined legacy indexing tRPC procedures behind `SERVICE_UNAVAILABLE` and removed their imports from the rewritten runtime. This makes the old indexing tree disposable without prematurely implementing its replacement.

### 2026-08-09: Discord feature and parity audit

- Confirmed Velumn's legacy publication scope is public-thread messages even though text, announcement, and forum parents are stored.
- Confirmed AO additionally publishes root text/announcement messages and announcement-thread content; this broader product scope is not automatically a Velumn requirement.
- Confirmed AO's broader parity for categories, channel ordering, forum tags, bot permission snapshots, user updates, and solutions.
- Confirmed Velumn's broader fidelity for polls, Unicode reaction aggregates, role mentions, broad Discord links, backlinks, thread state, embed types, and isolated rich-content validation.
- Added a source-backed entity, message-feature, lifecycle, privacy, and operational comparison.
- Recorded AO defects that must not be copied, including cursor advancement after failed work, unbounded/non-atomic keyed queues, delete bypass, stale edit relations, media races, failure erasure, and attempt-based metrics.
- Expanded compatibility tests and open decisions so message types, components v2, tags, reactions, webhook/crosspost metadata, field ownership, consent, and move/privacy transitions cannot be assumed during implementation.
- Kept production code unchanged; this entry is research only.

### 2026-08-09: accepted AO adaptations for Velumn

- Accepted categories, channel positions, forum tags, applied thread tags, announcement metadata, opted-in root announcement messages, and announcement threads.
- Accepted missed guild-leave repair, full supported root/thread lifecycle parity, effective bot-permission synchronization, scoped scheduled reconciliation, and existing-user-only profile updates.
- Accepted robust transactional backlink replacement and cleanup, deleted-reference fallback, complete attachment replacement including empty sets, components v1 selects, and components v2 with an explicit compatibility boundary.
- Chose hybrid mention/link enrichment: stable IDs, PostgreSQL-first read enrichment, historical snapshots where useful, bounded Discord fallback, broad Velumn link parsing, Velumn routing for public indexed targets, and Discord fallback.
- Chose existing message metadata JSON for flags, crosspost/reference context, webhook display identity, and interaction ID rather than dedicated SQL columns.
- Kept explicit `archived`, `archivedTimestamp`, and `locked` fields because Discord's archive timestamp alone records the last state transition, not the current archived boolean.
- Accepted PostgreSQL-authoritative Meili projection with durable restart recovery for add, update, delete, disable, title, and privacy operations.
- Kept root text-channel messages excluded and kept unrelated Discord users out of Velumn's database.

### 2026-08-09: indexing implementation and legacy cutover

- Implemented gateway parity, bounded keyed coordination, classified retries, historical reconciliation, durable jobs/checkpoints, scheduled repair, and the leased Meili projection ledger.
- Added the PostgreSQL indexing migration and package helpers for transactional policy/privacy enforcement, source-version ordering, replacement semantics, backlinks, and projection enqueueing.
- Restored tRPC guild/thread indexing through persisted job acceptance, status, and cancellation; retained only the raw-message diagnostic as explicitly unavailable.
- Added focused policy, conversion, Discord history, event, mutation, coordinator, reconciliation, job, scheduler, projector, lifecycle, and API tests.
- Deleted the Sapphire entrypoint/config, legacy listeners, old conversion helper, `/print-embed`, and old indexing modules. No production fallback imports remain.
- Remaining work is live smoke and deployment verification listed at the top of this document, not implementation of the indexing architecture.

### 2026-08-09: final indexing hardening

- Added a terminal projection `failed` disposition after the tenth attempt, allowing later work in the partition to proceed while preserving operator-visible failure state.
- Added deterministic persisted rotation across capped active and stored thread candidates.
- Added authoritative offline thread/container delete repair and permanent hierarchy tombstones that reject later resurrection.
- Kept the tombstone schema change additive for already-migrated databases; isolated PostgreSQL validation covered the complete migration chain and helper behavior.
- The previous container-tombstone residual risk is superseded. Remaining validation is limited to live Discord, live Meili, and browser smoke; arbitrary missed individual-message deletes remain explicitly outside container repair.
- The bot suite is 115 tests: 16 Bun unit tests and 99 Effect/Vitest tests. Legacy Sapphire and indexing production files remain deleted.
