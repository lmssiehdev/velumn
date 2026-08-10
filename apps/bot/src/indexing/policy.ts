import { ChannelType, MessageFlags, MessageType } from "discord.js";
import type { IndexErrorClassification, RetryDisposition } from "./model";

export type SourceRejectionReason =
	| "unsupported-source"
	| "unsupported-parent"
	| "indexing-disabled"
	| "nsfw"
	| "not-viewable"
	| "missing-view-channel"
	| "missing-read-message-history"
	| "privacy-rejected";

export interface SourceEligibilityFacts {
	readonly channelType: ChannelType;
	readonly parentChannelType: ChannelType | null;
	/** True only when the source's controlling root channel is opted in. */
	readonly indexingEnabled: boolean;
	/** Includes inherited parent/category NSFW state. */
	readonly nsfw: boolean;
	readonly viewable: boolean;
	readonly hasViewChannel: boolean;
	readonly hasReadMessageHistory: boolean;
	readonly privacyAllowed: boolean;
}

export type SourceEligibility =
	| { readonly _tag: "Eligible"; readonly kind: "thread" | "root-announcement" }
	| { readonly _tag: "Ineligible"; readonly reason: SourceRejectionReason };

export type MessageTypeClassification =
	| { readonly _tag: "Publishable"; readonly type: MessageType }
	| { readonly _tag: "TerminallySkipped"; readonly type: MessageType }
	| { readonly _tag: "UnsupportedFuture"; readonly type: number };

export type MessageEligibility =
	| { readonly _tag: "Publishable" }
	| {
			readonly _tag: "TerminallySkipped";
			readonly reason: SourceRejectionReason | "message-type" | "voice-message";
	  }
	| { readonly _tag: "UnsupportedFuture"; readonly messageType: number };

const publishableMessageTypes = new Set<number>([
	MessageType.Default,
	MessageType.Reply,
	MessageType.ChatInputCommand,
	MessageType.ThreadStarterMessage,
	MessageType.ContextMenuCommand,
]);

// Deliberately exhaustive for discord.js 14.27. New enum members require an
// explicit product decision instead of silently becoming terminal skips.
const knownMessageTypes = new Set<number>([
	MessageType.Default,
	MessageType.RecipientAdd,
	MessageType.RecipientRemove,
	MessageType.Call,
	MessageType.ChannelNameChange,
	MessageType.ChannelIconChange,
	MessageType.ChannelPinnedMessage,
	MessageType.UserJoin,
	MessageType.GuildBoost,
	MessageType.GuildBoostTier1,
	MessageType.GuildBoostTier2,
	MessageType.GuildBoostTier3,
	MessageType.ChannelFollowAdd,
	MessageType.GuildDiscoveryDisqualified,
	MessageType.GuildDiscoveryRequalified,
	MessageType.GuildDiscoveryGracePeriodInitialWarning,
	MessageType.GuildDiscoveryGracePeriodFinalWarning,
	MessageType.ThreadCreated,
	MessageType.Reply,
	MessageType.ChatInputCommand,
	MessageType.ThreadStarterMessage,
	MessageType.GuildInviteReminder,
	MessageType.ContextMenuCommand,
	MessageType.AutoModerationAction,
	MessageType.RoleSubscriptionPurchase,
	MessageType.InteractionPremiumUpsell,
	MessageType.StageStart,
	MessageType.StageEnd,
	MessageType.StageSpeaker,
	MessageType.StageRaiseHand,
	MessageType.StageTopic,
	MessageType.GuildApplicationPremiumSubscription,
	MessageType.GuildIncidentAlertModeEnabled,
	MessageType.GuildIncidentAlertModeDisabled,
	MessageType.GuildIncidentReportRaid,
	MessageType.GuildIncidentReportFalseAlarm,
	MessageType.PurchaseNotification,
	MessageType.PollResult,
]);

const sourceKind = (
	facts: SourceEligibilityFacts,
): "thread" | "root-announcement" | SourceRejectionReason => {
	if (facts.channelType === ChannelType.PublicThread) {
		if (
			facts.parentChannelType !== ChannelType.GuildText &&
			facts.parentChannelType !== ChannelType.GuildForum
		) {
			return "unsupported-parent";
		}
		return "thread";
	}

	if (facts.channelType === ChannelType.AnnouncementThread) {
		return facts.parentChannelType === ChannelType.GuildAnnouncement
			? "thread"
			: "unsupported-parent";
	}

	if (facts.channelType === ChannelType.GuildAnnouncement) {
		return "root-announcement";
	}

	return "unsupported-source";
};

export const decideSourceEligibility = (
	facts: SourceEligibilityFacts,
): SourceEligibility => {
	const kind = sourceKind(facts);
	if (kind !== "thread" && kind !== "root-announcement") {
		return { _tag: "Ineligible", reason: kind };
	}
	if (!facts.indexingEnabled) {
		return { _tag: "Ineligible", reason: "indexing-disabled" };
	}
	if (facts.nsfw) return { _tag: "Ineligible", reason: "nsfw" };
	if (!facts.viewable) return { _tag: "Ineligible", reason: "not-viewable" };
	if (!facts.hasViewChannel) {
		return { _tag: "Ineligible", reason: "missing-view-channel" };
	}
	if (!facts.hasReadMessageHistory) {
		return { _tag: "Ineligible", reason: "missing-read-message-history" };
	}
	if (!facts.privacyAllowed) {
		return { _tag: "Ineligible", reason: "privacy-rejected" };
	}
	return { _tag: "Eligible", kind };
};

export const classifyMessageType = (
	type: number,
): MessageTypeClassification => {
	if (publishableMessageTypes.has(type)) {
		return { _tag: "Publishable", type: type as MessageType };
	}
	if (knownMessageTypes.has(type)) {
		return { _tag: "TerminallySkipped", type: type as MessageType };
	}
	return { _tag: "UnsupportedFuture", type };
};

export const decideMessageEligibility = (
	facts: SourceEligibilityFacts & {
		readonly messageType: number;
		readonly messageFlags: number;
	},
): MessageEligibility => {
	const source = decideSourceEligibility(facts);
	if (source._tag === "Ineligible") {
		return { _tag: "TerminallySkipped", reason: source.reason };
	}
	if ((facts.messageFlags & MessageFlags.IsVoiceMessage) !== 0) {
		return { _tag: "TerminallySkipped", reason: "voice-message" };
	}

	const messageType = classifyMessageType(facts.messageType);
	if (messageType._tag === "UnsupportedFuture") {
		return { _tag: "UnsupportedFuture", messageType: messageType.type };
	}
	return messageType._tag === "Publishable"
		? { _tag: "Publishable" }
		: { _tag: "TerminallySkipped", reason: "message-type" };
};

const retryableClassifications = new Set<IndexErrorClassification>([
	"discord-transient",
	"partial-fetch",
	"database",
	"projection-submission",
	"projection-completion",
]);

export const retryDispositionFor = (
	classification: IndexErrorClassification,
): RetryDisposition =>
	retryableClassifications.has(classification) ? "retryable" : "terminal";
