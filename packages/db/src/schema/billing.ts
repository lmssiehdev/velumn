import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { dbServer, snowflake } from "./discord";

export const polarSubscriptionStatusEnum = pgEnum("polar_subscription_status", [
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
	"paused",
]);

export const polarCheckoutAttemptStatusEnum = pgEnum(
	"polar_checkout_attempt_status",
	["pending", "succeeded", "expired", "failed"],
);

export const polarWebhookEventStatusEnum = pgEnum(
	"polar_webhook_event_status",
	["processed", "ignored"],
);

export const serverGrantSourceEnum = pgEnum("server_grant_source", [
	"open_source",
	"manual",
	"legacy_paid",
]);

export const dbPolarSubscription = pgTable(
	"polar_subscription",
	{
		id: text("id").primaryKey(),
		serverId: snowflake("server_id")
			.notNull()
			.references(() => dbServer.id, { onDelete: "restrict" }),
		purchaserUserId: text("purchaser_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		polarCustomerId: text("polar_customer_id").notNull(),
		checkoutId: text("checkout_id"),
		productId: text("product_id").notNull(),
		productAllowed: boolean("product_allowed").notNull().default(false),
		status: polarSubscriptionStatusEnum("status").notNull(),
		recurringInterval: text("recurring_interval"),
		recurringIntervalCount: integer("recurring_interval_count"),
		amount: integer("amount"),
		currency: text("currency"),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		pauseAtPeriodEnd: boolean("pause_at_period_end").notNull().default(false),
		trialStart: timestamp("trial_start", { mode: "date" }),
		trialEnd: timestamp("trial_end", { mode: "date" }),
		currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
		currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
		currentMeterPeriodStart: timestamp("current_meter_period_start", {
			mode: "date",
		}),
		currentMeterPeriodEnd: timestamp("current_meter_period_end", {
			mode: "date",
		}),
		startedAt: timestamp("started_at", { mode: "date" }),
		canceledAt: timestamp("canceled_at", { mode: "date" }),
		pastDueAt: timestamp("past_due_at", { mode: "date" }),
		pausedAt: timestamp("paused_at", { mode: "date" }),
		resumesAt: timestamp("resumes_at", { mode: "date" }),
		endsAt: timestamp("ends_at", { mode: "date" }),
		endedAt: timestamp("ended_at", { mode: "date" }),
		discountId: text("discount_id"),
		seats: integer("seats"),
		customerCancellationReason: text("customer_cancellation_reason"),
		customerCancellationComment: text("customer_cancellation_comment"),
		providerCreatedAt: timestamp("provider_created_at", { mode: "date" }),
		providerModifiedAt: timestamp("provider_modified_at", { mode: "date" }),
		lastEventAt: timestamp("last_event_at", { mode: "date" }),
		lastEventType: text("last_event_type"),
		lastEventFingerprint: text("last_event_fingerprint"),
		reconciliationRequired: boolean("reconciliation_required")
			.notNull()
			.default(false),
		reconciliationFailures: integer("reconciliation_failures")
			.notNull()
			.default(0),
		missingConfirmationCount: integer("missing_confirmation_count")
			.notNull()
			.default(0),
		lastReconciledAt: timestamp("last_reconciled_at", { mode: "date" }),
		lastReconciliationAttemptAt: timestamp("last_reconciliation_attempt_at", {
			mode: "date",
		}),
		lastReconciliationErrorCode: text("last_reconciliation_error_code"),
		firstMissingAt: timestamp("first_missing_at", { mode: "date" }),
		reconciliationClaimId: text("reconciliation_claim_id"),
		reconciliationClaimedAt: timestamp("reconciliation_claimed_at", {
			mode: "date",
		}),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		index("polar_subscription_server_id_idx").on(table.serverId),
		index("polar_subscription_purchaser_user_id_idx").on(table.purchaserUserId),
		index("polar_subscription_customer_id_idx").on(table.polarCustomerId),
		index("polar_subscription_product_id_idx").on(table.productId),
		index("polar_subscription_server_status_idx").on(
			table.serverId,
			table.status,
		),
		index("polar_subscription_reconciliation_idx").on(
			table.reconciliationRequired,
			table.reconciliationClaimedAt,
		),
	],
);

export type DBPolarSubscription = typeof dbPolarSubscription.$inferSelect;
export type DBPolarSubscriptionInsert = typeof dbPolarSubscription.$inferInsert;

export const dbPolarCheckoutAttempt = pgTable(
	"polar_checkout_attempt",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		serverId: snowflake("server_id")
			.notNull()
			.references(() => dbServer.id, { onDelete: "restrict" }),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		polarCheckoutId: text("polar_checkout_id"),
		status: polarCheckoutAttemptStatusEnum("status")
			.notNull()
			.default("pending"),
		failureCode: text("failure_code"),
		lastReconciledAt: timestamp("last_reconciled_at", { mode: "date" }),
		reconciliationClaimId: text("reconciliation_claim_id"),
		reconciliationClaimedAt: timestamp("reconciliation_claimed_at", {
			mode: "date",
		}),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("polar_checkout_attempt_checkout_id_idx").on(
			table.polarCheckoutId,
		),
		uniqueIndex("polar_checkout_attempt_pending_server_idx")
			.on(table.serverId)
			.where(sql`${table.status} = 'pending'`),
		index("polar_checkout_attempt_server_created_at_idx").on(
			table.serverId,
			table.createdAt,
		),
		index("polar_checkout_attempt_user_id_idx").on(table.userId),
		index("polar_checkout_attempt_status_expires_at_idx").on(
			table.status,
			table.expiresAt,
		),
	],
);

export type DBPolarCheckoutAttempt = typeof dbPolarCheckoutAttempt.$inferSelect;
export type DBPolarCheckoutAttemptInsert =
	typeof dbPolarCheckoutAttempt.$inferInsert;

export const dbPolarWebhookEvent = pgTable(
	"polar_webhook_event",
	{
		fingerprint: text("fingerprint").primaryKey(),
		eventType: text("event_type").notNull(),
		resourceId: text("resource_id"),
		eventAt: timestamp("event_at", { mode: "date" }).notNull(),
		status: polarWebhookEventStatusEnum("status").notNull(),
		reason: text("reason"),
		receivedAt: timestamp("received_at", { mode: "date" })
			.notNull()
			.defaultNow(),
		processedAt: timestamp("processed_at", { mode: "date" }),
	},
	(table) => [
		index("polar_webhook_event_resource_id_idx").on(table.resourceId),
		index("polar_webhook_event_received_at_idx").on(table.receivedAt),
	],
);

export type DBPolarWebhookEvent = typeof dbPolarWebhookEvent.$inferSelect;

export const dbServerGrant = pgTable(
	"server_grant",
	{
		serverId: snowflake("server_id")
			.notNull()
			.references(() => dbServer.id, { onDelete: "restrict" }),
		source: serverGrantSourceEnum("source").notNull(),
		sourceId: text("source_id").notNull(),
		revokedAt: timestamp("revoked_at", { mode: "date" }),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.serverId, table.source, table.sourceId] }),
		index("server_grant_server_revoked_at_idx").on(
			table.serverId,
			table.revokedAt,
		),
	],
);

export type DBServerGrant = typeof dbServerGrant.$inferSelect;
export type DBServerGrantInsert = typeof dbServerGrant.$inferInsert;
