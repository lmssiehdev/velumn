import {
	internalLinksSchema,
	type MessageComponentsSchema,
	type MessageMetadataSchema,
	messageComponentsSchema,
	messageMetadataSchema,
} from "@repo/db/helpers/validation";
import {
	ChannelType,
	ComponentType,
	MessageFlags,
} from "discord-api-types/v10";
import type {
	AttachmentReplacement,
	AttachmentState,
	ReactionReplacement,
	ReactionState,
	ReplacementState,
} from "./model";

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

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
	readonly channelType: number;
	readonly parent?: {
		readonly id: string;
		readonly name: string;
		readonly type: number;
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
	readonly type: number;
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
			Record<string, { readonly name: string; readonly type: number }>
		>;
		readonly roles?: Readonly<
			Record<string, { readonly name: string; readonly color: number }>
		>;
	};
	/** `null` means the relation was not fetched; an empty array removes all rows. */
	readonly attachments: readonly ResolvedAttachmentInput[] | null;
	readonly reactions: readonly ResolvedReactionInput[] | null;
	readonly components: readonly ResolvedComponentInput[] | null;
	readonly linkTargets?: readonly ResolvedInternalLinkTarget[];
}

export type ResolvedComponentInput = Readonly<{
	type: number;
	[key: string]: JsonValue;
}>;

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
	readonly type: number;
	readonly sourceVersion: number;
	readonly pinned: boolean;
	readonly applicationId: string | null;
	readonly childThreadId: string | null;
	readonly referenceId: string | null;
	readonly metadata: MessageMetadataSchema;
	readonly attachments: AttachmentReplacement;
	readonly reactions: ReactionReplacement;
	readonly components: ReplacementState<MessageComponentsSchema[number]>;
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
	const metadata = messageMetadataSchema.parse({
		flags: input.flags,
		reference: input.reference ?? undefined,
		webhook: input.webhook
			? {
					id: input.webhook.id,
					type: input.webhook.type,
					displayName: input.webhook.displayName,
					avatarUrl: input.webhook.avatarUrl,
					name: input.webhook.displayName ?? "Webhook",
					avatar: input.webhook.avatarUrl,
				}
			: undefined,
		interaction: input.interaction ?? undefined,
		users: input.mentions?.users,
		channels: input.mentions?.channels,
		roles: input.mentions?.roles,
		internalLinks: internalLinks.flatMap((link) =>
			link.target ? [toLegacyInternalLink(link, link.target)] : [],
		),
	});

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
		internalLinks,
		backlinks: {
			_tag: "Replace",
			items: uniqueBacklinks(input, internalLinks),
		},
	};
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
) {
	return internalLinksSchema.parse({
		original: link.original,
		guild: { id: target.guildId, name: target.guildName },
		channel: {
			id: target.channelId,
			name: target.channelName,
			type: target.channelType,
			parent: target.parent
				? {
						parentId: target.parent.id,
						name: target.parent.name,
						type: target.parent.type,
					}
				: undefined,
		},
		message: link.messageId ?? undefined,
	});
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
	return Object.values(MessageFlags).filter(
		(flag): flag is MessageFlags =>
			typeof flag === "number" && (bitfield & flag) === flag,
	);
}

function convertComponent(
	component: ResolvedComponentInput,
): MessageComponentsSchema[number] {
	let converted: unknown;
	switch (component.type) {
		case ComponentType.ActionRow:
			converted = {
				type: ComponentType.ActionRow,
				components: array(component.components).map(convertActionRowItem),
			};
			break;
		case ComponentType.TextDisplay:
			converted = {
				type: ComponentType.TextDisplay,
				content: string(component.content),
				...(number(component.id) == null ? {} : { id: number(component.id) }),
			};
			break;
		case ComponentType.Section:
			converted = {
				type: ComponentType.Section,
				components: array(component.components).map((child) => ({
					type: ComponentType.TextDisplay,
					content: string(object(child).content),
				})),
				...(component.accessory
					? { accessory: convertAccessory(object(component.accessory)) }
					: {}),
			};
			break;
		case ComponentType.Separator:
			converted = {
				type: ComponentType.Separator,
				...(boolean(component.divider) == null
					? {}
					: { divider: boolean(component.divider) }),
				...(number(component.spacing) == null
					? {}
					: { spacing: number(component.spacing) }),
			};
			break;
		case ComponentType.MediaGallery:
			converted = {
				type: ComponentType.MediaGallery,
				items: array(component.items).map((item) => {
					const value = object(item);
					return {
						media: { url: string(object(value.media).url) },
						...(typeof value.description === "string"
							? { description: value.description }
							: {}),
						...(typeof value.spoiler === "boolean"
							? { spoiler: value.spoiler }
							: {}),
					};
				}),
			};
			break;
		case ComponentType.File:
			converted = {
				type: ComponentType.File,
				file: { url: string(object(component.file).url) },
				...(typeof component.spoiler === "boolean"
					? { spoiler: component.spoiler }
					: {}),
			};
			break;
		case ComponentType.Container:
			converted = {
				type: ComponentType.Container,
				components: array(component.components).map((child) =>
					convertComponent(object(child) as ResolvedComponentInput),
				),
				...(typeof component.accentColor === "number"
					? { accentColor: component.accentColor }
					: {}),
				...(typeof component.spoiler === "boolean"
					? { spoiler: component.spoiler }
					: {}),
			};
			break;
		default:
			converted = { type: component.type, unsupported: true };
	}
	return messageComponentsSchema.element.parse(converted);
}

