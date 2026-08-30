import {
	ComponentType,
	PollLayoutType,
	StickerFormatType,
} from "discord-api-types/v10";
import z from "zod";
import {
	collectionToArray,
	collectionToRecord,
	removeUndefinedValues,
} from "../utils/zod";

const partialEmojiSchema = z
	.object({
		id: z.string().nullable().optional(),
		name: z.string().nullable().optional(),
		animated: z.boolean().catch(false),
	})
	.nullable();

const componentEmojiSchema = partialEmojiSchema.optional();

const buttonComponentSchema = z.object({
	type: z.literal(ComponentType.Button),
	style: z.number(),
	disabled: z.boolean().default(false),
	label: z.string().nullable().optional(),
	url: z.string().nullable().optional(),
	customId: z.string().nullable().optional(),
	emoji: componentEmojiSchema,
});

const selectBaseFields = {
	customId: z.string(),
	placeholder: z.string().nullable().optional(),
	minValues: z.number().int().nonnegative().optional(),
	maxValues: z.number().int().nonnegative().optional(),
	disabled: z.boolean().default(false),
};

const stringSelectComponentSchema = z.object({
	type: z.literal(ComponentType.StringSelect),
	...selectBaseFields,
	options: z.array(
		z.object({
			label: z.string(),
			value: z.string(),
			description: z.string().nullable().optional(),
			emoji: componentEmojiSchema,
			default: z.boolean().optional(),
		}),
	),
});

const autoSelectComponentSchema = z.object({
	type: z.union([
		z.literal(ComponentType.UserSelect),
		z.literal(ComponentType.RoleSelect),
		z.literal(ComponentType.MentionableSelect),
		z.literal(ComponentType.ChannelSelect),
	]),
	...selectBaseFields,
	channelTypes: z.array(z.number()).optional(),
	defaultValues: z
		.array(z.object({ id: z.string(), type: z.string() }))
		.optional(),
});

const actionRowItemSchema = z.union([
	buttonComponentSchema,
	stringSelectComponentSchema,
	autoSelectComponentSchema,
	z.object({ type: z.number(), unsupported: z.literal(true) }),
]);

//
// Rows Schema
//
export const rowsSchema = z.object({
	type: z.literal(ComponentType.ActionRow),
	components: z.array(actionRowItemSchema),
});

const mediaSchema = z.object({ url: z.string() });
const textDisplayComponentSchema = z.object({
	type: z.literal(ComponentType.TextDisplay),
	content: z.string(),
	id: z.number().int().optional(),
});
const thumbnailComponentSchema = z.object({
	type: z.literal(ComponentType.Thumbnail),
	media: mediaSchema,
	description: z.string().nullable().optional(),
	spoiler: z.boolean().optional(),
});
const separatorComponentSchema = z.object({
	type: z.literal(ComponentType.Separator),
	divider: z.boolean().optional(),
	spacing: z.number().optional(),
});
const mediaGalleryComponentSchema = z.object({
	type: z.literal(ComponentType.MediaGallery),
	items: z.array(
		z.object({
			media: mediaSchema,
			description: z.string().nullable().optional(),
			spoiler: z.boolean().optional(),
		}),
	),
});
const fileComponentSchema = z.object({
	type: z.literal(ComponentType.File),
	file: mediaSchema,
	spoiler: z.boolean().optional(),
});
const unknownComponentSchema = z.object({
	type: z.number(),
	unsupported: z.literal(true),
});

const sectionComponentSchema = z.object({
	type: z.literal(ComponentType.Section),
	components: z.array(textDisplayComponentSchema),
	accessory: z
		.union([thumbnailComponentSchema, buttonComponentSchema])
		.optional(),
});

type MessageComponentSchema =
	| z.infer<typeof rowsSchema>
	| z.infer<typeof textDisplayComponentSchema>
	| z.infer<typeof sectionComponentSchema>
	| z.infer<typeof separatorComponentSchema>
	| z.infer<typeof mediaGalleryComponentSchema>
	| z.infer<typeof fileComponentSchema>
	| {
			type: typeof ComponentType.Container;
			accentColor?: number | null;
			spoiler?: boolean;
			components: MessageComponentSchema[];
	  }
	| z.infer<typeof unknownComponentSchema>;

const messageComponentSchema: z.ZodType<MessageComponentSchema> = z.lazy(() =>
	z.union([
		rowsSchema,
		textDisplayComponentSchema,
		sectionComponentSchema,
		separatorComponentSchema,
		mediaGalleryComponentSchema,
		fileComponentSchema,
		z.object({
			type: z.literal(ComponentType.Container),
			accentColor: z.number().nullable().optional(),
			spoiler: z.boolean().optional(),
			components: z.array(messageComponentSchema),
		}),
		unknownComponentSchema,
	]),
);

export const messageComponentsSchema = z.array(messageComponentSchema);
export type RowsSchema = z.infer<typeof rowsSchema>;
export type MessageComponentsSchema = z.infer<typeof messageComponentsSchema>;

//
// Metadata Schema
//
export const internalLinksSchema = z.object({
	original: z.string(),
	guild: z.object({
		id: z.string(),
		name: z.string(),
	}),
	channel: z.object({
		parent: z
			.object({
				name: z.string().optional(),
				type: z.number().optional(),
				parentId: z.string().optional(),
			})
			.optional(),
		id: z.string(),
		type: z.number(),
		name: z.string(),
	}),
	message: z.string().optional(),
});

