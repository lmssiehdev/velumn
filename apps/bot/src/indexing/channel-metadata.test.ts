import { assert, describe, it } from "@effect/vitest";
import {
	ChannelFlags,
	ChannelFlagsBitField,
	ChannelType,
	type GuildBasedChannel,
} from "discord.js";
import { toIndexingChannelMetadata } from "./channel-metadata";

const channel = (
	value: Parameters<typeof structuredClone>[0],
): GuildBasedChannel => value as GuildBasedChannel;

describe("toIndexingChannelMetadata", () => {
	it("maps a guild channel with caller-provided reconciliation facts", () => {
		const observedAt = new Date(1_000);
		const metadata = toIndexingChannelMetadata(
			channel({
				id: "channel",
				guildId: "guild",
				parentId: "category",
				name: "General",
				type: ChannelType.GuildText,
				nsfw: true,
				flags: new ChannelFlagsBitField(),
				isThread: () => false,
			}),
			{
				observedAt,
				position: 12,
				botPermissions: null,
				botPermissionsCheckedAt: null,
			},
		);

		assert.deepInclude(metadata, {
			id: "channel",
			serverId: "guild",
			parentId: "category",
			authorId: null,
			channelName: "General",
			position: 12,
			nsfw: true,
			botPermissions: null,
			botPermissionsCheckedAt: null,
			observedAt,
			archived: false,
			locked: false,
			pinned: false,
			archivedTimestamp: null,
			type: ChannelType.GuildText,
		});
		assert.deepEqual(metadata.availableTags, { _tag: "NotFetched" });
		assert.deepEqual(metadata.appliedTagIds, { _tag: "NotFetched" });
	});

	it("maps forum tags and mutation permission facts", () => {
		const observedAt = new Date(2_000);
		const metadata = toIndexingChannelMetadata(
			channel({
				id: "forum",
				guildId: "guild",
				parentId: null,
				name: "Support",
				type: ChannelType.GuildForum,
				nsfw: false,
				flags: new ChannelFlagsBitField(),
				availableTags: [
					{
						id: "tag",
						name: "Solved",
						moderated: true,
						emoji: { id: "emoji", name: "check" },
					},
				],
				isThread: () => false,
			}),
			{
				observedAt,
				position: 4,
				botPermissions: 7n,
				botPermissionsCheckedAt: observedAt,
			},
		);

		assert.equal(metadata.position, 4);
		assert.equal(metadata.botPermissions, "7");
		assert.equal(metadata.botPermissionsCheckedAt, observedAt);
		assert.isFalse(metadata.pinned);
		assert.deepEqual(metadata.availableTags, {
			_tag: "Replace",
			items: [
				{
					id: "tag",
					name: "Solved",
					moderated: true,
					emojiId: "emoji",
					emojiName: "check",
				},
			],
		});
	});

	it("maps thread ownership, archive state, and applied tags", () => {
		const metadata = toIndexingChannelMetadata(
			channel({
				id: "thread",
				guildId: "guild",
				parentId: "forum",
				ownerId: "owner",
				name: "Question",
				type: ChannelType.PublicThread,
				archived: true,
				locked: true,
				archiveTimestamp: 3_000,
				appliedTags: ["tag"],
				flags: new ChannelFlagsBitField(ChannelFlags.Pinned),
				isThread: () => true,
			}),
			{
				observedAt: new Date(3_000),
				position: 0,
				botPermissions: 0n,
				botPermissionsCheckedAt: new Date(3_000),
			},
		);

		assert.deepInclude(metadata, {
			authorId: "owner",
			archived: true,
			locked: true,
			pinned: true,
			archivedTimestamp: 3_000,
		});
		assert.deepEqual(metadata.appliedTagIds, {
			_tag: "Replace",
			items: ["tag"],
		});
	});
});
