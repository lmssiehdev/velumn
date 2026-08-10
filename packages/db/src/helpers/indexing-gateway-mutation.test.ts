import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

process.env.DATABASE_URL ??= "postgres://localhost/velumn_test";

describe("indexing gateway mutation persistence", () => {
	it("returns the existing row when a submission is enqueued twice", async () => {
		const [{ enqueueIndexingGatewayMutation }, { dbIndexingGatewayMutation }] =
			await Promise.all([import("./indexing"), import("../schema")]);
		const persisted = { id: 1, submissionId: "gateway:event:entity:1" };
		let conflictTarget: unknown;
		const database = {
			insert: () => ({
				values: () => ({
					onConflictDoUpdate: (options: { target: unknown }) => {
						conflictTarget = options.target;
						return { returning: async () => [persisted] };
					},
				}),
			}),
		};

		const result = await enqueueIndexingGatewayMutation(
			{
				submissionId: persisted.submissionId,
				orderingKey: "content:thread-1",
				mutation: { _tag: "DeleteMessage" },
				submittedAt: new Date(1),
			},
			database as never,
		);

		assert.equal(result, persisted);
		assert.equal(conflictTarget, dbIndexingGatewayMutation.submissionId);
	});

	it("persists distinct same-millisecond event identities", async () => {
		const { enqueueIndexingGatewayMutation } = await import("./indexing");
		const stored = new Map<string, { id: number; submissionId: string }>();
		const database = {
			insert: () => ({
				values: (input: { submissionId: string }) => ({
					onConflictDoUpdate: () => ({
						returning: async () => {
							const existing = stored.get(input.submissionId);
							if (existing) return [existing];
							const row = {
								id: stored.size + 1,
								submissionId: input.submissionId,
							};
							stored.set(input.submissionId, row);
							return [row];
						},
					}),
				}),
			}),
		};
		const input = {
			orderingKey: "content:thread-1",
			mutation: { _tag: "DeleteMessage" },
			submittedAt: new Date(1),
		};

		await enqueueIndexingGatewayMutation(
			{ ...input, submissionId: "gateway:event:entity:1:identity-a" },
			database as never,
		);
		await enqueueIndexingGatewayMutation(
			{ ...input, submissionId: "gateway:event:entity:1:identity-b" },
			database as never,
		);

		assert.equal(stored.size, 2);
	});

	it("claims expired work but never skips earlier work for an ordering key", async () => {
		const { claimIndexingGatewayMutationBatch } = await import("./indexing");
		let statement = "";
		const database = {
			execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
				statement = new PgDialect().sqlToQuery(query).sql.replace(/\s+/g, " ");
				return { rows: [] };
			},
		};

		await claimIndexingGatewayMutationBatch(
			{
				leaseOwner: "worker-2",
				leaseExpiresAt: new Date(3_000),
				limit: 10,
				now: new Date(2_000),
			},
			database as never,
		);

		assert.match(
			statement,
			/"status" = 'processing' and "db_indexing_gateway_mutation"\."lease_expires_at" <= \$\d+/,
		);
		assert.match(
			statement,
			/not exists \( select 1 from "db_indexing_gateway_mutation" as earlier where earlier\.ordering_key = "db_indexing_gateway_mutation"\."ordering_key" and earlier\.id < "db_indexing_gateway_mutation"\."id" \)/,
		);
		assert.match(statement, /for update skip locked/);
		assert.match(statement, /attempt_count = mutation\.attempt_count \+ 1/);
		assert.match(statement, /mutation\.attempt_count as "attemptCount"/);
	});

	it("decodes pg driver claim values into the declared runtime shape", async () => {
		const { claimIndexingGatewayMutationBatch } = await import("./indexing");
		const database = {
			execute: async () => ({
				rows: [
					{
						id: "42",
						submissionId: "gateway:event:42",
						orderingKey: "content:thread-1",
						mutation: JSON.stringify({ _tag: "DeleteMessage" }),
						submittedAt: "2026-08-09 12:34:56.789",
						status: "processing",
						attemptCount: "3",
						nextAttemptAt: "2026-08-09 12:35:00",
						leaseOwner: "worker-1",
						leaseExpiresAt: "2026-08-09 12:40:00",
						lastErrorCode: null,
						createdAt: "2026-08-09 12:30:00",
						updatedAt: "2026-08-09 12:34:56.789",
					},
				],
			}),
		};

		const [claimed] = await claimIndexingGatewayMutationBatch(
			{
				leaseOwner: "worker-1",
				leaseExpiresAt: new Date(2_000),
				limit: 1,
				now: new Date(1_000),
			},
			database as never,
		);

		assert.ok(claimed);
		assert.equal(claimed.id, 42);
		assert.equal(claimed.attemptCount, 3);
		assert.deepEqual(claimed.mutation, { _tag: "DeleteMessage" });
		assert.equal(claimed.submittedAt.toISOString(), "2026-08-09T12:34:56.789Z");
		assert.equal(
			claimed.nextAttemptAt.toISOString(),
			"2026-08-09T12:35:00.000Z",
		);
		assert.equal(
			claimed.leaseExpiresAt?.toISOString(),
			"2026-08-09T12:40:00.000Z",
		);
		assert.equal(claimed.createdAt.toISOString(), "2026-08-09T12:30:00.000Z");
		assert.equal(claimed.updatedAt.toISOString(), "2026-08-09T12:34:56.789Z");
	});

	it("rejects unsafe IDs and invalid timestamps instead of corrupting claims", async () => {
		const {
			claimIndexingGatewayMutationBatch,
			IndexingGatewayMutationRowDecodeError,
		} = await import("./indexing");
		const validRow = {
			id: "1",
			submissionId: "gateway:event:1",
			orderingKey: "content:thread-1",
			mutation: { _tag: "DeleteMessage" },
			submittedAt: "2026-08-09 12:34:56",
			status: "processing",
			attemptCount: "1",
			nextAttemptAt: "2026-08-09 12:35:00",
			leaseOwner: "worker-1",
			leaseExpiresAt: null,
			lastErrorCode: null,
			createdAt: "2026-08-09 12:30:00",
			updatedAt: "2026-08-09 12:34:56",
		};
		const claim = (row: Record<string, unknown>) =>
			claimIndexingGatewayMutationBatch(
				{
					leaseOwner: "worker-1",
					leaseExpiresAt: new Date(2_000),
					limit: 1,
					now: new Date(1_000),
				},
				{ execute: async () => ({ rows: [row] }) } as never,
			);

		await assert.rejects(
			claim({ ...validRow, id: "9007199254740992" }),
			(error: unknown) =>
				error instanceof IndexingGatewayMutationRowDecodeError &&
				error.field === "id",
		);
		await assert.rejects(
			claim({ ...validRow, submittedAt: "not-a-timestamp" }),
			(error: unknown) =>
				error instanceof IndexingGatewayMutationRowDecodeError &&
				error.field === "submittedAt",
		);
	});

	it("fences every claim mutation by id, owner, and generation", async () => {
		const {
			completeIndexingGatewayMutation,
			deferIndexingGatewayMutation,
			releaseIndexingGatewayMutationClaim,
			renewIndexingGatewayMutationLease,
		} = await import("./indexing");
		const statements: string[] = [];
		const database = {
			execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
				statements.push(
					new PgDialect().sqlToQuery(query).sql.replace(/\s+/g, " "),
				);
				return { rows: [] };
			},
		};

		assert.equal(
			await completeIndexingGatewayMutation(7, "owner-a", 3, database as never),
			false,
		);
		assert.equal(
			await deferIndexingGatewayMutation(
				7,
				"owner-a",
				3,
				"indexing:defect",
				new Date(4_000),
				database as never,
			),
			false,
		);
		assert.equal(
			await renewIndexingGatewayMutationLease(
				7,
				"owner-a",
				3,
				new Date(5_000),
				database as never,
			),
			false,
		);
		assert.equal(
			await releaseIndexingGatewayMutationClaim(
				7,
				"owner-a",
				3,
				database as never,
			),
			false,
		);

		assert.equal(statements.length, 4);
		for (const statement of statements) {
			assert.match(statement, /"id" = \$\d+/);
			assert.match(statement, /"lease_owner" = \$\d+/);
			assert.match(statement, /"attempt_count" = \$\d+/);
		}
		assert.match(
			statements[2] ?? "",
			/"lease_expires_at" > clock_timestamp\(\)/,
		);
	});

	it("uses claim-specific release rather than owner-wide cleanup", async () => {
		const { releaseIndexingGatewayMutationClaim } = await import("./indexing");
		const statements: string[] = [];
		const database = {
			execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
				statements.push(
					new PgDialect().sqlToQuery(query).sql.replace(/\s+/g, " "),
				);
				return { rows: [{ id: statements.length }] };
			},
		};

		await releaseIndexingGatewayMutationClaim(
			11,
			"shared-owner",
			4,
			database as never,
		);
		await releaseIndexingGatewayMutationClaim(
			12,
			"shared-owner",
			9,
			database as never,
		);

		assert.equal(statements.length, 2);
		for (const statement of statements) {
			assert.match(statement, /"id" = \$\d+/);
			assert.match(statement, /"attempt_count" = \$\d+/);
		}
	});
});
