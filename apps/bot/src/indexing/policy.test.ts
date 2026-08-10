import { assert, describe, it } from "@effect/vitest";
import {
	ChannelType,
	InteractionType,
	MessageFlags,
	MessageReferenceType,
	MessageType,
	WebhookType,
} from "discord.js";
import { IndexingOperationError, type ReplacementState } from "./model";
import {
	classifyMessageType,
	decideMessageEligibility,
	decideSourceEligibility,
	retryDispositionFor,
	type SourceEligibilityFacts,
	type SourceRejectionReason,
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

describe("indexing policy", () => {
	it("uses the discord.js 14.27 enum values represented by the contracts", () => {
		assert.deepEqual(
			[
				ChannelType.GuildAnnouncement,
				ChannelType.AnnouncementThread,
				ChannelType.PublicThread,
				ChannelType.PrivateThread,
				ChannelType.GuildMedia,
			],
			[5, 10, 11, 12, 16],
		);
		assert.deepEqual(
			[
				MessageType.Default,
				MessageType.Reply,
				MessageType.ChatInputCommand,
				MessageType.ThreadStarterMessage,
				MessageType.ContextMenuCommand,
				MessageType.PollResult,
			],
			[0, 19, 20, 21, 23, 46],
		);
		assert.equal(MessageFlags.IsVoiceMessage, 8192);
		assert.deepEqual(
			[MessageReferenceType.Default, MessageReferenceType.Forward],
			[0, 1],
		);
		assert.deepEqual(
			[
				WebhookType.Incoming,
				WebhookType.ChannelFollower,
				WebhookType.Application,
			],
			[1, 2, 3],
		);
		assert.deepEqual(
			[
				InteractionType.Ping,
				InteractionType.ApplicationCommand,
				InteractionType.MessageComponent,
				InteractionType.ApplicationCommandAutocomplete,
				InteractionType.ModalSubmit,
			],
			[1, 2, 3, 4, 5],
		);
	});

	it("accepts only the supported publication sources", () => {
		assert.deepEqual(decideSourceEligibility(eligiblePublicThread), {
			_tag: "Eligible",
			kind: "thread",
		});
		assert.deepEqual(
			decideSourceEligibility({
				...eligiblePublicThread,
				channelType: ChannelType.AnnouncementThread,
				parentChannelType: ChannelType.GuildAnnouncement,
			}),
			{ _tag: "Eligible", kind: "thread" },
		);
		assert.deepEqual(
			decideSourceEligibility({
				...eligiblePublicThread,
				channelType: ChannelType.GuildAnnouncement,
				parentChannelType: null,
			}),
			{ _tag: "Eligible", kind: "root-announcement" },
		);
	});

	it("rejects root text, private, DM, voice, and media sources", () => {
		for (const channelType of [
			ChannelType.GuildText,
			ChannelType.PrivateThread,
			ChannelType.DM,
			ChannelType.GroupDM,
			ChannelType.GuildVoice,
			ChannelType.GuildStageVoice,
			ChannelType.GuildMedia,
		]) {
			assert.deepEqual(
				decideSourceEligibility({ ...eligiblePublicThread, channelType }),
				{ _tag: "Ineligible", reason: "unsupported-source" },
			);
		}
	});

	it("returns a stable reason for each supplied policy failure", () => {
		const cases: ReadonlyArray<
			readonly [Partial<SourceEligibilityFacts>, SourceRejectionReason]
		> = [
			[{ indexingEnabled: false }, "indexing-disabled"],
			[{ nsfw: true }, "nsfw"],
			[{ viewable: false }, "not-viewable"],
			[{ hasViewChannel: false }, "missing-view-channel"],
			[{ hasReadMessageHistory: false }, "missing-read-message-history"],
			[{ privacyAllowed: false }, "privacy-rejected"],
		];

		for (const [change, reason] of cases) {
			assert.deepEqual(
				decideSourceEligibility({ ...eligiblePublicThread, ...change }),
				{ _tag: "Ineligible", reason },
			);
		}
	});

	it("separates publishable, known skipped, and future message types", () => {
		for (const type of [
			MessageType.Default,
			MessageType.Reply,
			MessageType.ChatInputCommand,
			MessageType.ThreadStarterMessage,
			MessageType.ContextMenuCommand,
		]) {
			assert.equal(classifyMessageType(type)._tag, "Publishable");
		}

		assert.deepEqual(classifyMessageType(MessageType.ChannelPinnedMessage), {
			_tag: "TerminallySkipped",
			type: MessageType.ChannelPinnedMessage,
		});
		assert.deepEqual(classifyMessageType(47), {
			_tag: "UnsupportedFuture",
			type: 47,
		});
		for (const type of Object.values(MessageType)) {
			if (typeof type === "number") {
				assert.notEqual(classifyMessageType(type)._tag, "UnsupportedFuture");
			}
		}
	});

	it("rejects voice messages even when their type and source are publishable", () => {
		assert.deepEqual(
			decideMessageEligibility({
				...eligiblePublicThread,
				messageType: MessageType.Default,
				messageFlags: MessageFlags.IsVoiceMessage,
			}),
			{ _tag: "TerminallySkipped", reason: "voice-message" },
		);
	});

	it("keeps fetched-empty replacement state distinct from not fetched", () => {
		const notFetched: ReplacementState<string> = { _tag: "NotFetched" };
		const removeAll: ReplacementState<string> = { _tag: "Replace", items: [] };

		assert.notEqual(notFetched._tag, removeAll._tag);
	});

	it("classifies retry policy without inspecting defects", () => {
		assert.equal(retryDispositionFor("discord-transient"), "retryable");
		assert.equal(retryDispositionFor("projection-completion"), "retryable");
		assert.equal(retryDispositionFor("discord-permission"), "terminal");
		assert.equal(retryDispositionFor("privacy-rejection"), "terminal");
	});

	it("constructs the typed Effect 4 operation error contract", () => {
		const error = new IndexingOperationError({
			operation: "fetch-message-page",
			classification: "discord-transient",
			cause: new Error("transport unavailable"),
		});

		assert.equal(error._tag, "IndexingOperationError");
		assert.equal(retryDispositionFor(error.classification), "retryable");
	});
});
