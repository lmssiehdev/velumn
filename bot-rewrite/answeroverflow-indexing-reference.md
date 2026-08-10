# AnswerOverflow Indexing Reference

Status: vendored research snapshot

Captured: 2026-08-09

Upstream workspace: `../AnswerOverflow`

Related pinned source: [`discord-api-spec-source.md`](./discord-api-spec-source.md) records the exact external Discord HTTP API preview used for reference without vendoring its JSON.

## Purpose

Preserve the AnswerOverflow indexing and Discord-parity findings that Velumn intends to learn from. This is a behavioral reference, not copied source code and not a requirement to reproduce AO's product scope or implementation literally.

The authoritative Velumn design remains [`indexing.md`](./indexing.md). If upstream AO changes, this snapshot should not silently change with it; rerun the comparison and add a dated research entry.

## Velumn Implementation Status

The accepted adaptations are implemented without copying AO's architecture. Velumn adds stronger guarantees: ten-attempt terminal Meili projection failure, deterministic persisted rotation across capped active/stored thread work, authoritative offline container-delete repair, and permanent hierarchy tombstones that block resurrection. The fairness and tombstone schema changes use additive migrations after the base indexing migration, and the complete chain/helpers were validated in isolated PostgreSQL.

The bot suite currently contains 115 tests: 16 Bun unit tests and 99 Effect/Vitest tests across 18 files. Sapphire and the legacy indexing implementation are deleted. The previous container-tombstone residual risk is superseded; remaining cutover gaps are live Discord, live Meili outage/recovery, and desktop/narrow browser smoke.

## Primary Upstream Sources

- `../AnswerOverflow/apps/discord-bot/src/services/indexing.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/server.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/channel.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/message.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/user.ts`
- `../AnswerOverflow/apps/discord-bot/src/sync/bot-permissions.ts`
- `../AnswerOverflow/apps/discord-bot/src/core/discord-service.ts`
- `../AnswerOverflow/apps/discord-bot/src/utils/conversions.ts`
- `../AnswerOverflow/apps/discord-bot/src/utils/channel-batched-queue.ts`
- `../AnswerOverflow/packages/database/convex/schema.ts`
- `../AnswerOverflow/packages/database/convex/shared/messages.ts`
- `../AnswerOverflow/packages/database/convex/private/messages.ts`
- `../AnswerOverflow/packages/ui/src/components/discord-message/`

## Accepted Velumn Adaptations

