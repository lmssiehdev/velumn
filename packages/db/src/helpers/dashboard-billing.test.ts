import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/velumn_test";

describe("billing domain rules", () => {
	it("entitles only allowed active and trialing subscriptions", async () => {
		const { isPolarSubscriptionEntitled } = await import("./dashboard-billing");

		assert.equal(
			isPolarSubscriptionEntitled({ productAllowed: true, status: "active" }),
			true,
		);
		assert.equal(
			isPolarSubscriptionEntitled({ productAllowed: true, status: "trialing" }),
			true,
		);
		for (const status of [
			"past_due",
			"paused",
			"canceled",
			"unpaid",
			"incomplete",
			"incomplete_expired",
		] as const) {
			assert.equal(
				isPolarSubscriptionEntitled({ productAllowed: true, status }),
				false,
			);
		}
		assert.equal(
			isPolarSubscriptionEntitled({ productAllowed: false, status: "active" }),
			false,
		);
	});

	it("produces key-order-independent webhook fingerprints", async () => {
		const { createPolarWebhookFingerprint } =
			await import("./dashboard-billing");
		const eventAt = new Date("2026-08-11T12:00:00.000Z");
		const first = createPolarWebhookFingerprint({
			eventType: "subscription.updated",
			eventAt,
			resourceId: "sub_1",
			snapshot: { status: "active", nested: { b: 2, a: 1 } },
		});
		const second = createPolarWebhookFingerprint({
			eventType: "subscription.updated",
			eventAt,
			resourceId: "sub_1",
			snapshot: { nested: { a: 1, b: 2 }, status: "active" },
		});

		assert.equal(first, second);
		assert.match(first, /^[a-f0-9]{64}$/);
	});

	it("requires two missing confirmations at least 24 hours apart", async () => {
		const { shouldConfirmPolarSubscriptionMissing } =
			await import("./dashboard-billing");
		const now = new Date("2026-08-11T12:00:00.000Z");

		assert.equal(
			shouldConfirmPolarSubscriptionMissing({
				missingConfirmationCount: 0,
				firstMissingAt: null,
				now,
			}),
			false,
		);
		assert.equal(
			shouldConfirmPolarSubscriptionMissing({
				missingConfirmationCount: 1,
				firstMissingAt: new Date("2026-08-10T12:01:00.000Z"),
				now,
			}),
			false,
		);
		assert.equal(
			shouldConfirmPolarSubscriptionMissing({
				missingConfirmationCount: 1,
				firstMissingAt: new Date("2026-08-10T12:00:00.000Z"),
				now,
			}),
			true,
		);
	});
});
