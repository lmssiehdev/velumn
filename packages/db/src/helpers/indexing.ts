import { ChannelType, MessageType } from "discord-api-types/v10";
import {
	and,
	asc,
	eq,
	exists,
	inArray,
	isNull,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "..";
import { isThreadStarterMessage } from "../publication";
import {
	type DBChannel,
	type DBForumTag,
	type DBIndexingCheckpoint,
	type DBIndexingGatewayMutation,
	type DBIndexingJob,
	type DBIndexingJobInsert,
	type DBMeiliProjection,
	type DBMessage,
	type DBUser,
	dbAttachments,
	dbChannel,
	dbChannelAppliedTag,
	dbDiscordUser,
	dbForumTag,
	dbIndexingCheckpoint,
	dbIndexingContainerTombstone,
	dbIndexingGatewayMutation,
	dbIndexingJob,
	dbMeiliProjection,
	dbMessage,
	dbServer,
	dbThreadBacklink,
} from "../schema";
import {
	collectIndexingChannelDeletionIds,
	type IndexingChannelDeletionScope,
} from "./indexing-channel-deletion";
import {
	decodeClaimedIndexingGatewayMutation,
	type RawIndexingGatewayMutation,
} from "./indexing-gateway-mutation";
import type {
	EmbedSchema,
	MessageComponentsSchema,
	MessageMetadataSchema,
} from "./validation";

export type { IndexingChannelDeletionScope } from "./indexing-channel-deletion";
export { IndexingGatewayMutationRowDecodeError } from "./indexing-gateway-mutation";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The subset shared by the root database and an active Drizzle transaction. */
export type IndexingDatabase = Pick<
	DatabaseTransaction,
	"delete" | "execute" | "insert" | "select" | "update"
>;

export type IndexingJobKind = DBIndexingJob["kind"];
export type IndexingCheckpointKind = DBIndexingCheckpoint["kind"];
export type MeiliProjectionOperation = DBMeiliProjection["operation"];

export type EnqueueIndexingGatewayMutationInput = Pick<
	DBIndexingGatewayMutation,
	"mutation" | "orderingKey" | "submissionId" | "submittedAt"
>;

export async function enqueueIndexingGatewayMutation(
	input: EnqueueIndexingGatewayMutationInput,
	database: IndexingDatabase = db,
): Promise<DBIndexingGatewayMutation> {
	const [row] = await database
		.insert(dbIndexingGatewayMutation)
		.values(input)
		.onConflictDoUpdate({
			target: dbIndexingGatewayMutation.submissionId,
			set: { submissionId: input.submissionId },
		})
		.returning();
	if (!row) throw new Error("Failed to enqueue indexing gateway mutation");
	return row;
}

export async function claimIndexingGatewayMutationBatch(
	input: {
		readonly leaseOwner: string;
		readonly leaseExpiresAt: Date;
		readonly limit: number;
		readonly now?: Date;
	},
	database: IndexingDatabase = db,
): Promise<DBIndexingGatewayMutation[]> {
	const limit = Math.trunc(input.limit);
	const now = input.now ?? new Date();
	if (limit < 1)
		throw new RangeError("Gateway mutation claim limit must be positive");
	if (!input.leaseOwner)
		throw new Error("Gateway mutation lease owner is required");
	if (input.leaseExpiresAt <= now) {
		throw new RangeError(
			"Gateway mutation lease expiry must be after claim time",
		);
	}

	const result = await database.execute<RawIndexingGatewayMutation>(sql`
		with candidates as (
			select ${dbIndexingGatewayMutation.id}
			from ${dbIndexingGatewayMutation}
			where (
				(${dbIndexingGatewayMutation.status} = 'pending' and ${dbIndexingGatewayMutation.nextAttemptAt} <= ${now})
				or
				(${dbIndexingGatewayMutation.status} = 'processing' and ${dbIndexingGatewayMutation.leaseExpiresAt} <= ${now})
			)
			and not exists (
				select 1
				from ${dbIndexingGatewayMutation} as earlier
				where earlier.ordering_key = ${dbIndexingGatewayMutation.orderingKey}
					and earlier.id < ${dbIndexingGatewayMutation.id}
					and earlier.status in ('pending', 'processing')
			)
			order by ${dbIndexingGatewayMutation.nextAttemptAt}, ${dbIndexingGatewayMutation.id}
			limit ${limit}
			for update skip locked
		)
		update ${dbIndexingGatewayMutation} as mutation
		set status = 'processing',
			attempt_count = mutation.attempt_count + 1,
			lease_owner = ${input.leaseOwner},
			lease_expires_at = ${input.leaseExpiresAt},
			updated_at = ${now}
		from candidates
		where mutation.id = candidates.id
		returning
			mutation.id,
			mutation.submission_id as "submissionId",
			mutation.ordering_key as "orderingKey",
			mutation.mutation,
			mutation.submitted_at as "submittedAt",
			mutation.status,
			mutation.attempt_count as "attemptCount",
			mutation.next_attempt_at as "nextAttemptAt",
			mutation.lease_owner as "leaseOwner",
			mutation.lease_expires_at as "leaseExpiresAt",
			mutation.last_error_code as "lastErrorCode",
			mutation.created_at as "createdAt",
			mutation.updated_at as "updatedAt"
	`);
	return result.rows.map(decodeClaimedIndexingGatewayMutation);
}

export async function completeIndexingGatewayMutation(
	id: number,
	leaseOwner: string,
	generation: number,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const result = await database.execute<{ id: number }>(sql`
		delete from ${dbIndexingGatewayMutation}
		where ${dbIndexingGatewayMutation.id} = ${id}
			and ${dbIndexingGatewayMutation.status} = 'processing'
			and ${dbIndexingGatewayMutation.leaseOwner} = ${leaseOwner}
			and ${dbIndexingGatewayMutation.attemptCount} = ${generation}
		returning ${dbIndexingGatewayMutation.id}
	`);
	return result.rows.length > 0;
}

export async function deferIndexingGatewayMutation(
	id: number,
	leaseOwner: string,
	generation: number,
	errorCode: string,
	nextAttemptAt: Date,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const result = await database.execute<{ id: number }>(sql`
		update ${dbIndexingGatewayMutation}
		set status = 'pending',
			next_attempt_at = ${nextAttemptAt},
			lease_owner = null,
			lease_expires_at = null,
			last_error_code = ${errorCode},
			updated_at = clock_timestamp()
		where ${dbIndexingGatewayMutation.id} = ${id}
			and ${dbIndexingGatewayMutation.status} = 'processing'
			and ${dbIndexingGatewayMutation.leaseOwner} = ${leaseOwner}
			and ${dbIndexingGatewayMutation.attemptCount} = ${generation}
		returning ${dbIndexingGatewayMutation.id}
	`);
	return result.rows.length > 0;
}

export async function failIndexingGatewayMutation(
	id: number,
	leaseOwner: string,
	generation: number,
	errorCode: string,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const result = await database.execute<{ id: number }>(sql`
		update ${dbIndexingGatewayMutation}
		set status = 'failed',
			lease_owner = null,
			lease_expires_at = null,
			last_error_code = ${errorCode},
			updated_at = clock_timestamp()
		where ${dbIndexingGatewayMutation.id} = ${id}
			and ${dbIndexingGatewayMutation.status} = 'processing'
			and ${dbIndexingGatewayMutation.leaseOwner} = ${leaseOwner}
			and ${dbIndexingGatewayMutation.attemptCount} = ${generation}
		returning ${dbIndexingGatewayMutation.id}
	`);
	return result.rows.length > 0;
}

export async function renewIndexingGatewayMutationLease(
	id: number,
	leaseOwner: string,
	generation: number,
	leaseExpiresAt: Date,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const result = await database.execute<{ id: number }>(sql`
		update ${dbIndexingGatewayMutation}
		set lease_expires_at = ${leaseExpiresAt},
			updated_at = clock_timestamp()
		where ${dbIndexingGatewayMutation.id} = ${id}
			and ${dbIndexingGatewayMutation.status} = 'processing'
			and ${dbIndexingGatewayMutation.leaseOwner} = ${leaseOwner}
			and ${dbIndexingGatewayMutation.attemptCount} = ${generation}
			and ${dbIndexingGatewayMutation.leaseExpiresAt} > clock_timestamp()
		returning ${dbIndexingGatewayMutation.id}
	`);
	return result.rows.length > 0;
}

export async function releaseIndexingGatewayMutationClaim(
	id: number,
	leaseOwner: string,
	generation: number,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const result = await database.execute<{ id: number }>(sql`
		update ${dbIndexingGatewayMutation}
		set status = 'pending',
			lease_owner = null,
			lease_expires_at = null,
			updated_at = clock_timestamp()
		where ${dbIndexingGatewayMutation.id} = ${id}
			and ${dbIndexingGatewayMutation.status} = 'processing'
			and ${dbIndexingGatewayMutation.leaseOwner} = ${leaseOwner}
			and ${dbIndexingGatewayMutation.attemptCount} = ${generation}
		returning ${dbIndexingGatewayMutation.id}
	`);
	return result.rows.length > 0;
}

export type StoredReconciliationCandidate = {
	readonly guildId: string;
	readonly parentChannelId: string;
	readonly threadId: string;
};

export type StoredSupportedContainer = {
	readonly id: string;
	readonly parentId: string | null;
	readonly type: ChannelType;
};

const maximumConvertedMessageBatchSize = 100;

export type IndexingReplacement<Item> =
	| { readonly _tag: "NotFetched" }
	| { readonly _tag: "Replace"; readonly items: readonly Item[] };

export type IndexingUserProfileInput = Pick<
	DBUser,
	"avatar" | "displayName" | "id" | "isBot"
>;

export type IndexingAttachmentInput = {
	readonly id: string;
	readonly filename: string;
	readonly contentType: string | null;
	readonly size: number;
	readonly sourceUrl: string;
};

export type IndexingReactionInput = {
	readonly emojiId: string | null;
	readonly emojiName: string;
	readonly animated: boolean;
	readonly count: number;
};

export type IndexingBacklinkInput = {
	readonly fromMessageId: string;
	readonly fromPublicationChannelId: string;
	readonly toPublicationChannelId: string;
};

/** Serializable counterpart of the bot's converted message output. */
export type ConvertedIndexingMessageInput = {
	readonly id: string;
	readonly serverId: string;
	readonly channelId: string;
	readonly publicationChannelId: string;
	readonly parentChannelId: string | null;
	readonly authorId: string;
	readonly content: string;
	readonly cleanContent: string | null;
	readonly type: MessageType;
	readonly sourceVersion: number;
	readonly pinned: boolean;
	readonly applicationId: string | null;
	readonly childThreadId: string | null;
	readonly referenceId: string | null;
	readonly metadata: MessageMetadataSchema;
	readonly attachments: IndexingReplacement<IndexingAttachmentInput>;
	readonly reactions: IndexingReplacement<IndexingReactionInput>;
	readonly components: IndexingReplacement<MessageComponentsSchema[number]>;
	readonly embeds: IndexingReplacement<EmbedSchema>;
	readonly backlinks: IndexingReplacement<IndexingBacklinkInput>;
};

export type IndexingSourceFacts = {
	readonly sourceId: string;
	readonly serverId: string;
	readonly channelType: number;
	readonly parentChannelType: number | null;
	readonly indexingEnabled: boolean;
	readonly nsfw: boolean;
	readonly botPermissions: string | null;
	readonly botPermissionsCheckedAt: Date | null;
	readonly serverActive: boolean;
	readonly privacyAllowed: boolean;
};

export type IndexingForumTagInput = Pick<
	DBForumTag,
	"emojiId" | "emojiName" | "id" | "moderated" | "name"
>;

export type IndexingChannelMetadataInput = Pick<
	DBChannel,
	| "archived"
	| "archivedTimestamp"
	| "authorId"
	| "botPermissions"
	| "botPermissionsCheckedAt"
	| "channelName"
	| "id"
	| "locked"
	| "nsfw"
	| "parentId"
	| "position"
	| "serverId"
	| "type"
> & {
	readonly observedAt: Date;
	readonly availableTags?: IndexingReplacement<IndexingForumTagInput>;
	readonly appliedTagIds?: IndexingReplacement<string>;
};

export type UpsertIndexingChannelMetadataResult =
	| {
			readonly _tag: "Applied";
			readonly channel: DBChannel;
			readonly observedAt: Date;
	  }
	| {
			readonly _tag: "Deleted";
			readonly containerId: string;
			readonly deletedAt: Date;
			readonly observedAt: Date;
	  }
	| {
			readonly _tag: "MissingInstallation";
			readonly serverId: string;
	  };

export type IndexingGuildMetadataInput = Pick<
	typeof dbServer.$inferSelect,
	"description" | "icon" | "id" | "memberCount" | "name"
>;

export type UpdateIndexingGuildMetadataResult =
	| { readonly _tag: "Updated" }
	| { readonly _tag: "MissingInstallation"; readonly serverId: string };

export type IndexingPermissionDiagnosticsInput = {
	readonly channelId: string;
	readonly serverId: string;
	readonly botPermissions: string | null;
	readonly checkedAt: Date;
	readonly includeDescendants: boolean;
};

export type CommitConvertedMessageBatchInput = {
	readonly sourceId: string;
	readonly messages: readonly ConvertedIndexingMessageInput[];
	readonly users: readonly IndexingUserProfileInput[];
	readonly checkpoint: {
		readonly channelId: string;
		readonly scanCursor: string | null;
		readonly commitCursor: string | null;
	};
	readonly jobId?: string | null;
};

export type CommitConvertedMessageBatchResult = {
	readonly committedMessageIds: readonly string[];
	readonly staleMessageIds: readonly string[];
	readonly privacyRejectedMessageIds: readonly string[];
	readonly projectionCount: number;
};

export class IndexingSourcePolicyError extends Error {
	readonly name = "IndexingSourcePolicyError";

	constructor(
		readonly reason:
			| "missing-source"
			| "inactive-server"
			| "indexing-disabled"
			| "nsfw"
			| "privacy-rejected"
			| "source-mismatch",
	) {
		super(`Indexing source rejected: ${reason}`);
	}
}

export type MeiliProjectionSourceDocument = {
	readonly id: string;
	readonly title: string;
	readonly channelName: string;
	readonly content: string;
	readonly serverId: string;
	readonly threadId: string;
	readonly isThreadStarter: boolean;
	readonly timestamp: number;
};

const projectionParent = alias(dbChannel, "projection_parent");
const projectionParentCategory = alias(dbChannel, "projection_parent_category");
const projectionAuthor = alias(dbDiscordUser, "projection_author");
const projectionStarter = alias(dbMessage, "projection_starter");
const projectionStarterAuthor = alias(
	dbDiscordUser,
	"projection_starter_author",
);
const indexingSourceParent = alias(dbChannel, "indexing_source_parent");
const indexingSourceOwner = alias(dbDiscordUser, "indexing_source_owner");

export async function loadIndexingSourceFacts(
	sourceId: string,
	database: IndexingDatabase = db,
): Promise<IndexingSourceFacts | null> {
	const [row] = await database
		.select({
			sourceId: dbChannel.id,
			serverId: dbChannel.serverId,
			channelType: dbChannel.type,
			parentChannelType: indexingSourceParent.type,
			indexingEnabled: sql<boolean>`coalesce(${indexingSourceParent.indexingEnabled}, ${dbChannel.indexingEnabled})`,
			nsfw: sql<boolean>`${dbChannel.nsfw} or coalesce(${indexingSourceParent.nsfw}, false)`,
			botPermissions: sql<
				string | null
			>`coalesce(${dbChannel.botPermissions}, ${indexingSourceParent.botPermissions})`,
			botPermissionsCheckedAt: sql<Date | null>`coalesce(${dbChannel.botPermissionsCheckedAt}, ${indexingSourceParent.botPermissionsCheckedAt})`,
			serverActive: sql<boolean>`${dbServer.kickedAt} is null`,
			privacyAllowed: sql<boolean>`coalesce(${indexingSourceOwner.isIgnored}, false) = false`,
		})
		.from(dbChannel)
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.leftJoin(
			indexingSourceParent,
			eq(dbChannel.parentId, indexingSourceParent.id),
		)
		.leftJoin(
			indexingSourceOwner,
			eq(dbChannel.authorId, indexingSourceOwner.id),
		)
		.where(eq(dbChannel.id, sourceId))
		.limit(1);
	return row ?? null;
}

/** Mirrors Discord channel/thread metadata without changing dashboard policy. */
export async function upsertIndexingChannelMetadata(
	input: IndexingChannelMetadataInput,
): Promise<UpsertIndexingChannelMetadataResult> {
	return await db.transaction(
		async (tx) => {
			if (!(await hasIndexingGuildInstallation(input.serverId, tx))) {
				return {
					_tag: "MissingInstallation" as const,
					serverId: input.serverId,
				};
			}
			const [tombstone] = await tx
				.select({ deletedAt: dbIndexingContainerTombstone.deletedAt })
				.from(dbIndexingContainerTombstone)
				.where(eq(dbIndexingContainerTombstone.containerId, input.id))
				.limit(1);
			if (tombstone) {
				return {
					_tag: "Deleted" as const,
					containerId: input.id,
					deletedAt: tombstone.deletedAt,
					observedAt: input.observedAt,
				};
			}

			const { appliedTagIds, availableTags, observedAt, ...metadata } = input;
			const [channel] = await tx
				.insert(dbChannel)
				.values({ ...metadata, indexingEnabled: false })
				.onConflictDoUpdate({
					target: dbChannel.id,
					set: {
						serverId: input.serverId,
						parentId: input.parentId,
						authorId: input.authorId,
						channelName: input.channelName,
						position: input.position,
						nsfw: input.nsfw,
						botPermissions:
							input.botPermissionsCheckedAt !== null
								? sql`case
									when ${dbChannel.botPermissionsCheckedAt} is null
										or ${input.botPermissionsCheckedAt} >= ${dbChannel.botPermissionsCheckedAt}
									then ${input.botPermissions}
									else ${dbChannel.botPermissions}
								end`
								: undefined,
						botPermissionsCheckedAt:
							input.botPermissionsCheckedAt !== null
								? sql`case
									when ${dbChannel.botPermissionsCheckedAt} is null
										or ${input.botPermissionsCheckedAt} >= ${dbChannel.botPermissionsCheckedAt}
									then ${input.botPermissionsCheckedAt}
									else ${dbChannel.botPermissionsCheckedAt}
								end`
								: undefined,
						archived: input.archived,
						locked: input.locked,
						archivedTimestamp: input.archivedTimestamp,
						type: input.type,
					},
				})
				.returning();
			if (!channel)
				throw new Error("Failed to upsert indexing channel metadata");
			if (availableTags?._tag === "Replace") {
				if (availableTags.items.length > 0) {
					await tx
						.insert(dbForumTag)
						.values(
							availableTags.items.map((tag) => ({
								...tag,
								channelId: input.id,
							})),
						)
						.onConflictDoUpdate({
							target: dbForumTag.id,
							set: {
								channelId: input.id,
								name: sql.raw(`excluded.${dbForumTag.name.name}`),
								moderated: sql.raw(`excluded.${dbForumTag.moderated.name}`),
								emojiId: sql.raw(`excluded.${dbForumTag.emojiId.name}`),
								emojiName: sql.raw(`excluded.${dbForumTag.emojiName.name}`),
							},
						});
				}
				await tx.delete(dbForumTag).where(
					and(
						eq(dbForumTag.channelId, input.id),
						availableTags.items.length > 0
							? notInArray(
									dbForumTag.id,
									availableTags.items.map(({ id }) => id),
								)
							: undefined,
					),
				);
			}
			if (appliedTagIds?._tag === "Replace") {
				await tx
					.delete(dbChannelAppliedTag)
					.where(eq(dbChannelAppliedTag.channelId, input.id));
				if (appliedTagIds.items.length > 0) {
					await tx.insert(dbChannelAppliedTag).values(
						appliedTagIds.items.map((tagId) => ({
							channelId: input.id,
							tagId,
						})),
					);
				}
			}
			await enqueueIndexingChannelRefreshes(
				{ serverId: input.serverId, channelIds: [input.id] },
				tx,
			);
			return { _tag: "Applied" as const, channel, observedAt };
		},
		{ isolationLevel: "serializable" },
	);
}

/** Refreshes an authorized installation without creating authorization state. */
export async function upsertIndexingGuildMetadata(
	input: IndexingGuildMetadataInput,
): Promise<UpdateIndexingGuildMetadataResult> {
	const rows = await db
		.update(dbServer)
		.set({
			name: input.name,
			description: input.description,
			memberCount: input.memberCount,
			icon: input.icon,
			kickedAt: null,
		})
		.where(eq(dbServer.id, input.id))
		.returning({ id: dbServer.id });
	return rows.length > 0
		? { _tag: "Updated" }
		: { _tag: "MissingInstallation", serverId: input.id };
}

export async function hasIndexingGuildInstallation(
	serverId: string,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const [server] = await database
		.select({ id: dbServer.id })
		.from(dbServer)
		.where(eq(dbServer.id, serverId))
		.limit(1);
	return server !== undefined;
}

export async function reconcileIndexingPermissionDiagnostics(
	input: IndexingPermissionDiagnosticsInput,
): Promise<number> {
	return await db.transaction(async (tx) => {
		const rows = await tx
			.update(dbChannel)
			.set({
				botPermissions: input.botPermissions,
				botPermissionsCheckedAt: input.checkedAt,
			})
			.where(
				and(
					eq(dbChannel.serverId, input.serverId),
					or(
						isNull(dbChannel.botPermissionsCheckedAt),
						sql`${dbChannel.botPermissionsCheckedAt} <= ${input.checkedAt}`,
					),
					input.includeDescendants
						? or(
								eq(dbChannel.id, input.channelId),
								eq(dbChannel.parentId, input.channelId),
							)
						: eq(dbChannel.id, input.channelId),
				),
			)
			.returning({ id: dbChannel.id });
		return rows.length;
	});
}

export async function commitConvertedMessageBatch(
	input: CommitConvertedMessageBatchInput,
): Promise<CommitConvertedMessageBatchResult> {
	if (input.messages.length > maximumConvertedMessageBatchSize) {
		throw new RangeError(
			`Converted message batch cannot exceed ${maximumConvertedMessageBatchSize}`,
		);
	}
	assertUnique(
		input.messages.map(({ id }) => id),
		"message",
	);
	assertUnique(
		input.users.map(({ id }) => id),
		"user",
	);

	return await db.transaction(
		async (tx) => {
			const facts = await loadIndexingSourceFacts(input.sourceId, tx);
			assertSourceCanCommit(facts);
			if (input.checkpoint.channelId !== input.sourceId) {
				throw new IndexingSourcePolicyError("source-mismatch");
			}

			if (input.users.length > 0) {
				await tx
					.insert(dbDiscordUser)
					.values([...input.users])
					.onConflictDoUpdate({
						target: dbDiscordUser.id,
						set: {
							displayName: sql.raw(
								`excluded.${dbDiscordUser.displayName.name}`,
							),
							avatar: sql.raw(`excluded.${dbDiscordUser.avatar.name}`),
							isBot: sql.raw(`excluded.${dbDiscordUser.isBot.name}`),
						},
					});
			}

			const authorIds = [
				...new Set(input.messages.map(({ authorId }) => authorId)),
			];
			const authors = authorIds.length
				? await tx
						.select({
							id: dbDiscordUser.id,
							isIgnored: dbDiscordUser.isIgnored,
						})
						.from(dbDiscordUser)
						.where(inArray(dbDiscordUser.id, authorIds))
				: [];
			const authorPrivacy = new Map(
				authors.map((author) => [author.id, author.isIgnored]),
			);
			const privacyRejectedMessageIds: string[] = [];
			const accepted = input.messages.filter((message) => {
				if (
					message.serverId !== facts.serverId ||
					message.publicationChannelId !== input.sourceId
				) {
					throw new IndexingSourcePolicyError("source-mismatch");
				}
				if (
					!authorPrivacy.has(message.authorId) ||
					authorPrivacy.get(message.authorId) === true
				) {
					privacyRejectedMessageIds.push(message.id);
					return false;
				}
				return true;
			});

			const committedRows: { id: string }[] = [];
			for (const message of accepted) {
				const rows = await tx
					.insert(dbMessage)
					.values(toDatabaseMessage(message))
					.onConflictDoUpdate({
						target: dbMessage.id,
						set: messageConflictUpdate(message),
						setWhere: sql`excluded.${sql.identifier(dbMessage.sourceVersion.name)} > ${dbMessage.sourceVersion}`,
					})
					.returning({ id: dbMessage.id });
				committedRows.push(...rows);
			}
			const committedIds = new Set(committedRows.map(({ id }) => id));
			const committedMessages = accepted.filter(({ id }) =>
				committedIds.has(id),
			);

			await replaceMessageRelations(committedMessages, tx);
			const projections = await enqueueMeiliProjections(
				committedMessages.map((message) => ({
					operation: "message_upsert" as const,
					entityId: message.id,
					partitionKey: message.publicationChannelId,
					serverId: message.serverId,
					jobId: input.jobId ?? null,
				})),
				tx,
			);
			await upsertIndexingCheckpoint(
				{
					...input.checkpoint,
					kind: "message_history",
					updatedByJobId: input.jobId ?? null,
				},
				tx,
			);

			return {
				committedMessageIds: [...committedIds],
				staleMessageIds: accepted.flatMap(({ id }) =>
					committedIds.has(id) ? [] : [id],
				),
				privacyRejectedMessageIds,
				projectionCount: projections.length,
			};
		},
		{ isolationLevel: "serializable" },
	);
}

export type CreateIndexingJobInput = Pick<
	DBIndexingJobInsert,
	| "channelId"
	| "idempotencyKey"
	| "kind"
	| "requestedBy"
	| "serverId"
	| "trigger"
>;

export type CompleteIndexingJobInput =
	| {
			status: "succeeded";
			summary: NonNullable<DBIndexingJob["summary"]>;
	  }
	| {
			status: "partial";
			summary: NonNullable<DBIndexingJob["summary"]>;
			errorCode?: string | null;
	  }
	| {
			status: "failed";
			summary?: DBIndexingJob["summary"];
			errorCode: string;
	  }
	| {
			status: "cancelled";
			summary?: DBIndexingJob["summary"];
	  };

export async function createOrGetIndexingJob(
	input: CreateIndexingJobInput,
	database: IndexingDatabase = db,
): Promise<DBIndexingJob> {
	const insert = database.insert(dbIndexingJob).values(input);
	const rows = input.idempotencyKey
		? await insert
				.onConflictDoUpdate({
					target: dbIndexingJob.idempotencyKey,
					set: { idempotencyKey: input.idempotencyKey },
				})
				.returning()
		: await insert.returning();
	const job = rows[0];
	if (!job) throw new Error("Failed to create or retrieve indexing job");
	return job;
}

export async function markIndexingJobRunning(
	jobId: string,
	database: IndexingDatabase = db,
): Promise<DBIndexingJob | null> {
	const [job] = await database
		.update(dbIndexingJob)
		.set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(dbIndexingJob.id, jobId),
				eq(dbIndexingJob.status, "queued"),
				isNull(dbIndexingJob.cancellationRequestedAt),
			),
		)
		.returning();
	return job ?? null;
}

