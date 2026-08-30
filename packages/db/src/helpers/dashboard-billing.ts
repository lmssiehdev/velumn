import { createHash } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../index";
import {
	type DBPolarCheckoutAttempt,
	type DBPolarSubscription,
	dbPolarCheckoutAttempt,
	dbPolarSubscription,
	dbPolarWebhookEvent,
	dbServer,
	dbServerGrant,
	type ServerPlan,
	user,
} from "../schema";

export type PolarSubscriptionStatus = DBPolarSubscription["status"];

export type PolarSubscriptionSnapshot = {
	id: string;
	serverId: string;
	purchaserUserId: string;
	checkoutAttemptId: string | null;
	customerId: string;
	checkoutId: string | null;
	productId: string;
	status: PolarSubscriptionStatus;
	recurringInterval: string | null;
	recurringIntervalCount: number | null;
	amount: number | null;
	currency: string | null;
	cancelAtPeriodEnd: boolean;
	pauseAtPeriodEnd: boolean;
	trialStart: Date | null;
	trialEnd: Date | null;
	currentPeriodStart: Date | null;
	currentPeriodEnd: Date | null;
	currentMeterPeriodStart: Date | null;
	currentMeterPeriodEnd: Date | null;
	startedAt: Date | null;
	canceledAt: Date | null;
	pastDueAt: Date | null;
	pausedAt: Date | null;
	resumesAt: Date | null;
	endsAt: Date | null;
	endedAt: Date | null;
	discountId: string | null;
	seats: number | null;
	customerCancellationReason: string | null;
	customerCancellationComment: string | null;
	providerCreatedAt: Date | null;
	providerModifiedAt: Date | null;
	eventAt: Date;
	eventType: string;
};

export type PolarCheckoutAttempt = {
	id: string;
	serverId: string;
	userId: string | null;
	polarCheckoutId: string | null;
	status: DBPolarCheckoutAttempt["status"];
	failureCode: string | null;
	lastReconciledAt: string | null;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
};

export type BillingSubscription = {
	id: string;
	purchaserUserId: string | null;
	productId: string;
	productAllowed: boolean;
	status: PolarSubscriptionStatus;
	recurringInterval: string | null;
	recurringIntervalCount: number | null;
	amount: number | null;
	currency: string | null;
	cancelAtPeriodEnd: boolean;
	pauseAtPeriodEnd: boolean;
	trialStart: string | null;
	trialEnd: string | null;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	startedAt: string | null;
	endsAt: string | null;
	endedAt: string | null;
};

export type BillingOwner = {
	id: string;
	name: string;
};

export type ServerBillingProjection = {
	serverId: string;
	effectivePlan: ServerPlan;
	subscriptions: BillingSubscription[];
	owners: BillingOwner[];
	checkoutAttempt: PolarCheckoutAttempt | null;
};

export type CreatePolarCheckoutAttemptResult =
	| { type: "created"; attempt: PolarCheckoutAttempt }
	| { type: "server_not_found" }
	| { type: "already_entitled" }
	| { type: "pending_attempt_exists"; attempt: PolarCheckoutAttempt };

export type FailPolarCheckoutAttemptResult =
	| { type: "failed"; attempt: PolarCheckoutAttempt }
	| { type: "not_found" };

export type ApplyPolarSubscriptionSnapshotResult =
	| { type: "applied"; subscriptionId: string; entitled: boolean }
	| { type: "duplicate"; subscriptionId: string }
	| { type: "ignored"; subscriptionId: string; reason: string }
	| { type: "stale"; subscriptionId: string };

export type PolarReconciliationBatch = {
	subscriptions: Array<{ id: string }>;
	attempts: Array<{ id: string; serverId: string; userId: string | null }>;
};

type EntitlementSubscription = Pick<
	DBPolarSubscription,
	"productAllowed" | "status"
>;

export function isPolarSubscriptionEntitled(
	subscription: EntitlementSubscription,
): boolean {
	return (
		subscription.productAllowed &&
		(subscription.status === "active" || subscription.status === "trialing")
	);
}

function toIso(value: Date | null): string | null {
	return value?.toISOString() ?? null;
}

