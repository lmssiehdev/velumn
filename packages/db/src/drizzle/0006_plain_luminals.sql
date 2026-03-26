ALTER TABLE "db_channel" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "db_channel" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;
