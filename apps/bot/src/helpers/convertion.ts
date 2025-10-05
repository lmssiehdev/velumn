import { embedSchema } from '@repo/db/helpers/validation';
import type {
  DBChannel,
  DBMessage,
  DBMessageWithRelations,
  DBServerInsert,
  DBUser,
} from '@repo/db/schema/index';
import {
  ChannelFlags,
  type Guild,
  type GuildBasedChannel,
  type GuildChannel,
  type Message,
  type ThreadChannel,
  type User,
} from 'discord.js';

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
    // flags: message.flags.bitfield,
    // nonce: message.nonce ? message.nonce.toString() : null,
    // tts: message.tts,
    // embeds: message.embeds.map((embed) => ({
    //   title: embed.title ?? undefined,
    //   description: embed.description ?? undefined,
    //   url: embed.url ?? undefined,
    //   color: embed.color ?? undefined,
    //   type: undefined,
    //   timestamp: embed.timestamp ?? undefined,
    //   footer: embed.footer
    //     ? {
    //         text: embed.footer.text,
    //         iconUrl: embed.footer.iconURL ?? undefined,
    //         proxyIconUrl: embed.footer.proxyIconURL ?? undefined,
    //       }
    //     : undefined,
    //   image: embed.image
    //     ? {
    //         url: embed.image.url,
    //         proxyUrl: embed.image.proxyURL ?? undefined,
    //         height: embed.image.height ?? undefined,
    //         width: embed.image.width ?? undefined,
    //       }
    //     : undefined,
    //   video: embed.video
    //     ? {
    //         height: embed.video.height ?? undefined,
    //         width: embed.video.width ?? undefined,
    //         url: embed.video.url,
    //         proxyUrl: embed.video.proxyURL ?? undefined,
    //       }
    //     : undefined,
    //   provider: embed.provider
    //     ? {
    //         name: embed.provider.name ?? undefined,
    //         url: embed.provider.url ?? undefined,
    //       }
    //     : undefined,
    //   thumbnail: embed.thumbnail
    //     ? {
    //         url: embed.thumbnail.url,
    //         proxyUrl: embed.thumbnail.proxyURL ?? undefined,
    //         height: embed.thumbnail.height ?? undefined,
    //         width: embed.thumbnail.width ?? undefined,
    //       }
    //     : undefined,
    //   author: embed.author
    //     ? {
    //         name: embed.author.name ?? undefined,
    //         url: embed.author.url ?? undefined,
    //         iconUrl: embed.author.iconURL ?? undefined,
    //         proxyIconUrl: embed.author.proxyIconURL ?? undefined,
    //       }
    //     : undefined,
    //   fields: embed.fields.map((field) => ({
    //     name: field.name,
    //     value: field.value,
    //     inline: field.inline ?? false,
    //   })),
    // })),
    // interactionId: message.interaction?.id ?? null,
    pinned: fullMessage.pinned,
    type: fullMessage.type,
    webhookId: fullMessage.webhookId,
    referenceId: fullMessage.reference?.messageId ?? null,
    authorId: fullMessage.author.id,
    serverId: fullMessage.guildId,
    // questionId: null,
    childThreadId: fullMessage.thread?.id ?? null,
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
  const dbMessages = new Map<string, DBMessageWithRelations>();
  for await (const msg of messages) {
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
