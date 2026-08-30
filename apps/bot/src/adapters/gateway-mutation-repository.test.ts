import { assert, describe, it } from "@effect/vitest";
import { decodeClaimedIndexingGatewayMutation } from "@repo/db/helpers/indexing-gateway-mutation";
import { Effect } from "effect";
import { vi } from "vitest";
import {
	GatewayMutationLeaseLostError,
	GatewayMutationRepository,
	GatewayMutationRepositoryError,
} from "./gateway-mutation-repository";

vi.mock("@repo/db/helpers/indexing", () => ({
	claimIndexingGatewayMutationBatch: async () => [
		decodeClaimedIndexingGatewayMutation({
			id: "9007199254740992",
			submissionId: "gateway:test:unsafe",
			orderingKey: "content:thread-1",
			mutation: { _tag: "DeleteMessage" },
			submittedAt: "2026-08-09 12:34:56",
			status: "processing",
			attemptCount: "1",
			nextAttemptAt: "2026-08-09 12:34:56",
			leaseOwner: "worker-1",
			leaseExpiresAt: "2026-08-09 12:40:00",
			lastErrorCode: null,
			createdAt: "2026-08-09 12:30:00",
			updatedAt: "2026-08-09 12:34:56",
		}),
	],
	failIndexingGatewayMutation: async () => false,
}));

describe("gateway mutation repository", () => {
	it.effect("reports invalid claimed rows as a typed repository failure", () =>
		GatewayMutationRepository.use((repository) =>
			repository.claim({
				leaseOwner: "worker-1",
				leaseExpiresAt: new Date(2_000),
				limit: 1,
				now: new Date(1_000),
			}),
		).pipe(
			Effect.provide(GatewayMutationRepository.layer),
			Effect.flip,
			Effect.map((error) => {
				assert.instanceOf(error, GatewayMutationRepositoryError);
				assert.equal(error.operation, "claim");
				return undefined;
			}),
		),
	);

	it.effect("reports a fenced terminal mutation as a typed lease loss", () =>
		GatewayMutationRepository.use((repository) =>
			repository.fail(1, "worker-1", 2, "indexing:defect"),
		).pipe(
			Effect.provide(GatewayMutationRepository.layer),
			Effect.flip,
			Effect.map((error) => {
				assert.instanceOf(error, GatewayMutationLeaseLostError);
				assert.equal(error.operation, "fail");
			}),
		),
	);
});