export async function completeIndexingJob(
	jobId: string,
	result: CompleteIndexingJobInput,
	database: IndexingDatabase = db,
): Promise<DBIndexingJob | null> {
	const errorCode = "errorCode" in result ? result.errorCode : null;
	const [job] = await database
		.update(dbIndexingJob)
		.set({
			status: result.status,
			summary: result.summary ?? null,
			errorCode,
			completedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(dbIndexingJob.id, jobId),
				inArray(dbIndexingJob.status, ["queued", "running"]),
			),
		)
		.returning();
	return job ?? null;
}

export async function requestIndexingJobCancellation(
	jobId: string,
	database: IndexingDatabase = db,
): Promise<DBIndexingJob | null> {
	const now = new Date();
	const [job] = await database
		.update(dbIndexingJob)
		.set({ cancellationRequestedAt: now, updatedAt: now })
		.where(
			and(
				eq(dbIndexingJob.id, jobId),
				inArray(dbIndexingJob.status, ["queued", "running"]),
				isNull(dbIndexingJob.cancellationRequestedAt),
			),
		)
		.returning();
	return job ?? null;
}

export async function getIndexingJob(
	jobId: string,
	database: IndexingDatabase = db,
): Promise<DBIndexingJob | null> {
	const [job] = await database
		.select()
		.from(dbIndexingJob)
		.where(eq(dbIndexingJob.id, jobId))
		.limit(1);
	return job ?? null;
}

