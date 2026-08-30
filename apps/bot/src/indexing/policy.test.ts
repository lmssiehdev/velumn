import { assert, describe, it } from "@effect/vitest";
import { ChannelType, MessageFlags, MessageType } from "discord.js";
import { Option, Schema } from "effect";
import {
	classifyMessageType,
	decideMessageEligibility,
	decideSourceEligibility,
	type SourceEligibility,
	type SourceEligibilityFacts,
} from "./policy";

const eligiblePublicThread: SourceEligibilityFacts = {
	channelType: ChannelType.PublicThread,
	parentChannelType: ChannelType.GuildForum,
	indexingEnabled: true,
	nsfw: false,
	viewable: true,
	hasViewChannel: true,
	hasReadMessageHistory: true,
	privacyAllowed: true,
};

const decodeChannelType = Schema.decodeUnknownOption(Schema.Number);

const uniqueChannelTypes = [
	...new Set(
		Object.values(ChannelType).flatMap((channelType) => {
			const parsed = Option.getOrUndefined(decodeChannelType(channelType));
			return parsed === undefined ? [] : [parsed as ChannelType];
		}),
	),
];

const parentChannelTypes = [null, ...uniqueChannelTypes] as const;

const expectedSourceEligibility = (
	channelType: ChannelType,
	parentChannelType: ChannelType | null,
): SourceEligibility => {
	if (channelType === ChannelType.PublicThread) {
		return parentChannelType === ChannelType.GuildText ||
			parentChannelType === ChannelType.GuildForum
			? { _tag: "Eligible", kind: "thread" }
			: { _tag: "Ineligible", reason: "unsupported-parent" };
	}
	if (channelType === ChannelType.AnnouncementThread) {
		return parentChannelType === ChannelType.GuildAnnouncement
			? { _tag: "Eligible", kind: "thread" }
			: { _tag: "Ineligible", reason: "unsupported-parent" };
	}
	return channelType === ChannelType.GuildAnnouncement
		? { _tag: "Eligible", kind: "root-announcement" }
		: { _tag: "Ineligible", reason: "unsupported-source" };
};

const messageTypeDispositions = {
	[MessageType.Default]: "Publishable",
	[MessageType.RecipientAdd]: "TerminallySkipped",
	[MessageType.RecipientRemove]: "TerminallySkipped",
	[MessageType.Call]: "TerminallySkipped",
	[MessageType.ChannelNameChange]: "TerminallySkipped",
	[MessageType.ChannelIconChange]: "TerminallySkipped",
	[MessageType.ChannelPinnedMessage]: "TerminallySkipped",
	[MessageType.UserJoin]: "TerminallySkipped",
	[MessageType.GuildBoost]: "TerminallySkipped",
	[MessageType.GuildBoostTier1]: "TerminallySkipped",
	[MessageType.GuildBoostTier2]: "TerminallySkipped",
	[MessageType.GuildBoostTier3]: "TerminallySkipped",
	[MessageType.ChannelFollowAdd]: "TerminallySkipped",
	[MessageType.GuildDiscoveryDisqualified]: "TerminallySkipped",
	[MessageType.GuildDiscoveryRequalified]: "TerminallySkipped",
	[MessageType.GuildDiscoveryGracePeriodInitialWarning]: "TerminallySkipped",
	[MessageType.GuildDiscoveryGracePeriodFinalWarning]: "TerminallySkipped",
	[MessageType.ThreadCreated]: "TerminallySkipped",
	[MessageType.Reply]: "Publishable",
	[MessageType.ChatInputCommand]: "Publishable",
	[MessageType.ThreadStarterMessage]: "Publishable",
	[MessageType.GuildInviteReminder]: "TerminallySkipped",
	[MessageType.ContextMenuCommand]: "Publishable",
	[MessageType.AutoModerationAction]: "TerminallySkipped",
	[MessageType.RoleSubscriptionPurchase]: "TerminallySkipped",
	[MessageType.InteractionPremiumUpsell]: "TerminallySkipped",
	[MessageType.StageStart]: "TerminallySkipped",
	[MessageType.StageEnd]: "TerminallySkipped",
	[MessageType.StageSpeaker]: "TerminallySkipped",
	[MessageType.StageRaiseHand]: "TerminallySkipped",
	[MessageType.StageTopic]: "TerminallySkipped",
	[MessageType.GuildApplicationPremiumSubscription]: "TerminallySkipped",
	[MessageType.GuildIncidentAlertModeEnabled]: "TerminallySkipped",
	[MessageType.GuildIncidentAlertModeDisabled]: "TerminallySkipped",
	[MessageType.GuildIncidentReportRaid]: "TerminallySkipped",
	[MessageType.GuildIncidentReportFalseAlarm]: "TerminallySkipped",
	[MessageType.PurchaseNotification]: "TerminallySkipped",
	[MessageType.PollResult]: "TerminallySkipped",
} as const satisfies Readonly<
	Record<MessageType, "Publishable" | "TerminallySkipped">
