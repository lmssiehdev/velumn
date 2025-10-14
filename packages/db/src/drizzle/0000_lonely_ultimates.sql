CREATE TYPE "public"."plan" AS ENUM('FREE', 'OPEN_SOURCE', 'PAID');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"server_id" bigint,
	"finished_onboarding" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" bigint NOT NULL,
	"file_name" text NOT NULL,
	"url" text NOT NULL,
	"proxyUrl" text NOT NULL,
	"description" text,
	"content_type" text,
	"size" integer,
	"height" integer,
	"width" integer
);
--> statement-breakpoint
CREATE TABLE "db_channel" (
	"id" bigint PRIMARY KEY NOT NULL,
	"server_id" bigint NOT NULL,
	"parent_id" bigint,
	"author_id" bigint,
	"channel_name" varchar,
	"archivedTimestamp" bigint,
	"last_indexed_message_id" bigint,
	"type" integer NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"indexing_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "db_user" (
	"id" bigint PRIMARY KEY NOT NULL,
	"display_name" varchar NOT NULL,
	"avatar" varchar,
	"is_bot" boolean DEFAULT false NOT NULL,
	"anonymize_name" boolean DEFAULT false NOT NULL,
	"can_publicly_display_messages" boolean
);
--> statement-breakpoint
CREATE TABLE "db_message" (
	"id" bigint PRIMARY KEY NOT NULL,
	"server_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"child_thread_id" bigint,
	"parent_channel_id" bigint,
	"clean_content" varchar,
	"content" varchar NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"type" integer NOT NULL,
	"webhook_id" bigint,
	"reference_id" bigint,
	"application_id" bigint,
	"reactions" json,
	"embeds" json DEFAULT '[]'::json,
	"poll" json DEFAULT 'null'::json,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "db_server" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"member_count" integer NOT NULL,
	"kicked_at" timestamp,
	"plan" "plan" DEFAULT 'FREE' NOT NULL,
	"invitedBy" text,
	"anonymize_users" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_discord_invite" (
	"server_id" bigint PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thread_backlink" (
	"source_message_id" text NOT NULL,
	"target_thread_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "thread_backlink_source_message_id_target_thread_id_pk" PRIMARY KEY("source_message_id","target_thread_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_channel" ADD CONSTRAINT "db_channel_server_id_db_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."db_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_message" ADD CONSTRAINT "db_message_server_id_db_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."db_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_message" ADD CONSTRAINT "db_message_channel_id_db_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."db_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "attachment_message_id_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "channel_pinned_idx" ON "db_channel" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "channel_parent_id_idx" ON "db_channel" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "channel_server_id_idx" ON "db_channel" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "message_channel_id_idx" ON "db_message" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "message_parent_channel_id_idx" ON "db_message" USING btree ("parent_channel_id");--> statement-breakpoint
CREATE INDEX "backlinks_to_thread_idx" ON "thread_backlink" USING btree ("target_thread_id");