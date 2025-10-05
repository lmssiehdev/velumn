import { EmbedType } from 'discord-api-types/v10';
import z from 'zod';

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
