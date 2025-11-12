import {
	bigint,
	boolean,
	customType,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import type {
	DBAttachments,
	DBSnapshotSchema,
	EmbedSchema,
	MessageMetadataSchema,
	PollSchema,
} from "../helpers/validation";
export const snowflake = customType<{
	data: string;
}>({
	dataType() {
		return "bigint";
	},
	// @ts-expect-error
	fromDriver(value: string) {
		return value.toString();
	},
});

//
// User
//
export const dbDiscordUser = pgTable("db_user", {
	id: snowflake("id").primaryKey(),
	displayName: varchar("display_name").notNull(),
	avatar: varchar("avatar"),
	isBot: boolean("is_bot").notNull().default(false),
	anonymizeName: boolean("anonymize_name").notNull().default(false),
	isIgnored: boolean("can_publicly_display_messages"),
});

export type DBUser = typeof dbDiscordUser.$inferSelect;

//
// Server
//
export const planEnum = pgEnum("plan", ["FREE", "OPEN_SOURCE", "PAID"]);

export type ServerPlan = (typeof planEnum.enumValues)[number];

export const dbServer = pgTable("db_server", {
	id: snowflake("id").primaryKey(),
	name: varchar("name").notNull(),
	description: varchar("description"),
	memberCount: integer("member_count").notNull(),
	kickedAt: timestamp("kicked_at", { mode: "date" }),
	plan: planEnum("plan").notNull().default("FREE"),
	serverInvite: text("server_invite"),
	invitedBy: text("invitedBy"),
	anonymizeUsers: boolean("anonymize_users").default(false).notNull(),
	icon: text("icon").default(""),
});

export type DBServerInsert = typeof dbServer.$inferInsert;
export type DBServer = typeof dbServer.$inferSelect;

//
// Channel
//

export const dbChannel = pgTable(
	"db_channel",
	{
		id: snowflake("id").primaryKey(),
		serverId: snowflake("server_id")
			.notNull()
			.references(() => dbServer.id, { onDelete: "cascade" }),
		parentId: snowflake("parent_id"),
		authorId: snowflake("author_id"),
		channelName: varchar("channel_name"),
		archivedTimestamp: bigint("archivedTimestamp", { mode: "number" }),
		lastIndexedMessageId: snowflake("last_indexed_message_id"),
		type: integer("type").notNull(),
		pinned: boolean("pinned").default(false).notNull(),

		indexingEnabled: boolean("indexing_enabled").default(false).notNull(),
	},
	(table) => [
		index("channel_pinned_idx").on(table.pinned),
		index("channel_type_idx").on(table.type),
		index("channel_parent_id_idx").on(table.parentId),
		index("channel_server_id_idx").on(table.serverId),
	],
);

export type DBChannel = typeof dbChannel.$inferSelect;

//
// Message
//

export type DBMessageReaction = {
	id: string | null;
	name: string;
	animated: boolean;
	count: number;
	messageId: string;
	isServerEmoji: boolean;
};

export const dbMessage = pgTable(
	"db_message",
	{
		id: snowflake("id").primaryKey(),
		serverId: snowflake("server_id")
			.notNull()
			.references(() => dbServer.id, { onDelete: "cascade" }),
		channelId: snowflake("channel_id")
			.notNull()
			.references(() => dbChannel.id, { onDelete: "cascade" }),
		authorId: snowflake("author_id").notNull(),
		childThreadId: snowflake("child_thread_id"),
		parentChannelId: snowflake("parent_channel_id"),
		cleanContent: varchar("clean_content"),
		content: varchar("content").notNull(),
		// TODO: get this form the flags
		pinned: boolean("pinned").notNull().default(false),
		type: integer("type").notNull(),
		webhookId: snowflake("webhook_id"),
		referenceId: snowflake("reference_id"),
		applicationId: snowflake("application_id"),
		reactions: json("reactions")
			.$type<DBMessageReaction[] | null>()
			.default(null),
		embeds: json("embeds").$type<EmbedSchema[] | null>().default(null),
		poll: json("poll").$type<PollSchema | null>().default(null),
		metadata: json("metadata")
			.$type<MessageMetadataSchema | null>()
			.default(null),
		snapshot: json("snapshot").$type<DBSnapshotSchema | null>().default(null),
		/**
		 * The primary channel ID for querying all messages in the thread.
		 *
		 * This works around a Discord quirk where starter messages for threads
		 * created from text channels point to the parent channel instead of the thread.
		 *
		 * - For regular messages: equals `Message.id`
		 * - For thread starter messages: equals `Message.thread.id`
		 */
		primaryChannelId: snowflake("primary_channel_id"),
		/**
		 * this is set to true when the user has opted out of indexing
		 * in case they want to opt back in, we can still show a proper message
		 * for the messages that were deleted before.
		 */
		isIgnored: boolean("is_ignored").notNull().default(false),
	},
	(t) => [
		index("message_author_id_idx").on(t.authorId),
		index("message_channel_id_idx").on(t.channelId),
		index("message_primary_channel_id_idx").on(t.primaryChannelId),
		index("message_parent_channel_id_idx").on(t.parentChannelId),
	],
);

export type DBMessage = typeof dbMessage.$inferSelect;

//
// Attachments

export const dbAttachments = pgTable(
	"attachments",
	{
		id: text("id").primaryKey(),
		messageId: snowflake("message_id").notNull(),
		name: text("file_name").notNull(),
		url: text("url").notNull(),
		proxyURL: text("proxyURL").notNull(),
		description: text("description"),
		contentType: text("content_type"),
		size: integer("size"),
		height: integer("height"),
		width: integer("width"),
		isSnapshot: boolean("isSnapshot").notNull().default(false),
	},
	(t) => [index("attachment_message_id_idx").on(t.messageId)],
);

export type DBMessageWithRelations = DBMessage & {
	attachments?: DBAttachments[];
};

//
// backlinks: Tracks thread referencing for bidirectional linking.
//
export const dbThreadBacklink = pgTable(
	"thread_backlink",
	{
		fromMessageId: snowflake("from_message_id").notNull(),
		toThreadId: snowflake("to_thread_id").notNull(),
		fromThreadId: snowflake("from_thread_id").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.fromMessageId, table.toThreadId] }),
		index("backlinks_to_thread_idx").on(table.toThreadId),
		index("backlinks_from_thread_idx").on(table.fromThreadId),
	],
);
export type DBThreadBacklink = typeof dbThreadBacklink.$inferSelect;

// Pending invites
// used to link the user with the bot, surely there is a better way
// but this works for now
export const pendingDiscordInvite = pgTable("pending_discord_invite", {
	serverId: snowflake("server_id").notNull().primaryKey(),
	userId: text("user_id").notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date()),
});
