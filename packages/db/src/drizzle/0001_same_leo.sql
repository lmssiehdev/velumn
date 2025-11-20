ALTER TABLE "db_channel" ADD COLUMN "upvotes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "downvotes" integer DEFAULT 0 NOT NULL;