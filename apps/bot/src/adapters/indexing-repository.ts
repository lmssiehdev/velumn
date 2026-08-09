import type {
	ClaimMeiliProjectionBatchInput,
	CommitConvertedMessageBatchInput,
	CommitConvertedMessageBatchResult,
	CompleteIndexingJobInput,
	ConvertedIndexingMessageInput,
	DeleteIndexedMessageInput,
	DeleteIndexedThreadInput,
	DeleteIndexingChannelTreeInput,
	IndexedMutationResult,
	IndexingChannelMetadataInput,
	IndexingGuildMetadataInput,
	IndexingPermissionDiagnosticsInput,
	IndexingSourceFacts,
	IndexingUserProfileInput,
	MeiliProjectionSourceDocument,
	ReconcileIndexedThreadInput,
	StoredReconciliationCandidate,
	StoredSupportedContainer,
	UpdateIndexingGuildMetadataResult,
	UpsertIndexingChannelMetadataResult,
	UpsertIndexingCheckpointInput,
} from "@repo/db/helpers/indexing";
import type {
	DBIndexingCheckpoint,
	DBIndexingJob,
	DBMeiliProjection,
	DBUser,
} from "@repo/db/schema/index";
import { Context, Effect, Layer, Schema } from "effect";

export type MeiliProjection = DBMeiliProjection;
export type IndexingMessageInput = ConvertedIndexingMessageInput;
export type IndexingUserInput = IndexingUserProfileInput;

export type {
	DeleteIndexedMessageInput,
	DeleteIndexedThreadInput,
	IndexedMutationResult,
	IndexingChannelMetadataInput,
	ReconcileIndexedThreadInput,
};

export class IndexingRepositoryError extends Schema.TaggedError<IndexingRepositoryError>()(
	"IndexingRepositoryError",
	{
		operation: Schema.Literals([
			"claim",
			"create-job",
			"get-job",
			"start-job",
			"complete-job",
			"cancel-job",
			"repair-jobs",
			"active-servers",
			"installation-exists",
			"mark-server-left",
			"stored-candidates",
			"stored-supported-containers",
			"get-checkpoint",
			"upsert-checkpoint",
			"reset-checkpoint",
			"complete",
			"defer",
			"fail",
			"release",
			"source",
			"source-facts",
			"commit-message",
			"delete-message",
			"delete-thread",
			"delete-channel",
			"delete-guild",
			"reconcile-thread",
			"reconcile-permissions",
			"upsert-channel-metadata",
			"upsert-guild-metadata",
			"update-user-profile",
		]),
		cause: Schema.Defect(),
	},
) {}

export class ProjectionLeaseLostError extends Schema.TaggedError<ProjectionLeaseLostError>()(
	"ProjectionLeaseLostError",
	{
		operation: Schema.Literals(["complete", "defer", "fail"]),
		projectionId: Schema.Number,
	},
) {}

export type IndexingRepositoryFailure =
	| IndexingRepositoryError
	| ProjectionLeaseLostError;

