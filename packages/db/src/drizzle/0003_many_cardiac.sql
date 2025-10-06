CREATE TABLE "thread_backlink" (
	"source_message_id" text NOT NULL,
	"target_thread_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "thread_backlink_source_message_id_target_thread_id_pk" PRIMARY KEY("source_message_id","target_thread_id")
);
--> statement-breakpoint
ALTER TABLE "db_message" ADD COLUMN "metadata" json DEFAULT '{}'::json;--> statement-breakpoint
CREATE INDEX "backlinks_to_thread_idx" ON "thread_backlink" USING btree ("target_thread_id");