function serializeAttempt(row: DBPolarCheckoutAttempt): PolarCheckoutAttempt {
	return {
		id: row.id,
		serverId: row.serverId,
		userId: row.userId,
		polarCheckoutId: row.polarCheckoutId,
		status: row.status,
		failureCode: row.failureCode,
		lastReconciledAt: toIso(row.lastReconciledAt),
		expiresAt: row.expiresAt.toISOString(),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function serializeSubscription(row: DBPolarSubscription): BillingSubscription {
	return {
		id: row.id,
		purchaserUserId: row.purchaserUserId,
		productId: row.productId,
		productAllowed: row.productAllowed,
		status: row.status,
		recurringInterval: row.recurringInterval,
		recurringIntervalCount: row.recurringIntervalCount,
		amount: row.amount,
		currency: row.currency,
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
		pauseAtPeriodEnd: row.pauseAtPeriodEnd,
		trialStart: toIso(row.trialStart),
		trialEnd: toIso(row.trialEnd),
		currentPeriodStart: toIso(row.currentPeriodStart),
		currentPeriodEnd: toIso(row.currentPeriodEnd),
		startedAt: toIso(row.startedAt),
		endsAt: toIso(row.endsAt),
		endedAt: toIso(row.endedAt),
	};
}

type FingerprintValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Date
	| readonly FingerprintValue[]
	| { readonly [key: string]: FingerprintValue };

const fingerprintValueSchema: z.ZodType<FingerprintValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.undefined(),
		z.date(),
		z.array(fingerprintValueSchema),
		z.record(z.string(), fingerprintValueSchema),
	]),
);
const fingerprintRecordSchema = z.record(z.string(), fingerprintValueSchema);

function stableValue(value: FingerprintValue): FingerprintValue {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(stableValue);
	const record = fingerprintRecordSchema.safeParse(value);
	if (record.success) {
		return Object.fromEntries(
			Object.entries(record.data)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, stableValue(child)]),
		);
	}
	return value;
}

export function createPolarWebhookFingerprint({
	eventType,
	eventAt,
	resourceId,
	snapshot,
}: {
	eventType: string;
	eventAt: Date;
	resourceId: string | null;
	snapshot: FingerprintValue;
}): string {
	return createHash("sha256")
		.update(
			JSON.stringify(stableValue({ eventType, eventAt, resourceId, snapshot })),
		)
		.digest("hex");
}

export async function createPolarCheckoutAttempt({
	serverId,
	userId,
	expiresAt,
}: {
	serverId: string;
	userId: string;
	expiresAt: Date;
}): Promise<CreatePolarCheckoutAttemptResult> {
	return await db.transaction(async (tx) => {
		const [server] = await tx
			.select({ id: dbServer.id })
			.from(dbServer)
			.where(eq(dbServer.id, serverId))
			.for("update");
		if (!server) return { type: "server_not_found" };

		const now = new Date();
		await tx
			.update(dbPolarCheckoutAttempt)
			.set({ status: "expired", updatedAt: now })
			.where(
				and(
					eq(dbPolarCheckoutAttempt.serverId, serverId),
					eq(dbPolarCheckoutAttempt.status, "pending"),
					lte(dbPolarCheckoutAttempt.expiresAt, now),
				),
			);

		const entitled = await tx
			.select({ id: dbPolarSubscription.id })
			.from(dbPolarSubscription)
			.where(
				and(
					eq(dbPolarSubscription.serverId, serverId),
					eq(dbPolarSubscription.productAllowed, true),
					inArray(dbPolarSubscription.status, [
						"trialing",
						"active",
						"past_due",
					]),
				),
			)
			.limit(1);
		if (entitled.length > 0) return { type: "already_entitled" };
		const activeGrants = await tx
			.select({ source: dbServerGrant.source })
			.from(dbServerGrant)
			.where(
				and(
					eq(dbServerGrant.serverId, serverId),
					isNull(dbServerGrant.revokedAt),
				),
			)
			.limit(1);
		if (activeGrants.length > 0) return { type: "already_entitled" };

		const [pending] = await tx
			.select()
			.from(dbPolarCheckoutAttempt)
			.where(
				and(
					eq(dbPolarCheckoutAttempt.serverId, serverId),
					eq(dbPolarCheckoutAttempt.status, "pending"),
				),
			)
			.limit(1);
		if (pending) {
			return {
				type: "pending_attempt_exists",
				attempt: serializeAttempt(pending),
			};
		}

		const [attempt] = await tx
			.insert(dbPolarCheckoutAttempt)
			.values({ serverId, userId, expiresAt })
			.returning();
		if (!attempt)
			throw new Error("Polar checkout attempt insert returned no row");
		return { type: "created", attempt: serializeAttempt(attempt) };
	});
}

