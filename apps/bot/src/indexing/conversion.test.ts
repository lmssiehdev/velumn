import { assert, describe, it } from "@effect/vitest";
import {
	type APIComponentInContainer,
	type APIComponentInMessageActionRow,
	type APIEmbed,
	type APIMessageTopLevelComponent,
	type APISectionAccessoryComponent,
	ButtonStyle,
	ChannelType,
	ComponentType,
	EmbedFlags,
	EmbedMediaFlags,
	EmbedType,
	MessageFlags,
	MessageReferenceType,
	MessageType,
	SelectMenuDefaultValueType,
	SeparatorSpacingSize,
} from "discord-api-types/v10";
import {
	convertResolvedMessage,
	knownMessageFlags,
	parseDiscordLinks,
	type ResolvedEmbedInput,
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

type FutureComponentFixture = Readonly<{
	type: number;
	[key: string]:
		| string
		| number
		| boolean
		| null
		| undefined
		| readonly FutureComponentFixture[];
}>;

const discordFixture = <Value>(
	value: Parameters<typeof structuredClone>[0],
): Value => value as Value;

const futureTopLevel = (
	fixture: FutureComponentFixture,
): APIMessageTopLevelComponent =>
	discordFixture<APIMessageTopLevelComponent>(fixture);

const futureActionRowItem = (
	fixture: FutureComponentFixture,
): APIComponentInMessageActionRow =>
	discordFixture<APIComponentInMessageActionRow>(fixture);

const futureContainerChild = (
	fixture: FutureComponentFixture,
): APIComponentInContainer => discordFixture<APIComponentInContainer>(fixture);

const futureAccessory = (
	fixture: FutureComponentFixture,
): APISectionAccessoryComponent =>
	discordFixture<APISectionAccessoryComponent>(fixture);

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
		embeds: [],
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

	it("constructs non-null metadata while omitting unavailable optional fields", () => {
		assert.deepEqual(convertResolvedMessage(message()).metadata, { flags: 0 });
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

	it("preserves response embeds and replacement semantics", () => {
		const apiEmbed = {
			title: "Release notes",
			url: "https://example.com/releases/1",
			footer: {
				text: "Published",
				icon_url: "https://cdn.discordapp.com/footer.png",
			},
			image: {
				url: "https://cdn.discordapp.com/image.png",
				content_type: "image/png",
				description: "Release diagram",
				width: 640,
				height: 360,
				flags: EmbedMediaFlags.IsAnimated,
			},
			thumbnail: { url: "https://cdn.discordapp.com/thumbnail.png" },
			video: {
				url: "https://cdn.discordapp.com/video.mp4",
				content_type: "video/mp4",
			},
			provider: { url: "https://example.com" },
			author: {
				name: "Velumn",
				url: "https://example.com/velumn",
				icon_url: "https://cdn.discordapp.com/author.png",
			},
			fields: [{ name: "Status", value: "Ready" }],
			flags: EmbedFlags.IsContentInventoryEntry,
		} satisfies APIEmbed;
		const embed = {
			...apiEmbed,
			components: [
				{
					type: ComponentType.Container,
					accent_color: 0x12_34_56,
					spoiler: false,
					components: [
						{
							type: ComponentType.TextDisplay,
							content: "Component text",
						},
					],
				},
			],
		} satisfies ResolvedEmbedInput;
		const converted = convertResolvedMessage(message({ embeds: [embed] }));

		assert.equal(converted.embeds._tag, "Replace");
		if (converted.embeds._tag !== "Replace") return;
		assert.deepInclude(converted.embeds.items[0], {
			type: EmbedType.Rich,
			url: "https://example.com/releases/1",
			fields: [{ name: "Status", value: "Ready", inline: false }],
			provider: { name: "", url: "https://example.com" },
			image: apiEmbed.image,
			thumbnail: apiEmbed.thumbnail,
			video: apiEmbed.video,
			footer: apiEmbed.footer,
			author: apiEmbed.author,
			flags: EmbedFlags.IsContentInventoryEntry,
		});
		assert.deepEqual(converted.embeds.items[0]?.components?.[0], {
			type: ComponentType.Container,
			accentColor: 0x12_34_56,
			spoiler: false,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: "Component text",
					id: undefined,
				},
			],
		});
		assert.deepEqual(convertResolvedMessage(message({ embeds: [] })).embeds, {
			_tag: "Replace",
			items: [],
		});
		assert.deepEqual(convertResolvedMessage(message({ embeds: null })).embeds, {
			_tag: "NotFetched",
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
		assert.equal(converted.metadata.internalLinks?.length, 2);
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

	it("maps real API action row fields for buttons and every v1 select type", () => {
		const rows = [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Primary,
						label: "Choose",
						custom_id: "button-id",
						emoji: { name: "wave" },
					},
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						label: "Docs",
						url: "https://example.com",
					},
				],
			},
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.StringSelect,
						custom_id: "string-id",
						min_values: 0,
						max_values: 2,
						options: [
							{
								label: "One",
								value: "1",
								default: true,
								emoji: { id: "161616161616161616", name: "one" },
							},
						],
					},
				],
			},
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.UserSelect,
						custom_id: "user-id",
						default_values: [
							{ id: id.user, type: SelectMenuDefaultValueType.User },
						],
					},
				],
			},
			{
				type: ComponentType.ActionRow,
				components: [{ type: ComponentType.RoleSelect, custom_id: "role-id" }],
			},
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.MentionableSelect,
						custom_id: "mentionable-id",
						min_values: 1,
						max_values: 3,
					},
				],
			},
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.ChannelSelect,
						custom_id: "channel-id",
						channel_types: [ChannelType.GuildText, ChannelType.PublicThread],
						default_values: [
							{
								id: id.otherThread,
								type: SelectMenuDefaultValueType.Channel,
							},
						],
					},
				],
			},
		] satisfies readonly APIMessageTopLevelComponent[];
		const converted = convertResolvedMessage(message({ components: rows }));

		assert.equal(converted.components._tag, "Replace");
		if (converted.components._tag !== "Replace") return;
		const components = converted.components.items.flatMap((row) => {
			assert.equal(row.type, ComponentType.ActionRow);
			if (!("components" in row) || row.type !== ComponentType.ActionRow)
				throw new Error("Expected row");
			assert.ok(row.components.length <= 5);
			const hasSelect = row.components.some(
				(component) => component.type !== ComponentType.Button,
			);
			if (hasSelect) assert.equal(row.components.length, 1);
			return row.components;
		});
		const componentByKey = new Map(
			components.map((component) => [
				component.type === ComponentType.Button && "customId" in component
					? (component.customId ?? `button:${component.style}`)
					: component.type,
				component,
			]),
		);
		const selectBase = {
			disabled: false,
			placeholder: undefined,
			minValues: undefined,
			maxValues: undefined,
		};
		const autoSelectBase = {
			...selectBase,
			channelTypes: undefined,
			defaultValues: undefined,
		};

		assert.deepEqual(componentByKey.get("button-id"), {
			type: ComponentType.Button,
			style: ButtonStyle.Primary,
			disabled: false,
			label: "Choose",
			customId: "button-id",
			url: undefined,
			emoji: { id: null, name: "wave", animated: false },
		});
		assert.deepEqual(componentByKey.get(`button:${ButtonStyle.Link}`), {
			type: ComponentType.Button,
			style: ButtonStyle.Link,
			disabled: false,
			label: "Docs",
			customId: undefined,
			url: "https://example.com",
			emoji: undefined,
		});
		assert.deepEqual(componentByKey.get(ComponentType.StringSelect), {
			type: ComponentType.StringSelect,
			customId: "string-id",
			...selectBase,
			minValues: 0,
			maxValues: 2,
			options: [
				{
					label: "One",
					value: "1",
					description: undefined,
					default: true,
					emoji: {
						id: "161616161616161616",
						name: "one",
						animated: false,
					},
				},
			],
		});
		assert.deepEqual(componentByKey.get(ComponentType.UserSelect), {
			type: ComponentType.UserSelect,
			customId: "user-id",
			...autoSelectBase,
			defaultValues: [{ id: id.user, type: SelectMenuDefaultValueType.User }],
		});
		assert.deepEqual(componentByKey.get(ComponentType.RoleSelect), {
			type: ComponentType.RoleSelect,
			customId: "role-id",
			...autoSelectBase,
		});
		assert.deepEqual(componentByKey.get(ComponentType.MentionableSelect), {
			type: ComponentType.MentionableSelect,
			customId: "mentionable-id",
			...autoSelectBase,
			minValues: 1,
			maxValues: 3,
		});
		assert.deepEqual(componentByKey.get(ComponentType.ChannelSelect), {
			type: ComponentType.ChannelSelect,
			customId: "channel-id",
			...autoSelectBase,
			channelTypes: [ChannelType.GuildText, ChannelType.PublicThread],
			defaultValues: [
				{
					id: id.otherThread,
					type: SelectMenuDefaultValueType.Channel,
				},
			],
		});
	});

	it("maps supported top-level v2 components into the stored shape", () => {
		const components = [
			{ type: ComponentType.TextDisplay, id: 42, content: "hello" },
			{
				type: ComponentType.Section,
				components: [
					{ type: ComponentType.TextDisplay, id: 43, content: "section" },
				],
				accessory: {
					type: ComponentType.Thumbnail,
					media: { url: "https://cdn.discordapp.com/thumb.png" },
					description: null,
					spoiler: true,
				},
			},
			{
				type: ComponentType.Separator,
				divider: false,
				spacing: SeparatorSpacingSize.Large,
			},
			{
				type: ComponentType.MediaGallery,
				items: [
					{
						media: { url: "https://cdn.discordapp.com/image.png" },
						description: null,
						spoiler: true,
					},
				],
			},
			{
				type: ComponentType.File,
				file: { url: "attachment://guide.pdf" },
				spoiler: true,
			},
			{
				type: ComponentType.Container,
				accent_color: 0x12_34_56,
				spoiler: true,
				components: [{ type: ComponentType.TextDisplay, content: "nested" }],
			},
			{
				type: ComponentType.Container,
				accent_color: null,
				components: [],
			},
		] satisfies readonly APIMessageTopLevelComponent[];
		const converted = convertResolvedMessage(message({ components }));

		assert.equal(converted.components._tag, "Replace");
		if (converted.components._tag !== "Replace") return;
		assert.deepEqual(converted.components.items, [
			{ type: ComponentType.TextDisplay, id: 42, content: "hello" },
			{
				type: ComponentType.Section,
				components: [
					{ type: ComponentType.TextDisplay, id: 43, content: "section" },
				],
				accessory: {
					type: ComponentType.Thumbnail,
					media: { url: "https://cdn.discordapp.com/thumb.png" },
					description: null,
					spoiler: true,
				},
			},
			{
				type: ComponentType.Separator,
				divider: false,
				spacing: SeparatorSpacingSize.Large,
			},
			{
				type: ComponentType.MediaGallery,
				items: [
					{
						media: { url: "https://cdn.discordapp.com/image.png" },
						description: null,
						spoiler: true,
					},
				],
			},
			{
				type: ComponentType.File,
				file: { url: "attachment://guide.pdf" },
				spoiler: true,
			},
			{
				type: ComponentType.Container,
				accentColor: 0x12_34_56,
				spoiler: true,
				components: [
					{
						type: ComponentType.TextDisplay,
						content: "nested",
						id: undefined,
					},
				],
			},
			{
				type: ComponentType.Container,
				accentColor: null,
				spoiler: undefined,
				components: [],
			},
		]);
	});

	it("degrades unknown components and omits unknown section accessories", () => {
		const converted = convertResolvedMessage(
			message({
				components: [
					futureTopLevel({ type: 9_999, future: "top-level" }),
					{
						type: ComponentType.ActionRow,
						components: [futureActionRowItem({ type: 9_998, future: "row" })],
					},
					{
						type: ComponentType.Container,
						components: [
							futureContainerChild({ type: 9_997, future: "container" }),
						],
					},
					{
						type: ComponentType.Section,
						components: [
							{ type: ComponentType.TextDisplay, content: "section" },
						],
						accessory: futureAccessory({
							type: 9_996,
							future: "accessory",
						}),
					},
				],
			}),
		);

		assert.deepEqual(converted.components, {
			_tag: "Replace",
			items: [
				{ type: 9_999, unsupported: true },
				{
					type: ComponentType.ActionRow,
					components: [{ type: 9_998, unsupported: true }],
				},
				{
					type: ComponentType.Container,
					accentColor: undefined,
					spoiler: undefined,
					components: [{ type: 9_997, unsupported: true }],
				},
				{
					type: ComponentType.Section,
					components: [
						{
							type: ComponentType.TextDisplay,
							content: "section",
							id: undefined,
						},
					],
				},
			],
		});
	});
});
