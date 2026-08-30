import {
	type EmbedSchema,
	type MessageComponentsSchema,
	type MessageMetadataSchema,
	type RowsSchema,
} from "@repo/db/helpers/validation";
import {
	type APIAutoPopulatedSelectMenuComponent,
	type APIButtonComponent,
	type APIComponentInContainer,
	type APIComponentInMessageActionRow,
	type APIContainerComponent,
	type APIEmbed,
	type APIMessageComponentEmoji,
	type APIMessageTopLevelComponent,
	type APISectionAccessoryComponent,
	type APIStringSelectComponent,
	type APIThumbnailComponent,
	ChannelType,
	ComponentType,
	EmbedType,
	MessageFlags,
	type MessageType,
} from "discord-api-types/v10";
import { Option, Schema } from "effect";
import type {
	AttachmentReplacement,
	AttachmentState,
	ReactionReplacement,
	ReactionState,
	ReplacementState,
} from "./model";

export interface ResolvedAttachmentInput {
	readonly id: string;
	readonly filename: string;
	readonly contentType: string | null;
	readonly size: number;
	readonly sourceUrl: string;
}

export interface ResolvedReactionInput {
	readonly emojiId: string | null;
	readonly emojiName: string;
	readonly animated?: boolean;
	readonly count: number;
}

export interface ResolvedInternalLinkTarget {
	readonly guildId: string;
	readonly guildName: string;
	readonly channelId: string;
	readonly channelName: string;
	readonly channelType: ChannelType;
	readonly parent?: {
		readonly id: string;
		readonly name: string;
		readonly type: ChannelType;
	} | null;
	readonly messageId?: string | null;
	/** Canonical published thread/root reached by this link, if any. */
	readonly backlinkTargetId: string | null;
}

export interface ResolvedMessageInput {
	readonly id: string;
	readonly guildId: string;
	readonly channelId: string;
	/** Canonical channel used by publication, including thread-starter messages. */
	readonly publicationChannelId: string;
	readonly parentChannelId: string | null;
	readonly authorId: string;
	readonly content: string;
	readonly cleanContent: string | null;
	readonly type: MessageType;
	readonly createdTimestamp: number;
	readonly editedTimestamp: number | null;
	readonly flags: number;
	readonly pinned: boolean;
	readonly applicationId?: string | null;
	readonly childThreadId?: string | null;
	readonly reference?: {
		readonly type?: number;
		readonly messageId: string | null;
		readonly channelId: string | null;
		readonly guildId: string | null;
	} | null;
	readonly webhook?: {
		readonly id: string;
		readonly type: number | null;
		readonly displayName: string | null;
		readonly avatarUrl: string | null;
	} | null;
	readonly interaction?: {
		readonly id: string;
		readonly type: number | null;
		readonly applicationId: string | null;
	} | null;
	readonly mentions?: {
		readonly users?: Readonly<
			Record<
				string,
				{ readonly username: string; readonly globalName: string | null }
			>
		>;
		readonly channels?: Readonly<
			Record<string, { readonly name: string; readonly type: ChannelType }>
		>;
		readonly roles?: Readonly<
			Record<string, { readonly name: string; readonly color: number }>
		>;
	};
	/** `null` means the relation was not fetched; an empty array removes all rows. */
	readonly attachments: readonly ResolvedAttachmentInput[] | null;
	readonly reactions: readonly ResolvedReactionInput[] | null;
	readonly components: readonly APIMessageTopLevelComponent[] | null;
	readonly embeds: readonly ResolvedEmbedInput[] | null;
	readonly linkTargets?: readonly ResolvedInternalLinkTarget[];
}

export interface ResolvedEmbedInput extends APIEmbed {
	readonly components?: APIContainerComponent[];
}

export interface ParsedDiscordLink {
	readonly original: string;
	readonly guildId: string;
	readonly channelId: string;
	readonly messageId: string | null;
}

export interface ConvertedInternalLink extends ParsedDiscordLink {
	readonly target: ResolvedInternalLinkTarget | null;
}

export interface BacklinkTarget {
	readonly fromMessageId: string;
	readonly fromPublicationChannelId: string;
	readonly toPublicationChannelId: string;
}