export async function getPolarCheckoutAttempt(
	id: string,
): Promise<PolarCheckoutAttempt | null> {
	const [attempt] = await db
		.select()
		.from(dbPolarCheckoutAttempt)
		.where(eq(dbPolarCheckoutAttempt.id, id))
		.limit(1);
	return attempt ? serializeAttempt(attempt) : null;
}

export async function failPolarCheckoutAttempt(
	id: string,
	userId: string,
	failureCode: string,
): Promise<FailPolarCheckoutAttemptResult> {
	const [attempt] = await db
		.update(dbPolarCheckoutAttempt)
		.set({ status: "failed", failureCode, updatedAt: new Date() })
		.where(
			and(
				eq(dbPolarCheckoutAttempt.id, id),
				eq(dbPolarCheckoutAttempt.userId, userId),
				eq(dbPolarCheckoutAttempt.status, "pending"),
			),
		)
		.returning();
	return attempt
		? { type: "failed", attempt: serializeAttempt(attempt) }
		: { type: "not_found" };
}

export async function getServerBillingProjection({
	serverId,
}: {
	serverId: string;
}): Promise<ServerBillingProjection | null> {
	const [server, subscriptions, grants, ownerRows, attempts] =
		await Promise.all([
			db
				.select({ id: dbServer.id, plan: dbServer.plan })
				.from(dbServer)
				.where(eq(dbServer.id, serverId))
				.limit(1),
			db
				.select()
				.from(dbPolarSubscription)
				.where(eq(dbPolarSubscription.serverId, serverId))
				.orderBy(desc(dbPolarSubscription.createdAt)),
			db
				.select({ source: dbServerGrant.source })
				.from(dbServerGrant)
				.where(
					and(
						eq(dbServerGrant.serverId, serverId),
						isNull(dbServerGrant.revokedAt),
					),
				),
			db
				.selectDistinct({ id: user.id, name: user.name })
				.from(dbPolarSubscription)
				.innerJoin(user, eq(dbPolarSubscription.purchaserUserId, user.id))
				.where(eq(dbPolarSubscription.serverId, serverId)),
			db
				.select()
				.from(dbPolarCheckoutAttempt)
				.where(
					and(
						eq(dbPolarCheckoutAttempt.serverId, serverId),
						gt(dbPolarCheckoutAttempt.expiresAt, new Date()),
					),
				)
				.orderBy(desc(dbPolarCheckoutAttempt.createdAt))
				.limit(1),
		]);
	const currentServer = server[0];
	if (!currentServer) return null;
	const effectivePlan: ServerPlan = grants.some(
		({ source }) => source === "open_source",
	)
		? "OPEN_SOURCE"
		: subscriptions.some(isPolarSubscriptionEntitled) || grants.length > 0
			? "PAID"
			: "FREE";

	return {
		serverId,
		effectivePlan,
		subscriptions: subscriptions.map(serializeSubscription),
		owners: ownerRows,
		checkoutAttempt: attempts[0] ? serializeAttempt(attempts[0]) : null,
	};
}

export async function getPurchaserPortalAccess({
	serverId,
	userId,
}: {
	serverId: string;
	userId: string;
}): Promise<{ purchased: boolean; subscriptionIds: string[] }> {
	const subscriptions = await db
		.select({ id: dbPolarSubscription.id })
		.from(dbPolarSubscription)
		.where(
			and(
				eq(dbPolarSubscription.serverId, serverId),
				eq(dbPolarSubscription.purchaserUserId, userId),
			),
		);
	return {
		purchased: subscriptions.length > 0,
		subscriptionIds: subscriptions.map(({ id }) => id),
	};
}