>;

describe("indexing publication policy", () => {
	it("classifies every unique channel and parent combination", () => {
		for (const channelType of uniqueChannelTypes) {
			for (const parentChannelType of parentChannelTypes) {
				assert.deepEqual(
					decideSourceEligibility({
						...eligiblePublicThread,
						channelType,
						parentChannelType,
					}),
					expectedSourceEligibility(channelType, parentChannelType),
				);
			}
		}
	});

	it("preserves source rejection precedence", () => {
		const rejectedFacts = {
			indexingEnabled: false,
			nsfw: true,
			viewable: false,
			hasViewChannel: false,
			hasReadMessageHistory: false,
			privacyAllowed: false,
		};
		const cases: ReadonlyArray<
			readonly [Partial<SourceEligibilityFacts>, SourceEligibility]
		> = [
			[
				{ ...rejectedFacts, channelType: ChannelType.GuildText },
				{ _tag: "Ineligible", reason: "unsupported-source" },
			],
			[
				{ ...rejectedFacts, parentChannelType: ChannelType.GuildVoice },
				{ _tag: "Ineligible", reason: "unsupported-parent" },
			],
			[rejectedFacts, { _tag: "Ineligible", reason: "indexing-disabled" }],
			[
				{ ...rejectedFacts, indexingEnabled: true },
				{ _tag: "Ineligible", reason: "nsfw" },
			],
			[
				{ ...rejectedFacts, indexingEnabled: true, nsfw: false },
				{ _tag: "Ineligible", reason: "not-viewable" },
			],
			[
				{
					...rejectedFacts,
					indexingEnabled: true,
					nsfw: false,
					viewable: true,
				},
				{ _tag: "Ineligible", reason: "missing-view-channel" },
			],
			[
				{
					...rejectedFacts,
					indexingEnabled: true,
					nsfw: false,
					viewable: true,
					hasViewChannel: true,
				},
				{ _tag: "Ineligible", reason: "missing-read-message-history" },
			],
			[
				{
					...rejectedFacts,
					indexingEnabled: true,
					nsfw: false,
					viewable: true,
					hasViewChannel: true,
					hasReadMessageHistory: true,
				},
				{ _tag: "Ineligible", reason: "privacy-rejected" },
			],
		];

		for (const [change, expected] of cases) {
			assert.deepEqual(
				decideSourceEligibility({ ...eligiblePublicThread, ...change }),
				expected,
			);
		}
	});

	it("returns the exact disposition for every current message type", () => {
		for (const [type, disposition] of Object.entries(messageTypeDispositions)) {
			const messageType = Number(type) as MessageType;
			assert.deepEqual(
				classifyMessageType(messageType),
				disposition === "Publishable"
					? { _tag: "Publishable", type: messageType }
					: { _tag: "TerminallySkipped", type: messageType },
			);
		}
	});

	it("keeps unknown numeric message types unsupported", () => {
		assert.deepEqual(classifyMessageType(47), {
			_tag: "UnsupportedFuture",
			type: 47,
		});
	});

	it("preserves source and voice rejection precedence", () => {
		assert.deepEqual(
			decideMessageEligibility({
				...eligiblePublicThread,
				indexingEnabled: false,
				messageType: 47,
				messageFlags: MessageFlags.IsVoiceMessage,
			}),
			{ _tag: "TerminallySkipped", reason: "indexing-disabled" },
		);
		assert.deepEqual(
			decideMessageEligibility({
				...eligiblePublicThread,
				messageType: 47,
				messageFlags: MessageFlags.IsVoiceMessage,
			}),
			{ _tag: "TerminallySkipped", reason: "voice-message" },
		);
		assert.deepEqual(
			decideMessageEligibility({
				...eligiblePublicThread,
				messageType: 47,
				messageFlags: 0,
			}),
			{ _tag: "UnsupportedFuture", messageType: 47 },
		);
	});
});