export interface ConvertedMessage {
	readonly id: string;
	readonly serverId: string;
	readonly channelId: string;
	readonly publicationChannelId: string;
	readonly parentChannelId: string | null;
	readonly authorId: string;
	readonly content: string;
	readonly cleanContent: string | null;
	readonly type: MessageType;
	readonly sourceVersion: number;
	readonly pinned: boolean;
	readonly applicationId: string | null;
	readonly childThreadId: string | null;
	readonly referenceId: string | null;
	readonly metadata: NonNullable<MessageMetadataSchema>;
	readonly attachments: AttachmentReplacement;
	readonly reactions: ReactionReplacement;
	readonly components: ReplacementState<MessageComponentsSchema[number]>;
	readonly embeds: ReplacementState<EmbedSchema>;
	readonly internalLinks: readonly ConvertedInternalLink[];
	readonly backlinks: ReplacementState<BacklinkTarget>;
}

const discordLinkPattern =
	/(?:https?:\/\/)?(?:(?:www|ptb|canary)\.)?discord(?:app)?\.com\/channels\/(?<guildId>\d{17,20}|@me)\/(?<channelId>\d{17,20})(?:\/(?<messageId>\d{17,20}))?/giu;

export function parseDiscordLinks(content: string): ParsedDiscordLink[] {
	return [...content.matchAll(discordLinkPattern)].flatMap((match) => {
		const guildId = match.groups?.guildId;
		const channelId = match.groups?.channelId;
		if (!(guildId && channelId)) return [];
		return [
			{
				original: match[0],
				guildId,
				channelId,
				messageId: match.groups?.messageId ?? null,
			},
		];
	});
}

export function convertResolvedMessage(
	input: ResolvedMessageInput,
): ConvertedMessage {
	const internalLinks = resolveInternalLinks(input);
	const legacyInternalLinks = internalLinks.flatMap((link) =>
		link.target ? [toLegacyInternalLink(link, link.target)] : [],
	);
	const metadata: NonNullable<MessageMetadataSchema> = {
		flags: input.flags,
	};
	if (input.reference) metadata.reference = input.reference;
	if (input.webhook) {
		metadata.webhook = {
			id: input.webhook.id,
			type: input.webhook.type,
			displayName: input.webhook.displayName,
			avatarUrl: input.webhook.avatarUrl,
			name: input.webhook.displayName ?? "Webhook",
			avatar: input.webhook.avatarUrl,
		};
	}
	if (input.interaction) metadata.interaction = input.interaction;
	if (input.mentions?.users) metadata.users = input.mentions.users;
	if (input.mentions?.channels) metadata.channels = input.mentions.channels;
	if (input.mentions?.roles) metadata.roles = input.mentions.roles;
	if (legacyInternalLinks.length > 0) {
		metadata.internalLinks = legacyInternalLinks;
	}

	return {
		id: input.id,
		serverId: input.guildId,
		channelId: input.channelId,
		publicationChannelId: input.publicationChannelId,
		parentChannelId: input.parentChannelId,
		authorId: input.authorId,
		content: input.content,
		cleanContent: input.cleanContent,
		type: input.type,
		sourceVersion: input.editedTimestamp ?? input.createdTimestamp,
		pinned: input.pinned,
		applicationId: input.applicationId ?? null,
		childThreadId: input.childThreadId ?? null,
		referenceId: input.reference?.messageId ?? null,
		metadata,
		attachments: replace(
			input.attachments,
			(attachment): AttachmentState => attachment,
		),
		reactions: convertReactions(input.reactions),
		components: replace(input.components, convertComponent),
		embeds: replace(input.embeds, convertEmbed),
		internalLinks,
		backlinks: {
			_tag: "Replace",
			items: uniqueBacklinks(input, internalLinks),
		},
	};
}

function convertEmbed(value: ResolvedEmbedInput): EmbedSchema {
	const { components, fields, provider, ...embed } = value;
	const converted: EmbedSchema = {
		...embed,
		type: embed.type ?? EmbedType.Rich,
	};
	if (fields) {
		converted.fields = fields.map((field) => ({
			...field,
			inline: field.inline ?? false,
		}));
	}
	if (provider) converted.provider = { ...provider, name: provider.name ?? "" };
	if (components) converted.components = components.map(convertComponent);
	return converted;
}

function replace<Input, Output>(
	items: readonly Input[] | null,
	convert: (item: Input) => Output,
): ReplacementState<Output> {
	return items === null
		? { _tag: "NotFetched" }
		: { _tag: "Replace", items: items.map(convert) };
}