export async function isServerProEntitled(serverId: string): Promise<boolean> {
	const [subscriptions, grants] = await Promise.all([
		db
			.select({
				productAllowed: dbPolarSubscription.productAllowed,
				status: dbPolarSubscription.status,
			})
			.from(dbPolarSubscription)
			.where(eq(dbPolarSubscription.serverId, serverId)),
		db
			.select({ source: dbServerGrant.source })
			.from(dbServerGrant)
			.where(
				and(
					eq(dbServerGrant.serverId, serverId),
					isNull(dbServerGrant.revokedAt),
				),
			),
	]);
	return grants.length > 0 || subscriptions.some(isPolarSubscriptionEntitled);
}

function snapshotColumns(
	snapshot: PolarSubscriptionSnapshot,
	productAllowed: boolean,
) {
	return {
		serverId: snapshot.serverId,
		purchaserUserId: snapshot.purchaserUserId,
		polarCustomerId: snapshot.customerId,
		checkoutId: snapshot.checkoutId,
		productId: snapshot.productId,
		productAllowed,
		status: snapshot.status,
		recurringInterval: snapshot.recurringInterval,
		recurringIntervalCount: snapshot.recurringIntervalCount,
		amount: snapshot.amount,
		currency: snapshot.currency,
		cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
		pauseAtPeriodEnd: snapshot.pauseAtPeriodEnd,
		trialStart: snapshot.trialStart,
		trialEnd: snapshot.trialEnd,
		currentPeriodStart: snapshot.currentPeriodStart,
		currentPeriodEnd: snapshot.currentPeriodEnd,
		currentMeterPeriodStart: snapshot.currentMeterPeriodStart,
		currentMeterPeriodEnd: snapshot.currentMeterPeriodEnd,
		startedAt: snapshot.startedAt,
		canceledAt: snapshot.canceledAt,
		pastDueAt: snapshot.pastDueAt,
		pausedAt: snapshot.pausedAt,
		resumesAt: snapshot.resumesAt,
		endsAt: snapshot.endsAt,
		endedAt: snapshot.endedAt,
		discountId: snapshot.discountId,
		seats: snapshot.seats,
		customerCancellationReason: snapshot.customerCancellationReason,
		customerCancellationComment: snapshot.customerCancellationComment,
		providerCreatedAt: snapshot.providerCreatedAt,
		providerModifiedAt: snapshot.providerModifiedAt,
	};
}

function existingSnapshotColumns(subscription: DBPolarSubscription) {
	return {
		serverId: subscription.serverId,
		purchaserUserId: subscription.purchaserUserId,
		polarCustomerId: subscription.polarCustomerId,
		checkoutId: subscription.checkoutId,
		productId: subscription.productId,
		productAllowed: subscription.productAllowed,
		status: subscription.status,
		recurringInterval: subscription.recurringInterval,
		recurringIntervalCount: subscription.recurringIntervalCount,
		amount: subscription.amount,
		currency: subscription.currency,
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		pauseAtPeriodEnd: subscription.pauseAtPeriodEnd,
		trialStart: subscription.trialStart,
		trialEnd: subscription.trialEnd,
		currentPeriodStart: subscription.currentPeriodStart,
		currentPeriodEnd: subscription.currentPeriodEnd,
		currentMeterPeriodStart: subscription.currentMeterPeriodStart,
		currentMeterPeriodEnd: subscription.currentMeterPeriodEnd,
		startedAt: subscription.startedAt,
		canceledAt: subscription.canceledAt,
		pastDueAt: subscription.pastDueAt,
		pausedAt: subscription.pausedAt,
		resumesAt: subscription.resumesAt,
		endsAt: subscription.endsAt,
		endedAt: subscription.endedAt,
		discountId: subscription.discountId,
		seats: subscription.seats,
		customerCancellationReason: subscription.customerCancellationReason,
		customerCancellationComment: subscription.customerCancellationComment,
		providerCreatedAt: subscription.providerCreatedAt,
		providerModifiedAt: subscription.providerModifiedAt,
	};
}

