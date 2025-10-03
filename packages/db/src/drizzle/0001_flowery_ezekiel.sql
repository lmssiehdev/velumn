ALTER TABLE "db_channel" ALTER COLUMN "indexing_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "finished_onboarding" boolean DEFAULT false NOT NULL;