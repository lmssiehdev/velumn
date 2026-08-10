CREATE TYPE "indexing_gateway_mutation_status" AS ENUM('pending', 'processing');--> statement-breakpoint
CREATE TABLE "db_indexing_gateway_mutation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "db_indexing_gateway_mutation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"submission_id" text NOT NULL,
	"ordering_key" text NOT NULL,
	"mutation" json NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"status" "indexing_gateway_mutation_status" DEFAULT 'pending'::"indexing_gateway_mutation_status" NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp,
	"last_error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "indexing_gateway_mutation_attempt_count_check" CHECK ("attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "indexing_gateway_mutation_pending_idx" ON "db_indexing_gateway_mutation" ("status","next_attempt_at","id");--> statement-breakpoint
CREATE INDEX "indexing_gateway_mutation_ordering_id_idx" ON "db_indexing_gateway_mutation" ("ordering_key","id");
