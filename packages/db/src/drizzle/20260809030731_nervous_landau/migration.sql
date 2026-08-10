CREATE TYPE "indexing_checkpoint_kind" AS ENUM('message_history', 'archived_thread_discovery');--> statement-breakpoint
CREATE TYPE "indexing_job_kind" AS ENUM('full_reconciliation', 'guild_reconciliation', 'channel_reconciliation', 'thread_reconciliation', 'projection_rebuild', 'checkpoint_reset', 'privacy_purge');--> statement-breakpoint
CREATE TYPE "indexing_job_status" AS ENUM('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "meili_projection_operation" AS ENUM('message_upsert', 'message_delete', 'container_refresh', 'container_delete', 'server_delete', 'rebuild');--> statement-breakpoint
CREATE TYPE "meili_projection_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "db_channel_applied_tag" (
	"channel_id" bigint,
	"tag_id" bigint,
	CONSTRAINT "db_channel_applied_tag_pkey" PRIMARY KEY("channel_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "db_forum_tag" (
	"id" bigint PRIMARY KEY,
	"channel_id" bigint NOT NULL,
	"name" varchar NOT NULL,
	"moderated" boolean DEFAULT false NOT NULL,
	"emoji_id" bigint,
	"emoji_name" varchar
);
--> statement-breakpoint
CREATE TABLE "db_indexing_checkpoint" (
	"channel_id" bigint,
	"kind" "indexing_checkpoint_kind",
	"scan_cursor" bigint,
	"commit_cursor" bigint,
	"updated_by_job_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "db_indexing_checkpoint_pkey" PRIMARY KEY("channel_id","kind")
);
--> statement-breakpoint
CREATE TABLE "db_indexing_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" "indexing_job_kind" NOT NULL,
	"status" "indexing_job_status" DEFAULT 'queued'::"indexing_job_status" NOT NULL,
	"trigger" text NOT NULL,
	"server_id" bigint,
	"channel_id" bigint,
	"requested_by" text,
	"idempotency_key" text,
	"summary" json DEFAULT 'null',
	"error_code" text,
	"cancellation_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "db_meili_projection" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "db_meili_projection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"operation" "meili_projection_operation" NOT NULL,
	"entity_id" text NOT NULL,
	"partition_key" text NOT NULL,
	"server_id" bigint NOT NULL,
	"job_id" uuid,
	"status" "meili_projection_status" DEFAULT 'pending'::"meili_projection_status" NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp,
	"submitted_at" timestamp,
	"meili_task_uid" integer,
	"completed_at" timestamp,
	"last_error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meili_projection_attempt_count_check" CHECK ("attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "bot_permissions" text;--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "bot_permissions_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "db_message" ADD COLUMN "source_version" bigint;--> statement-breakpoint
UPDATE "db_message"
SET "source_version" = ("id" / 4194304) + 1420070400000
WHERE "source_version" IS NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "source_version" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "source_version" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "forum_tag_channel_id_idx" ON "db_forum_tag" ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "indexing_job_idempotency_key_idx" ON "db_indexing_job" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "indexing_job_status_created_at_idx" ON "db_indexing_job" ("status","created_at");--> statement-breakpoint
CREATE INDEX "indexing_job_server_created_at_idx" ON "db_indexing_job" ("server_id","created_at");--> statement-breakpoint
CREATE INDEX "meili_projection_pending_idx" ON "db_meili_projection" ("status","next_attempt_at","id");--> statement-breakpoint
CREATE INDEX "meili_projection_partition_id_idx" ON "db_meili_projection" ("partition_key","id");--> statement-breakpoint
CREATE INDEX "meili_projection_job_id_idx" ON "db_meili_projection" ("job_id");--> statement-breakpoint
UPDATE "db_channel" AS "channel"
SET "parent_id" = NULL
WHERE "channel"."parent_id" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "db_channel" AS "parent"
		WHERE "parent"."id" = "channel"."parent_id"
	);--> statement-breakpoint
ALTER TABLE "db_channel" ADD CONSTRAINT "channel_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "db_channel"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "db_channel_applied_tag" ADD CONSTRAINT "db_channel_applied_tag_channel_id_db_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "db_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "db_channel_applied_tag" ADD CONSTRAINT "db_channel_applied_tag_tag_id_db_forum_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "db_forum_tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "db_forum_tag" ADD CONSTRAINT "db_forum_tag_channel_id_db_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "db_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
DELETE FROM "thread_backlink" AS "backlink"
WHERE NOT EXISTS (
		SELECT 1
		FROM "db_message" AS "message"
		WHERE "message"."id" = "backlink"."from_message_id"
	)
	OR NOT EXISTS (
		SELECT 1
		FROM "db_channel" AS "target_thread"
		WHERE "target_thread"."id" = "backlink"."to_thread_id"
	)
	OR NOT EXISTS (
		SELECT 1
		FROM "db_channel" AS "source_thread"
		WHERE "source_thread"."id" = "backlink"."from_thread_id"
	);--> statement-breakpoint
ALTER TABLE "thread_backlink" ADD CONSTRAINT "thread_backlink_from_message_id_db_message_id_fkey" FOREIGN KEY ("from_message_id") REFERENCES "db_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "thread_backlink" ADD CONSTRAINT "thread_backlink_to_thread_id_db_channel_id_fkey" FOREIGN KEY ("to_thread_id") REFERENCES "db_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "thread_backlink" ADD CONSTRAINT "thread_backlink_from_thread_id_db_channel_id_fkey" FOREIGN KEY ("from_thread_id") REFERENCES "db_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "db_indexing_checkpoint" ADD CONSTRAINT "db_indexing_checkpoint_channel_id_db_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "db_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "db_indexing_checkpoint" ADD CONSTRAINT "db_indexing_checkpoint_6SBC7UEhGSaq_fkey" FOREIGN KEY ("updated_by_job_id") REFERENCES "db_indexing_job"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "db_meili_projection" ADD CONSTRAINT "db_meili_projection_job_id_db_indexing_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "db_indexing_job"("id") ON DELETE SET NULL;
