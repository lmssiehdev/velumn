import { EmbedType } from 'discord-api-types/v10';
import z from 'zod';

//
// Metadata Schema
//

const collectionToRecord = <T extends z.ZodObject>(schema: T) =>
  z
    .any()
    .transform((arr) => arr.map((x: unknown) => x))
    .pipe(z.array(z.object({ id: z.string() }).and(schema)))
    .transform((arr) =>
      arr.reduce(
        (acc, { id, ...rest }) => {
          // @ts-expect-error
          acc[id] = rest;
          return acc;
        },
        {} as Record<string, z.infer<T>>
      )
    )
    .catch({});

export const internalLinksSchema = z.object({
  original: z.string(),
  guild: z.object({
    id: z.string(),
    name: z.string(),
  }),
  channel: z.object({
    parent: z.object({
      name: z.string().optional(),
      type: z.number().optional(),
      parentId: z.string().optional(),
    }).optional(),
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
  ),
  roles: collectionToRecord(
    z.object({
      name: z.string(),
      color: z.number(),
    })
  ),
  users: collectionToRecord(
    z.object({
      username: z.string(),
      globalName: z.string().nullable(),
    })
  ),
  internalLinks: z.array(internalLinksSchema),
});

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
