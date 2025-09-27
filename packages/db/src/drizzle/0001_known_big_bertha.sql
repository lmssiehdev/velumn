DROP INDEX "channed_idx";--> statement-breakpoint
DROP INDEX "pinned_idx";--> statement-breakpoint
ALTER TABLE "db_channel" ALTER COLUMN "server_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "server_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "author_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "content" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "pinned" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "pinned" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "indexing_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "anonymize_users" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "db_channel" ADD CONSTRAINT "db_channel_server_id_db_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."db_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_message" ADD CONSTRAINT "db_message_server_id_db_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."db_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_message" ADD CONSTRAINT "db_message_channel_id_db_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."db_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "attachment_message_id_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "channel_pinned_idx" ON "db_channel" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "channel_parent_id_idx" ON "db_channel" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "channel_server_id_idx" ON "db_channel" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "message_channel_id_idx" ON "db_message" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "message_parent_channel_id_idx" ON "db_message" USING btree ("parent_channel_id");