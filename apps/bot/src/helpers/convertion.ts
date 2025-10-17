import {
  collectionToArray,
  type DBSnapshotSchema,
  dbAttachmentsSchema,
  embedSchema,
  internalLinksSchema,
  type MessageMetadataSchema,
  messageMetadataSchema,
  pollSchema,
  snapShotSchema,
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
  type Emoji,
  type Guild,
  type GuildBasedChannel,
  type GuildChannel,
  type Message,
  MessageFlags,
  type MessageSnapshot,
  MessageType,
  type ThreadChannel,
  type User,
} from 'discord.js';
import z from 'zod';
import { is } from 'zod/v4/locales';
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
    isIgnored: false,
  } satisfies DBUser;
}

//
// Message
//

function toDbPoll(message: Message) {
  if (!message.poll) {
    return null;
  }

  const { success, data, error } = pollSchema.safeParse(message.poll);
  if (!success) {
    console.error(
      'Failed to parse poll data:',
      error.issues.map((x) => x.message)
    );
    return null;
  }
  return data;
}

async function toDbInternalLink(message: Message | MessageSnapshot) {
  if (!message.content) {
    return [];
  }

  const groupSchema = z.object({
    original: z.string(),
    guildId: z.string(),
    channelId: z.string(),
    messageId: z.string().optional(),
  });

  const validGroups = [...message.content.matchAll(MessageLinkRegex)].flatMap(
    (m) => {
      const parsed = groupSchema.safeParse({ original: m[0], ...m.groups });
      return parsed.success && message.guildId === parsed.data.guildId
        ? [parsed.data]
        : [];
    }
  );

  if (validGroups.length === 0) {
    return [];
  }

  const internalLinks = await Promise.all(
    validGroups.map(async (g) => {
      try {
        const channel = await message.client.channels.fetch(g.channelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          return null;
        }
        if (!('messages' in channel)) {
          return null;
        }
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
export async function toDbMetadata(message: Message | MessageSnapshot): Promise<MessageMetadataSchema | null> {
  const { users, channels, roles } = message.mentions;
  const internalLinks = await toDbInternalLink(message);

  const { success, data } = messageMetadataSchema.safeParse({
    users,
    channels,
    roles,
    internalLinks,
  });
  if (!success) {
    console.error('failed_to_parse_message_medata');
    return null;
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
  let fullMessage = message.type === MessageType.ThreadStarterMessage ? await message.fetchReference() : message;
  if (fullMessage.partial) {
    fullMessage = await fullMessage.fetch();
  }
  if (!fullMessage.guildId) {
    throw new Error('Message is not in a guild');
  }

  const convertedMessage: DBMessageWithRelations = {
    id: fullMessage.id,
    cleanContent: fullMessage.cleanContent,
    content: fullMessage.content,
    channelId: fullMessage.channelId,
    parentChannelId: fullMessage.channel.isThread()
      ? fullMessage.channel.parentId
      : null,
    reactions: toDbReactions(fullMessage),
    attachments: toDbAttachments(fullMessage),
    embeds: toDbEmbeds(fullMessage),
    applicationId: message.applicationId,
    // interactionId: message.interaction?.id ?? null,
    pinned: fullMessage.pinned,
    type: fullMessage.type,
    webhookId: fullMessage.webhookId,
    referenceId: fullMessage.reference?.messageId ?? null,
    authorId: fullMessage.author.id,
    serverId: fullMessage.guildId,
    // questionId: null,
    childThreadId: fullMessage.thread?.id ?? null,
    poll: toDbPoll(fullMessage),
    // TODO: promise all?
    metadata: await toDbMetadata(fullMessage),
    snapshot: await toDBSnapshot(fullMessage),
    isIgnored: false,
    primaryChannelId: message.channelId,
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
    if (dbMessages.has(msg.id)) {
      continue;
    }
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
  if (!emoji) {
    return null;
  }
  return {
    id: emoji.id,
    name: emoji.name,
    animated: emoji.animated ?? false,
  };
}

function toDbEmbeds(message: Message | MessageSnapshot) {
  return message.embeds.flatMap((e) => {
    const result = embedSchema.safeParse(e.data);
    if (!result.success) {
      console.error('Invalid embed:', e.data, result.data, result.error);
      return [];
    }
    return [result.data];
  });
}

function toDbAttachments(message: Message | MessageSnapshot) {
  // !! TODO: use the zod schema
  return message.attachments.map((attachment) => {
    return {
      id: attachment.id,
      url: attachment.url,
      messageId: message.id!,
      proxyURL: attachment.proxyURL,
      name: attachment.name ?? '',
      size: attachment.size,
      height: attachment.height,
      width: attachment.width,
      contentType: attachment.contentType,
      description: attachment.description,
      ephemeral: attachment.ephemeral ?? false,
      isSnapshot: false,
    };
  });
}

export async function toDBSnapshot(
  message: Message
): Promise<DBSnapshotSchema | null> {
  if (!message.flags?.has(MessageFlags.HasSnapshot)) {
    return null;
  }
  const snapshot = message.messageSnapshots.first();
  if (!snapshot) {
    return null;
  }

  const snapshotWithMetadata = {
    ...snapshot,
    attachments: snapshot.attachments.map((x) => ({
      ...x,
      messageId: message.id,
      isSnapshot: true,
    })),
  };

  const { success, data, error } =
    snapShotSchema.safeParse(snapshotWithMetadata);

  if (!success) {
    console.error('Failed to parse snapshot:', error);
    return null;
  }

  return {
    ...data,
    metadata: await toDbMetadata(snapshot),
    forwardedInMessageId: message.id,
  };
}
