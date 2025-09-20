import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  integer,
  json,
  pgTable,
  text,
  varchar,
} from 'drizzle-orm/pg-core';

const snowflake = customType<{
  data: string;
}>({
  dataType() {
    return 'text';
  },
  // @ts-expect-error
  fromDriver(value: string) {
    return value.toString();
  },
});

//
// User
//
export const dbDiscordUser = pgTable('db_user', {
  id: snowflake('id').primaryKey(),
  displayName: varchar('display_name').notNull(),
  avatar: varchar('avatar'),
  isBot: boolean('is_bot').notNull().default(false),
  anonymizeName: boolean('anonymize_name').notNull().default(false),
  canPubliclyDisplayMessages: boolean('can_publicly_display_messages'),
});

export const discordUserRelations = relations(dbDiscordUser, ({ many }) => ({
  messages: many(dbMessage),
}));

export type DBUser = typeof dbDiscordUser.$inferSelect;

//
// Server
//

export const dbServer = pgTable('db_server', {
  id: snowflake('id').primaryKey(),
  name: varchar('name').notNull(),
  description: varchar('description'),
  memberCount: integer('member_count').notNull(),
});

export const serverRelations = relations(dbServer, ({ many }) => ({
  channels: many(dbChannel),
}));

export type DBServer = typeof dbServer.$inferSelect;

//
// Channel
//

export const dbChannel = pgTable('db_channel', {
  id: snowflake('id').primaryKey(),
  serverId: snowflake('server_id'),
  parentId: snowflake('parent_id'),
  authorId: snowflake('author_id'),
  channelName: varchar('channel_name'),
  archivedTimestamp: bigint('archivedTimestamp', { mode: 'number' }),
  lastIndexedMessageId: snowflake('last_indexed_message_id'),
  type: integer('type').notNull(),
});

export const channelRelations = relations(dbChannel, ({ one, many }) => ({
  messages: many(dbMessage),
  server: one(dbServer, {
    fields: [dbChannel.serverId], // Foreign key in THIS table
    references: [dbServer.id], // Primary key in the OTHER table
  }),
}));

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

export const dbMessage = pgTable('db_message', {
  id: snowflake('id').primaryKey(),
  serverId: snowflake('server_id'),
  channelId: snowflake('channel_id'),
  authorId: snowflake('author_id'),
  childThreadId: snowflake('child_thread_id'),
  parentChannelId: snowflake('parent_channel_id'),
  cleanContent: varchar('clean_content'),
  content: varchar('content'),
  pinned: boolean('pinned'),
  type: integer('type'),
  webhookId: snowflake('webhook_id'),
  referenceId: snowflake('reference_id'),
  applicationId: snowflake('application_id'),
  reactions: json('reactions').$type<DBMessageReaction[]>(),
});

export const messageRelations = relations(dbMessage, ({ one, many }) => ({
  user: one(dbDiscordUser, {
    fields: [dbMessage.authorId],
    references: [dbDiscordUser.id],
  }),
  channel: one(dbChannel, {
    fields: [dbMessage.channelId],
    references: [dbChannel.id],
  }),
  attachments: many(dbAttachments),
}));

export type DBMessage = typeof dbMessage.$inferSelect;

// Attachments

export const dbAttachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  messageId: snowflake('message_id').notNull(),
  name: text('file_name').notNull(),
  url: text('url').notNull(),
  proxyUrl: text('proxyUrl').notNull(),
  description: text('description'),
  contentType: text('content_type'),
  size: integer('size'),
  height: integer('height'),
  width: integer('width'),
});

export const attachmentRelations = relations(dbAttachments, ({ one }) => ({
  messages: one(dbMessage, {
    fields: [dbAttachments.messageId],
    references: [dbMessage.id],
  }),
}));

export type DBAttachments = typeof dbAttachments.$inferSelect;

export type DBMessageWithRelations = DBMessage & {
  attachments?: DBAttachments[];
};