function compareSnapshotVersion(
	existing: DBPolarSubscription,
	snapshot: PolarSubscriptionSnapshot,
): -1 | 0 | 1 {
	if (existing.providerModifiedAt && !snapshot.providerModifiedAt) return -1;
	if (!existing.providerModifiedAt && snapshot.providerModifiedAt) return 1;
	if (existing.providerModifiedAt && snapshot.providerModifiedAt) {
		const difference =
			snapshot.providerModifiedAt.getTime() -
			existing.providerModifiedAt.getTime();
		return difference === 0 ? 0 : difference > 0 ? 1 : -1;
	}
	const difference =
		snapshot.eventAt.getTime() - (existing.lastEventAt?.getTime() ?? 0);
	return difference === 0 ? 0 : difference > 0 ? 1 : -1;
}

async function finishWebhookEvent(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	fingerprint: string,
	status: "processed" | "ignored",
	reason: string | null,
) {
	await tx
		.update(dbPolarWebhookEvent)
		.set({ status, reason, processedAt: new Date() })
		.where(eq(dbPolarWebhookEvent.fingerprint, fingerprint));
}

async function recomputeServerPlan(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	serverId: string,
): Promise<ServerPlan> {
	const [subscriptions, grants] = await Promise.all([
		tx
			.select({
				productAllowed: dbPolarSubscription.productAllowed,
				status: dbPolarSubscription.status,
			})
			.from(dbPolarSubscription)
			.where(eq(dbPolarSubscription.serverId, serverId)),
		tx
			.select({ source: dbServerGrant.source })
			.from(dbServerGrant)
			.where(
				and(
					eq(dbServerGrant.serverId, serverId),
					isNull(dbServerGrant.revokedAt),
				),
			),
	]);
	const plan: ServerPlan = grants.some(({ source }) => source === "open_source")
		? "OPEN_SOURCE"
		: subscriptions.some(isPolarSubscriptionEntitled) || grants.length > 0
			? "PAID"
			: "FREE";
	await tx.update(dbServer).set({ plan }).where(eq(dbServer.id, serverId));
	return plan;
}

