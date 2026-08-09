import { assert, describe, it } from "@effect/vitest";
import { messageMetadataSchema } from "@repo/db/helpers/validation";
import {
	ButtonStyle,
	ChannelType,
	ComponentType,
	MessageFlags,
	MessageReferenceType,
	MessageType,
} from "discord-api-types/v10";
import {
	convertResolvedMessage,
	knownMessageFlags,
	parseDiscordLinks,
	type ResolvedMessageInput,
} from "./conversion";

const id = {
	guild: "111111111111111111",
	thread: "222222222222222222",
	otherThread: "333333333333333333",
	message: "444444444444444444",
	linkedMessage: "555555555555555555",
	user: "666666666666666666",
};

function message(
	override: Partial<ResolvedMessageInput> = {},
): ResolvedMessageInput {
	return {
		id: id.message,
		guildId: id.guild,
		channelId: "777777777777777777",
		publicationChannelId: id.thread,
		parentChannelId: "777777777777777777",
		authorId: id.user,
		content: "hello",
		cleanContent: "hello",
		type: MessageType.Default,
		createdTimestamp: 1_700_000_000_000,
		editedTimestamp: null,
		flags: 0,
		pinned: false,
		attachments: [],
		reactions: [],
		components: [],
		...override,
	};
}

describe("pure Discord message conversion", () => {
	it("keeps publication identity stable and versions edits by Discord time", () => {
		const converted = convertResolvedMessage(
			message({
				channelId: "777777777777777777",
				publicationChannelId: id.thread,
				editedTimestamp: 1_700_000_000_123,
			}),
		);

		assert.equal(converted.channelId, "777777777777777777");
		assert.equal(converted.publicationChannelId, id.thread);
		assert.equal(converted.sourceVersion, 1_700_000_000_123);
		assert.equal(
			convertResolvedMessage(message()).sourceVersion,
			1_700_000_000_000,
		);
	});

	it("preserves flags, references, webhook identity, and interaction identity", () => {
		const flags = MessageFlags.Crossposted | MessageFlags.HasSnapshot;
		const converted = convertResolvedMessage(
			message({
				flags,
				reference: {
					type: MessageReferenceType.Forward,
					messageId: id.linkedMessage,
					channelId: id.otherThread,
					guildId: id.guild,
				},
				webhook: {
					id: "888888888888888888",
					type: 1,
					displayName: "Release bot",
					avatarUrl: "https://cdn.discordapp.com/avatar.png",
				},
				interaction: {
					id: "999999999999999999",
					type: 2,
					applicationId: "101010101010101010",
				},
			}),
		);

		assert.equal(converted.referenceId, id.linkedMessage);
		assert.equal(converted.metadata?.flags, flags);
		assert.deepEqual(converted.metadata?.reference, {
			type: MessageReferenceType.Forward,
			messageId: id.linkedMessage,
			channelId: id.otherThread,
			guildId: id.guild,
		});
		assert.equal(converted.metadata?.webhook?.displayName, "Release bot");
		assert.equal(
			converted.metadata?.interaction?.applicationId,
			"101010101010101010",
		);
		assert.deepEqual(knownMessageFlags(flags), [
			MessageFlags.Crossposted,
			MessageFlags.HasSnapshot,
		]);
	});

	it("distinguishes not fetched attachments from fetched empty replacement", () => {
		assert.deepEqual(
			convertResolvedMessage(message({ attachments: null })).attachments,
			{ _tag: "NotFetched" },
		);
		assert.deepEqual(
			convertResolvedMessage(message({ attachments: [] })).attachments,
			{ _tag: "Replace", items: [] },
		);
		assert.deepEqual(
			convertResolvedMessage(
				message({
					attachments: [
						{
							id: "121212121212121212",
							filename: "diagram.png",
							contentType: "image/png",
							size: 42,
							sourceUrl: "https://cdn.discordapp.com/diagram.png",
						},
					],
				}),
			).attachments,
			{
				_tag: "Replace",
				items: [
					{
						id: "121212121212121212",
						filename: "diagram.png",
						contentType: "image/png",
						size: 42,
						sourceUrl: "https://cdn.discordapp.com/diagram.png",
					},
				],
			},
		);
	});

	it("aggregates duplicate Unicode and custom reactions without dropping either", () => {
		const converted = convertResolvedMessage(
			message({
				reactions: [
					{ emojiId: null, emojiName: "👍", count: 2 },
					{ emojiId: null, emojiName: "👍", count: 3 },
					{
						emojiId: "131313131313131313",
						emojiName: "velumn",
						animated: true,
						count: 4,
					},
				],
			}),
		);

		assert.deepEqual(converted.reactions, {
			_tag: "Replace",
			items: [
				{
					emojiId: null,
					emojiName: "👍",
					animated: false,
					count: 5,
				},
				{
					emojiId: "131313131313131313",
					emojiName: "velumn",
					animated: true,
					count: 4,
				},
			],
		});
	});

	it("parses broad Discord links and emits deduplicated canonical backlinks", () => {
		const content = [
			`discord.com/channels/${id.guild}/${id.otherThread}/${id.linkedMessage}`,
			`<http://ptb.discordapp.com/channels/${id.guild}/${id.otherThread}/${id.linkedMessage}>`,
			`https://canary.discord.com/channels/000000000000000000/${id.otherThread}`,
		].join(" ");
		assert.equal(parseDiscordLinks(content).length, 3);

		const converted = convertResolvedMessage(
			message({
				content,
				linkTargets: [
					{
						guildId: id.guild,
						guildName: "Velumn",
						channelId: id.otherThread,
						channelName: "release-notes",
						channelType: ChannelType.PublicThread,
						parent: {
							id: "141414141414141414",
							name: "Support",
							type: ChannelType.GuildForum,
						},
						messageId: id.linkedMessage,
						backlinkTargetId: id.otherThread,
					},
				],
			}),
		);

		assert.equal(converted.internalLinks.length, 2);
		assert.equal(converted.metadata?.internalLinks?.length, 2);
		assert.deepEqual(converted.backlinks, {
			_tag: "Replace",
			items: [
				{
					fromMessageId: id.message,
					fromPublicationChannelId: id.thread,
					toPublicationChannelId: id.otherThread,
				},
			],
		});
	});

	it("converts buttons and every v1 select type", () => {
		const row = {
			type: ComponentType.ActionRow,
			components: [
				{
					type: ComponentType.Button,
					style: ButtonStyle.Link,
					label: "Docs",
					url: "https://example.com",
				},
				{
					type: ComponentType.StringSelect,
					customId: "string",
					options: [{ label: "One", value: "1", default: true }],
				},
				{ type: ComponentType.UserSelect, customId: "user" },
				{ type: ComponentType.RoleSelect, customId: "role" },
				{ type: ComponentType.MentionableSelect, customId: "mentionable" },
				{
					type: ComponentType.ChannelSelect,
					customId: "channel",
					channelTypes: [ChannelType.GuildText, ChannelType.PublicThread],
				},
			],
		} as const;
		const converted = convertResolvedMessage(message({ components: [row] }));

		assert.equal(converted.components._tag, "Replace");
		if (converted.components._tag !== "Replace") return;
		const convertedRow = converted.components.items[0];
		assert.equal(convertedRow?.type, ComponentType.ActionRow);
		assert.equal(
			convertedRow && "components" in convertedRow
				? convertedRow.components.length
				: 0,
			6,
		);
	});

	it("accepts the v2 compatibility subset and degrades unknown components", () => {
		const converted = convertResolvedMessage(
			message({
				components: [
					{ type: ComponentType.TextDisplay, content: "hello" },
					{
						type: ComponentType.Section,
						components: [
							{ type: ComponentType.TextDisplay, content: "section" },
						],
						accessory: {
							type: ComponentType.Thumbnail,
							media: { url: "https://cdn.discordapp.com/thumb.png" },
						},
					},
					{ type: ComponentType.Separator, divider: true, spacing: 2 },
					{
						type: ComponentType.MediaGallery,
						items: [
							{
								media: { url: "https://cdn.discordapp.com/image.png" },
								description: "Diagram",
							},
						],
					},
					{
						type: ComponentType.File,
						file: { url: "attachment://guide.pdf" },
					},
					{
						type: ComponentType.Container,
						accentColor: 0x12_34_56,
						components: [
							{ type: ComponentType.TextDisplay, content: "nested" },
						],
					},
					{ type: 9_999, future: "value" },
				],
			}),
		);

		assert.equal(converted.components._tag, "Replace");
		if (converted.components._tag !== "Replace") return;
		assert.deepEqual(converted.components.items.at(-1), {
			type: 9_999,
			unsupported: true,
		});
		const items = converted.components.items;
		assert.doesNotThrow(() => JSON.stringify(items));
	});

	it("accepts serializable mention records while retaining legacy Map input", () => {
		assert.deepEqual(
			messageMetadataSchema.parse({
				users: {
					[id.user]: { username: "lum", globalName: "Lum" },
				},
			}),
			{
				users: {
					[id.user]: { username: "lum", globalName: "Lum" },
				},
			},
		);
		assert.deepEqual(
			messageMetadataSchema.parse({
				roles: new Map([
					[
						"151515151515151515",
						{ id: "151515151515151515", name: "Maintainer", color: 42 },
					],
				]),
			}),
			{
				roles: {
					"151515151515151515": { name: "Maintainer", color: 42 },
				},
			},
		);
	});
});