/** Marks jobs abandoned by a previous process so they cannot remain running forever. */
export async function repairInterruptedIndexingJobs(
	database: IndexingDatabase = db,
): Promise<DBIndexingJob[]> {
	const now = new Date();
	return await database
		.update(dbIndexingJob)
		.set({
			status: "failed",
			errorCode: "process-restarted",
			completedAt: now,
			updatedAt: now,
		})
		.where(inArray(dbIndexingJob.status, ["queued", "running"]))
		.returning();
}

export async function listActiveIndexingServerIds(
	database: IndexingDatabase = db,
): Promise<string[]> {
	const rows = await database
		.select({ id: dbServer.id })
		.from(dbServer)
		.where(isNull(dbServer.kickedAt));
	return rows.map(({ id }) => id);
}

export async function markIndexingServerLeft(
	serverId: string,
	observedAt: Date,
	database: IndexingDatabase = db,
): Promise<boolean> {
	const rows = await database
		.update(dbServer)
		.set({ kickedAt: observedAt })
		.where(and(eq(dbServer.id, serverId), isNull(dbServer.kickedAt)))
		.returning({ id: dbServer.id });
	return rows.length > 0;
}

export async function deleteIndexingGuild(
	serverId: string,
	observedAt: Date,
): Promise<IndexedMutationResult> {
	return await db.transaction(
		async (tx) => {
			const channels = await tx
				.select({ id: dbChannel.id })
				.from(dbChannel)
				.where(eq(dbChannel.serverId, serverId));
			const updated = await tx
				.update(dbServer)
				.set({ kickedAt: observedAt })
				.where(eq(dbServer.id, serverId))
				.returning({ id: dbServer.id });
			const projections = await enqueueMeiliProjections(
				channels.map(({ id }) => ({
					operation: "container_delete" as const,
					entityId: id,
					partitionKey: id,
					serverId,
					jobId: null,
				})),
				tx,
			);
			return {
				affectedRows: updated.length,
				projectionCount: projections.length,
				stale: updated.length === 0,
			};
		},
		{ isolationLevel: "serializable" },
	);
}

