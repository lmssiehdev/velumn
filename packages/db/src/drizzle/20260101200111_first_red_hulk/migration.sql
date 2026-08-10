CREATE TABLE "user_servers" (
	"user_id" text NOT NULL,
	"server_id" bigint NOT NULL,
	"finished_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_servers_user_id_server_id_pk" PRIMARY KEY("user_id","server_id")
);
--> statement-breakpoint
ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_servers_user_id_idx" ON "user_servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_servers_server_id_idx" ON "user_servers" USING btree ("server_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "finished_onboarding";