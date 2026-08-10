CREATE TYPE "domain_lifecycle_status" AS ENUM('unconfigured', 'provisioning', 'pending', 'verified', 'removing');--> statement-breakpoint
CREATE TABLE "db_domain_lifecycle" (
	"server_id" bigint PRIMARY KEY,
	"domain" text,
	"status" "domain_lifecycle_status" DEFAULT 'unconfigured'::"domain_lifecycle_status" NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_lifecycle_generation_check" CHECK ("generation" >= 0),
	CONSTRAINT "domain_lifecycle_state_check" CHECK (("status" = 'unconfigured' AND "domain" IS NULL) OR ("status" <> 'unconfigured' AND "domain" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_lifecycle_domain_idx" ON "db_domain_lifecycle" ("domain");--> statement-breakpoint
ALTER TABLE "db_domain_lifecycle" ADD CONSTRAINT "db_domain_lifecycle_server_id_db_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "db_server"("id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "db_domain_lifecycle" ("server_id", "domain", "status", "generation", "created_at", "updated_at")
SELECT
	"id",
	"custom_domain",
	CASE
		WHEN "domain_verified" THEN 'verified'::"domain_lifecycle_status"
		ELSE 'pending'::"domain_lifecycle_status"
	END,
	1,
	now(),
	now()
FROM "db_server"
WHERE "custom_domain" IS NOT NULL;