export async function listStoredReconciliationCandidates(
	input: {
		readonly guildId: string;
		readonly parentChannelId?: string;
		readonly threadId?: string;
	},
	database: IndexingDatabase = db,
): Promise<StoredReconciliationCandidate[]> {
	const parent = alias(dbChannel, "reconciliation_parent");
	return (await database
		.select({
			guildId: dbChannel.serverId,
			parentChannelId: dbChannel.parentId,
			threadId: dbChannel.id,
		})
		.from(dbChannel)
		.innerJoin(parent, eq(dbChannel.parentId, parent.id))
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.where(
			and(
				eq(dbChannel.serverId, input.guildId),
				input.parentChannelId
					? eq(dbChannel.parentId, input.parentChannelId)
					: undefined,
				input.threadId ? eq(dbChannel.id, input.threadId) : undefined,
				inArray(dbChannel.type, [
					ChannelType.PublicThread,
					ChannelType.AnnouncementThread,
				]),
				inArray(parent.type, [
					ChannelType.GuildText,
					ChannelType.GuildForum,
					ChannelType.GuildAnnouncement,
				]),
				eq(parent.indexingEnabled, true),
				isNull(dbServer.kickedAt),
			),
		)
		.orderBy(asc(dbChannel.id))) as StoredReconciliationCandidate[];
}