export async function applyPolarSubscriptionSnapshot({
	snapshot,
	allowedProductId,
	eventFingerprint,
}: {
	snapshot: PolarSubscriptionSnapshot;
	allowedProductId: string;
	eventFingerprint: string;
}): Promise<ApplyPolarSubscriptionSnapshotResult> {
	return await db.transaction(async (tx) => {
		const claimed = await tx
			.insert(dbPolarWebhookEvent)
			.values({
				fingerprint: eventFingerprint,
				eventType: snapshot.eventType,
				resourceId: snapshot.id,
				eventAt: snapshot.eventAt,
				status: "ignored",
			})
			.onConflictDoNothing()
			.returning({ fingerprint: dbPolarWebhookEvent.fingerprint });
		if (claimed.length === 0) {
			return { type: "duplicate", subscriptionId: snapshot.id };
		}

		let [existing] = await tx
			.select()
			.from(dbPolarSubscription)
			.where(eq(dbPolarSubscription.id, snapshot.id))
			.limit(1)
			.for("update");
		const productAllowed = snapshot.productId === allowedProductId;

		if (!existing) {
			const serverRows = await tx
				.select({ id: dbServer.id })
				.from(dbServer)
				.where(eq(dbServer.id, snapshot.serverId))
				.for("update");
			if (serverRows.length === 0) {
				const reason = "unknown_server";
				await finishWebhookEvent(tx, eventFingerprint, "ignored", reason);
				return { type: "ignored", subscriptionId: snapshot.id, reason };
			}
			[existing] = await tx
				.select()
				.from(dbPolarSubscription)
				.where(eq(dbPolarSubscription.id, snapshot.id))
				.limit(1)
				.for("update");
		}

		if (!existing) {
			if (!productAllowed) {
				const reason = "unsupported_product";
				await finishWebhookEvent(tx, eventFingerprint, "ignored", reason);
				return { type: "ignored", subscriptionId: snapshot.id, reason };
			}
			if (!snapshot.checkoutAttemptId) {
				const reason = "missing_checkout_attempt";
				await finishWebhookEvent(tx, eventFingerprint, "ignored", reason);
				return { type: "ignored", subscriptionId: snapshot.id, reason };
			}
			const [attempt] = await tx
				.select()
				.from(dbPolarCheckoutAttempt)
				.where(
					and(
						eq(dbPolarCheckoutAttempt.id, snapshot.checkoutAttemptId),
						eq(dbPolarCheckoutAttempt.serverId, snapshot.serverId),
						eq(dbPolarCheckoutAttempt.userId, snapshot.purchaserUserId),
						inArray(dbPolarCheckoutAttempt.status, [
							"pending",
							"succeeded",
							"expired",
						]),
					),
				)
				.limit(1);
			if (!attempt) {
				const reason = "checkout_attempt_mismatch";
				await finishWebhookEvent(tx, eventFingerprint, "ignored", reason);
				return { type: "ignored", subscriptionId: snapshot.id, reason };
			}
		}

		if (
			(existing && existing.serverId !== snapshot.serverId) ||
			(existing && existing.polarCustomerId !== snapshot.customerId)
		) {
			const reason = "immutable_binding_mismatch";
			await finishWebhookEvent(tx, eventFingerprint, "ignored", reason);
			return { type: "ignored", subscriptionId: snapshot.id, reason };
		}
		if (existing) {
			const version = compareSnapshotVersion(existing, snapshot);
			if (version < 0) {
				await finishWebhookEvent(
					tx,
					eventFingerprint,
					"ignored",
					"stale_snapshot",
				);
				return { type: "stale", subscriptionId: snapshot.id };
			}
			if (version === 0) {
				const incoming = {
					...snapshotColumns(snapshot, productAllowed),
					purchaserUserId: existing.purchaserUserId,
				};
				if (
					JSON.stringify(stableValue(existingSnapshotColumns(existing))) ===
					JSON.stringify(stableValue(incoming))
				) {
					await finishWebhookEvent(tx, eventFingerprint, "processed", null);
					return { type: "duplicate", subscriptionId: snapshot.id };
				}
				await tx
					.update(dbPolarSubscription)
					.set({ reconciliationRequired: true, updatedAt: new Date() })
					.where(eq(dbPolarSubscription.id, snapshot.id));
				const reason = "equal_version_conflict";
				await finishWebhookEvent(tx, eventFingerprint, "ignored", reason);
				return { type: "ignored", subscriptionId: snapshot.id, reason };
			}
		}

		const binding = existing
			? {
					serverId: existing.serverId,
					purchaserUserId: existing.purchaserUserId,
					polarCustomerId: existing.polarCustomerId,
				}
			: {
					serverId: snapshot.serverId,
					purchaserUserId: snapshot.purchaserUserId,
					polarCustomerId: snapshot.customerId,
				};
		const columns = snapshotColumns(snapshot, productAllowed);
		const now = new Date();
		await tx
			.insert(dbPolarSubscription)
			.values({
				id: snapshot.id,
				...columns,
				...binding,
				lastEventAt: snapshot.eventAt,
				lastEventType: snapshot.eventType,
				lastEventFingerprint: eventFingerprint,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: dbPolarSubscription.id,
				set: {
					...columns,
					...binding,
					lastEventAt: snapshot.eventAt,
					lastEventType: snapshot.eventType,
					lastEventFingerprint: eventFingerprint,
					reconciliationRequired: false,
					missingConfirmationCount: 0,
					firstMissingAt: null,
					lastReconciliationErrorCode: null,
					updatedAt: now,
				},
			});

		if (
			snapshot.checkoutAttemptId &&
			(snapshot.status === "active" || snapshot.status === "trialing")
		) {
			await tx
				.update(dbPolarCheckoutAttempt)
				.set({
					status: "succeeded",
					polarCheckoutId: snapshot.checkoutId,
					failureCode: null,
					updatedAt: now,
				})
				.where(
					and(
						eq(dbPolarCheckoutAttempt.id, snapshot.checkoutAttemptId),
						eq(dbPolarCheckoutAttempt.serverId, binding.serverId),
					),
				);
		}

		await recomputeServerPlan(tx, binding.serverId);
		await finishWebhookEvent(tx, eventFingerprint, "processed", null);
		return {
			type: "applied",
			subscriptionId: snapshot.id,
			entitled:
				productAllowed &&
				(snapshot.status === "active" || snapshot.status === "trialing"),
		};
	});
}

