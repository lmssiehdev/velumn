import { assert, describe, it } from "@effect/vitest";
import type { DBIndexingJob } from "@repo/db/schema/index";
import { Effect } from "effect";
import { SearchIndex } from "../adapters/search";
import { ReconciliationJobs } from "../indexing/jobs";
import { Readiness } from "../runtime/readiness";
import { makeBotApiOperations } from "./operations";

const acceptedJob: DBIndexingJob = {
	id: "123e4567-e89b-42d3-a456-426614174000",
	kind: "guild_reconciliation",
	status: "queued",
	trigger: "manual",
	serverId: "123456789012345678",
	channelId: null,
	requestedBy: null,
	idempotencyKey: null,
	summary: null,
	errorCode: null,
	cancellationRequestedAt: null,
	createdAt: new Date(0),
	startedAt: null,
	completedAt: null,
	updatedAt: new Date(0),
};

describe("BotApiOperations", () => {
	it.effect("does not let HTTP cancellation outlive durable acceptance", () => {
		let starts = 0;
		let acceptJob!: (job: DBIndexingJob) => void;
		const acceptance = new Promise<DBIndexingJob>((resolve) => {
			acceptJob = resolve;
		});
		const jobs = ReconciliationJobs.of({
			repairStartup: Effect.die("not used"),
			startGuild: () =>
				Effect.sync(() => {
					starts++;
				}).pipe(Effect.andThen(Effect.promise(() => acceptance))),
			startThread: () => Effect.die("not used"),
			startScheduled: () => Effect.die("not used"),
			get: () => Effect.die("not used"),
			cancel: () => Effect.die("not used"),
		});

		return Effect.gen(function* () {
			const operations = yield* makeBotApiOperations();
			yield* Effect.promise(async () => {
				const alreadyAborted = new AbortController();
				alreadyAborted.abort();
				let abortError: unknown;
				try {
					operations.startGuildReconciliation(
						acceptedJob.serverId as string,
						{ trigger: "index-server" },
						alreadyAborted.signal,
					);
				} catch (error) {
					abortError = error;
				}
				assert.instanceOf(abortError, DOMException);
				assert.strictEqual((abortError as DOMException).name, "AbortError");
				assert.strictEqual(starts, 0);

				const request = new AbortController();
				const result = operations.startGuildReconciliation(
					acceptedJob.serverId as string,
					{ trigger: "index-server" },
					request.signal,
				);
				request.abort();
				acceptJob(acceptedJob);
				assert.deepStrictEqual(await result, {
					ok: true,
					value: { id: acceptedJob.id, status: "queued" },
				});
				assert.strictEqual(starts, 1);
			});
		}).pipe(
			Effect.provideService(ReconciliationJobs, jobs),
			Effect.provideService(
				SearchIndex,
				SearchIndex.of({
					addDocuments: () => Effect.void,
					updateDocuments: () => Effect.void,
					deleteMessages: () => Effect.void,
					deleteThread: () => Effect.void,
					updateThreadTitle: () => Effect.void,
					search: () => Effect.die("not used"),
					health: Effect.die("not used"),
				}),
			),
			Effect.provide(Readiness.layer),
			Effect.scoped,
		);
	});
});