export async function listStoredSupportedContainers(
	guildId: string,
	database: IndexingDatabase = db,
): Promise<StoredSupportedContainer[]> {
	return await database
		.select({
			id: dbChannel.id,
			parentId: dbChannel.parentId,
			type: dbChannel.type,
		})
		.from(dbChannel)
		.where(
			and(
				eq(dbChannel.serverId, guildId),
				inArray(dbChannel.type, [
					ChannelType.GuildCategory,
					ChannelType.GuildText,
					ChannelType.GuildForum,
					ChannelType.GuildAnnouncement,
				]),
			),
		)
		.orderBy(asc(dbChannel.id));
}

export async function getIndexingCheckpoint(
	channelId: string,
	kind: IndexingCheckpointKind,
	database: IndexingDatabase = db,
): Promise<DBIndexingCheckpoint | null> {
	const [checkpoint] = await database
		.select()
		.from(dbIndexingCheckpoint)
		.where(
			and(
				eq(dbIndexingCheckpoint.channelId, channelId),
				eq(dbIndexingCheckpoint.kind, kind),
			),
		)
		.limit(1);
	return checkpoint ?? null;
}

export type UpsertIndexingCheckpointInput = Pick<
	DBIndexingCheckpoint,
	"channelId" | "commitCursor" | "kind" | "scanCursor" | "updatedByJobId"
>;

export async function upsertIndexingCheckpoint(
	input: UpsertIndexingCheckpointInput,
	database: IndexingDatabase = db,
): Promise<DBIndexingCheckpoint> {
	const [checkpoint] = await database
		.insert(dbIndexingCheckpoint)
		.values(input)
		.onConflictDoUpdate({
			target: [dbIndexingCheckpoint.channelId, dbIndexingCheckpoint.kind],
			set: {
				scanCursor:
					input.kind === "message_history"
						? monotonicCursor(dbIndexingCheckpoint.scanCursor, input.scanCursor)
						: input.scanCursor,
				commitCursor:
					input.kind === "message_history"
						? monotonicCursor(
								dbIndexingCheckpoint.commitCursor,
								input.commitCursor,
							)
						: input.commitCursor,
				updatedByJobId: input.updatedByJobId,
				updatedAt: new Date(),
			},
		})
		.returning();
	if (!checkpoint) throw new Error("Failed to upsert indexing checkpoint");
	return checkpoint;
}

export async function resetIndexingCheckpoint(
	input: Pick<DBIndexingCheckpoint, "channelId" | "kind" | "updatedByJobId">,
	database: IndexingDatabase = db,
): Promise<DBIndexingCheckpoint> {
	const [checkpoint] = await database
		.insert(dbIndexingCheckpoint)
		.values({ ...input, scanCursor: null, commitCursor: null })
		.onConflictDoUpdate({
			target: [dbIndexingCheckpoint.channelId, dbIndexingCheckpoint.kind],
			set: {
				scanCursor: null,
				commitCursor: null,
				updatedByJobId: input.updatedByJobId,
				updatedAt: new Date(),
			},
		})
		.returning();
	if (!checkpoint) throw new Error("Failed to reset indexing checkpoint");
	return checkpoint;
}

export type EnqueueMeiliProjectionInput = Pick<
	DBMeiliProjection,
	"entityId" | "jobId" | "operation" | "partitionKey" | "serverId"
>;