function convertActionRowItem(value: JsonValue) {
	const component = object(value);
	const type = number(component.type) ?? -1;
	if (type === ComponentType.Button) return convertButton(component);
	if (type === ComponentType.StringSelect) {
		return {
			...convertSelectBase(component, ComponentType.StringSelect),
			options: array(component.options).map((option) => {
				const item = object(option);
				return {
					label: string(item.label),
					value: string(item.value),
					...(typeof item.description === "string"
						? { description: item.description }
						: {}),
					...(item.emoji ? { emoji: convertEmoji(object(item.emoji)) } : {}),
					...(typeof item.default === "boolean"
						? { default: item.default }
						: {}),
				};
			}),
		};
	}
	if (
		type === ComponentType.UserSelect ||
		type === ComponentType.RoleSelect ||
		type === ComponentType.MentionableSelect ||
		type === ComponentType.ChannelSelect
	) {
		return {
			...convertSelectBase(component, type),
			...(Array.isArray(component.channelTypes)
				? { channelTypes: component.channelTypes.filter(isNumber) }
				: {}),
			...(Array.isArray(component.defaultValues)
				? {
						defaultValues: component.defaultValues.map((entry) => {
							const item = object(entry);
							return { id: string(item.id), type: string(item.type) };
						}),
					}
				: {}),
		};
	}
	return { type, unsupported: true as const };
}

function convertButton(component: Readonly<Record<string, JsonValue>>) {
	return {
		type: ComponentType.Button,
		style: number(component.style) ?? 1,
		disabled: boolean(component.disabled) ?? false,
		...(typeof component.label === "string" ? { label: component.label } : {}),
		...(typeof component.url === "string" ? { url: component.url } : {}),
		...(typeof component.customId === "string"
			? { customId: component.customId }
			: {}),
		...(component.emoji
			? { emoji: convertEmoji(object(component.emoji)) }
			: {}),
	};
}

function convertAccessory(component: Readonly<Record<string, JsonValue>>) {
	if (component.type === ComponentType.Thumbnail) {
		return {
			type: ComponentType.Thumbnail,
			media: { url: string(object(component.media).url) },
			...(typeof component.description === "string"
				? { description: component.description }
				: {}),
			...(typeof component.spoiler === "boolean"
				? { spoiler: component.spoiler }
				: {}),
		};
	}
	return convertButton(component);
}

function convertSelectBase(
	component: Readonly<Record<string, JsonValue>>,
	type: number,
) {
	return {
		type,
		customId: string(component.customId),
		disabled: boolean(component.disabled) ?? false,
		...(typeof component.placeholder === "string"
			? { placeholder: component.placeholder }
			: {}),
		...(typeof component.minValues === "number"
			? { minValues: component.minValues }
			: {}),
		...(typeof component.maxValues === "number"
			? { maxValues: component.maxValues }
			: {}),
	};
}

function convertEmoji(emoji: Readonly<Record<string, JsonValue>>) {
	return {
		id: typeof emoji.id === "string" ? emoji.id : null,
		name: typeof emoji.name === "string" ? emoji.name : null,
		animated: typeof emoji.animated === "boolean" ? emoji.animated : false,
	};
}

function object(
	value: JsonValue | undefined,
): Readonly<Record<string, JsonValue>> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Readonly<Record<string, JsonValue>>)
		: {};
}

function array(value: JsonValue | undefined): readonly JsonValue[] {
	return Array.isArray(value) ? value : [];
}

function string(value: JsonValue | undefined): string {
	return typeof value === "string" ? value : "";
}

function number(value: JsonValue | undefined): number | null {
	return typeof value === "number" ? value : null;
}

function boolean(value: JsonValue | undefined): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function isNumber(value: JsonValue): value is number {
	return typeof value === "number";
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
