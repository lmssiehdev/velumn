import type { DBIndexingGatewayMutation } from "@repo/db/schema/index";
import { Context, Effect, Layer, Schema } from "effect";

export class GatewayMutationRepositoryError extends Schema.TaggedError<GatewayMutationRepositoryError>()(
	"GatewayMutationRepositoryError",
	{
		operation: Schema.Literals([
			"enqueue",
			"claim",
			"complete",
			"defer",
			"renew",
			"release",
		]),
		cause: Schema.Defect(),
	},
) {}

export class GatewayMutationLeaseLostError extends Schema.TaggedError<GatewayMutationLeaseLostError>()(
	"GatewayMutationLeaseLostError",
	{
		operation: Schema.Literals(["complete", "defer", "renew", "release"]),
		mutationId: Schema.Number,
	},
) {}

export class GatewayMutationRepository extends Context.Service<
	GatewayMutationRepository,
	{
		readonly enqueue: (input: {
			readonly mutation: unknown;
			readonly orderingKey: string;
			readonly submissionId: string;
			readonly submittedAt: Date;
		}) => Effect.Effect<
			DBIndexingGatewayMutation,
			GatewayMutationRepositoryError
		>;
		readonly claim: (input: {
			readonly leaseOwner: string;
			readonly leaseExpiresAt: Date;
			readonly limit: number;
			readonly now?: Date;
		}) => Effect.Effect<
			readonly DBIndexingGatewayMutation[],
			GatewayMutationRepositoryError
		>;
		readonly complete: (
			id: number,
			leaseOwner: string,
			generation: number,
		) => Effect.Effect<
			void,
			GatewayMutationRepositoryError | GatewayMutationLeaseLostError
		>;
		readonly defer: (
			id: number,
			leaseOwner: string,
			generation: number,
			errorCode: string,
			nextAttemptAt: Date,
		) => Effect.Effect<
			void,
			GatewayMutationRepositoryError | GatewayMutationLeaseLostError
		>;
		readonly renew: (
			id: number,
			leaseOwner: string,
			generation: number,
			leaseExpiresAt: Date,
		) => Effect.Effect<
			void,
			GatewayMutationRepositoryError | GatewayMutationLeaseLostError
		>;
		readonly release: (
			id: number,
			leaseOwner: string,
			generation: number,
		) => Effect.Effect<
			void,
			GatewayMutationRepositoryError | GatewayMutationLeaseLostError
		>;
	}
>()("velumn/bot/adapters/GatewayMutationRepository") {
	static readonly layer = Layer.succeed(
		GatewayMutationRepository,
		GatewayMutationRepository.of({
			enqueue: (input) =>
				fromHelpers("enqueue", (helpers) =>
					helpers.enqueueIndexingGatewayMutation(input),
				),
			claim: (input) =>
				fromHelpers("claim", (helpers) =>
					helpers.claimIndexingGatewayMutationBatch(input),
				),
			complete: (id, leaseOwner, generation) =>
				fromHelpers("complete", (helpers) =>
					helpers.completeIndexingGatewayMutation(id, leaseOwner, generation),
				).pipe(
					Effect.flatMap((completed) =>
						completed
							? Effect.void
							: Effect.fail(
									new GatewayMutationLeaseLostError({
										operation: "complete",
										mutationId: id,
									}),
								),
					),
				),
			defer: (id, leaseOwner, generation, errorCode, nextAttemptAt) =>
				fromHelpers("defer", (helpers) =>
					helpers.deferIndexingGatewayMutation(
						id,
						leaseOwner,
						generation,
						errorCode,
						nextAttemptAt,
					),
				).pipe(
					Effect.flatMap((deferred) =>
						deferred
							? Effect.void
							: Effect.fail(
									new GatewayMutationLeaseLostError({
										operation: "defer",
										mutationId: id,
									}),
								),
					),
				),
			renew: (id, leaseOwner, generation, leaseExpiresAt) =>
				fromHelpers("renew", (helpers) =>
					helpers.renewIndexingGatewayMutationLease(
						id,
						leaseOwner,
						generation,
						leaseExpiresAt,
					),
				).pipe(
					Effect.flatMap((renewed) =>
						renewed
							? Effect.void
							: Effect.fail(
									new GatewayMutationLeaseLostError({
										operation: "renew",
										mutationId: id,
									}),
								),
					),
				),
			release: (id, leaseOwner, generation) =>
				fromHelpers("release", (helpers) =>
					helpers.releaseIndexingGatewayMutationClaim(
						id,
						leaseOwner,
						generation,
					),
				).pipe(
					Effect.flatMap((released) =>
						released
							? Effect.void
							: Effect.fail(
									new GatewayMutationLeaseLostError({
										operation: "release",
										mutationId: id,
									}),
								),
					),
				),
		}),
	);
}

type IndexingHelpers = typeof import("@repo/db/helpers/indexing");

const fromHelpers = <A>(
	operation: GatewayMutationRepositoryError["operation"],
	run: (helpers: IndexingHelpers) => Promise<A>,
) =>
	Effect.tryPromise({
		try: async () => run(await import("@repo/db/helpers/indexing")),
		catch: (cause) => new GatewayMutationRepositoryError({ operation, cause }),
	});
