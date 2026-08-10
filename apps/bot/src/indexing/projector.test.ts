import { assert, describe, it } from "@effect/vitest";
import { Effect, Tracer } from "effect";
import {
	IndexingRepository,
	IndexingRepositoryError,
	type MeiliProjection,
	ProjectionLeaseLostError,
} from "../adapters/indexing-repository";
import {
	type SearchDocument,
	SearchIndex,
	SearchIndexError,
	SearchNotConfiguredError,
} from "../adapters/search";
import { type MeiliProjectorOptions, projectMeiliBatch } from "./projector";

const now = new Date("2026-08-09T00:00:00.000Z");
const options: MeiliProjectorOptions = {
	leaseOwner: "projector-2",
	batchSize: 20,
	partitionConcurrency: 2,
	leaseDurationMs: 30_000,
	initialRetryDelayMs: 100,
	maximumRetryDelayMs: 1_000,
	maximumAttemptCount: 3,
};

const projection = (
	id: number,
	operation: MeiliProjection["operation"],
	overrides: Partial<MeiliProjection> = {},
): MeiliProjection => ({
	id,
	operation,
	entityId: `entity-${id}`,
	partitionKey: "thread-1",
	serverId: "server-1",
	jobId: null,
	status: "pending",
	attemptCount: 0,
	nextAttemptAt: new Date(0),
	leaseOwner: null,
	leaseExpiresAt: null,
	submittedAt: null,
	meiliTaskUid: null,
	completedAt: null,
	lastErrorCode: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	...overrides,
});

const document = (id: string): SearchDocument => ({
	id,
	title: "Thread",
	channelName: "Channel",
	content: `Content ${id}`,
	serverId: "server-1",
	threadId: "thread-1",
	isThreadStarter: false,
	timestamp: 1,
});

const makeRepository = (
	rows: MeiliProjection[],
	sources: ReadonlyMap<number, readonly SearchDocument[]> = new Map(),
) => {
	const released: string[] = [];
	const service = IndexingRepository.of({
		upsertChannelMetadata: () => Effect.die("unused"),
		deleteChannel: () => Effect.die("unused"),
		upsertGuildMetadata: () => Effect.die("unused"),
		guildInstallationExists: () => Effect.die("unused"),
		deleteGuild: () => Effect.die("unused"),
		updateUserProfile: () => Effect.die("unused"),
		reconcilePermissions: () => Effect.die("unused"),
		createJob: () => Effect.die("unused"),
		getJob: () => Effect.die("unused"),
		startJob: () => Effect.die("unused"),
		completeJob: () => Effect.die("unused"),
		requestJobCancellation: () => Effect.die("unused"),
		repairJobs: () => Effect.die("unused"),
		activeServerIds: () => Effect.die("unused"),
		markServerLeft: () => Effect.die("unused"),
		storedCandidates: () => Effect.die("unused"),
		storedSupportedContainers: () => Effect.die("unused"),
		getCheckpoint: () => Effect.die("unused"),
		upsertCheckpoint: () => Effect.die("unused"),
		resetCheckpoint: () => Effect.die("unused"),
		sourceFacts: () => Effect.die("unused"),
		commitMessage: () => Effect.die("unused"),
		deleteMessage: () => Effect.die("unused"),
		deleteThread: () => Effect.die("unused"),
		reconcileThread: () => Effect.die("unused"),
		claim: (input) =>
			Effect.sync(() => {
				const claimed = rows
					.filter(
						(row) =>
							(row.status === "pending" &&
								row.nextAttemptAt <= (input.now ?? new Date())) ||
							(row.status === "processing" &&
								row.leaseExpiresAt !== null &&
								row.leaseExpiresAt <= (input.now ?? new Date())),
					)
					.sort((left, right) => left.id - right.id)
					.slice(0, input.limit);
				for (const row of claimed) {
					row.status = "processing";
					row.attemptCount += 1;
					row.leaseOwner = input.leaseOwner;
					row.leaseExpiresAt = input.leaseExpiresAt;
				}
				return [...claimed].reverse();
			}),
		complete: (id, leaseOwner) =>
			Effect.gen(function* () {
				const row = rows.find((candidate) => candidate.id === id);
				if (row?.status !== "processing" || row.leaseOwner !== leaseOwner) {
					return yield* new ProjectionLeaseLostError({
						operation: "complete",
						projectionId: id,
					});
				}
				row.status = "completed";
				row.completedAt = now;
				row.lastErrorCode = null;
				row.leaseOwner = null;
				row.leaseExpiresAt = null;
			}),
		defer: (id, leaseOwner, errorCode, nextAttemptAt) =>
			Effect.gen(function* () {
				const row = rows.find((candidate) => candidate.id === id);
				if (row?.status !== "processing" || row.leaseOwner !== leaseOwner) {
					return yield* new ProjectionLeaseLostError({
						operation: "defer",
						projectionId: id,
					});
				}
				row.status = "pending";
				row.nextAttemptAt = nextAttemptAt;
				row.lastErrorCode = errorCode;
				row.leaseOwner = null;
				row.leaseExpiresAt = null;
			}),
		fail: (id, leaseOwner, errorCode) =>
			Effect.gen(function* () {
				const row = rows.find((candidate) => candidate.id === id);
				if (row?.status !== "processing" || row.leaseOwner !== leaseOwner) {
					return yield* new ProjectionLeaseLostError({
						operation: "fail",
						projectionId: id,
					});
				}
				row.status = "failed";
				row.completedAt = now;
				row.lastErrorCode = errorCode;
				row.leaseOwner = null;
				row.leaseExpiresAt = null;
			}),
		release: (leaseOwner) =>
			Effect.sync(() => {
				released.push(leaseOwner);
				for (const row of rows) {
					if (row.status === "processing" && row.leaseOwner === leaseOwner) {
						row.status = "pending";
						row.leaseOwner = null;
						row.leaseExpiresAt = null;
					}
				}
			}),
		source: (row) => Effect.succeed(sources.get(row.id) ?? []),
	});
	return { service, released };
};