export async function markPolarCustomerReconciliationNeeded(
	polarCustomerId: string,
): Promise<number> {
	const rows = await db
		.update(dbPolarSubscription)
		.set({ reconciliationRequired: true, updatedAt: new Date() })
		.where(eq(dbPolarSubscription.polarCustomerId, polarCustomerId))
		.returning({ id: dbPolarSubscription.id });
	return rows.length;
}

export async function claimPolarReconciliationBatch({
	leaseOwner,
	limit,
	now = new Date(),
	staleBefore = new Date(Date.now() - 10 * 60 * 1000),
}: {
	leaseOwner: string;
	limit: number;
	now?: Date;
	staleBefore?: Date;
}): Promise<PolarReconciliationBatch> {
	if (!leaseOwner)
		throw new Error("Billing reconciliation lease owner is required");
	if (!Number.isInteger(limit) || limit < 1) {
		throw new RangeError("Billing reconciliation limit must be positive");
	}
	const subscriptionCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const attemptCutoff = new Date(now.getTime() - 60 * 1000);

	return await db.transaction(async (tx) => {
		const subscriptions = await tx.execute<{ id: string }>(sql`
			with candidates as (
				select ${dbPolarSubscription.id}
				from ${dbPolarSubscription}
				where (
					${dbPolarSubscription.reconciliationRequired} = true
					or ${dbPolarSubscription.lastReconciledAt} is null
					or ${dbPolarSubscription.lastReconciledAt} <= ${subscriptionCutoff}
				)
				and (
					${dbPolarSubscription.reconciliationClaimId} is null
					or ${dbPolarSubscription.reconciliationClaimedAt} <= ${staleBefore}
				)
				and (
					${dbPolarSubscription.reconciliationRequired} = true
					or ${dbPolarSubscription.status} in ('active', 'trialing', 'past_due')
				)
				order by ${dbPolarSubscription.reconciliationRequired} desc,
					${dbPolarSubscription.lastReconciledAt} nulls first
				limit ${limit}
				for update skip locked
			)
			update ${dbPolarSubscription} as subscription
			set reconciliation_claim_id = ${leaseOwner},
				reconciliation_claimed_at = ${now},
				last_reconciliation_attempt_at = ${now},
				updated_at = ${now}
			from candidates
			where subscription.id = candidates.id
			returning subscription.id
		`);
		const attempts = await tx.execute<{
			id: string;
			serverId: string;
			userId: string | null;
		}>(sql`
			with candidates as (
				select ${dbPolarCheckoutAttempt.id}
				from ${dbPolarCheckoutAttempt}
				where ${dbPolarCheckoutAttempt.status} = 'pending'
					and ${dbPolarCheckoutAttempt.expiresAt} > ${now}
					and (
						${dbPolarCheckoutAttempt.lastReconciledAt} is null
						or ${dbPolarCheckoutAttempt.lastReconciledAt} <= ${attemptCutoff}
					)
					and (
						${dbPolarCheckoutAttempt.reconciliationClaimId} is null
						or ${dbPolarCheckoutAttempt.reconciliationClaimedAt} <= ${staleBefore}
					)
				order by ${dbPolarCheckoutAttempt.createdAt}
				limit ${limit}
				for update skip locked
			)
			update ${dbPolarCheckoutAttempt} as attempt
			set reconciliation_claim_id = ${leaseOwner},
				reconciliation_claimed_at = ${now},
				updated_at = ${now}
			from candidates
			where attempt.id = candidates.id
			returning attempt.id,
				attempt.server_id as "serverId",
				attempt.user_id as "userId"
		`);
		return { subscriptions: subscriptions.rows, attempts: attempts.rows };
	});
}

export async function completePolarSubscriptionReconciliation(
	id: string,
	leaseOwner: string,
): Promise<boolean> {
	const rows = await db
		.update(dbPolarSubscription)
		.set({
			reconciliationRequired: false,
			reconciliationFailures: 0,
			lastReconciledAt: new Date(),
			lastReconciliationErrorCode: null,
			missingConfirmationCount: 0,
			firstMissingAt: null,
			reconciliationClaimId: null,
			reconciliationClaimedAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(dbPolarSubscription.id, id),
				eq(dbPolarSubscription.reconciliationClaimId, leaseOwner),
			),
		)
		.returning({ id: dbPolarSubscription.id });
	return rows.length > 0;
}

