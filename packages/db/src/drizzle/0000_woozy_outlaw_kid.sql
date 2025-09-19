CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"parent_id" text,
	"author_id" text,
	"channel_name" varchar,
	"archivedTimestamp" bigint,
	"last_indexed_message_id" text,
	"type" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "db_user" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" varchar NOT NULL,
	"avatar" varchar,
	"is_bot" boolean DEFAULT false NOT NULL,
	"anonymize_name" boolean DEFAULT false NOT NULL,
	"can_publicly_display_messages" boolean
);
--> statement-breakpoint
CREATE TABLE "db_message" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"channel_id" text,
	"author_id" text,
	"child_thread_id" text,
	"parent_channel_id" text,
	"clean_content" varchar,
	"content" varchar,
	"pinned" boolean,
	"type" integer,
	"webhook_id" text,
	"reference_id" text,
	"application_id" text,
	"reactions" json
);
--> statement-breakpoint
CREATE TABLE "db_server" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"member_count" integer NOT NULL
);
