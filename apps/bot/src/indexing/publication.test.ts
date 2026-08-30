import { assert, describe, it } from "@effect/vitest";
import {
	isPublicThreadVisible,
	isThreadStarterMessage,
} from "@repo/db/publication";
import { ChannelType, MessageType } from "discord.js";

const visibleThread = {
	serverActive: true,
	threadType: ChannelType.PublicThread,
	parentBelongsToServer: true,
	parentIsUncategorized: true,
	parentCategoryBelongsToServer: false,
	parentCategoryType: null,
	parentType: ChannelType.GuildForum,
	parentIndexingEnabled: true,
	hasVisibleStarter: true,
};

describe("publication policy", () => {
	it("classifies Discord thread starter message shapes", () => {
		assert.isTrue(
			isThreadStarterMessage({
				messageId: "forum-thread",
				messageType: MessageType.Default,
				sourceChannelId: "forum-thread",
				publicationChannelId: "forum-thread",
			}),
		);
		assert.isTrue(
			isThreadStarterMessage({
				messageId: "text-thread",
				messageType: MessageType.Default,
				sourceChannelId: "parent-channel",
				publicationChannelId: "text-thread",
			}),
		);
		assert.isTrue(
			isThreadStarterMessage({
				messageId: "system-message",
				messageType: MessageType.ThreadStarterMessage,
				sourceChannelId: "thread",
				publicationChannelId: "thread",
			}),
		);
		assert.isFalse(
			isThreadStarterMessage({
				messageId: "reply",
				messageType: MessageType.Default,
				sourceChannelId: "thread",
				publicationChannelId: "thread",
			}),
		);
	});

	it("accepts uncategorized and valid categorized root parents", () => {
		assert.isTrue(isPublicThreadVisible(visibleThread));
		assert.isTrue(
			isPublicThreadVisible({
				...visibleThread,
				threadType: ChannelType.AnnouncementThread,
				parentIsUncategorized: false,
				parentCategoryBelongsToServer: true,
				parentCategoryType: ChannelType.GuildCategory,
				parentType: ChannelType.GuildAnnouncement,
			}),
		);
	});

	it("rejects cross-server and non-category nesting", () => {
		assert.isFalse(
			isPublicThreadVisible({
				...visibleThread,
				parentIsUncategorized: false,
				parentCategoryBelongsToServer: false,
				parentCategoryType: ChannelType.GuildCategory,
			}),
		);
		assert.isFalse(
			isPublicThreadVisible({
				...visibleThread,
				parentIsUncategorized: false,
				parentCategoryBelongsToServer: true,
				parentCategoryType: ChannelType.GuildText,
			}),
		);
	});

	it("does not publish root text channels as threads", () => {
		assert.isFalse(
			isPublicThreadVisible({
				...visibleThread,
				threadType: ChannelType.GuildText,
			}),
		);
	});
});