export async function enqueueMeiliProjections(
	inputs: readonly EnqueueMeiliProjectionInput[],
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection[]> {
	if (inputs.length === 0) return [];
	return await database
		.insert(dbMeiliProjection)
		.values([...inputs])
		.returning();
}

export async function enqueueIndexingChannelRefreshes(
	input: {
		readonly serverId: string;
		readonly channelIds: readonly string[];
	},
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection[]> {
	if (input.channelIds.length === 0) return [];
	const threads = await database
		.select({ id: dbChannel.id })
		.from(dbChannel)
		.where(
			and(
				eq(dbChannel.serverId, input.serverId),
				or(
					inArray(dbChannel.id, [...input.channelIds]),
					inArray(dbChannel.parentId, [...input.channelIds]),
				),
				inArray(dbChannel.type, [
					ChannelType.GuildAnnouncement,
					ChannelType.PublicThread,
					ChannelType.AnnouncementThread,
				]),
			),
		);
	return await enqueueMeiliProjections(
		threads.map(({ id }) => ({
			operation: "container_refresh",
			entityId: id,
			partitionKey: id,
			serverId: input.serverId,
			jobId: null,
		})),
		database,
	);
}

export type DeleteIndexingMessagesInput = {
	readonly messages: readonly {
		readonly id: string;
		readonly serverId: string;
		readonly partitionKey: string;
	}[];
	readonly jobId?: string | null;
};

export async function deleteIndexingMessages(
	input: DeleteIndexingMessagesInput,
): Promise<{
	readonly deletedMessageIds: readonly string[];
	readonly projectionCount: number;
}> {
	assertUnique(
		input.messages.map(({ id }) => id),
		"message",
	);
	if (input.messages.length === 0) {
		return { deletedMessageIds: [], projectionCount: 0 };
	}
	return await db.transaction(async (tx) => {
		const ids = input.messages.map(({ id }) => id);
		const existing = await tx
			.select({
				id: dbMessage.id,
				serverId: dbMessage.serverId,
				partitionKey: dbMessage.primaryChannelId,
			})
			.from(dbMessage)
			.where(inArray(dbMessage.id, ids));
		const existingById = new Map(
			existing.map((message) => [message.id, message]),
		);
		const deleted = await tx
			.delete(dbMessage)
			.where(inArray(dbMessage.id, ids))
			.returning({ id: dbMessage.id });
		const projections = await enqueueMeiliProjections(
			input.messages.map((message) => {
				const stored = existingById.get(message.id);
				return {
					operation: "message_delete" as const,
					entityId: message.id,
					partitionKey: stored?.partitionKey ?? message.partitionKey,
					serverId: stored?.serverId ?? message.serverId,
					jobId: input.jobId ?? null,
				};
			}),
			tx,
		);
		return {
			deletedMessageIds: deleted.map(({ id }) => id),
			projectionCount: projections.length,
		};
	});
}

export type DeleteIndexingChannelTreeInput = {
	readonly channelId: string;
	readonly serverId: string;
	readonly observedAt: Date;
	readonly scope: IndexingChannelDeletionScope;
	readonly jobId?: string | null;
};

export async function deleteIndexingChannelTree(
	input: DeleteIndexingChannelTreeInput,
): Promise<{
	readonly deletedChannelIds: readonly string[];
	readonly projectionCount: number;
}> {
	return await db.transaction(
		async (tx) => {
			if (!(await hasIndexingGuildInstallation(input.serverId, tx))) {
				return { deletedChannelIds: [], projectionCount: 0 };
			}
			const channels = await collectIndexingChannelDeletionIds(
				input.channelId,
				input.scope,
				async (pending, includeChildren) =>
					await tx
						.select({ id: dbChannel.id, serverId: dbChannel.serverId })
						.from(dbChannel)
						.where(
							and(
								eq(dbChannel.serverId, input.serverId),
								includeChildren
									? or(
											inArray(dbChannel.id, [...pending]),
											inArray(dbChannel.parentId, [...pending]),
										)
									: inArray(dbChannel.id, [...pending]),
							),
						),
			);
			const channelIds = channels.map(({ id }) => id);
			const tombstonedIds = [...new Set([input.channelId, ...channelIds])];
			await tx
				.insert(dbIndexingContainerTombstone)
				.values(
					tombstonedIds.map((containerId) => ({
						containerId,
						deletedAt: input.observedAt,
					})),
				)
				.onConflictDoNothing({
					target: dbIndexingContainerTombstone.containerId,
				});
			if (channelIds.length > 0) {
				// The self-referencing FK atomically sets surviving category children's parents to null.
				await tx.delete(dbChannel).where(inArray(dbChannel.id, channelIds));
			}
			const projections = await enqueueMeiliProjections(
				tombstonedIds.map((channelId) => ({
					operation: "container_delete" as const,
					entityId: channelId,
					partitionKey: channelId,
					serverId: input.serverId,
					jobId: input.jobId ?? null,
				})),
				tx,
			);
			return {
				deletedChannelIds: channelIds,
				projectionCount: projections.length,
			};
		},
		{ isolationLevel: "serializable" },
	);
}

export type IndexedMutationResult = {
	readonly affectedRows: number;
	readonly projectionCount: number;
	readonly stale: boolean;
};

export type DeleteIndexedMessageInput = {
	readonly messageId: string;
	readonly sourceId: string;
	readonly observedAt: number;
};

/** Deletes only when the gateway observation is at least as new as stored data. */
export async function deleteIndexedMessage(
	input: DeleteIndexedMessageInput,
): Promise<IndexedMutationResult> {
	return await db.transaction(
		async (tx) => {
			const [stored] = await tx
				.select({
					id: dbMessage.id,
					partitionKey: dbMessage.primaryChannelId,
					serverId: dbMessage.serverId,
					sourceVersion: dbMessage.sourceVersion,
				})
				.from(dbMessage)
				.where(eq(dbMessage.id, input.messageId))
				.limit(1);

			if (stored && stored.partitionKey !== input.sourceId) {
				throw new IndexingSourcePolicyError("source-mismatch");
			}
			if (stored && stored.sourceVersion > input.observedAt) {
				return { affectedRows: 0, projectionCount: 0, stale: true };
			}

			const facts = stored
				? null
				: await loadIndexingSourceFacts(input.sourceId, tx);
			const serverId = stored?.serverId ?? facts?.serverId;
			const deleted = stored
				? await tx
						.delete(dbMessage)
						.where(
							and(
								eq(dbMessage.id, input.messageId),
								sql`${dbMessage.sourceVersion} <= ${input.observedAt}`,
							),
						)
						.returning({ id: dbMessage.id })
				: [];
			const projections = serverId
				? await enqueueMeiliProjections(
						[
							{
								operation: "message_delete",
								entityId: input.messageId,
								partitionKey: input.sourceId,
								serverId,
								jobId: null,
							},
						],
						tx,
					)
				: [];

			return {
				affectedRows: deleted.length,
				projectionCount: projections.length,
				stale: false,
			};
		},
		{ isolationLevel: "serializable" },
	);
}

export type DeleteIndexedThreadInput = {
	readonly threadId: string;
	readonly parentChannelId: string;
	readonly serverId: string;
	readonly observedAt: number;
};

export async function deleteIndexedThread(
	input: DeleteIndexedThreadInput,
): Promise<IndexedMutationResult> {
	return await db.transaction(
		async (tx) => {
			if (!(await hasIndexingGuildInstallation(input.serverId, tx))) {
				return { affectedRows: 0, projectionCount: 0, stale: true };
			}
			const [thread] = await tx
				.select({
					parentId: dbChannel.parentId,
					serverId: dbChannel.serverId,
				})
				.from(dbChannel)
				.where(eq(dbChannel.id, input.threadId))
				.limit(1);
			if (thread && thread.parentId !== input.parentChannelId) {
				throw new IndexingSourcePolicyError("source-mismatch");
			}
			if (thread && thread.serverId !== input.serverId) {
				throw new IndexingSourcePolicyError("source-mismatch");
			}
			const [parent] = thread
				? []
				: await tx
						.select({ serverId: dbChannel.serverId })
						.from(dbChannel)
						.where(eq(dbChannel.id, input.parentChannelId))
						.limit(1);
			if (parent && parent.serverId !== input.serverId) {
				throw new IndexingSourcePolicyError("source-mismatch");
			}
			const serverId = thread?.serverId ?? parent?.serverId ?? input.serverId;
			await tx
				.insert(dbIndexingContainerTombstone)
				.values({
					containerId: input.threadId,
					deletedAt: new Date(input.observedAt),
				})
				.onConflictDoNothing({
					target: dbIndexingContainerTombstone.containerId,
				});
			const deleted = thread
				? await tx
						.delete(dbChannel)
						.where(eq(dbChannel.id, input.threadId))
						.returning({ id: dbChannel.id })
				: [];
			const projections = serverId
				? await enqueueMeiliProjections(
						[
							{
								operation: "container_delete",
								entityId: input.threadId,
								partitionKey: input.threadId,
								serverId,
								jobId: null,
							},
						],
						tx,
					)
				: [];

			return {
				affectedRows: deleted.length,
				projectionCount: projections.length,
				stale: false,
			};
		},
		{ isolationLevel: "serializable" },
	);
}

export type ReconcileIndexedThreadInput = {
	readonly threadId: string;
	readonly parentChannelId: string;
	readonly requestedAt: number;
};

export async function reconcileIndexedThread(
	input: ReconcileIndexedThreadInput,
): Promise<IndexedMutationResult> {
	return await db.transaction(async (tx) => {
		const [thread] = await tx
			.select({ serverId: dbChannel.serverId })
			.from(dbChannel)
			.where(
				and(
					eq(dbChannel.id, input.threadId),
					eq(dbChannel.parentId, input.parentChannelId),
				),
			)
			.limit(1);
		if (!thread) {
			return { affectedRows: 0, projectionCount: 0, stale: true };
		}
		const projections = await enqueueMeiliProjections(
			[
				{
					operation: "container_refresh",
					entityId: input.threadId,
					partitionKey: input.threadId,
					serverId: thread.serverId,
					jobId: null,
				},
			],
			tx,
		);
		return {
			affectedRows: 1,
			projectionCount: projections.length,
			stale: false,
		};
	});
}

/** Gateway profile updates must not create a privacy record implicitly. */
export async function updateExistingIndexingUserProfile(
	input: IndexingUserProfileInput,
	database: IndexingDatabase = db,
): Promise<DBUser | null> {
	const [user] = await database
		.update(dbDiscordUser)
		.set({
			displayName: input.displayName,
			avatar: input.avatar,
			isBot: input.isBot,
		})
		.where(eq(dbDiscordUser.id, input.id))
		.returning();
	return user ?? null;
}

export type ClaimMeiliProjectionBatchInput = {
	leaseOwner: string;
	leaseExpiresAt: Date;
	limit: number;
	now?: Date;
};

export async function claimMeiliProjectionBatch(
	input: ClaimMeiliProjectionBatchInput,
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection[]> {
	const limit = Math.trunc(input.limit);
	const now = input.now ?? new Date();
	if (limit < 1)
		throw new RangeError("Projection claim limit must be positive");
	if (!input.leaseOwner) throw new Error("Projection lease owner is required");
	if (input.leaseExpiresAt <= now) {
		throw new RangeError(
			"Projection lease expiry must be after the claim time",
		);
	}

	const result = await database.execute<DBMeiliProjection>(sql`
		with candidates as (
			select ${dbMeiliProjection.id}
			from ${dbMeiliProjection}
			where (
				(${dbMeiliProjection.status} = 'pending' and ${dbMeiliProjection.nextAttemptAt} <= ${now})
				or
				(${dbMeiliProjection.status} = 'processing' and ${dbMeiliProjection.leaseExpiresAt} <= ${now})
			)
			and not exists (
				select 1
				from ${dbMeiliProjection} as earlier
				where earlier.partition_key = ${dbMeiliProjection.partitionKey}
					and earlier.id < ${dbMeiliProjection.id}
					and earlier.status in ('pending', 'processing')
			)
			order by ${dbMeiliProjection.nextAttemptAt}, ${dbMeiliProjection.id}
			limit ${limit}
			for update skip locked
		)
		update ${dbMeiliProjection} as projection
		set
			status = 'processing',
			attempt_count = projection.attempt_count + 1,
			lease_owner = ${input.leaseOwner},
			lease_expires_at = ${input.leaseExpiresAt},
			updated_at = ${now}
		from candidates
		where projection.id = candidates.id
		returning
			projection.id,
			projection.operation,
			projection.entity_id as "entityId",
			projection.partition_key as "partitionKey",
			projection.server_id as "serverId",
			projection.job_id as "jobId",
			projection.status,
			projection.attempt_count as "attemptCount",
			projection.next_attempt_at as "nextAttemptAt",
			projection.lease_owner as "leaseOwner",
			projection.lease_expires_at as "leaseExpiresAt",
			projection.submitted_at as "submittedAt",
			projection.meili_task_uid as "meiliTaskUid",
			projection.completed_at as "completedAt",
			projection.last_error_code as "lastErrorCode",
			projection.created_at as "createdAt",
			projection.updated_at as "updatedAt"
	`);
	return result.rows;
}

export async function markMeiliProjectionSubmitted(
	projectionId: number,
	leaseOwner: string,
	meiliTaskUid: number,
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection | null> {
	const now = new Date();
	const [projection] = await database
		.update(dbMeiliProjection)
		.set({ meiliTaskUid, submittedAt: now, updatedAt: now })
		.where(ownedProcessingProjection(projectionId, leaseOwner))
		.returning();
	return projection ?? null;
}

export async function markMeiliProjectionCompleted(
	projectionId: number,
	leaseOwner: string,
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection | null> {
	const now = new Date();
	const [projection] = await database
		.update(dbMeiliProjection)
		.set({
			status: "completed",
			completedAt: now,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastErrorCode: null,
			updatedAt: now,
		})
		.where(ownedProcessingProjection(projectionId, leaseOwner))
		.returning();
	return projection ?? null;
}

export async function deferMeiliProjection(
	projectionId: number,
	leaseOwner: string,
	errorCode: string,
	nextAttemptAt: Date,
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection | null> {
	const [projection] = await database
		.update(dbMeiliProjection)
		.set({
			status: "pending",
			nextAttemptAt,
			leaseOwner: null,
			leaseExpiresAt: null,
			submittedAt: null,
			meiliTaskUid: null,
			lastErrorCode: errorCode,
			updatedAt: new Date(),
		})
		.where(ownedProcessingProjection(projectionId, leaseOwner))
		.returning();
	return projection ?? null;
}

export async function markMeiliProjectionFailed(
	projectionId: number,
	leaseOwner: string,
	errorCode: string,
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection | null> {
	const now = new Date();
	const [projection] = await database
		.update(dbMeiliProjection)
		.set({
			status: "failed",
			completedAt: now,
			leaseOwner: null,
			leaseExpiresAt: null,
			submittedAt: null,
			meiliTaskUid: null,
			lastErrorCode: errorCode,
			updatedAt: now,
		})
		.where(ownedProcessingProjection(projectionId, leaseOwner))
		.returning();
	return projection ?? null;
}

export async function releaseMeiliProjectionClaims(
	leaseOwner: string,
	database: IndexingDatabase = db,
): Promise<DBMeiliProjection[]> {
	return await database
		.update(dbMeiliProjection)
		.set({
			status: "pending",
			leaseOwner: null,
			leaseExpiresAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(dbMeiliProjection.status, "processing"),
				eq(dbMeiliProjection.leaseOwner, leaseOwner),
			),
		)
		.returning();
}

export async function loadMeiliProjectionSource(
	projection: Pick<DBMeiliProjection, "entityId" | "operation" | "serverId">,
	database: IndexingDatabase = db,
): Promise<MeiliProjectionSourceDocument[]> {
	if (
		projection.operation !== "message_upsert" &&
		projection.operation !== "container_refresh" &&
		projection.operation !== "rebuild"
	) {
		return [];
	}

	const rows = await database
		.select({
			id: dbMessage.id,
			title: dbChannel.channelName,
			channelName: sql<
				string | null
			>`coalesce(${projectionParent.channelName}, ${dbChannel.channelName})`,
			content: dbMessage.cleanContent,
			fallbackContent: dbMessage.content,
			serverId: dbMessage.serverId,
			threadId: dbChannel.id,
			isThreadStarter: dbMessage.starterMessage,
		})
		.from(dbMessage)
		.innerJoin(dbChannel, eq(dbMessage.primaryChannelId, dbChannel.id))
		.innerJoin(projectionParent, eq(dbChannel.parentId, projectionParent.id))
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.innerJoin(projectionAuthor, eq(dbMessage.authorId, projectionAuthor.id))
		.where(
			and(
				eq(dbMessage.serverId, projection.serverId),
				projection.operation === "message_upsert"
					? eq(dbMessage.id, projection.entityId)
					: projection.operation === "container_refresh"
						? eq(dbChannel.id, projection.entityId)
						: undefined,
				inArray(dbChannel.type, [
					ChannelType.PublicThread,
					ChannelType.AnnouncementThread,
				]),
				eq(projectionParent.serverId, dbChannel.serverId),
				or(
					isNull(projectionParent.parentId),
					exists(
						database
							.select({ one: sql`1` })
							.from(projectionParentCategory)
							.where(
								and(
									eq(projectionParentCategory.id, projectionParent.parentId),
									eq(
										projectionParentCategory.serverId,
										projectionParent.serverId,
									),
									eq(projectionParentCategory.type, ChannelType.GuildCategory),
								),
							),
					),
				),
				inArray(projectionParent.type, [
					ChannelType.GuildText,
					ChannelType.GuildForum,
					ChannelType.GuildAnnouncement,
				]),
				eq(projectionParent.indexingEnabled, true),
				exists(
					database
						.select({ one: sql`1` })
						.from(projectionStarter)
						.innerJoin(
							projectionStarterAuthor,
							eq(projectionStarter.authorId, projectionStarterAuthor.id),
						)
						.where(
							and(
								eq(projectionStarter.serverId, dbChannel.serverId),
								eq(projectionStarter.primaryChannelId, dbChannel.id),
								eq(projectionStarter.starterMessage, true),
								eq(projectionStarter.isIgnored, false),
								or(
									isNull(projectionStarterAuthor.isIgnored),
									eq(projectionStarterAuthor.isIgnored, false),
								),
							),
						),
				),
				isNull(dbServer.kickedAt),
				eq(dbMessage.isIgnored, false),
				or(
					isNull(projectionAuthor.isIgnored),
					eq(projectionAuthor.isIgnored, false),
				),
			),
		)
		.orderBy(asc(dbMessage.id));

	return rows.map((row) => ({
		id: row.id,
		title: row.title ?? "Untitled thread",
		channelName: row.channelName ?? "Unknown channel",
		content: row.content ?? row.fallbackContent,
		serverId: row.serverId,
		threadId: row.threadId,
		isThreadStarter: row.isThreadStarter,
		timestamp: Number(BigInt(row.id) >> 22n) + 1_420_070_400_000,
	}));
}

function ownedProcessingProjection(projectionId: number, leaseOwner: string) {
	return and(
		eq(dbMeiliProjection.id, projectionId),
		eq(dbMeiliProjection.status, "processing"),
		eq(dbMeiliProjection.leaseOwner, leaseOwner),
	);
}

function monotonicCursor(
	column: typeof dbIndexingCheckpoint.scanCursor,
	value: string | null,
) {
	if (value === null) return column;
	return sql<string>`greatest(coalesce(${column}, 0), ${value})`;
}

function assertUnique(values: readonly string[], kind: string): void {
	if (new Set(values).size !== values.length) {
		throw new Error(`Indexing ${kind} input contains duplicate IDs`);
	}
}

function assertSourceCanCommit(
	facts: IndexingSourceFacts | null,
): asserts facts is IndexingSourceFacts {
	if (!facts) throw new IndexingSourcePolicyError("missing-source");
	if (!facts.serverActive) {
		throw new IndexingSourcePolicyError("inactive-server");
	}
	if (!facts.indexingEnabled) {
		throw new IndexingSourcePolicyError("indexing-disabled");
	}
	if (facts.nsfw) throw new IndexingSourcePolicyError("nsfw");
	if (!facts.privacyAllowed) {
		throw new IndexingSourcePolicyError("privacy-rejected");
	}
	const supported =
		facts.channelType === ChannelType.GuildAnnouncement ||
		((facts.channelType === ChannelType.PublicThread ||
			facts.channelType === ChannelType.AnnouncementThread) &&
			(facts.parentChannelType === ChannelType.GuildText ||
				facts.parentChannelType === ChannelType.GuildForum ||
				facts.parentChannelType === ChannelType.GuildAnnouncement));
	if (!supported) throw new IndexingSourcePolicyError("source-mismatch");
}

function toDatabaseMessage(message: ConvertedIndexingMessageInput): DBMessage {
	return {
		id: message.id,
		sourceVersion: message.sourceVersion,
		serverId: message.serverId,
		channelId: message.channelId,
		authorId: message.authorId,
		childThreadId: message.childThreadId,
		parentChannelId: message.parentChannelId,
		cleanContent: message.cleanContent,
		content: message.content,
		pinned: message.pinned,
		type: message.type,
		webhookId: null,
		referenceId: message.referenceId,
		applicationId: message.applicationId,
		reactions:
			message.reactions._tag === "Replace"
				? message.reactions.items.map((reaction) => ({
						id: reaction.emojiId,
						name: reaction.emojiName,
						animated: reaction.animated,
						count: reaction.count,
						messageId: message.id,
						isServerEmoji: reaction.emojiId !== null,
					}))
				: null,
		embeds:
			message.embeds._tag === "Replace" ? [...message.embeds.items] : null,
		poll: null,
		metadata: message.metadata,
		components:
			message.components._tag === "Replace"
				? ([...message.components.items] as DBMessage["components"])
				: null,
		snapshot: null,
		starterMessage: isThreadStarterMessage({
			messageId: message.id,
			messageType: message.type,
			sourceChannelId: message.channelId,
			publicationChannelId: message.publicationChannelId,
		}),
		stickers: null,
		primaryChannelId: message.publicationChannelId,
		isIgnored: false,
	};
}

function messageConflictUpdate(message: ConvertedIndexingMessageInput) {
	const stored = toDatabaseMessage(message);
	return {
		sourceVersion: stored.sourceVersion,
		serverId: stored.serverId,
		channelId: stored.channelId,
		authorId: stored.authorId,
		childThreadId: stored.childThreadId,
		parentChannelId: stored.parentChannelId,
		cleanContent: stored.cleanContent,
		content: stored.content,
		pinned: stored.pinned,
		type: stored.type,
		referenceId: stored.referenceId,
		applicationId: stored.applicationId,
		metadata: stored.metadata,
		starterMessage: stored.starterMessage,
		primaryChannelId: stored.primaryChannelId,
		isIgnored: false,
		reactions:
			message.reactions._tag === "Replace" ? stored.reactions : undefined,
		components:
			message.components._tag === "Replace" ? stored.components : undefined,
		embeds: message.embeds._tag === "Replace" ? stored.embeds : undefined,
	};
}

async function replaceMessageRelations(
	messages: readonly ConvertedIndexingMessageInput[],
	tx: DatabaseTransaction,
): Promise<void> {
	for (const message of messages) {
		if (message.attachments._tag === "Replace") {
			await tx
				.delete(dbAttachments)
				.where(eq(dbAttachments.messageId, message.id));
			if (message.attachments.items.length > 0) {
				await tx.insert(dbAttachments).values(
					message.attachments.items.map((attachment) => ({
						id: attachment.id,
						messageId: message.id,
						name: attachment.filename,
						url: attachment.sourceUrl,
						proxyURL: attachment.sourceUrl,
						description: null,
						contentType: attachment.contentType,
						size: attachment.size,
						height: null,
						width: null,
						isSnapshot: false,
					})),
				);
			}
		}

		if (message.backlinks._tag === "Replace") {
			await tx
				.delete(dbThreadBacklink)
				.where(eq(dbThreadBacklink.fromMessageId, message.id));
			for (const backlink of message.backlinks.items) {
				if (
					backlink.fromMessageId !== message.id ||
					backlink.fromPublicationChannelId !== message.publicationChannelId
				) {
					throw new IndexingSourcePolicyError("source-mismatch");
				}
			}
			const targetIds = [
				...new Set(
					message.backlinks.items.map(
						({ toPublicationChannelId }) => toPublicationChannelId,
					),
				),
			];
			const existingTargetIds = new Set(
				targetIds.length === 0
					? []
					: (
							await tx
								.select({ id: dbChannel.id })
								.from(dbChannel)
								.where(inArray(dbChannel.id, targetIds))
						).map(({ id }) => id),
			);
			const backlinks = message.backlinks.items.filter((backlink) =>
				existingTargetIds.has(backlink.toPublicationChannelId),
			);
			if (backlinks.length > 0) {
				await tx.insert(dbThreadBacklink).values(
					backlinks.map((backlink) => ({
						fromMessageId: backlink.fromMessageId,
						fromThreadId: backlink.fromPublicationChannelId,
						toThreadId: backlink.toPublicationChannelId,
					})),
				);
			}
		}
	}
}
