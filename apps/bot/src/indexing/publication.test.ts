import { assert, describe, it } from "@effect/vitest";
import { isPublicThreadVisible } from "@repo/db/publication";
import { ChannelType } from "discord.js";

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
