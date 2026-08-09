import type {
	InteractionType,
	MessageFlags,
	MessageReferenceType,
	MessageType,
	WebhookType,
} from "discord.js";
import type { Cause, Effect } from "effect";
import { Schema } from "effect";

export type DiscordId = string;

export type ReplacementState<Item> =
	| { readonly _tag: "NotFetched" }
	| { readonly _tag: "Replace"; readonly items: readonly Item[] };

export interface AttachmentState {
	readonly id: DiscordId;
	readonly filename: string;
	readonly contentType: string | null;
	readonly size: number;
	readonly sourceUrl: string;
}

export interface ReactionState {
	readonly emojiId: DiscordId | null;
	readonly emojiName: string;
	readonly animated: boolean;
	readonly count: number;
}

export type AttachmentReplacement = ReplacementState<AttachmentState>;
export type ReactionReplacement = ReplacementState<ReactionState>;

export interface MessageFlagsMetadata {
	readonly bitfield: number;
	readonly known: readonly MessageFlags[];
}

export interface MessageReferenceMetadata {
	readonly type: MessageReferenceType;
	readonly messageId: DiscordId | null;
	readonly channelId: DiscordId;
	readonly guildId: DiscordId | null;
}

export interface WebhookMetadata {
	readonly id: DiscordId;
	readonly type: WebhookType | null;
	readonly displayName: string | null;
	readonly avatarUrl: string | null;
}

export interface InteractionMetadata {
	readonly id: DiscordId;
	readonly type: InteractionType | null;
	readonly applicationId: DiscordId | null;
}

export interface SafeMessageMetadata {
	readonly type: MessageType;
	readonly flags: MessageFlagsMetadata;
	readonly reference: MessageReferenceMetadata | null;
	readonly webhook: WebhookMetadata | null;
	readonly interaction: InteractionMetadata | null;
}

export type IndexMutation =
	| {
			readonly _tag: "UpsertMessage";
			readonly messageId: DiscordId;
			readonly channelId: DiscordId;
			readonly threadId: DiscordId | null;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "DeleteMessage";
			readonly messageId: DiscordId;
			readonly channelId: DiscordId;
			readonly threadId: DiscordId | null;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "DeleteThread";
			readonly threadId: DiscordId;
			readonly parentChannelId: DiscordId;
			readonly guildId: DiscordId;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "ReconcileThread";
			readonly threadId: DiscordId;
			readonly parentChannelId: DiscordId;
			readonly guildId: DiscordId;
			readonly requestedAt: number;
			readonly reconcileStarter?: boolean;
	  }
	| {
			readonly _tag: "UpsertChannel";
			readonly channelId: DiscordId;
			readonly guildId: DiscordId;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "DeleteChannel";
			readonly channelId: DiscordId;
			readonly guildId: DiscordId;
			readonly scope: "self" | "tree";
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "InstallGuild";
			readonly guildId: DiscordId;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "UpsertGuild";
			readonly guildId: DiscordId;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "DeleteGuild";
			readonly guildId: DiscordId;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "UpsertUser";
			readonly userId: DiscordId;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "ReconcileBotMemberPermissions";
			readonly guildId: DiscordId;
			readonly userId: DiscordId;
			readonly deleted: boolean;
			readonly observedAt: number;
	  }
	| {
			readonly _tag: "ReconcileRolePermissions";
			readonly guildId: DiscordId;
			readonly roleId: DiscordId;
			readonly deleted: boolean;
			readonly observedAt: number;
	  };

export type SubmissionSource =
	| "gateway"
	| "manual"
	| "reconciliation"
	| "scheduled";

export interface IndexSubmission {
	readonly id: string;
	readonly source: SubmissionSource;
	readonly orderingKey: DiscordId;
	readonly mutation: IndexMutation;
	readonly submittedAt: number;
}

export type IndexTerminalOutcome<E> =
	| {
			readonly _tag: "Completed";
			readonly submissionId: string;
			readonly completedAt: number;
	  }
	| {
			readonly _tag: "Failed";
			readonly submissionId: string;
			readonly failedAt: number;
			readonly cause: Cause.Cause<E>;
	  };

export interface SubmissionReceipt<E> {
	readonly await: Effect.Effect<IndexTerminalOutcome<E>>;
}

export type IndexSubmissionResult<E> =
	| {
			readonly _tag: "Accepted";
			readonly receipt: SubmissionReceipt<E>;
	  }
	| { readonly _tag: "Overloaded" }
	| { readonly _tag: "Closing" };

export interface IndexCoordinatorState {
	readonly accepting: boolean;
	readonly outstanding: number;
}

export type IndexJobState =
	| "accepted"
	| "running"
	| "retry-scheduled"
	| "completed"
	| "failed"
	| "cancelled";

export interface IndexJob {
	readonly id: string;
	readonly submissionId: string;
	readonly state: IndexJobState;
	readonly attempt: number;
	readonly createdAt: number;
	readonly updatedAt: number;
}

export type IndexOutcome =
	| { readonly _tag: "Accepted"; readonly at: number }
	| { readonly _tag: "Started"; readonly at: number; readonly attempt: number }
	| {
			readonly _tag: "DatabaseCompleted";
			readonly at: number;
			readonly affectedRows: number;
	  }
	| {
			readonly _tag: "ProjectionSubmitted";
			readonly at: number;
			readonly projectionId: string;
	  }
	| {
			readonly _tag: "ProjectionCompleted";
			readonly at: number;
			readonly projectionId: string;
	  }
	| {
			readonly _tag: "RetryScheduled";
			readonly at: number;
			readonly attempt: number;
			readonly delayMs: number;
	  }
	| {
			readonly _tag: "Recovered";
			readonly at: number;
			readonly warningCount: number;
	  }
	| {
			readonly _tag: "Failed";
			readonly at: number;
			readonly classification: IndexErrorClassification;
	  }
	| {
			readonly _tag: "Cancelled";
			readonly at: number;
			readonly reason: "shutdown" | "superseded" | "requested";
	  };

export type IndexErrorClassification =
	| "discord-transient"
	| "discord-permission"
	| "missing-entity"
	| "unsupported-entity"
	| "partial-fetch"
	| "conversion"
	| "privacy-rejection"
	| "database"
	| "projection-submission"
	| "projection-completion"
	| "cache-invalidation"
	| "cancelled"
	| "configuration";

export type RetryDisposition = "retryable" | "terminal";

export type IndexOperation =
	| "fetch-source"
	| "fetch-message-page"
	| "convert-message"
	| "commit-mutation"
	| "submit-projection"
	| "complete-projection"
	| "invalidate-cache"
	| "coordinate-job";

export class IndexingOperationError extends Schema.TaggedError<IndexingOperationError>()(
	"IndexingOperationError",
	{
		operation: Schema.Literals([
			"fetch-source",
			"fetch-message-page",
			"convert-message",
			"commit-mutation",
			"submit-projection",
			"complete-projection",
			"invalidate-cache",
			"coordinate-job",
		]),
		classification: Schema.Literals([
			"discord-transient",
			"discord-permission",
			"missing-entity",
			"unsupported-entity",
			"partial-fetch",
			"conversion",
			"privacy-rejection",
			"database",
			"projection-submission",
			"projection-completion",
			"cache-invalidation",
			"cancelled",
			"configuration",
		]),
		cause: Schema.Defect(),
	},
) {}
