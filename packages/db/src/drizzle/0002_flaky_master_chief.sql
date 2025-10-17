DROP INDEX "message_child_thread_id_idx";--> statement-breakpoint
ALTER TABLE "db_message" ADD COLUMN "primary_channel_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ADD CONSTRAINT "db_message_primary_channel_id_db_channel_id_fk" FOREIGN KEY ("primary_channel_id") REFERENCES "public"."db_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_primary_channel_id_idx" ON "db_message" USING btree ("primary_channel_id");