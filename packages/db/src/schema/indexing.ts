import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { dbChannel, snowflake } from "./discord";

export const indexingJobKindEnum = pgEnum("indexing_job_kind", [
	"full_reconciliation",
	"guild_reconciliation",
	"channel_reconciliation",
	"thread_reconciliation",
	"projection_rebuild",
	"checkpoint_reset",
	"privacy_purge",
]);

export const indexingJobStatusEnum = pgEnum("indexing_job_status", [
	"queued",
	"running",
	"succeeded",
	"partial",
	"failed",
	"cancelled",
]);

export type IndexingJobSummary = {
	planned: number;
	processed: number;
	committed: number;
	skipped: number;
	failed: number;
	projectionsPending: number;
};

export const dbIndexingJob = pgTable(
	"db_indexing_job",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		kind: indexingJobKindEnum("kind").notNull(),
		status: indexingJobStatusEnum("status").notNull().default("queued"),
		trigger: text("trigger").notNull(),
		serverId: snowflake("server_id"),
		channelId: snowflake("channel_id"),
		requestedBy: text("requested_by"),
		idempotencyKey: text("idempotency_key"),
		summary: json("summary").$type<IndexingJobSummary | null>().default(null),
		errorCode: text("error_code"),
		cancellationRequestedAt: timestamp("cancellation_requested_at", {
			mode: "date",
		}),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		startedAt: timestamp("started_at", { mode: "date" }),
		completedAt: timestamp("completed_at", { mode: "date" }),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("indexing_job_idempotency_key_idx").on(table.idempotencyKey),
		index("indexing_job_status_created_at_idx").on(
			table.status,
			table.createdAt,
		),
		index("indexing_job_server_created_at_idx").on(
			table.serverId,
			table.createdAt,
		),
	],
);

export type DBIndexingJob = typeof dbIndexingJob.$inferSelect;
export type DBIndexingJobInsert = typeof dbIndexingJob.$inferInsert;

export const indexingCheckpointKindEnum = pgEnum("indexing_checkpoint_kind", [
	"message_history",
	"archived_thread_discovery",
	"reconciliation_selection",
]);

export const dbIndexingCheckpoint = pgTable(
	"db_indexing_checkpoint",
	{
		channelId: snowflake("channel_id")
			.notNull()
			.references(() => dbChannel.id, { onDelete: "cascade" }),
		kind: indexingCheckpointKindEnum("kind").notNull(),
		scanCursor: snowflake("scan_cursor"),
		commitCursor: snowflake("commit_cursor"),
		updatedByJobId: uuid("updated_by_job_id").references(
			() => dbIndexingJob.id,
			{ onDelete: "set null" },
		),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.channelId, table.kind] })],
);

export type DBIndexingCheckpoint = typeof dbIndexingCheckpoint.$inferSelect;
export type DBIndexingCheckpointInsert =
	typeof dbIndexingCheckpoint.$inferInsert;

export const dbIndexingContainerTombstone = pgTable(
	"db_indexing_container_tombstone",
	{
		containerId: snowflake("container_id").primaryKey(),
		deletedAt: timestamp("deleted_at", { mode: "date" }).notNull(),
	},
);

export type DBIndexingContainerTombstone =
	typeof dbIndexingContainerTombstone.$inferSelect;
export type DBIndexingContainerTombstoneInsert =
	typeof dbIndexingContainerTombstone.$inferInsert;

export const indexingGatewayMutationStatusEnum = pgEnum(
	"indexing_gateway_mutation_status",
	["pending", "processing"],
);

export const dbIndexingGatewayMutation = pgTable(
	"db_indexing_gateway_mutation",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		submissionId: text("submission_id").notNull(),
		orderingKey: text("ordering_key").notNull(),
		mutation: json("mutation").$type<unknown>().notNull(),
		submittedAt: timestamp("submitted_at", { mode: "date" }).notNull(),
		status: indexingGatewayMutationStatusEnum("status")
			.notNull()
			.default("pending"),
		attemptCount: integer("attempt_count").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at", { mode: "date" })
			.notNull()
			.defaultNow(),
		leaseOwner: text("lease_owner"),
		leaseExpiresAt: timestamp("lease_expires_at", { mode: "date" }),
		lastErrorCode: text("last_error_code"),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("indexing_gateway_mutation_submission_id_idx").on(
			table.submissionId,
		),
		index("indexing_gateway_mutation_pending_idx").on(
			table.status,
			table.nextAttemptAt,
			table.id,
		),
		index("indexing_gateway_mutation_ordering_id_idx").on(
			table.orderingKey,
			table.id,
		),
		check(
			"indexing_gateway_mutation_attempt_count_check",
			sql`${table.attemptCount} >= 0`,
		),
	],
);

export type DBIndexingGatewayMutation =
	typeof dbIndexingGatewayMutation.$inferSelect;
export type DBIndexingGatewayMutationInsert =
	typeof dbIndexingGatewayMutation.$inferInsert;

export const meiliProjectionOperationEnum = pgEnum(
	"meili_projection_operation",
	[
		"message_upsert",
		"message_delete",
		"container_refresh",
		"container_delete",
		"server_delete",
		"rebuild",
	],
);

export const meiliProjectionStatusEnum = pgEnum("meili_projection_status", [
	"pending",
	"processing",
	"completed",
	"failed",
]);

export const dbMeiliProjection = pgTable(
	"db_meili_projection",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		operation: meiliProjectionOperationEnum("operation").notNull(),
		entityId: text("entity_id").notNull(),
		partitionKey: text("partition_key").notNull(),
		serverId: snowflake("server_id").notNull(),
		jobId: uuid("job_id").references(() => dbIndexingJob.id, {
			onDelete: "set null",
		}),
		status: meiliProjectionStatusEnum("status").notNull().default("pending"),
		attemptCount: integer("attempt_count").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at", { mode: "date" })
			.notNull()
			.defaultNow(),
		leaseOwner: text("lease_owner"),
		leaseExpiresAt: timestamp("lease_expires_at", { mode: "date" }),
		submittedAt: timestamp("submitted_at", { mode: "date" }),
		meiliTaskUid: integer("meili_task_uid"),
		completedAt: timestamp("completed_at", { mode: "date" }),
		lastErrorCode: text("last_error_code"),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("meili_projection_pending_idx").on(
			table.status,
			table.nextAttemptAt,
			table.id,
		),
		index("meili_projection_partition_id_idx").on(table.partitionKey, table.id),
		index("meili_projection_job_id_idx").on(table.jobId),
		check(
			"meili_projection_attempt_count_check",
			sql`${table.attemptCount} >= 0`,
		),
	],
);

export type DBMeiliProjection = typeof dbMeiliProjection.$inferSelect;
export type DBMeiliProjectionInsert = typeof dbMeiliProjection.$inferInsert;
