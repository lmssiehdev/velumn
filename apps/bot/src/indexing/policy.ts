import { ChannelType, MessageFlags, MessageType } from "discord.js";
import { Match } from "effect";

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

type MessageTypeDisposition = "publishable" | "terminally-skipped";

const messageTypeDispositions = {
	[MessageType.Default]: "publishable",
	[MessageType.RecipientAdd]: "terminally-skipped",
	[MessageType.RecipientRemove]: "terminally-skipped",
	[MessageType.Call]: "terminally-skipped",
	[MessageType.ChannelNameChange]: "terminally-skipped",
	[MessageType.ChannelIconChange]: "terminally-skipped",
	[MessageType.ChannelPinnedMessage]: "terminally-skipped",
	[MessageType.UserJoin]: "terminally-skipped",
	[MessageType.GuildBoost]: "terminally-skipped",
	[MessageType.GuildBoostTier1]: "terminally-skipped",
	[MessageType.GuildBoostTier2]: "terminally-skipped",
	[MessageType.GuildBoostTier3]: "terminally-skipped",
	[MessageType.ChannelFollowAdd]: "terminally-skipped",
	[MessageType.GuildDiscoveryDisqualified]: "terminally-skipped",
	[MessageType.GuildDiscoveryRequalified]: "terminally-skipped",
	[MessageType.GuildDiscoveryGracePeriodInitialWarning]: "terminally-skipped",
	[MessageType.GuildDiscoveryGracePeriodFinalWarning]: "terminally-skipped",
	[MessageType.ThreadCreated]: "terminally-skipped",
	[MessageType.Reply]: "publishable",
	[MessageType.ChatInputCommand]: "publishable",
	[MessageType.ThreadStarterMessage]: "publishable",
	[MessageType.GuildInviteReminder]: "terminally-skipped",
	[MessageType.ContextMenuCommand]: "publishable",
	[MessageType.AutoModerationAction]: "terminally-skipped",
	[MessageType.RoleSubscriptionPurchase]: "terminally-skipped",
	[MessageType.InteractionPremiumUpsell]: "terminally-skipped",
	[MessageType.StageStart]: "terminally-skipped",
	[MessageType.StageEnd]: "terminally-skipped",
	[MessageType.StageSpeaker]: "terminally-skipped",
	[MessageType.StageRaiseHand]: "terminally-skipped",
	[MessageType.StageTopic]: "terminally-skipped",
	[MessageType.GuildApplicationPremiumSubscription]: "terminally-skipped",
	[MessageType.GuildIncidentAlertModeEnabled]: "terminally-skipped",
	[MessageType.GuildIncidentAlertModeDisabled]: "terminally-skipped",
	[MessageType.GuildIncidentReportRaid]: "terminally-skipped",
	[MessageType.GuildIncidentReportFalseAlarm]: "terminally-skipped",
	[MessageType.PurchaseNotification]: "terminally-skipped",
	[MessageType.PollResult]: "terminally-skipped",
} as const satisfies Readonly<Record<MessageType, MessageTypeDisposition>>;

const isMessageType = (type: number): type is MessageType =>
	Object.hasOwn(messageTypeDispositions, type);

const classifySource = (facts: SourceEligibilityFacts): SourceEligibility => {
	if (facts.channelType === ChannelType.PublicThread) {
		if (
			facts.parentChannelType !== ChannelType.GuildText &&
			facts.parentChannelType !== ChannelType.GuildForum
		) {
			return { _tag: "Ineligible", reason: "unsupported-parent" };
		}
		return { _tag: "Eligible", kind: "thread" };
	}

	if (facts.channelType === ChannelType.AnnouncementThread) {
		return facts.parentChannelType === ChannelType.GuildAnnouncement
			? { _tag: "Eligible", kind: "thread" }
			: { _tag: "Ineligible", reason: "unsupported-parent" };
	}

	if (facts.channelType === ChannelType.GuildAnnouncement) {
		return { _tag: "Eligible", kind: "root-announcement" };
	}

	return { _tag: "Ineligible", reason: "unsupported-source" };
};

export const decideSourceEligibility = (
	facts: SourceEligibilityFacts,
): SourceEligibility => {
	const source = classifySource(facts);
	if (source._tag === "Ineligible") {
		return source;
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
	return source;
};

export const classifyMessageType = (
	type: number,
): MessageTypeClassification => {
	if (!isMessageType(type)) {
		return { _tag: "UnsupportedFuture", type };
	}
	return messageTypeDispositions[type] === "publishable"
		? { _tag: "Publishable", type }
		: { _tag: "TerminallySkipped", type };
};

const messageEligibilityFor = Match.typeTags<
	MessageTypeClassification,
	MessageEligibility
>()({
	Publishable: () => ({ _tag: "Publishable" }),
	TerminallySkipped: () => ({
		_tag: "TerminallySkipped",
		reason: "message-type",
	}),
	UnsupportedFuture: ({ type }) => ({
		_tag: "UnsupportedFuture",
		messageType: type,
	}),
});

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

	return messageEligibilityFor(classifyMessageType(facts.messageType));
};
