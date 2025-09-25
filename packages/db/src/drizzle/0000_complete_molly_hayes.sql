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
	"server_id" bigint,
	"parent_id" bigint,
	"author_id" bigint,
	"channel_name" varchar,
	"archivedTimestamp" bigint,
	"last_indexed_message_id" bigint,
	"type" integer NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL
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
	"server_id" bigint,
	"channel_id" bigint,
	"author_id" bigint,
	"child_thread_id" bigint,
	"parent_channel_id" bigint,
	"clean_content" varchar,
	"content" varchar,
	"pinned" boolean,
	"type" integer,
	"webhook_id" bigint,
	"reference_id" bigint,
	"application_id" bigint,
	"reactions" json
);
--> statement-breakpoint
CREATE TABLE "db_server" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"member_count" integer NOT NULL,
	"kicked_at" time,
	"plan" "plan" DEFAULT 'FREE' NOT NULL,
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"invitedBy" bigint
);
--> statement-breakpoint
CREATE TABLE "pending_discord_invite" (
	"server_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channed_idx" ON "db_channel" USING btree ("id");--> statement-breakpoint
CREATE INDEX "pinned_idx" ON "db_channel" USING btree ("pinned");