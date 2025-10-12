import {
  embedSchema,
  internalLinksSchema,
  type MessageMetadataSchema,
  messageMetadataSchema,
} from '@repo/db/helpers/validation';
import type {
  DBChannel,
  DBMessage,
  DBMessageWithRelations,
  DBServerInsert,
  DBUser,
} from '@repo/db/schema/index';
import {
  ChannelFlags,
  Emoji,
  type Guild,
  type GuildBasedChannel,
  type GuildChannel,
  type Message,
  type ThreadChannel,
  type User,
} from 'discord.js';
import z from 'zod';
import { isChannelIndexable } from '../core/indexing/server.js';
import { MessageLinkRegex } from './regex';

export async function toDbChannel(
  channel: GuildChannel | GuildBasedChannel | ThreadChannel
) {
  if (!channel.guild) {
    throw new Error('Channel is not in a guild');
  }

  const authorId = channel.isThread()
    ? (await channel.fetchOwner())?.id
    : undefined;

  const convertedChannel: DBChannel = {
    id: channel.id,
    channelName: channel.name,
    authorId: authorId ?? null,
    serverId: channel.guild.id,
    parentId: channel.isThread() ? channel.parentId : null,
    archivedTimestamp:
      channel.isThread() && channel.archiveTimestamp
        ? channel.archiveTimestamp
        : null,
    lastIndexedMessageId: null,
    type: channel.type,
    // archived: channel.isThread() && (channel.archived ?? false),
    indexingEnabled: false,
    pinned: channel.isThread() && channel.flags.has(ChannelFlags.Pinned),
  };

  return convertedChannel;
}

export function toDbUser(user: User) {
  return {
    id: user.id,
    displayName: user.username,
    avatar: user.avatar,
    isBot: user.bot,
    anonymizeName: false,
    canPubliclyDisplayMessages: false,
  } satisfies DBUser;
}

//
// Message
//

async function toDbInternalLink(message: Message) {
  if (!message.content) return [];

  const groupSchema = z.object({
    original: z.string(),
    guildId: z.string(),
    channelId: z.string(),
    messageId: z.string().optional(),
  });

  const validGroups = [...message.content.matchAll(MessageLinkRegex)]
    .flatMap(m => {
      const parsed = groupSchema.safeParse({ original: m[0], ...m.groups });
      return parsed.success && message.guildId === parsed.data.guildId
        ? [parsed.data]
        : [];
    });


  if (validGroups.length === 0) return []

  const internalLinks = await Promise.all(
    validGroups.map(async (g) => {
      try {
        const channel = await message.client.channels.fetch(g.channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) return null;
        if (!('messages' in channel)) return null;
        const fetchedMessage = g.messageId
          ? await channel.messages.fetch(g.messageId)
          : null;

        const data = {
          original: g.original,
          guild: {
            id: channel.guildId,
            name: channel.guild.name,
          },
          channel: {
            parent: {
              name: channel.parent?.name,
              type: channel.parent?.type,
              parentId: channel.parentId ?? undefined,
            },
            id: channel.id,
            type: channel.type,
            name: channel.name,
          },
          message: fetchedMessage?.id,
        } satisfies z.infer<typeof internalLinksSchema>;

        return internalLinksSchema.parse(data);
      } catch (error) {
        console.error('Failed to fetch channel/message:', error);
        return null;
      }
    })
  );
  return internalLinks.filter((x) => x !== null) ?? [];
}

/**
 * used to extract somehelpful metadata required by the UI to render messages.
 */
export async function toDbMetadata(message: Message) {
  const { users, channels, roles } = message.mentions;
  const internalLinks = await toDbInternalLink(message);

  const { success, data } = messageMetadataSchema.safeParse({
    users,
    channels,
    roles,
    internalLinks,
  });
  if (!success) {
    console.log('failed_to_parse_message_medata');
    return {} as MessageMetadataSchema;
  }
  return data;
}
function toDbReactions(message: Message): DBMessage['reactions'] {
  if (!message.guild) {
    return null;
  }

  const dbReactions: DBMessage['reactions'] = [];
  const reactions = message.reactions.cache.values();

  // TODO: check if we need to fetch the reactions..
  for (const reaction of reactions) {
    if (!reaction.emoji.name) {
      continue;
    }

    const isServerEmoji = reaction.emoji.id
      ? Boolean(message.guild.emojis.cache.get(reaction.emoji.id))
      : true;

    dbReactions.push({
      id: reaction.emoji.id,
      name: reaction.emoji.name,
      animated: reaction.emoji.animated ?? false,
      count: reaction.count,
      messageId: message.id,
      isServerEmoji,
    });
  }

  return dbReactions;
}

// shut it, this code is pretty;
export async function toDBMessage(
  message: Message
): Promise<DBMessageWithRelations> {
  let fullMessage = message;
  if (fullMessage.partial) {
    fullMessage = await fullMessage.fetch();
  }
  if (!fullMessage.guildId) {
    throw new Error('Message is not in a guild');
  }

  const embeds = message.embeds.flatMap((e) => {
    const result = embedSchema.safeParse(e.data);
    if (!result.success) {
      console.error('Invalid embed:', e.data, result.data, result.error);
      return [];
    }
    return [result.data];
  });

  const convertedMessage: DBMessageWithRelations = {
    id: fullMessage.id,
    cleanContent: fullMessage.cleanContent,
    content: fullMessage.content,
    channelId: fullMessage.channelId,
    parentChannelId: fullMessage.channel.isThread()
      ? fullMessage.channel.parentId
      : null,
    reactions: toDbReactions(fullMessage),
    attachments: message.attachments.map((attachment) => {
      return {
        id: attachment.id,
        url: attachment.url,
        messageId: message.id,
        proxyUrl: attachment.proxyURL,
        name: attachment.name ?? '',
        size: attachment.size,
        height: attachment.height,
        width: attachment.width,
        contentType: attachment.contentType,
        description: attachment.description,
        ephemeral: attachment.ephemeral ?? false,
      };
    }),
    applicationId: message.applicationId,
    embeds,
    // interactionId: message.interaction?.id ?? null,
    pinned: fullMessage.pinned,
    type: fullMessage.type,
    webhookId: fullMessage.webhookId,
    referenceId: fullMessage.reference?.messageId ?? null,
    authorId: fullMessage.author.id,
    serverId: fullMessage.guildId,
    // questionId: null,
    childThreadId: fullMessage.thread?.id ?? null,
    metadata: await toDbMetadata(fullMessage),
  };
  return convertedMessage;
}

export function extractUsersSetFromMessages(messages: Message[]) {
  const users = new Map<string, DBUser>();
  for (const msg of messages) {
    users.set(msg.author.id, toDbUser(msg.author));
  }
  return Array.from(users.values());
}

export async function messagesToDBMessagesSet(messages: Message[]) {
  const reversed = [...messages].reverse();
  const dbMessages = new Map<string, DBMessageWithRelations>();
  for await (const msg of reversed) {
    if (dbMessages.has(msg.id)) continue;
    const converted = await toDBMessage(msg);
    dbMessages.set(msg.id, converted);
  }
  return Array.from(dbMessages.values());
}

//
// Server
//

export function toDbServer(guild: Guild) {
  const convertedServer: DBServerInsert = {
    id: guild.id,
    name: guild.name,
    description: guild.description,
    memberCount: guild.memberCount,
  };
  return convertedServer;
}

//
// Helpers
//

export function getEmojiData(emoji: Emoji) {
  if (!emoji) return null;
  return {
    id: emoji.id,
    name: emoji.name,
    animated: emoji.animated ?? false,
  };
}