| Requested capability | AO behavior | Velumn adaptation |
| --- | --- | --- |
| Channel position | Stores Discord channel position | Persist and use for stable dashboard/public ordering |
| Categories | Stores category entities and relationships | Persist categories and model inherited permission effects |
| Missed guild-leave repair | Compares stored servers with the bot's guild cache at startup | Repair missed leaves at startup and periodically |
| Announcement-channel metadata | Synchronizes announcement roots | Maintain through create/update/delete parity |
| Root announcement messages | Indexes enabled root announcement content | Index only when that announcement channel is explicitly opted in |
| Forum available tags | Stores forum tag definitions | Persist ID, name, moderation state, and emoji |
| Applied thread tags | Synchronizes a thread's current tags | Replace the complete set and clean it on deletion |
| Announcement threads | Treats them as eligible public thread content | Support under the same policy as public threads |
| Thread archive state | Stores archive timestamp | Keep Velumn's `archived`, `archivedTimestamp`, and `locked` fields |
| Effective bot permissions | Stores effective permission bitfield | Store diagnostics and still check current permissions before reads |
| User profiles | Synchronizes broad Discord identity state | Process `UserUpdate` only for users already in Velumn's database |
| Reverse backlinks | AO has no equivalent | Preserve Velumn's feature and make it transactionally correct |
| Deleted-reference fallback | Renders unavailable original-message state | Fix Velumn's unreachable fallback and retain reply context |
| Crosspost flags | Stores Discord message flags | Store flags and available source/reference identity in message metadata |
| Attachment replacement | Reconciles attachment collections, with an empty-set bug | Implement complete replacement and stale-object cleanup |
| Attachment removal to empty | AO accidentally preserves the final removed attachment | Distinguish unknown from fetched-empty and delete all current rows |
| Components v1 selects | Converts selected menu types | Support a documented set and render everything stored |
| Components v2 | Converts a broad subset | Adopt a tested subset with visible unknown fallback |
| User/channel mentions | Primarily enriches stable IDs from its database at read time | Use PostgreSQL-first hybrid enrichment with bounded Discord fallback |
| Internal Discord links | Uses narrow parsing and strong internal routing | Combine Velumn's broad parser with DB-first resolution and Velumn/Discord fallback routing |
| Webhook display identity | Stores webhook author name/avatar metadata | Store in existing message metadata alongside `webhookId` |
| Interaction ID | Stores on AO message records | Store in existing Velumn message metadata without a dedicated SQL column |
| Search | Uses Convex-native search over authoritative records | Keep PostgreSQL authoritative and derive external Meili documents from committed state |
| Root channel create | Synchronizes supported root/category creation | Add through the Effect-owned parity layer |
| Root channel update/delete | Replaces metadata and removes channel records | Add full replacement plus explicit descendant/projection cleanup |
| Thread create/update/delete | Synchronizes public and announcement threads | Add one shared eligibility and ordering policy, including moves/privacy transitions |
| Bot role/permission updates | Resynchronizes affected channel permissions | Adopt and improve category inheritance and burst coalescing |
| Scheduled reconciliation | Runs periodic historical repair | Run through Velumn's scoped coordinator and common mutation path |
| Durable search recovery | Not needed for AO's native Convex search | Add a PostgreSQL-backed Meili projection ledger/outbox |

Root text-channel messages remain excluded. Private threads, DMs, voice messages, and media-channel content remain excluded unless Velumn separately designs their publication and access policy.

## Archive State

Discord's archive timestamp records when the archive state last changed. It does not by itself state whether a thread is currently archived. An active thread can retain a timestamp from its latest transition.

Velumn therefore keeps:

```ts
{
  archived: boolean;
  archivedTimestamp: number | null;
  locked: boolean;
}
```

## Profile Synchronization

AO needs broad identity synchronization because Discord accounts participate in login, consent, memberships, and dashboard access. Velumn's narrower rule is:

```text
UserUpdate -> existing Velumn user? -> update public Discord profile fields
                                  -> otherwise ignore
```

Profile synchronization must never overwrite privacy-owned state such as ignore or anonymization flags.

## Crosspost Flags

Announcement channels can publish messages to follower channels. Relevant Discord message flags include:

- `Crossposted`: an announcement source was published.
- `IsCrosspost`: this message is a published copy.
- `SourceMessageDeleted`: the original source was deleted.
- `HasThread`: the message has an associated thread.
- `HasSnapshot`: the message contains a forwarded snapshot.
- `IsComponentsV2`: component-v2 rules apply.

Flags explain behavior but do not contain complete provenance. Preserve available message-reference/source identity as well. Velumn can store the bitfield and interaction/webhook metadata inside the existing message metadata JSON.

## Mention And Link Enrichment

Eager enrichment resolves names during indexing and stores snapshots with every message. It renders without joins and preserves historical names, but duplicates metadata, becomes stale, and can trigger excessive Discord requests.

Lazy enrichment stores stable IDs and resolves current data at read time. It is fresher and avoids duplication, but requires database lookups and explicit deleted/unavailable fallbacks.

Velumn uses a hybrid:

1. Stable IDs remain authoritative.
2. Resolve indexed users/channels/threads/servers from PostgreSQL at read time.
3. Preserve snapshots where historical identity matters, including webhook name/avatar and role name/color.
4. Bound Discord fallback during indexing/reconciliation.
5. Never fan out unbounded Discord requests per message.
6. Render unavailable/deleted labels when resolution fails.

For internal links, retain Velumn's broad Discord URL support, route public indexed destinations to Velumn, and retain the original Discord URL as fallback.

## Backlink Target