const makeSearch = (
	events: string[],
	failOperation?:
		| "addDocuments"
		| "updateDocuments"
		| "deleteMessages"
		| "deleteThread",
	terminal = false,
) =>
	SearchIndex.of({
		addDocuments: (documents) =>
			failOperation === "addDocuments"
				? Effect.fail(
						terminal
							? new SearchNotConfiguredError()
							: new SearchIndexError({
									operation: "addDocuments",
									cause: "failed",
								}),
					)
				: Effect.sync(() => events.push(`add:${documents[0]?.id}`)),
		updateDocuments: (documents) =>
			failOperation === "updateDocuments"
				? Effect.fail(
						terminal
							? new SearchNotConfiguredError()
							: new SearchIndexError({
									operation: "updateDocuments",
									cause: "failed",
								}),
					)
				: Effect.sync(() => events.push(`update:${documents[0]?.id}`)),
		deleteMessages: (ids) =>
			failOperation === "deleteMessages"
				? Effect.fail(
						new SearchIndexError({
							operation: "deleteMessages",
							cause: terminal ? { code: "document_not_found" } : "failed",
						}),
					)
				: Effect.sync(() => events.push(`delete:${ids[0]}`)),
		deleteThread: (id) =>
			failOperation === "deleteThread"
				? Effect.fail(
						new SearchIndexError({
							operation: "deleteThread",
							cause: terminal ? { code: "index_not_found" } : "failed",
						}),
					)
				: Effect.sync(() => events.push(`delete-thread:${id}`)),
		updateThreadTitle: () => Effect.void,
		search: () => Effect.die("unused"),
		health: Effect.die("unused"),
	});

const run = (
	repository: IndexingRepository["Service"],
	search: SearchIndex["Service"],
) =>
	projectMeiliBatch(options).pipe(
		Effect.provideService(IndexingRepository, repository),
		Effect.provideService(SearchIndex, search),
	);

