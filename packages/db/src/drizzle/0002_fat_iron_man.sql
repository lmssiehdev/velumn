CREATE TYPE "public"."plan" AS ENUM('FREE', 'OPEN_SOURCE', 'PAID');--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "kicked_at" time;--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "plan" "plan" DEFAULT 'FREE' NOT NULL;--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "polar_customer_id" text;--> statement-breakpoint
ALTER TABLE "db_server" ADD COLUMN "polar_subscription_id" text;