Backlinks are derived authoritative relations:

1. Parse and normalize supported internal links.
2. Compute the desired destination-thread set per source message.
3. Replace that source message's backlink rows in the message transaction.
4. Remove stale edges on edit.
5. Remove outgoing/incoming edges on message/thread deletion through explicit operations and foreign keys where appropriate.
6. Rebuild or reconcile backlinks from stored message content.
7. Apply visibility and privacy rules before exposing an edge.

## Attachment Target

Collection semantics must distinguish:

```ts
attachments: undefined // unknown or not fetched
attachments: []        // fetched and confirmed empty
attachments: [item]    // complete replacement set
```

Message versioning must prevent an older upload completion from patching a newer edit. Object deletion and orphan recovery are separate durable projection work.

## Search And Durable Recovery

AO's search index is native to its authoritative Convex records. Velumn has an external projection:

```text
PostgreSQL authoritative mutation
             |
             v
MeiliSearch add/update/delete task
```

A crash after the PostgreSQL commit but before Meili submission leaves search stale. Waiting for a Meili task does not close that crash window.

Velumn implements this adaptation by writing pending projection work in the same PostgreSQL transaction as the authoritative mutation. A scoped Effect worker submits the Meili operation, waits for completion, and marks the projection record complete. Pending work survives process restart.

Coverage includes:

- Message add/update/delete.
- Thread title and tag changes.
- Root/thread deletion.
- Channel disablement.
- Privacy purge.
- Full projection rebuild.

PostgreSQL remains authoritative. MeiliSearch remains disposable and rebuildable.

## Good Effect Patterns To Retain

- Service and Layer boundaries.
- Scoped resource ownership and finalizers.
- Typed Discord integration errors as a foundation.
- `Schedule.cron` and fixed health schedules.
- Process-local semaphore under an explicit single-replica guarantee.
- `Stream.groupedWithin` for size-or-time batching.
- Key-local mutation ordering as a concept.
- Explicit `Clock`, `Random`, sleeps, and bounded `Effect.forEach` concurrency.
- Hierarchical spans for run, guild, channel, thread, fetch, conversion, commit, and projection.
- Real discord.js structures in test layers.
- Continue processing independent threads after one failure.

## Improvements Required For Velumn

- Classify terminal skips, retryable failures, unresolved failures, and completed work.
- Give every failed thread a durable disposition before discovery cursors forget it.
- Use bounded queues, atomic keyed-worker creation, global concurrency limits, and idle eviction.
- Route create, update, delete, reconciliation, and privacy through the same ordering domain.
- Return work receipts rather than treating queue offer as persistence.
- Preserve partial failures in run summaries instead of converting the whole run to success.
- Add typed bounded retries; AO's indexing code primarily uses pacing and recurrence, not `Effect.retry`.
- Pass cancellation into integrations where supported.
- Avoid detached scheduler/work ownership.
- Advance checkpoints only from durable outcomes or explicit durable skip/retry records.
- Test pagination, races, retries, checkpoints, overload, shutdown drain, projection restart, and edit-to-empty behavior.

## Upstream Caveats

- Failed message conversions can be skipped while the checkpoint advances from fetched messages: `apps/discord-bot/src/services/indexing.ts:367-438`.
- Forum thread errors are isolated, but the parent cursor advances from all planned threads: `apps/discord-bot/src/services/indexing.ts:891-943`.
- Message deletes bypass the keyed upsert queue: `apps/discord-bot/src/sync/message.ts:186-247`.
- Keyed queues are unbounded, created non-atomically, and never evicted: `apps/discord-bot/src/utils/channel-batched-queue.ts:42-111`.
- Empty attachments/reactions become `undefined` and can preserve stale relations: `apps/discord-bot/src/utils/conversions.ts:654-655`.
- AO omits Unicode reactions and fetches at most 100 users per custom reaction: `apps/discord-bot/src/utils/conversions.ts:500-524`.

These caveats do not invalidate AO's architecture. They identify where Velumn should adapt and polish the pattern rather than copy it.
