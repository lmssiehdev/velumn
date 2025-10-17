import { EmbedType, PollLayoutType } from 'discord-api-types/v10';
import z, { ZodSchema } from 'zod';

export const collectionToRecord = <T extends z.ZodObject>(schema: T) =>
  z
    .any()
    .transform((arr) => arr.map((x: unknown) => x))
    .pipe(z.array(z.object({ id: z.coerce.string() }).and(schema)))
    .transform((arr) => {
      if (arr.length === 0) return undefined;
      return arr.reduce(
        (acc, { id, ...rest }) => {
          // @ts-expect-error
          acc[id] = rest;
          return acc;
        },
        {} as Record<string, z.infer<T>>
      )
    }
    )
    .optional()
    .catch((ctx) => {
      console.log('Failed to parse collection:', ctx);
      return undefined;
    });

export const collectionToArray = <T extends z.ZodObject>(schema: T) =>
  z
    .any()
    .transform((c) => {
      if (c instanceof Map) {
        return Array.from(c.values());
      }
      const arr = Array.isArray(c) ? c : [];
      if (arr.length === 0) return undefined;
      return c;
    })
    .pipe(z.array(schema))
    .optional()
    .catch((ctx) => {
      console.log(
        'collection_to_array_schema_converstion_failed',
        z.prettifyError(ctx.error)
      );
      return undefined;
    });

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
export const messageMetadataSchema = z.object({
  channels: collectionToRecord(
    z.object({
      name: z.string(),
      type: z.number(),
    })
  ).optional(),
  roles: collectionToRecord(
    z.object({
      name: z.string(),
      color: z.number(),
    })
  ).optional(),
  users: collectionToRecord(
    z.object({
      username: z.string(),
      globalName: z.string().nullable(),
    })
  ).optional(),
  internalLinks: collectionToArray(internalLinksSchema).optional(),
}).transform(removeUndefinedValues);

function removeUndefinedValues<T extends Record<string, any>>(
  data: T
): Partial<T> | null {
  const result = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;

  return Object.keys(result).length === 0 ? null : result;
}

//
// Poll Schema
//

const answerSchema = z.object({
  text: z.string(),
  voteCount: z.number(),
  emoji: z
    .object({
      id: z.string().nullable(),
      name: z.string(),
      animated: z.boolean().catch(false),
    })
    .nullable(),
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
export type EmbedSchema = z.infer<typeof embedSchema>;
export const embedSchema = z
  .object({
    title: z.string(),
    type: z.enum(EmbedType),
    description: z.string(),
    url: z.string(),
    timestamp: z.string(),
    color: z.number(),
    footer: z.object({
      text: z.string(),
      icon_url: z.string().optional(),
      proxy_icon_url: z.string().optional(),
    }),
    image: z.object({
      url: z.string(),
      proxy_url: z.string().optional(),
      height: z.number().optional(),
      width: z.number().optional(),
    }),
    thumbnail: z.object({
      url: z.string(),
      proxy_url: z.string().optional(),
      height: z.number().optional(),
      width: z.number().optional(),
    }),
    video: z.object({
      url: z.string().optional(),
      proxy_url: z.string().optional(),
      height: z.number().optional(),
      width: z.number().optional(),
    }),
    provider: z
      .object({
        name: z.string(),
        url: z.string(),
      })
      .partial(),
    author: z.object({
      name: z.string().max(256),
      url: z.string().optional(),
      icon_url: z.string().optional(),
      proxy_icon_url: z.string().optional(),
    }),
    fields: z.array(
      z.object({
        name: z.string().max(256),
        value: z.string().max(1024),
        inline: z.boolean().optional(),
      })
    ),
  })
  .partial();

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
  embeds: z
    .array(
      z
        .object({
          data: embedSchema,
        })
        .transform((x) => x.data)
    )
    .catch((ctx) => {
      console.log(z.prettifyError(ctx.error));
      return [];
    }),
  flags: z.number().or(z.any().transform((x) => x.bitfield ?? 0)),
});