function convertReactions(
	reactions: readonly ResolvedReactionInput[] | null,
): ReactionReplacement {
	if (reactions === null) return { _tag: "NotFetched" };
	const aggregates = new Map<string, ReactionState>();
	for (const reaction of reactions) {
		if (!reaction.emojiName) continue;
		const key = reaction.emojiId ?? `unicode:${reaction.emojiName}`;
		const previous = aggregates.get(key);
		aggregates.set(key, {
			emojiId: reaction.emojiId,
			emojiName: reaction.emojiName,
			animated: reaction.animated ?? false,
			count: (previous?.count ?? 0) + reaction.count,
		});
	}
	return { _tag: "Replace", items: [...aggregates.values()] };
}

function resolveInternalLinks(
	input: ResolvedMessageInput,
): ConvertedInternalLink[] {
	const targets = input.linkTargets ?? [];
	return parseDiscordLinks(input.content)
		.filter((link) => link.guildId === input.guildId)
		.map((link) => ({
			...link,
			target:
				targets.find(
					(target) =>
						target.guildId === link.guildId &&
						target.channelId === link.channelId &&
						(target.messageId == null || target.messageId === link.messageId),
				) ?? null,
		}));
}

function toLegacyInternalLink(
	link: ParsedDiscordLink,
	target: ResolvedInternalLinkTarget,
): NonNullable<NonNullable<MessageMetadataSchema>["internalLinks"]>[number] {
	const channel: NonNullable<
		NonNullable<MessageMetadataSchema>["internalLinks"]
	>[number]["channel"] = {
		id: target.channelId,
		name: target.channelName,
		type: target.channelType,
	};
	if (target.parent) {
		channel.parent = {
			parentId: target.parent.id,
			name: target.parent.name,
			type: target.parent.type,
		};
	}
	const converted: NonNullable<
		NonNullable<MessageMetadataSchema>["internalLinks"]
	>[number] = {
		original: link.original,
		guild: { id: target.guildId, name: target.guildName },
		channel,
	};
	if (link.messageId) converted.message = link.messageId;
	return converted;
}

function uniqueBacklinks(
	input: ResolvedMessageInput,
	links: readonly ConvertedInternalLink[],
): BacklinkTarget[] {
	const targetIds = new Set(
		links.flatMap((link) =>
			link.target?.backlinkTargetId &&
			link.target.backlinkTargetId !== input.publicationChannelId
				? [link.target.backlinkTargetId]
				: [],
		),
	);
	return [...targetIds].map((toPublicationChannelId) => ({
		fromMessageId: input.id,
		fromPublicationChannelId: input.publicationChannelId,
		toPublicationChannelId,
	}));
}

export function knownMessageFlags(bitfield: number): MessageFlags[] {
	const decodeFlag = Schema.decodeUnknownOption(Schema.Number);
	return Object.values(MessageFlags).flatMap((flag) => {
		const parsed = Option.getOrUndefined(decodeFlag(flag));
		return parsed !== undefined && (bitfield & parsed) === parsed
			? [parsed as MessageFlags]
			: [];
	});
}

type ComponentOutput = MessageComponentsSchema[number];
type ActionRowItemOutput = RowsSchema["components"][number];
type ButtonOutput = Extract<
	Exclude<ActionRowItemOutput, { unsupported: true }>,
	{ type: ComponentType.Button }
>;
type StringSelectOutput = Extract<
	Exclude<ActionRowItemOutput, { unsupported: true }>,
	{ type: ComponentType.StringSelect }
>;
type AutoSelectOutput = Extract<
	Exclude<ActionRowItemOutput, { unsupported: true }>,
	{
		type:
			| ComponentType.UserSelect
			| ComponentType.RoleSelect
			| ComponentType.MentionableSelect
			| ComponentType.ChannelSelect;
	}
>;
type AccessoryOutput = NonNullable<
	Extract<
		Exclude<ComponentOutput, { unsupported: true }>,
		{ type: ComponentType.Section }
	>["accessory"]
>;
type EmojiOutput = Exclude<ButtonOutput["emoji"], null | undefined>;