export class IndexingRepository extends Context.Service<
	IndexingRepository,
	{
		readonly sourceFacts: (
			sourceId: string,
		) => Effect.Effect<IndexingSourceFacts | null, IndexingRepositoryError>;
		readonly upsertChannelMetadata: (
			input: IndexingChannelMetadataInput,
		) => Effect.Effect<
			UpsertIndexingChannelMetadataResult,
			IndexingRepositoryError
		>;
		readonly deleteChannel: (
			input: DeleteIndexingChannelTreeInput,
		) => Effect.Effect<IndexedMutationResult, IndexingRepositoryError>;
		readonly upsertGuildMetadata: (
			input: IndexingGuildMetadataInput,
		) => Effect.Effect<
			UpdateIndexingGuildMetadataResult,
			IndexingRepositoryError
		>;
		readonly guildInstallationExists: (
			serverId: string,
		) => Effect.Effect<boolean, IndexingRepositoryError>;
		readonly deleteGuild: (
			serverId: string,
			observedAt: Date,
		) => Effect.Effect<IndexedMutationResult, IndexingRepositoryError>;
		readonly updateUserProfile: (
			input: IndexingUserProfileInput,
		) => Effect.Effect<DBUser | null, IndexingRepositoryError>;
		readonly reconcilePermissions: (
			input: IndexingPermissionDiagnosticsInput,
		) => Effect.Effect<number, IndexingRepositoryError>;
		readonly createJob: (
			input: import("@repo/db/helpers/indexing").CreateIndexingJobInput,
		) => Effect.Effect<DBIndexingJob, IndexingRepositoryError>;
		readonly getJob: (
			jobId: string,
		) => Effect.Effect<DBIndexingJob | null, IndexingRepositoryError>;
		readonly startJob: (
			jobId: string,
		) => Effect.Effect<DBIndexingJob | null, IndexingRepositoryError>;
		readonly completeJob: (
			jobId: string,
			result: CompleteIndexingJobInput,
		) => Effect.Effect<DBIndexingJob | null, IndexingRepositoryError>;
		readonly requestJobCancellation: (
			jobId: string,
		) => Effect.Effect<DBIndexingJob | null, IndexingRepositoryError>;
		readonly repairJobs: () => Effect.Effect<
			readonly DBIndexingJob[],
			IndexingRepositoryError
		>;
		readonly activeServerIds: () => Effect.Effect<
			readonly string[],
			IndexingRepositoryError
		>;
		readonly markServerLeft: (
			serverId: string,
			observedAt: Date,
		) => Effect.Effect<boolean, IndexingRepositoryError>;
		readonly storedCandidates: (input: {
			readonly guildId: string;
			readonly parentChannelId?: string;
			readonly threadId?: string;
		}) => Effect.Effect<
			readonly StoredReconciliationCandidate[],
			IndexingRepositoryError
		>;
		readonly storedSupportedContainers: (
			guildId: string,
		) => Effect.Effect<
			readonly StoredSupportedContainer[],
			IndexingRepositoryError
		>;
		readonly getCheckpoint: (
			channelId: string,
			kind: import("@repo/db/helpers/indexing").IndexingCheckpointKind,
		) => Effect.Effect<DBIndexingCheckpoint | null, IndexingRepositoryError>;
		readonly upsertCheckpoint: (
			input: UpsertIndexingCheckpointInput,
		) => Effect.Effect<DBIndexingCheckpoint, IndexingRepositoryError>;
		readonly resetCheckpoint: (
			input: Pick<
				DBIndexingCheckpoint,
				"channelId" | "kind" | "updatedByJobId"
			>,
		) => Effect.Effect<DBIndexingCheckpoint, IndexingRepositoryError>;
		readonly commitMessage: (
			input: CommitConvertedMessageBatchInput,
		) => Effect.Effect<
			CommitConvertedMessageBatchResult,
			IndexingRepositoryError
		>;
		readonly deleteMessage: (
			input: DeleteIndexedMessageInput,
		) => Effect.Effect<IndexedMutationResult, IndexingRepositoryError>;
		readonly deleteThread: (
			input: DeleteIndexedThreadInput,
		) => Effect.Effect<IndexedMutationResult, IndexingRepositoryError>;
		readonly reconcileThread: (
			input: ReconcileIndexedThreadInput,
		) => Effect.Effect<IndexedMutationResult, IndexingRepositoryError>;
		readonly claim: (
			input: ClaimMeiliProjectionBatchInput,
		) => Effect.Effect<readonly MeiliProjection[], IndexingRepositoryError>;
		readonly complete: (
			projectionId: number,
			leaseOwner: string,
		) => Effect.Effect<void, IndexingRepositoryFailure>;
		readonly defer: (
			projectionId: number,
			leaseOwner: string,
			errorCode: string,
			nextAttemptAt: Date,
		) => Effect.Effect<void, IndexingRepositoryFailure>;
		readonly fail: (
			projectionId: number,
			leaseOwner: string,
			errorCode: string,
		) => Effect.Effect<void, IndexingRepositoryFailure>;
		readonly release: (
			leaseOwner: string,
		) => Effect.Effect<void, IndexingRepositoryError>;
		readonly source: (
			projection: MeiliProjection,
		) => Effect.Effect<
			readonly MeiliProjectionSourceDocument[],
			IndexingRepositoryError
		>;
	}
