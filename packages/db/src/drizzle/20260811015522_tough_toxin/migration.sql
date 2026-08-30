CREATE TYPE "polar_checkout_attempt_status" AS ENUM('pending', 'succeeded', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "polar_subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "polar_webhook_event_status" AS ENUM('processed', 'ignored');--> statement-breakpoint
CREATE TYPE "server_grant_source" AS ENUM('open_source', 'manual', 'legacy_paid');--> statement-breakpoint
CREATE TABLE "polar_checkout_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"server_id" bigint NOT NULL,
	"user_id" text,
	"polar_checkout_id" text,
	"status" "polar_checkout_attempt_status" DEFAULT 'pending'::"polar_checkout_attempt_status" NOT NULL,
	"failure_code" text,
	"last_reconciled_at" timestamp,
	"reconciliation_claim_id" text,
	"reconciliation_claimed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polar_subscription" (
	"id" text PRIMARY KEY,
	"server_id" bigint NOT NULL,
	"purchaser_user_id" text,
	"polar_customer_id" text NOT NULL,
	"checkout_id" text,
	"product_id" text NOT NULL,
	"product_allowed" boolean DEFAULT false NOT NULL,
	"status" "polar_subscription_status" NOT NULL,
	"recurring_interval" text,
	"recurring_interval_count" integer,
	"amount" integer,
	"currency" text,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"pause_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"current_meter_period_start" timestamp,
	"current_meter_period_end" timestamp,
	"started_at" timestamp,
	"canceled_at" timestamp,
	"past_due_at" timestamp,
	"paused_at" timestamp,
	"resumes_at" timestamp,
	"ends_at" timestamp,
	"ended_at" timestamp,
	"discount_id" text,
	"seats" integer,
	"customer_cancellation_reason" text,
	"customer_cancellation_comment" text,
	"provider_created_at" timestamp,
	"provider_modified_at" timestamp,
	"last_event_at" timestamp,
	"last_event_type" text,
	"last_event_fingerprint" text,
	"reconciliation_required" boolean DEFAULT false NOT NULL,
	"reconciliation_failures" integer DEFAULT 0 NOT NULL,
	"missing_confirmation_count" integer DEFAULT 0 NOT NULL,
	"last_reconciled_at" timestamp,
	"last_reconciliation_attempt_at" timestamp,
	"last_reconciliation_error_code" text,
	"first_missing_at" timestamp,
	"reconciliation_claim_id" text,
	"reconciliation_claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polar_webhook_event" (
	"fingerprint" text PRIMARY KEY,
	"event_type" text NOT NULL,
	"resource_id" text,
	"event_at" timestamp NOT NULL,
	"status" "polar_webhook_event_status" NOT NULL,
	"reason" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "server_grant" (
	"server_id" bigint,
	"source" "server_grant_source",
	"source_id" text,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "server_grant_pkey" PRIMARY KEY("server_id","source","source_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "polar_checkout_attempt_checkout_id_idx" ON "polar_checkout_attempt" ("polar_checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "polar_checkout_attempt_pending_server_idx" ON "polar_checkout_attempt" ("server_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "polar_checkout_attempt_server_created_at_idx" ON "polar_checkout_attempt" ("server_id","created_at");--> statement-breakpoint
CREATE INDEX "polar_checkout_attempt_user_id_idx" ON "polar_checkout_attempt" ("user_id");--> statement-breakpoint
CREATE INDEX "polar_checkout_attempt_status_expires_at_idx" ON "polar_checkout_attempt" ("status","expires_at");--> statement-breakpoint
CREATE INDEX "polar_subscription_server_id_idx" ON "polar_subscription" ("server_id");--> statement-breakpoint
CREATE INDEX "polar_subscription_purchaser_user_id_idx" ON "polar_subscription" ("purchaser_user_id");--> statement-breakpoint
CREATE INDEX "polar_subscription_customer_id_idx" ON "polar_subscription" ("polar_customer_id");--> statement-breakpoint
CREATE INDEX "polar_subscription_product_id_idx" ON "polar_subscription" ("product_id");--> statement-breakpoint
CREATE INDEX "polar_subscription_server_status_idx" ON "polar_subscription" ("server_id","status");--> statement-breakpoint
CREATE INDEX "polar_subscription_reconciliation_idx" ON "polar_subscription" ("reconciliation_required","reconciliation_claimed_at");--> statement-breakpoint
CREATE INDEX "polar_webhook_event_resource_id_idx" ON "polar_webhook_event" ("resource_id");--> statement-breakpoint
CREATE INDEX "polar_webhook_event_received_at_idx" ON "polar_webhook_event" ("received_at");--> statement-breakpoint
CREATE INDEX "server_grant_server_revoked_at_idx" ON "server_grant" ("server_id","revoked_at");--> statement-breakpoint
ALTER TABLE "polar_checkout_attempt" ADD CONSTRAINT "polar_checkout_attempt_server_id_db_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "db_server"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "polar_checkout_attempt" ADD CONSTRAINT "polar_checkout_attempt_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "polar_subscription" ADD CONSTRAINT "polar_subscription_server_id_db_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "db_server"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "polar_subscription" ADD CONSTRAINT "polar_subscription_purchaser_user_id_user_id_fkey" FOREIGN KEY ("purchaser_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "server_grant" ADD CONSTRAINT "server_grant_server_id_db_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "db_server"("id") ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO "server_grant" ("server_id", "source", "source_id")
SELECT
	"id",
	CASE
		WHEN "plan" = 'OPEN_SOURCE' THEN 'open_source'::"server_grant_source"
		ELSE 'legacy_paid'::"server_grant_source"
	END,
	CASE
		WHEN "plan" = 'OPEN_SOURCE' THEN 'open_source/default'
		ELSE 'legacy_paid/cutover-2026-08'
	END
FROM "db_server"
WHERE "plan" IN ('OPEN_SOURCE', 'PAID')
ON CONFLICT DO NOTHING;
