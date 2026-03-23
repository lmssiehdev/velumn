ALTER TABLE "db_server" ADD COLUMN "custom_domain" text DEFAULT null;--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "domain_verified" boolean DEFAULT false NOT NULL;