ALTER TABLE "db_server" ADD COLUMN "custom_domain" text DEFAULT null;--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "domain_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "server_custom_domain_idx" ON "db_server" USING btree ("custom_domain");