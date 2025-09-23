import { integer, json, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const webhookEvents = pgTable('webhook_events', {
    id: uuid('id').primaryKey().defaultRandom(),

    eventType: text('event_type').notNull(),
    eventId: text('event_id'),

    status: text('status', {
        enum: ['pending', 'processing', 'success', 'failed', 'skipped']
    }).default('pending').notNull(),

    receivedAt: timestamp('received_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    processingTimeMs: integer('processing_time_ms'),

    // Error handling
    error: text('error'),
    stackTrace: text('stack_trace'),
    retryCount: integer('retry_count').default(0).notNull(),

    payload: json('payload').notNull(),
    headers: json('headers'),

    source: text('source').default('polar').notNull(),
    version: text('version'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});