describe("Meili projector", () => {
	it.effect("preserves add, update, and delete order within a partition", () =>
		Effect.gen(function* () {
			const rows = [
				projection(1, "message_upsert"),
				projection(2, "container_refresh"),
				projection(3, "message_delete"),
				projection(4, "server_delete"),
			];
			const repository = makeRepository(
				rows,
				new Map([
					[1, [document("message-1")]],
					[2, [document("message-2")]],
				]),
			);
			const events: string[] = [];

			assert.deepEqual(yield* run(repository.service, makeSearch(events)), {
				claimedCount: 4,
				failedCount: 0,
			});
			assert.deepEqual(events, [
				"add:message-1",
				"update:message-2",
				"delete:entity-3",
			]);
			assert.deepEqual(
				rows.map((row) => row.status),
				["completed", "completed", "completed", "completed"],
			);
			assert.deepEqual(repository.released, [options.leaseOwner]);
		}),
	);

	it.effect("does not trace repeated empty polls", () =>
		Effect.gen(function* () {
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});
			const repository = makeRepository([]);

			yield* run(repository.service, makeSearch([])).pipe(
				Effect.andThen(run(repository.service, makeSearch([]))),
				Effect.provideService(Tracer.Tracer, tracer),
			);

			assert.deepEqual(spans, []);
		}),
	);

	it.effect(
		"defers a typed SearchIndex failure with bounded retry timing",
		() =>
			Effect.gen(function* () {
				const row = projection(1, "container_refresh");
				const laterRow = projection(2, "message_delete");
				const repository = makeRepository(
					[row, laterRow],
					new Map([[1, [document("message-1")]]]),
				);
				const events: string[] = [];
				const spans: Tracer.NativeSpan[] = [];
				const tracer = Tracer.make({
					span: (spanOptions) => {
						const span = new Tracer.NativeSpan(spanOptions);
						spans.push(span);
						return span;
					},
				});

				yield* run(
					repository.service,
					makeSearch(events, "updateDocuments"),
				).pipe(
					Effect.provideService(Tracer.Tracer, tracer),
				);
				assert.equal(row.status, "pending");
				assert.equal(row.lastErrorCode, "SearchIndexError:updateDocuments");
				assert.equal(row.nextAttemptAt.getTime(), 100);
				assert.equal(laterRow.status, "pending");
				assert.deepEqual(events, []);
				const projectionSpan = spans.find(
					(span) => span.name === "projector.projection",
				);
				assert.equal(
					projectionSpan?.attributes.get("operation.outcome"),
					"deferred",
				);
				assert.equal(
					projectionSpan?.attributes.get("error.classification"),
					"SearchIndexError:updateDocuments",
				);
				const batchSpan = spans.find((span) => span.name === "projector.poll");
				assert.equal(batchSpan?.attributes.get("batch.claimed_count"), 2);
				assert.equal(batchSpan?.attributes.get("batch.failed_count"), 0);
			}),
	);

	it.effect("does not annotate completed when completing loses the lease", () =>
		Effect.gen(function* () {
			const row = projection(1, "message_delete");
			const repository = makeRepository([row]);
			const service = IndexingRepository.of({
				...repository.service,
				complete: (id) =>
					Effect.fail(
						new ProjectionLeaseLostError({
							operation: "complete",
							projectionId: id,
						}),
					),
			});
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});

			const error = yield* run(
				service,
				makeSearch([], "deleteMessages", true),
			).pipe(Effect.provideService(Tracer.Tracer, tracer), Effect.flip);

			assert.equal(error._tag, "ProjectionLeaseLostError");
			const projectionSpan = spans.find(
				(span) => span.name === "projector.projection",
			);
			assert.equal(projectionSpan?.attributes.has("operation.outcome"), false);
			assert.equal(projectionSpan?.status._tag, "Ended");
		}),
	);

	it.effect("does not annotate failed when persisting failure fails", () =>
		Effect.gen(function* () {
			const row = projection(1, "message_upsert");
			const repository = makeRepository(
				[row],
				new Map([[1, [document("message-1")]]]),
			);
			const service = IndexingRepository.of({
				...repository.service,
				fail: () =>
					Effect.fail(
						new IndexingRepositoryError({
							operation: "fail",
							cause: "failed",
						}),
					),
			});
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});

			const error = yield* run(
				service,
				makeSearch([], "addDocuments", true),
			).pipe(Effect.provideService(Tracer.Tracer, tracer), Effect.flip);

			assert.equal(error._tag, "IndexingRepositoryError");
			const projectionSpan = spans.find(
				(span) => span.name === "projector.projection",
			);
			assert.equal(projectionSpan?.attributes.has("operation.outcome"), false);
			assert.equal(projectionSpan?.status._tag, "Ended");
		}),
	);

	it.effect("does not annotate deferred when deferring loses the lease", () =>
		Effect.gen(function* () {
			const row = projection(1, "container_refresh");
			const repository = makeRepository(
				[row],
				new Map([[1, [document("message-1")]]]),
			);
			const service = IndexingRepository.of({
				...repository.service,
				defer: (id) =>
					Effect.fail(
						new ProjectionLeaseLostError({
							operation: "defer",
							projectionId: id,
						}),
					),
			});
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (spanOptions) => {
					const span = new Tracer.NativeSpan(spanOptions);
					spans.push(span);
					return span;
				},
			});

			const error = yield* run(service, makeSearch([], "updateDocuments")).pipe(
				Effect.provideService(Tracer.Tracer, tracer),
				Effect.flip,
			);

			assert.equal(error._tag, "ProjectionLeaseLostError");
			const projectionSpan = spans.find(
				(span) => span.name === "projector.projection",
			);
			assert.equal(projectionSpan?.attributes.has("operation.outcome"), false);
			assert.equal(projectionSpan?.status._tag, "Ended");
		}),
	);

	it.effect("marks a retryable failure failed after its final attempt", () =>
		Effect.gen(function* () {
			const row = projection(1, "container_refresh", {
				attemptCount: options.maximumAttemptCount - 1,
			});
			const repository = makeRepository(
				[row],
				new Map([[1, [document("message-1")]]]),
			);

			assert.deepEqual(
				yield* run(repository.service, makeSearch([], "updateDocuments")),
				{ claimedCount: 1, failedCount: 1 },
			);
			assert.equal(row.status, "failed");
			assert.equal(row.attemptCount, options.maximumAttemptCount);
			assert.equal(row.lastErrorCode, "SearchIndexError:updateDocuments");
			assert.deepEqual(row.completedAt, now);
		}),
	);

	it.effect(
		"keeps deletion projections retryable past attempt ten and eventually succeeds",
		() =>
			Effect.gen(function* () {
				const row = projection(1, "message_delete", { attemptCount: 10 });
				const repository = makeRepository([row]);

				assert.deepEqual(
					yield* run(repository.service, makeSearch([], "deleteMessages")),
					{ claimedCount: 1, failedCount: 0 },
				);
				assert.equal(row.status, "pending");
				assert.equal(row.attemptCount, 11);
				assert.equal(row.nextAttemptAt.getTime(), options.maximumRetryDelayMs);
				assert.equal(row.lastErrorCode, "SearchIndexError:deleteMessages");

				row.nextAttemptAt = new Date(0);
				const events: string[] = [];
				yield* run(repository.service, makeSearch(events));
				assert.equal(row.status, "completed");
				assert.equal(row.attemptCount, 12);
				assert.equal(row.lastErrorCode, null);
				assert.deepEqual(events, ["delete:entity-1"]);
			}),
	);

	it.effect(
		"reclaims an expired deletion after restart beyond the retry limit",
		() =>
			Effect.gen(function* () {
				const row = projection(1, "container_delete", {
					status: "processing",
					attemptCount: 10,
					leaseOwner: "stopped-projector",
					leaseExpiresAt: new Date(-1),
					lastErrorCode: "SearchIndexError:deleteThread",
				});
				const repository = makeRepository([row]);
				const events: string[] = [];

				yield* run(repository.service, makeSearch(events));
				assert.equal(row.status, "completed");
				assert.equal(row.attemptCount, 11);
				assert.equal(row.leaseOwner, null);
				assert.deepEqual(events, ["delete-thread:entity-1"]);
			}),
	);

	it.effect(
		"completes terminal not-found deletion as an idempotent success",
		() =>
			Effect.gen(function* () {
				const row = projection(1, "container_delete", { attemptCount: 10 });
				const repository = makeRepository([row]);

				assert.deepEqual(
					yield* run(repository.service, makeSearch([], "deleteThread", true)),
					{ claimedCount: 1, failedCount: 0 },
				);
				assert.equal(row.status, "completed");
				assert.equal(row.attemptCount, 11);
				assert.equal(row.lastErrorCode, null);
			}),
	);

	it.effect("retries source-missing purge work indefinitely", () =>
		Effect.gen(function* () {
			const row = projection(1, "message_upsert", { attemptCount: 10 });
			const repository = makeRepository([row]);

			yield* run(repository.service, makeSearch([], "deleteMessages"));
			assert.equal(row.status, "pending");
			assert.equal(row.attemptCount, 11);
			assert.equal(row.lastErrorCode, "SearchIndexError:deleteMessages");
		}),
	);

	it.effect("marks a terminal failure failed without exhausting attempts", () =>
		Effect.gen(function* () {
			const row = projection(1, "message_upsert");
			const repository = makeRepository(
				[row],
				new Map([[1, [document("message-1")]]]),
			);

			yield* run(repository.service, makeSearch([], "addDocuments", true));
			assert.equal(row.status, "failed");
			assert.equal(row.attemptCount, 1);
			assert.equal(row.lastErrorCode, "SearchNotConfiguredError");
		}),
	);

	it.effect(
		"continues a partition after a failed row is durably terminal",
		() =>
			Effect.gen(function* () {
				const failedRow = projection(1, "container_refresh", {
					attemptCount: options.maximumAttemptCount - 1,
				});
				const laterRow = projection(2, "message_delete");
				const repository = makeRepository(
					[failedRow, laterRow],
					new Map([[1, [document("message-1")]]]),
				);
				const events: string[] = [];

				assert.deepEqual(
					yield* run(repository.service, makeSearch(events, "updateDocuments")),
					{ claimedCount: 2, failedCount: 1 },
				);
				assert.equal(failedRow.status, "failed");
				assert.equal(laterRow.status, "completed");
				assert.deepEqual(events, ["delete:entity-2"]);
			}),
	);

	it.effect("reclaims expired work and pending work after a restart", () =>
		Effect.gen(function* () {
			const rows = [
				projection(2, "message_delete"),
				projection(1, "message_upsert", {
					status: "processing",
					leaseOwner: "stopped-projector",
					leaseExpiresAt: new Date(-1),
				}),
			];
			const repository = makeRepository(
				rows,
				new Map([[1, [document("recovered")]]]),
			);
			const events: string[] = [];

			assert.deepEqual(yield* run(repository.service, makeSearch(events)), {
				claimedCount: 2,
				failedCount: 0,
			});
			assert.deepEqual(events, ["add:recovered", "delete:entity-2"]);
			assert.deepEqual(
				rows.map((row) => row.status),
				["completed", "completed"],
			);
		}),
	);

	it.effect("removes stale search data when an upsert source disappears", () =>
		Effect.gen(function* () {
			const rows = [
				projection(1, "message_upsert"),
				projection(2, "container_refresh", { partitionKey: "thread-2" }),
			];
			const repository = makeRepository(rows);
			const events: string[] = [];

			yield* run(repository.service, makeSearch(events));
			assert.deepEqual(events.sort(), [
				"delete-thread:entity-2",
				"delete:entity-1",
			]);
			assert.deepEqual(
				rows.map((row) => row.status),
				["completed", "completed"],
			);
		}),
	);
});
