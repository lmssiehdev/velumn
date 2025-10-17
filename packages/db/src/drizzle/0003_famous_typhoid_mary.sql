ALTER TABLE "db_message" DROP CONSTRAINT "db_message_primary_channel_id_db_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "db_message" ALTER COLUMN "primary_channel_id" DROP NOT NULL;