>()("velumn/bot/adapters/IndexingRepository") {
	static readonly layer = Layer.succeed(
		IndexingRepository,
		IndexingRepository.of({
			upsertChannelMetadata: (input) =>
				fromHelpers("upsert-channel-metadata", (helpers) =>
					helpers.upsertIndexingChannelMetadata(input),
				),
			deleteChannel: (input) =>
				fromHelpers("delete-channel", async (helpers) => {
					const deleted = await helpers.deleteIndexingChannelTree(input);
					return {
						affectedRows: deleted.deletedChannelIds.length,
						projectionCount: deleted.projectionCount,
						stale: deleted.deletedChannelIds.length === 0,
					};
				}),
			upsertGuildMetadata: (input) =>
				fromHelpers("upsert-guild-metadata", (helpers) =>
					helpers.upsertIndexingGuildMetadata(input),
				),
			guildInstallationExists: (serverId) =>
				fromHelpers("installation-exists", (helpers) =>
					helpers.hasIndexingGuildInstallation(serverId),
				),
			deleteGuild: (serverId, observedAt) =>
				fromHelpers("delete-guild", (helpers) =>
					helpers.deleteIndexingGuild(serverId, observedAt),
				),
			updateUserProfile: (input) =>
				fromHelpers("update-user-profile", (helpers) =>
					helpers.updateExistingIndexingUserProfile(input),
				),
			reconcilePermissions: (input) =>
				fromHelpers("reconcile-permissions", (helpers) =>
					helpers.reconcileIndexingPermissionDiagnostics(input),
				),
			createJob: (input) =>
				fromHelpers("create-job", (helpers) =>
					helpers.createOrGetIndexingJob(input),
				),
			getJob: (jobId) =>
				fromHelpers("get-job", (helpers) => helpers.getIndexingJob(jobId)),
			startJob: (jobId) =>
				fromHelpers("start-job", (helpers) =>
					helpers.markIndexingJobRunning(jobId),
				),
			completeJob: (jobId, result) =>
				fromHelpers("complete-job", (helpers) =>
					helpers.completeIndexingJob(jobId, result),
				),
			requestJobCancellation: (jobId) =>
				fromHelpers("cancel-job", (helpers) =>
					helpers.requestIndexingJobCancellation(jobId),
				),
			repairJobs: () =>
				fromHelpers("repair-jobs", (helpers) =>
					helpers.repairInterruptedIndexingJobs(),
				),
			activeServerIds: () =>
				fromHelpers("active-servers", (helpers) =>
					helpers.listActiveIndexingServerIds(),
				),
			markServerLeft: (serverId, observedAt) =>
				fromHelpers("mark-server-left", (helpers) =>
					helpers.markIndexingServerLeft(serverId, observedAt),
				),
			storedCandidates: (input) =>
				fromHelpers("stored-candidates", (helpers) =>
					helpers.listStoredReconciliationCandidates(input),
				),
			storedSupportedContainers: (guildId) =>
				fromHelpers("stored-supported-containers", (helpers) =>
					helpers.listStoredSupportedContainers(guildId),
				),
			getCheckpoint: (channelId, kind) =>
				fromHelpers("get-checkpoint", (helpers) =>
					helpers.getIndexingCheckpoint(channelId, kind),
				),
			upsertCheckpoint: (input) =>
				fromHelpers("upsert-checkpoint", (helpers) =>
					helpers.upsertIndexingCheckpoint(input),
				),
			resetCheckpoint: (input) =>
				fromHelpers("reset-checkpoint", (helpers) =>
					helpers.resetIndexingCheckpoint(input),
				),
			sourceFacts: (sourceId) =>
				fromHelpers("source-facts", (helpers) =>
					helpers.loadIndexingSourceFacts(sourceId),
				),
			commitMessage: (input) =>
				fromHelpers("commit-message", (helpers) =>
					helpers.commitConvertedMessageBatch(input),
				),
			deleteMessage: (input) =>
				fromHelpers("delete-message", (helpers) =>
					helpers.deleteIndexedMessage(input),
				),
			deleteThread: (input) =>
				fromHelpers("delete-thread", (helpers) =>
					helpers.deleteIndexedThread(input),
				),
			reconcileThread: (input) =>
				fromHelpers("reconcile-thread", (helpers) =>
					helpers.reconcileIndexedThread(input),
				),
			claim: (input) =>
				fromHelpers("claim", async (helpers) =>
					helpers.claimMeiliProjectionBatch(input),
				),
			complete: (projectionId, leaseOwner) =>
				fromHelpers("complete", (helpers) =>
					helpers.markMeiliProjectionCompleted(projectionId, leaseOwner),
				).pipe(
					Effect.flatMap((row) =>
						row
							? Effect.void
							: Effect.fail(
									new ProjectionLeaseLostError({
										operation: "complete",
										projectionId,
									}),
								),
					),
				),
			defer: (projectionId, leaseOwner, errorCode, nextAttemptAt) =>
				fromHelpers("defer", (helpers) =>
					helpers.deferMeiliProjection(
						projectionId,
						leaseOwner,
						errorCode,
						nextAttemptAt,
					),
				).pipe(
					Effect.flatMap((row) =>
						row
							? Effect.void
							: Effect.fail(
									new ProjectionLeaseLostError({
										operation: "defer",
										projectionId,
									}),
								),
					),
				),
			fail: (projectionId, leaseOwner, errorCode) =>
				fromHelpers("fail", (helpers) =>
					helpers.markMeiliProjectionFailed(
						projectionId,
						leaseOwner,
						errorCode,
					),
				).pipe(
					Effect.flatMap((row) =>
						row
							? Effect.void
							: Effect.fail(
									new ProjectionLeaseLostError({
										operation: "fail",
										projectionId,
									}),
								),
					),
				),
			release: (leaseOwner) =>
				fromHelpers("release", async (helpers) => {
					await helpers.releaseMeiliProjectionClaims(leaseOwner);
				}),
			source: (projection) =>
				fromHelpers("source", async (helpers) =>
					helpers.loadMeiliProjectionSource(projection),
				),
		}),
	);
}

type IndexingHelpers = typeof import("@repo/db/helpers/indexing");

export const upsertIndexingChannelMetadata = (
	input: IndexingChannelMetadataInput,
): Effect.Effect<
	UpsertIndexingChannelMetadataResult,
	IndexingRepositoryError
> =>
	fromHelpers("upsert-channel-metadata", (helpers) =>
		helpers.upsertIndexingChannelMetadata(input),
	);

export const updateExistingIndexingUserProfile = (
	input: IndexingUserProfileInput,
): Effect.Effect<DBUser | null, IndexingRepositoryError> =>
	fromHelpers("update-user-profile", (helpers) =>
		helpers.updateExistingIndexingUserProfile(input),
	);

const fromHelpers = <A>(
	operation: IndexingRepositoryError["operation"],
	run: (helpers: IndexingHelpers) => Promise<A>,
) =>
	Effect.tryPromise({
		try: async () => run(await import("@repo/db/helpers/indexing")),
		catch: (cause) => new IndexingRepositoryError({ operation, cause }),
	});