export async function recordPolarSubscriptionMissing(
	id: string,
	leaseOwner: string,
	now = new Date(),
): Promise<"missing_once" | "terminal" | "not_claimed"> {
	return await db.transaction(async (tx) => {
		const [subscription] = await tx
			.select()
			.from(dbPolarSubscription)
			.where(
				and(
					eq(dbPolarSubscription.id, id),
					eq(dbPolarSubscription.reconciliationClaimId, leaseOwner),
				),
			)
			.limit(1)
			.for("update");
		if (!subscription) return "not_claimed";

		const terminal = shouldConfirmPolarSubscriptionMissing({
			missingConfirmationCount: subscription.missingConfirmationCount,
			firstMissingAt: subscription.firstMissingAt,
			now,
		});

		await tx
			.update(dbPolarSubscription)
			.set({
				status: terminal ? "canceled" : subscription.status,
				productAllowed: terminal ? false : subscription.productAllowed,
				endedAt: terminal
					? (subscription.endedAt ?? now)
					: subscription.endedAt,
				reconciliationRequired: !terminal,
				reconciliationFailures: subscription.reconciliationFailures + 1,
				missingConfirmationCount: terminal ? 2 : 1,
				firstMissingAt: subscription.firstMissingAt ?? now,
				lastReconciliationErrorCode: "not_found",
				reconciliationClaimId: null,
				reconciliationClaimedAt: null,
				updatedAt: now,
			})
			.where(eq(dbPolarSubscription.id, id));

		if (terminal) await recomputeServerPlan(tx, subscription.serverId);
		return terminal ? "terminal" : "missing_once";
	});
}

export function shouldConfirmPolarSubscriptionMissing({
	missingConfirmationCount,
	firstMissingAt,
	now,
}: {
	missingConfirmationCount: number;
	firstMissingAt: Date | null;
	now: Date;
}): boolean {
	return (
		missingConfirmationCount >= 1 &&
		firstMissingAt !== null &&
		firstMissingAt.getTime() <= now.getTime() - 24 * 60 * 60 * 1000
	);
}

export async function deferPolarSubscriptionReconciliation(
	id: string,
	leaseOwner: string,
	errorCode: string,
): Promise<boolean> {
	const rows = await db
		.update(dbPolarSubscription)
		.set({
			reconciliationRequired: true,
			reconciliationFailures: sql`${dbPolarSubscription.reconciliationFailures} + 1`,
			lastReconciliationErrorCode: errorCode,
			reconciliationClaimId: null,
			reconciliationClaimedAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(dbPolarSubscription.id, id),
				eq(dbPolarSubscription.reconciliationClaimId, leaseOwner),
			),
		)
		.returning({ id: dbPolarSubscription.id });
	return rows.length > 0;
}

export async function completePolarCheckoutReconciliation(
	id: string,
	leaseOwner: string,
): Promise<boolean> {
	const rows = await db
		.update(dbPolarCheckoutAttempt)
		.set({
			lastReconciledAt: new Date(),
			reconciliationClaimId: null,
			reconciliationClaimedAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(dbPolarCheckoutAttempt.id, id),
				eq(dbPolarCheckoutAttempt.reconciliationClaimId, leaseOwner),
			),
		)
		.returning({ id: dbPolarCheckoutAttempt.id });
	return rows.length > 0;
}

export async function releasePolarCheckoutReconciliation(
	id: string,
	leaseOwner: string,
): Promise<boolean> {
	const rows = await db
		.update(dbPolarCheckoutAttempt)
		.set({
			reconciliationClaimId: null,
			reconciliationClaimedAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(dbPolarCheckoutAttempt.id, id),
				eq(dbPolarCheckoutAttempt.reconciliationClaimId, leaseOwner),
			),
		)
		.returning({ id: dbPolarCheckoutAttempt.id });
	return rows.length > 0;
}