export type MessageMetadataSchema = z.infer<typeof messageMetadataSchema>;
const resolvedRecord = <T extends z.ZodObject>(schema: T) =>
	z
		.union([z.record(z.string(), schema), collectionToRecord(schema)])
		.optional();

export const messageMetadataSchema = z
	.object({
		flags: z.number().int().nonnegative().optional(),
		reference: z
			.object({
				type: z.number().int().optional(),
				messageId: z.string().nullable().optional(),
				channelId: z.string().nullable().optional(),
				guildId: z.string().nullable().optional(),
			})
			.optional(),
		webhook: z
			.object({
				name: z.string().optional(),
				avatar: z.string().nullable().optional(),
				id: z.string().optional(),
				type: z.number().int().nullable().optional(),
				displayName: z.string().nullable().optional(),
				avatarUrl: z.string().nullable().optional(),
			})
			.optional(),
		interaction: z
			.object({
				id: z.string(),
				type: z.number().int().nullable().optional(),
				applicationId: z.string().nullable().optional(),
			})
			.optional(),
		channels: resolvedRecord(
			z.object({
				name: z.string(),
				type: z.number(),
			}),
		),
		roles: resolvedRecord(
			z.object({
				name: z.string(),
				color: z.number(),
			}),
		),
		users: resolvedRecord(
			z.object({
				username: z.string(),
				globalName: z.string().nullable(),
			}),
		),
		internalLinks: collectionToArray(internalLinksSchema),
	})
	.transform(removeUndefinedValues);
//
// Poll Schema
//

const answerSchema = z.object({
	text: z.string(),
	voteCount: z.number(),
	emoji: partialEmojiSchema,
});
export const pollSchema = z.object({
	question: z
		.object({
			text: z.string(),
		})
		.transform((x) => x.text),
	resultsFinalized: z.boolean(),
	layoutType: z.enum(PollLayoutType),
	answers: collectionToRecord(answerSchema),
});

export type PollSchema = z.infer<typeof pollSchema>;

//
// Embed Schema
//
const uint32Schema = z.number().int().min(0).max(4_294_967_295);
const embedMediaSchema = z.object({
	url: z.string().optional(),
	proxy_url: z.string().optional(),
	height: uint32Schema.optional(),
	width: uint32Schema.optional(),
	content_type: z.string().optional(),
	placeholder: z.string().optional(),
	placeholder_version: uint32Schema.optional(),
	description: z.string().optional(),
	flags: uint32Schema.optional(),
});

export const embedSchema = z.object({
	type: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	url: z.string().optional(),
	timestamp: z.string().optional(),
	color: z.number().int().optional(),
	footer: z
		.object({
			text: z.string(),
			icon_url: z.string().optional(),
			proxy_icon_url: z.string().optional(),
		})
		.optional(),
	image: embedMediaSchema.optional(),
	thumbnail: embedMediaSchema.optional(),
	video: embedMediaSchema.optional(),
	provider: z
		.object({
			name: z.string(),
			url: z.string().optional(),
		})
		.optional(),
	author: z
		.object({
			name: z.string(),
			url: z.string().optional(),
			icon_url: z.string().optional(),
			proxy_icon_url: z.string().optional(),
		})
		.optional(),
	fields: z
		.array(
			z.object({
				name: z.string(),
				value: z.string(),
				inline: z.boolean(),
			}),
		)
		.optional(),
	flags: z.number().int().nullable().optional(),
	components: z.array(messageComponentSchema).optional(),
});
export type EmbedSchema = z.infer<typeof embedSchema>;

//
// Attachments
//

export type DBAttachments = z.infer<typeof dbAttachmentsSchema>;
export const dbAttachmentsSchema = z.object({
	id: z.string(),
	messageId: z.string(), // Snowflake - numeric string
	name: z.string(),
	url: z.string(),
	proxyURL: z.string(),
	description: z.string().nullable(),
	contentType: z.string().nullable(),
	size: z.number().int().nullable(),
	height: z.number().int().nullable(),
	width: z.number().int().nullable(),
	isSnapshot: z.boolean().default(false),
});

// STICKERS

export const stickerSchema = collectionToArray(
	z.object({
		id: z.string(),
		name: z.string(),
		format: z.enum(StickerFormatType),
	}),
);

export type StickerSchema = z.infer<typeof stickerSchema>;

//
// Snapshots
//

export type DBSnapshotSchema = {
	forwardedInMessageId: string;
	metadata: MessageMetadataSchema | null;
} & z.infer<typeof snapShotSchema>;
export const snapShotSchema = z.object({
	id: z.string().nullable(),
	content: z.string(),
	type: z.number(),
	createdTimestamp: z.number(),
	editedTimestamp: z.number().nullable(),
	attachments: collectionToArray(dbAttachmentsSchema),
	components: z.array(rowsSchema).nullable(),
	stickers: stickerSchema.nullable(),
	embeds: z
		.array(
			z
				.object({
					data: embedSchema,
				})
				.transform((x) => x.data),
		)
		.catch((ctx) => {
			console.log(z.prettifyError(ctx.error));
			return [];
		}),
	flags: z.number().or(z.any().transform((x) => x.bitfield ?? 0)),
});