function convertComponent(
	component: APIMessageTopLevelComponent | APIComponentInContainer,
): ComponentOutput {
	const type: number = component.type;
	switch (component.type) {
		case ComponentType.ActionRow:
			return {
				type: ComponentType.ActionRow,
				components: component.components.map(convertActionRowItem),
			};
		case ComponentType.TextDisplay:
			return {
				type: ComponentType.TextDisplay,
				content: component.content,
				id: component.id,
			};
		case ComponentType.Section: {
			const accessory = convertAccessory(component.accessory);
			const section: Extract<
				Exclude<ComponentOutput, { unsupported: true }>,
				{ type: ComponentType.Section }
			> = {
				type: ComponentType.Section,
				components: component.components.map((child) => ({
					type: ComponentType.TextDisplay,
					content: child.content,
					id: child.id,
				})),
			};
			if (accessory) section.accessory = accessory;
			return section;
		}
		case ComponentType.Separator:
			return {
				type: ComponentType.Separator,
				divider: component.divider,
				spacing: component.spacing,
			};
		case ComponentType.MediaGallery:
			return {
				type: ComponentType.MediaGallery,
				items: component.items.map((item) => ({
					media: { url: item.media.url },
					description: item.description,
					spoiler: item.spoiler,
				})),
			};
		case ComponentType.File:
			return {
				type: ComponentType.File,
				file: { url: component.file.url },
				spoiler: component.spoiler,
			};
		case ComponentType.Container:
			return {
				type: ComponentType.Container,
				components: component.components.map(convertComponent),
				accentColor: component.accent_color,
				spoiler: component.spoiler,
			};
		default:
			return { type, unsupported: true };
	}
}

function convertActionRowItem(
	component: APIComponentInMessageActionRow,
): ActionRowItemOutput {
	const type: number = component.type;
	switch (component.type) {
		case ComponentType.Button:
			return convertButton(component);
		case ComponentType.StringSelect:
			return convertStringSelect(component);
		case ComponentType.UserSelect:
		case ComponentType.RoleSelect:
		case ComponentType.MentionableSelect:
		case ComponentType.ChannelSelect:
			return convertAutoSelect(component);
		default:
			return { type, unsupported: true };
	}
}

function convertButton(component: APIButtonComponent): ButtonOutput {
	return {
		type: ComponentType.Button,
		style: component.style,
		disabled: component.disabled ?? false,
		label: "label" in component ? component.label : undefined,
		url: "url" in component ? component.url : undefined,
		customId: "custom_id" in component ? component.custom_id : undefined,
		emoji:
			"emoji" in component && component.emoji
				? convertEmoji(component.emoji)
				: undefined,
	};
}

function convertStringSelect(
	component: APIStringSelectComponent,
): StringSelectOutput {
	return {
		type: component.type,
		customId: component.custom_id,
		disabled: component.disabled ?? false,
		placeholder: component.placeholder,
		minValues: component.min_values,
		maxValues: component.max_values,
		options: component.options.map((option) => ({
			label: option.label,
			value: option.value,
			description: option.description,
			emoji: option.emoji ? convertEmoji(option.emoji) : undefined,
			default: option.default,
		})),
	};
}

function convertAutoSelect(
	component: APIAutoPopulatedSelectMenuComponent,
): AutoSelectOutput {
	return {
		type: component.type,
		customId: component.custom_id,
		disabled: component.disabled ?? false,
		placeholder: component.placeholder,
		minValues: component.min_values,
		maxValues: component.max_values,
		channelTypes:
			component.type === ComponentType.ChannelSelect
				? component.channel_types
				: undefined,
		defaultValues: component.default_values?.map((entry) => ({
			id: entry.id,
			type: entry.type,
		})),
	};
}

function convertAccessory(
	component: APISectionAccessoryComponent,
): AccessoryOutput | undefined {
	switch (component.type) {
		case ComponentType.Button:
			return convertButton(component);
		case ComponentType.Thumbnail:
			return convertThumbnail(component);
		default:
			return undefined;
	}
}

function convertThumbnail(component: APIThumbnailComponent): AccessoryOutput {
	return {
		type: ComponentType.Thumbnail,
		media: { url: component.media.url },
		description: component.description,
		spoiler: component.spoiler,
	};
}

function convertEmoji(emoji: APIMessageComponentEmoji): EmojiOutput {
	return {
		id: emoji.id ?? null,
		name: emoji.name ?? null,
		animated: emoji.animated ?? false,
	};
}

export const supportedV2ComponentTypes = [
	ComponentType.TextDisplay,
	ComponentType.Section,
	ComponentType.Separator,
	ComponentType.MediaGallery,
	ComponentType.File,
	ComponentType.Container,
	ComponentType.Thumbnail,
] as const;

export const backlinkChannelTypes = [
	ChannelType.AnnouncementThread,
	ChannelType.PublicThread,
] as const;
