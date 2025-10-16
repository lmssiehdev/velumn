ALTER TABLE "db_message" ALTER COLUMN "reactions" SET DEFAULT 'null'::json;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "embeds" SET DEFAULT 'null'::json;--> statement-breakpoint
ALTER TABLE "db_message" ADD COLUMN "is_ignored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "message_author_id_idx" ON "db_message" USING btree ("author_id");