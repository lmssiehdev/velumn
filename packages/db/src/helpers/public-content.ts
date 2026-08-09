import { constructDiscordLink } from "@repo/utils/helpers/discord";
import { getSlugFromTitle } from "@repo/utils/helpers/slugify";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import { ChannelType } from "discord-api-types/v10";
import { and, asc, desc, eq, exists, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index";
import {
  isPublicThreadVisible,
  PUBLIC_PARENT_CHANNEL_TYPES,
  PUBLIC_THREAD_CHANNEL_TYPES,
} from "../publication";
import {
  type DBMessage,
  dbAttachments,
  dbChannel,
  dbDiscordUser,
  dbMessage,
  dbServer,
  dbThreadBacklink,
  userServers,
} from "../schema";
import {
  classifyPublicReference,
  collectPublicMentionIds,
  enrichPublicMessageMentions,
  type PublicMessageMentions,
} from "./public-message-enrichment";
import { dedupeDatabaseRead } from "./request-cache";
import type {
  DBSnapshotSchema,
  EmbedSchema,
  MessageMetadataSchema,
  PollSchema,
  RowsSchema,
  StickerSchema,
} from "./validation";

const publicContentCapability = Symbol("publicContentCapability");
const publicThreadParent = alias(dbChannel, "public_thread_parent");
const publicThreadCategory = alias(dbChannel, "public_thread_category");
const publicShellCategory = alias(dbChannel, "public_shell_category");
const publicChannelCategory = alias(dbChannel, "public_channel_category");
const publicStarterMessage = alias(dbMessage, "public_starter_message");
const publicStarterAuthor = alias(dbDiscordUser, "public_starter_author");
const publicListStarter = alias(dbMessage, "public_list_starter");
const publicListAuthor = alias(dbDiscordUser, "public_list_author");
const publicMessageAuthor = alias(dbDiscordUser, "public_message_author");
const publicCountAuthor = alias(dbDiscordUser, "public_count_author");
const publicReferenceMessage = alias(dbMessage, "public_reference_message");
const publicReferenceAuthor = alias(dbDiscordUser, "public_reference_author");
const publicReferenceThread = alias(dbChannel, "public_reference_thread");
const publicReferenceParent = alias(dbChannel, "public_reference_parent");
const publicReferenceCategory = alias(dbChannel, "public_reference_category");
const publicReferenceServer = alias(dbServer, "public_reference_server");
const publicReferenceStarter = alias(dbMessage, "public_reference_starter");
const publicReferenceStarterAuthor = alias(dbDiscordUser, "public_reference_starter_author");
const publicBacklinkMessage = alias(dbMessage, "public_backlink_message");
const publicBacklinkAuthor = alias(dbDiscordUser, "public_backlink_author");
const publicBacklinkThread = alias(dbChannel, "public_backlink_thread");
const publicBacklinkParent = alias(dbChannel, "public_backlink_parent");
const publicBacklinkCategory = alias(dbChannel, "public_backlink_category");
const publicBacklinkServer = alias(dbServer, "public_backlink_server");
const publicBacklinkStarter = alias(dbMessage, "public_backlink_starter");
const publicBacklinkStarterAuthor = alias(dbDiscordUser, "public_backlink_starter_author");
const MAX_PUBLIC_THREAD_MESSAGES = 101;

export type PublicServerCapability = {
  readonly kind: "public_server";
  readonly serverId: string;
  readonly serverName: string;
  readonly [publicContentCapability]: true;
};

export type VerifiedPublicTenantCapability = {
  readonly kind: "verified_public_tenant";
  readonly serverId: string;
  readonly serverName: string;
  readonly hostname: string;
  readonly [publicContentCapability]: true;
};

export type ManagedServerCapability = {
  readonly kind: "managed_server";
  readonly serverId: string;
  readonly userId: string;
  readonly [publicContentCapability]: true;
};

export type PublicChannelCapability = {
  readonly kind: "public_channel";
  readonly serverId: string;
  readonly serverName: string;
  readonly channelId: string;
  readonly channelName: string;
  readonly channelType: (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number];
  readonly [publicContentCapability]: true;
};

export type PublicContentCapability =
  | PublicServerCapability
  | VerifiedPublicTenantCapability
  | ManagedServerCapability
  | PublicChannelCapability;

export type PublicForumShell = {
  server: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    icon: string | null;
    joinUrl: string | null;
    canonicalDomain: string | null;
  };
  channels: Array<{
    id: string;
    name: string;
    type: (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number];
  }>;
};

export type PublicThreadMetadata = {
  id: string;
  title: string;
  channel: {
    id: string;
    name: string;
  };
  server: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    canonicalDomain: string | null;
  };
};

export type PublicThreadListPage = {
  items: Array<{
    id: string;
    title: string;
    author: string;
    channel: {
      id: string;
      name: string;
    };
    pinned: boolean;
    messageCount: number;
  }>;
  nextCursor: string | null;
};

export type PublicThreadPage = {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  truncated: boolean;
  discordUrl: string;
  parent: {
    id: string;
    name: string;
    type: number;
  };
  state: {
    archived: boolean;
    archivedAt: string | null;
    locked: boolean;
  };
  tags: Array<{
    id: string;
    name: string;
    moderated: boolean;
    emojiId: string | null;
    emojiName: string | null;
  }>;
  server: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    icon: string | null;
    joinUrl: string | null;
    canonicalDomain: string | null;
  };
  starter: PublicThreadMessage;
  replies: PublicThreadMessage[];
  backlinks: PublicThreadBacklink[];
};

export type PublicThreadReference =
  | { state: "unavailable"; messageId: string }
  | { state: "redacted"; messageId: string }
  | {
      state: "available";
      messageId: string;
      message: {
        id: string;
        createdAt: string;
        content: string;
        author: { name: string; isBot: boolean };
      };
    };

export type PublicThreadBacklink = {
  fromMessageId: string;
  createdAt: string;
  thread: { id: string; title: string; slug: string };
  author: { name: string; isBot: boolean };
};

export type PublicThreadMessage = {
  id: string;
  createdAt: string;
  content: string;
  referenceId: string | null;
  metadata: MessageMetadataSchema | null;
  embeds: EmbedSchema[] | null;
  poll: PollSchema | null;
  components: RowsSchema[] | null;
  snapshot: (DBSnapshotSchema & { mentions: PublicMessageMentions }) | null;
  stickers: StickerSchema | null;
  author: {
    name: string;
    avatar: string | null;
    isBot: boolean;
    isStarterAuthor: boolean;
    webhook: null | { id: string | null; name: string; avatar: string | null };
  };
  type: number;
  pinned: boolean;
  flags: number;
  applicationId: string | null;
  interactionId: string | null;
  reference: PublicThreadReference | null;
  mentions: PublicMessageMentions;
  reactions: DBMessage["reactions"];
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    description: string | null;
    contentType: string | null;
    size: number | null;
    width: number | null;
    height: number | null;
    isSnapshot: boolean;
  }>;
};

function isSnowflake(value: string): boolean {
  return /^[0-9]{1,20}$/.test(value);
}

function publicThreadPredicate(serverId?: string) {
  return and(
    serverId ? eq(dbChannel.serverId, serverId) : undefined,
    inArray(dbChannel.type, [...PUBLIC_THREAD_CHANNEL_TYPES]),
    eq(publicThreadParent.serverId, dbChannel.serverId),
    or(
      isNull(publicThreadParent.parentId),
      exists(
        db
          .select({ one: sql`1` })
          .from(publicThreadCategory)
          .where(
            and(
              eq(publicThreadCategory.id, publicThreadParent.parentId),
              eq(publicThreadCategory.serverId, publicThreadParent.serverId),
              eq(publicThreadCategory.type, ChannelType.GuildCategory),
            ),
          ),
      ),
    ),
    inArray(publicThreadParent.type, [...PUBLIC_PARENT_CHANNEL_TYPES]),
    eq(publicThreadParent.indexingEnabled, true),
    isNull(dbServer.kickedAt),
    exists(
      db
        .select({ one: sql`1` })
        .from(publicStarterMessage)
        .innerJoin(publicStarterAuthor, eq(publicStarterMessage.authorId, publicStarterAuthor.id))
        .where(
          and(
            eq(publicStarterMessage.serverId, dbChannel.serverId),
            eq(publicStarterMessage.primaryChannelId, dbChannel.id),
            eq(publicStarterMessage.starterMessage, true),
            eq(publicStarterMessage.isIgnored, false),
            or(isNull(publicStarterAuthor.isIgnored), eq(publicStarterAuthor.isIgnored, false)),
          ),
        ),
    ),
  );
}

function isNormalizedHostname(hostname: string): boolean {
  const labels = hostname.split(".");
  return (
    hostname.length > 0 &&
    hostname.length <= 253 &&
    hostname === hostname.toLowerCase() &&
    labels.every(
      (label) =>
        label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  );
}

export async function resolveVerifiedPublicTenant(
  hostname: string,
): Promise<VerifiedPublicTenantCapability | null> {
  if (!isNormalizedHostname(hostname)) return null;
  return dedupeDatabaseRead(`public-tenant:${hostname}`, () => queryVerifiedPublicTenant(hostname));
}

async function queryVerifiedPublicTenant(
  hostname: string,
): Promise<VerifiedPublicTenantCapability | null> {
  const [server] = await db
    .select({ id: dbServer.id, name: dbServer.name })
    .from(dbServer)
    .where(
      and(
        eq(dbServer.customDomain, hostname),
        eq(dbServer.domainVerified, true),
        isNull(dbServer.kickedAt),
      ),
    )
    .limit(1);

  if (!server) return null;
  return {
    kind: "verified_public_tenant",
    serverId: server.id,
    serverName: server.name,
    hostname,
    [publicContentCapability]: true,
  };
}

export async function resolvePublicServer(
  serverId: string,
): Promise<PublicServerCapability | null> {
  if (!isSnowflake(serverId)) return null;
  return dedupeDatabaseRead(`public-server:${serverId}`, () => queryPublicServer(serverId));
}

export async function resolvePublicThreadServer(
  threadId: string,
): Promise<PublicServerCapability | null> {
  if (!isSnowflake(threadId)) return null;
  return dedupeDatabaseRead(`public-thread-server:${threadId}`, async () => {
    const [server] = await db
      .select({ id: dbServer.id, name: dbServer.name })
      .from(dbChannel)
      .innerJoin(publicThreadParent, eq(dbChannel.parentId, publicThreadParent.id))
      .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
      .where(and(eq(dbChannel.id, threadId), publicThreadPredicate()))
      .limit(1);

    if (!server) return null;
    return {
      kind: "public_server",
      serverId: server.id,
      serverName: server.name,
      [publicContentCapability]: true,
    };
  });
}

async function queryPublicServer(serverId: string): Promise<PublicServerCapability | null> {
  const [server] = await db
    .select({ id: dbServer.id, name: dbServer.name })
    .from(dbServer)
    .where(and(eq(dbServer.id, serverId), isNull(dbServer.kickedAt)))
    .limit(1);

  if (!server) return null;
  return {
    kind: "public_server",
    serverId: server.id,
    serverName: server.name,
    [publicContentCapability]: true,
  };
}

export async function resolveManagedServer({
  userId,
  serverId,
}: {
  userId: string;
  serverId: string;
}): Promise<ManagedServerCapability | null> {
  if (!userId || !isSnowflake(serverId)) return null;
  return dedupeDatabaseRead(`managed-server:${userId}:${serverId}`, () =>
    queryManagedServer({ userId, serverId }),
  );
}

async function queryManagedServer({
  userId,
  serverId,
}: {
  userId: string;
  serverId: string;
}): Promise<ManagedServerCapability | null> {
  const [membership] = await db
    .select({ serverId: dbServer.id })
    .from(userServers)
    .innerJoin(dbServer, eq(userServers.serverId, dbServer.id))
    .where(and(eq(userServers.userId, userId), eq(userServers.serverId, serverId)))
    .limit(1);

  if (!membership) return null;
  return {
    kind: "managed_server",
    serverId: membership.serverId,
    userId,
    [publicContentCapability]: true,
  };
}

export async function getPublicForumShell(
  capability: PublicContentCapability,
): Promise<PublicForumShell | null> {
  if (capability[publicContentCapability] !== true) return null;
  return dedupeDatabaseRead(`public-forum-shell:${capability.serverId}`, () =>
    queryPublicForumShell(capability.serverId),
  );
}

async function queryPublicForumShell(serverId: string): Promise<PublicForumShell | null> {
  const rows = await db
    .select({
      serverId: dbServer.id,
      serverName: dbServer.name,
      serverDescription: dbServer.description,
      serverMemberCount: dbServer.memberCount,
      serverIcon: dbServer.icon,
      serverInvite: dbServer.serverInvite,
      serverCustomDomain: dbServer.customDomain,
      serverDomainVerified: dbServer.domainVerified,
      channelId: dbChannel.id,
      channelName: dbChannel.channelName,
      channelType: dbChannel.type,
    })
    .from(dbServer)
    .leftJoin(
      dbChannel,
      and(
        eq(dbChannel.serverId, dbServer.id),
        or(
          isNull(dbChannel.parentId),
          exists(
            db
              .select({ one: sql`1` })
              .from(publicShellCategory)
              .where(
                and(
                  eq(publicShellCategory.id, dbChannel.parentId),
                  eq(publicShellCategory.serverId, dbChannel.serverId),
                  eq(publicShellCategory.type, ChannelType.GuildCategory),
                ),
              ),
          ),
        ),
        inArray(dbChannel.type, [...PUBLIC_PARENT_CHANNEL_TYPES]),
        eq(dbChannel.indexingEnabled, true),
      ),
    )
    .where(and(eq(dbServer.id, serverId), isNull(dbServer.kickedAt)))
    .orderBy(asc(dbChannel.channelName), asc(dbChannel.id));

  const first = rows[0];
  if (!first) return null;
  return {
    server: {
      id: first.serverId,
      name: first.serverName,
      description: first.serverDescription,
      memberCount: first.serverMemberCount,
      icon: first.serverIcon,
      joinUrl: getDiscordInviteUrl(first.serverInvite),
      canonicalDomain: first.serverDomainVerified ? first.serverCustomDomain : null,
    },
    channels: rows.flatMap((row) =>
      row.channelId !== null &&
      PUBLIC_PARENT_CHANNEL_TYPES.includes(
        row.channelType as (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number],
      )
        ? [
            {
              id: row.channelId,
              name: row.channelName ?? "Unknown channel",
              type: row.channelType as (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number],
            },
          ]
        : [],
    ),
  };
}

export async function resolvePublicChannel(
  channelId: string,
): Promise<PublicChannelCapability | null> {
  if (!isSnowflake(channelId)) return null;
  return dedupeDatabaseRead(`public-channel:platform:${channelId}`, () =>
    queryPublicChannel(channelId),
  );
}

export async function resolveTenantPublicChannel(
  tenantCapability: VerifiedPublicTenantCapability,
  channelId: string,
): Promise<PublicChannelCapability | null> {
  if (tenantCapability[publicContentCapability] !== true || !isSnowflake(channelId)) {
    return null;
  }
  return dedupeDatabaseRead(`public-channel:tenant:${tenantCapability.serverId}:${channelId}`, () =>
    queryPublicChannel(channelId, tenantCapability.serverId),
  );
}

async function queryPublicChannel(
  channelId: string,
  serverId?: string,
): Promise<PublicChannelCapability | null> {
  const [channel] = await db
    .select({
      id: dbChannel.id,
      name: dbChannel.channelName,
      type: dbChannel.type,
      serverId: dbServer.id,
      serverName: dbServer.name,
    })
    .from(dbChannel)
    .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
    .where(
      and(
        eq(dbChannel.id, channelId),
        serverId ? eq(dbChannel.serverId, serverId) : undefined,
        or(
          isNull(dbChannel.parentId),
          exists(
            db
              .select({ one: sql`1` })
              .from(publicChannelCategory)
              .where(
                and(
                  eq(publicChannelCategory.id, dbChannel.parentId),
                  eq(publicChannelCategory.serverId, dbChannel.serverId),
                  eq(publicChannelCategory.type, ChannelType.GuildCategory),
                ),
              ),
          ),
        ),
        inArray(dbChannel.type, [...PUBLIC_PARENT_CHANNEL_TYPES]),
        eq(dbChannel.indexingEnabled, true),
        isNull(dbServer.kickedAt),
      ),
    )
    .limit(1);

  if (
    !channel ||
    !PUBLIC_PARENT_CHANNEL_TYPES.includes(
      channel.type as (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number],
    )
  ) {
    return null;
  }
  return {
    kind: "public_channel",
    serverId: channel.serverId,
    serverName: channel.serverName,
    channelId: channel.id,
    channelName: channel.name ?? "Unknown channel",
    channelType: channel.type as (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number],
    [publicContentCapability]: true,
  };
}

export async function getPublicThreadMetadata(
  capability: PublicContentCapability,
  threadId: string,
): Promise<PublicThreadMetadata | null> {
  if (capability[publicContentCapability] !== true || !isSnowflake(threadId)) {
    return null;
  }
  return dedupeDatabaseRead(`public-thread-metadata:${capability.serverId}:${threadId}`, () =>
    queryPublicThreadMetadata(capability, threadId),
  );
}

async function queryPublicThreadMetadata(
  capability: PublicContentCapability,
  threadId: string,
): Promise<PublicThreadMetadata | null> {
  const rows = await db
    .select({
      threadId: dbChannel.id,
      threadTitle: dbChannel.channelName,
      threadType: dbChannel.type,
      threadServerId: dbChannel.serverId,
      parentId: publicThreadParent.id,
      parentName: publicThreadParent.channelName,
      parentServerId: publicThreadParent.serverId,
      parentParentId: publicThreadParent.parentId,
      parentType: publicThreadParent.type,
      parentIndexingEnabled: publicThreadParent.indexingEnabled,
      parentCategoryServerId: publicThreadCategory.serverId,
      parentCategoryType: publicThreadCategory.type,
      starterId: dbMessage.id,
      starterIgnored: dbMessage.isIgnored,
      serverId: dbServer.id,
      serverName: dbServer.name,
      serverDescription: dbServer.description,
      serverIcon: dbServer.icon,
      serverKickedAt: dbServer.kickedAt,
      serverCustomDomain: dbServer.customDomain,
      serverDomainVerified: dbServer.domainVerified,
    })
    .from(dbChannel)
    .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
    .innerJoin(publicThreadParent, eq(dbChannel.parentId, publicThreadParent.id))
    .leftJoin(publicThreadCategory, eq(publicThreadParent.parentId, publicThreadCategory.id))
    .leftJoin(
      dbMessage,
      and(
        eq(dbMessage.primaryChannelId, dbChannel.id),
        eq(dbMessage.starterMessage, true),
        eq(dbMessage.isIgnored, false),
      ),
    )
    .where(and(publicThreadPredicate(capability.serverId), eq(dbChannel.id, threadId)))
    .limit(1);

  const [row] = rows;
  if (!row) return null;

  if (
    !isPublicThreadVisible({
      serverActive: row.serverKickedAt === null,
      threadType: row.threadType,
      parentBelongsToServer:
        row.parentServerId === row.threadServerId && row.serverId === row.threadServerId,
      parentIsUncategorized: row.parentParentId === null,
      parentCategoryBelongsToServer: row.parentCategoryServerId === row.threadServerId,
      parentCategoryType: row.parentCategoryType,
      parentType: row.parentType,
      parentIndexingEnabled: row.parentIndexingEnabled,
      hasVisibleStarter: row.starterId !== null && !row.starterIgnored,
    })
  ) {
    return null;
  }

  return {
    id: row.threadId,
    title: row.threadTitle ?? "Untitled thread",
    channel: {
      id: row.parentId,
      name: row.parentName ?? "Unknown channel",
    },
    server: {
      id: row.serverId,
      name: row.serverName,
      description: row.serverDescription,
      icon: row.serverIcon,
      canonicalDomain: row.serverDomainVerified ? row.serverCustomDomain : null,
    },
  };
}

export async function listPublicThreads(
  capability: PublicContentCapability,
  {
    channelId,
    cursor,
    limit = 20,
  }: {
    channelId?: string;
    cursor?: string;
    limit?: number;
  },
): Promise<PublicThreadListPage | null> {
  if (
    capability[publicContentCapability] !== true ||
    (channelId !== undefined && !isSnowflake(channelId)) ||
    (cursor !== undefined && !isSnowflake(cursor)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return null;
  }
  return dedupeDatabaseRead(
    `public-thread-list:${capability.serverId}:${channelId ?? "all"}:${cursor ?? "first"}:${limit}`,
    () => queryPublicThreads(capability, { channelId, cursor, limit }),
  );
}

async function queryPublicThreads(
  capability: PublicContentCapability,
  {
    channelId,
    cursor,
    limit,
  }: {
    channelId?: string;
    cursor?: string;
    limit: number;
  },
): Promise<PublicThreadListPage> {
  const messageCounts = db
    .select({
      threadId: dbMessage.primaryChannelId,
      count: sql<number>`count(*)::int`.as("public_message_count"),
    })
    .from(dbMessage)
    .innerJoin(publicCountAuthor, eq(dbMessage.authorId, publicCountAuthor.id))
    .where(
      and(
        eq(dbMessage.serverId, capability.serverId),
        eq(dbMessage.isIgnored, false),
        or(isNull(publicCountAuthor.isIgnored), eq(publicCountAuthor.isIgnored, false)),
      ),
    )
    .groupBy(dbMessage.primaryChannelId)
    .as("public_message_counts");
  const rows = await db
    .select({
      id: dbChannel.id,
      title: dbChannel.channelName,
      channelId: publicThreadParent.id,
      channelName: publicThreadParent.channelName,
      starterMetadata: publicListStarter.metadata,
      authorName: publicListAuthor.displayName,
      authorAnonymized: publicListAuthor.anonymizeName,
      pinned: dbChannel.pinned,
      messageCount: sql<number>`coalesce(${messageCounts.count}, 0)::int`,
    })
    .from(dbChannel)
    .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
    .innerJoin(publicThreadParent, eq(dbChannel.parentId, publicThreadParent.id))
    .innerJoin(
      publicListStarter,
      and(
        eq(publicListStarter.serverId, dbChannel.serverId),
        eq(publicListStarter.primaryChannelId, dbChannel.id),
        eq(publicListStarter.starterMessage, true),
        eq(publicListStarter.isIgnored, false),
      ),
    )
    .innerJoin(
      publicListAuthor,
      and(
        eq(publicListStarter.authorId, publicListAuthor.id),
        or(isNull(publicListAuthor.isIgnored), eq(publicListAuthor.isIgnored, false)),
      ),
    )
    .leftJoin(messageCounts, eq(messageCounts.threadId, dbChannel.id))
    .where(
      and(
        publicThreadPredicate(capability.serverId),
        channelId ? eq(publicThreadParent.id, channelId) : undefined,
        cursor ? lt(dbChannel.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(dbChannel.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map((row) => ({
      id: row.id,
      title: row.title ?? "Untitled thread",
      author: getPublicListAuthorName(row),
      channel: {
        id: row.channelId,
        name: row.channelName ?? "Unknown channel",
      },
      pinned: row.pinned,
      messageCount: row.messageCount,
    })),
    nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
  };
}

function getPublicListAuthorName(row: {
  starterMetadata: DBMessage["metadata"];
  authorName: string;
  authorAnonymized: boolean;
}): string {
  if (row.authorAnonymized) return "Anonymous member";
  const webhook = row.starterMetadata?.webhook;
  return webhook?.displayName?.trim() || webhook?.name?.trim() || row.authorName;
}

export async function getPublicThreadPage(
  capability: PublicContentCapability | null,
  threadId: string,
): Promise<PublicThreadPage | null> {
  if (
    !isSnowflake(threadId) ||
    (capability !== null && capability[publicContentCapability] !== true)
  ) {
    return null;
  }

  return dedupeDatabaseRead(
    `public-thread-page:${capability?.serverId ?? "platform"}:${threadId}`,
    () => queryPublicThreadPage(capability, threadId),
  );
}

async function queryPublicThreadPage(
  capability: PublicContentCapability | null,
  threadId: string,
): Promise<PublicThreadPage | null> {
  const rows = await db
    .select({
      threadId: dbChannel.id,
      threadTitle: dbChannel.channelName,
      threadAuthorId: dbChannel.authorId,
      threadArchived: dbChannel.archived,
      threadArchivedTimestamp: dbChannel.archivedTimestamp,
      threadLocked: dbChannel.locked,
      parentId: publicThreadParent.id,
      parentName: publicThreadParent.channelName,
      parentType: publicThreadParent.type,
      serverId: dbServer.id,
      serverName: dbServer.name,
      serverDescription: dbServer.description,
      serverMemberCount: dbServer.memberCount,
      serverIcon: dbServer.icon,
      serverInvite: dbServer.serverInvite,
      serverCustomDomain: dbServer.customDomain,
      serverDomainVerified: dbServer.domainVerified,
      messageId: dbMessage.id,
      messageAuthorId: dbMessage.authorId,
      messageContent: dbMessage.content,
      messageIsStarter: dbMessage.starterMessage,
      messageType: dbMessage.type,
      messagePinned: dbMessage.pinned,
      messageApplicationId: dbMessage.applicationId,
      messageWebhookId: dbMessage.webhookId,
      messageReferenceId: dbMessage.referenceId,
      messageMetadata: dbMessage.metadata,
      messageReactions: dbMessage.reactions,
      messageEmbeds: dbMessage.embeds,
      messagePoll: dbMessage.poll,
      messageComponents: dbMessage.components,
      messageSnapshot: dbMessage.snapshot,
      messageStickers: dbMessage.stickers,
      authorName: publicMessageAuthor.displayName,
      authorAvatar: publicMessageAuthor.avatar,
      authorIsBot: publicMessageAuthor.isBot,
      authorAnonymized: publicMessageAuthor.anonymizeName,
      messageCount: sql<number>`count(*) over()::int`,
      latestMessageId: sql<string>`max(${dbMessage.id}) over()`,
    })
    .from(dbChannel)
    .innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
    .innerJoin(publicThreadParent, eq(dbChannel.parentId, publicThreadParent.id))
    .innerJoin(
      dbMessage,
      and(eq(dbMessage.serverId, dbChannel.serverId), eq(dbMessage.primaryChannelId, dbChannel.id)),
    )
    .innerJoin(publicMessageAuthor, eq(dbMessage.authorId, publicMessageAuthor.id))
    .where(
      and(
        publicThreadPredicate(capability?.serverId),
        eq(dbChannel.id, threadId),
        eq(dbMessage.isIgnored, false),
        or(isNull(publicMessageAuthor.isIgnored), eq(publicMessageAuthor.isIgnored, false)),
      ),
    )
    .orderBy(desc(dbMessage.starterMessage), asc(dbMessage.id))
    .limit(MAX_PUBLIC_THREAD_MESSAGES + 1);

  if (rows.length === 0) return null;
  const starterRows = rows.filter((row) => row.messageIsStarter);
  const [starterRow] = starterRows;
  if (!starterRow || starterRows.length !== 1) return null;

  const pageRows = rows.slice(0, MAX_PUBLIC_THREAD_MESSAGES);
  const messageIds = pageRows.map((row) => row.messageId);
  const attachmentRows = await db
    .select({
      id: dbAttachments.id,
      messageId: dbAttachments.messageId,
      name: dbAttachments.name,
      url: dbAttachments.proxyURL,
      description: dbAttachments.description,
      contentType: dbAttachments.contentType,
      size: dbAttachments.size,
      width: dbAttachments.width,
      height: dbAttachments.height,
      isSnapshot: dbAttachments.isSnapshot,
    })
    .from(dbAttachments)
    .where(inArray(dbAttachments.messageId, messageIds))
    .orderBy(asc(dbAttachments.messageId), asc(dbAttachments.id));

  const attachmentsByMessage = new Map<string, PublicThreadMessage["attachments"]>();
  for (const attachment of attachmentRows) {
    const url = getSafeHttpsUrl(attachment.url);
    if (!url) continue;
    const messageAttachments = attachmentsByMessage.get(attachment.messageId);
    const projected = {
      id: attachment.id,
      name: attachment.name,
      url,
      description: attachment.description,
      contentType: attachment.contentType,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      isSnapshot: attachment.isSnapshot,
    };
    if (messageAttachments) messageAttachments.push(projected);
    else attachmentsByMessage.set(attachment.messageId, [projected]);
  }

  const mentionInputs = pageRows.map((row) => ({
    id: row.messageId,
    content: row.messageContent,
    metadata: row.messageMetadata,
  }));
  const snapshotMentionInputs = pageRows.flatMap((row) =>
    row.messageSnapshot
      ? [
          {
            id: `${row.messageId}:snapshot`,
            content: row.messageSnapshot.content,
            metadata: row.messageSnapshot.metadata,
          },
        ]
      : [],
  );
  const mentionIds = collectPublicMentionIds([...mentionInputs, ...snapshotMentionInputs]);
  const referenceIds = [
    ...new Set(pageRows.flatMap((row) => (row.messageReferenceId ? [row.messageReferenceId] : []))),
  ];
  const [userRows, channelRows, references, backlinks] = await Promise.all([
    mentionIds.users.length > 0
      ? db
          .select({
            id: dbDiscordUser.id,
            name: dbDiscordUser.displayName,
            redacted: dbDiscordUser.isIgnored,
            anonymized: dbDiscordUser.anonymizeName,
          })
          .from(dbDiscordUser)
          .where(inArray(dbDiscordUser.id, mentionIds.users))
      : [],
    mentionIds.channels.length > 0
      ? db
          .select({ id: dbChannel.id, name: dbChannel.channelName })
          .from(dbChannel)
          .where(
            and(
              eq(dbChannel.serverId, starterRow.serverId),
              inArray(dbChannel.id, mentionIds.channels),
            ),
          )
      : [],
    queryPublicReferences(referenceIds, capability?.serverId),
    queryPublicBacklinks(threadId, capability?.serverId),
  ]);
  const tags: PublicThreadPage["tags"] = [];
  const allMentions = enrichPublicMessageMentions(
    [...mentionInputs, ...snapshotMentionInputs],
    userRows.map((row) => ({
      id: row.id,
      name: row.anonymized ? "Anonymous member" : row.name,
      redacted: row.redacted === true,
    })),
    channelRows,
  );
  const privateMentionUserIds = new Set(
    userRows.filter((row) => row.redacted === true || row.anonymized).map((row) => row.id),
  );

  const starterAuthorId = starterRow.messageAuthorId;
  const messages = pageRows.map((row) => ({
    id: row.messageId,
    createdAt: getDateFromSnowflake(row.messageId).toISOString(),
    content: row.messageContent.trim(),
    referenceId: row.messageReferenceId,
    metadata: sanitizePublicMetadata(row.messageMetadata, privateMentionUserIds),
    type: row.messageType,
    pinned: row.messagePinned,
    flags: row.messageMetadata?.flags ?? 0,
    applicationId: row.messageApplicationId,
    interactionId: row.messageMetadata?.interaction?.id ?? null,
    reference: row.messageReferenceId
      ? (references.get(row.messageReferenceId) ?? {
          state: "unavailable" as const,
          messageId: row.messageReferenceId,
        })
      : null,
    mentions:
      allMentions.get(row.messageId) ??
      ({ users: [], channels: [], roles: [] } satisfies PublicMessageMentions),
    reactions: row.messageReactions,
    embeds: row.messageEmbeds,
    poll: row.messagePoll,
    components: row.messageComponents,
    snapshot: row.messageSnapshot
      ? {
          ...row.messageSnapshot,
          metadata: sanitizePublicMetadata(row.messageSnapshot.metadata, privateMentionUserIds),
          mentions:
            allMentions.get(`${row.messageId}:snapshot`) ??
            ({
              users: [],
              channels: [],
              roles: [],
            } satisfies PublicMessageMentions),
        }
      : null,
    stickers: row.messageStickers,
    author: {
      name: getPublicAuthorIdentity(row).name,
      avatar: getPublicAuthorIdentity(row).avatar,
      isBot: row.authorIsBot,
      isStarterAuthor: row.messageAuthorId === starterAuthorId,
      webhook: getPublicAuthorIdentity(row).webhook,
    },
    attachments: attachmentsByMessage.get(row.messageId) ?? [],
  }));
  const starter = messages.find((message) => message.id === starterRow.messageId);
  if (!starter || !hasPublicMessageBody(starter)) return null;

  const replies = messages.filter(
    (message) => message.id !== starter.id && hasPublicMessageBody(message),
  );
  const [first] = rows;
  if (!first) return null;
  const title = first.threadTitle?.trim() || starter.content.slice(0, 100);
  if (!title) return null;

  return {
    id: first.threadId,
    title,
    slug: getSlugFromTitle(title),
    createdAt: getDateFromSnowflake(first.threadId).toISOString(),
    updatedAt: getDateFromSnowflake(first.latestMessageId).toISOString(),
    replyCount: Math.max(0, first.messageCount - 1),
    truncated: first.messageCount > MAX_PUBLIC_THREAD_MESSAGES,
    discordUrl: constructDiscordLink({
      serverId: first.serverId,
      threadId: first.threadId,
    }),
    parent: {
      id: first.parentId,
      name: first.parentName ?? "Unknown channel",
      type: first.parentType,
    },
    state: {
      archived: first.threadArchived,
      archivedAt: toOptionalIsoDate(first.threadArchivedTimestamp),
      locked: first.threadLocked,
    },
    tags,
    server: {
      id: first.serverId,
      name: first.serverName,
      description: first.serverDescription,
      memberCount: first.serverMemberCount,
      icon: first.serverIcon,
      joinUrl: getDiscordInviteUrl(first.serverInvite),
      canonicalDomain: first.serverDomainVerified ? first.serverCustomDomain : null,
    },
    starter,
    replies,
    backlinks,
  };
}

async function queryPublicReferences(
  referenceIds: string[],
  serverId?: string,
): Promise<Map<string, PublicThreadReference>> {
  const result = new Map<string, PublicThreadReference>();
  if (referenceIds.length === 0) return result;

  const rows = await db
    .select({
      id: publicReferenceMessage.id,
      serverId: publicReferenceMessage.serverId,
      primaryChannelId: publicReferenceMessage.primaryChannelId,
      content: publicReferenceMessage.content,
      ignored: publicReferenceMessage.isIgnored,
      authorName: publicReferenceAuthor.displayName,
      authorIsBot: publicReferenceAuthor.isBot,
      authorAnonymized: publicReferenceAuthor.anonymizeName,
      authorIgnored: publicReferenceAuthor.isIgnored,
      threadId: publicReferenceThread.id,
      threadServerId: publicReferenceThread.serverId,
      threadType: publicReferenceThread.type,
      parentId: publicReferenceParent.id,
      parentServerId: publicReferenceParent.serverId,
      parentParentId: publicReferenceParent.parentId,
      parentType: publicReferenceParent.type,
      parentIndexingEnabled: publicReferenceParent.indexingEnabled,
      categoryServerId: publicReferenceCategory.serverId,
      categoryType: publicReferenceCategory.type,
      serverKickedAt: publicReferenceServer.kickedAt,
      hasVisibleStarter: exists(
        db
          .select({ one: sql`1` })
          .from(publicReferenceStarter)
          .innerJoin(
            publicReferenceStarterAuthor,
            eq(publicReferenceStarter.authorId, publicReferenceStarterAuthor.id),
          )
          .where(
            and(
              eq(publicReferenceStarter.primaryChannelId, publicReferenceThread.id),
              eq(publicReferenceStarter.starterMessage, true),
              eq(publicReferenceStarter.isIgnored, false),
              or(
                isNull(publicReferenceStarterAuthor.isIgnored),
                eq(publicReferenceStarterAuthor.isIgnored, false),
              ),
            ),
          ),
      ),
    })
    .from(publicReferenceMessage)
    .innerJoin(publicReferenceAuthor, eq(publicReferenceMessage.authorId, publicReferenceAuthor.id))
    .leftJoin(
      publicReferenceThread,
      eq(publicReferenceMessage.primaryChannelId, publicReferenceThread.id),
    )
    .leftJoin(publicReferenceParent, eq(publicReferenceThread.parentId, publicReferenceParent.id))
    .leftJoin(
      publicReferenceCategory,
      eq(publicReferenceParent.parentId, publicReferenceCategory.id),
    )
    .leftJoin(publicReferenceServer, eq(publicReferenceThread.serverId, publicReferenceServer.id))
    .where(
      and(
        inArray(publicReferenceMessage.id, referenceIds),
        serverId ? eq(publicReferenceThread.serverId, serverId) : undefined,
      ),
    );

  for (const row of rows) {
    const state = classifyPublicReference({
      exists: true,
      published: isCurrentlyPublishedMessage(row),
      messageRedacted: row.ignored,
      authorRedacted: row.authorIgnored === true,
    });
    if (state === "unavailable") continue;
    if (state === "redacted") {
      result.set(row.id, { state: "redacted", messageId: row.id });
      continue;
    }
    result.set(row.id, {
      state: "available",
      messageId: row.id,
      message: {
        id: row.id,
        createdAt: getDateFromSnowflake(row.id).toISOString(),
        content: row.content.trim(),
        author: {
          name: row.authorAnonymized ? "Anonymous member" : row.authorName,
          isBot: row.authorIsBot,
        },
      },
    });
  }

  return result;
}

async function queryPublicBacklinks(
  threadId: string,
  serverId?: string,
): Promise<PublicThreadBacklink[]> {
  const rows = await db
    .select({
      fromMessageId: dbThreadBacklink.fromMessageId,
      fromThreadId: dbThreadBacklink.fromThreadId,
      messageServerId: publicBacklinkMessage.serverId,
      primaryChannelId: publicBacklinkMessage.primaryChannelId,
      messageIgnored: publicBacklinkMessage.isIgnored,
      authorName: publicBacklinkAuthor.displayName,
      authorIsBot: publicBacklinkAuthor.isBot,
      authorAnonymized: publicBacklinkAuthor.anonymizeName,
      authorIgnored: publicBacklinkAuthor.isIgnored,
      threadId: publicBacklinkThread.id,
      threadTitle: publicBacklinkThread.channelName,
      threadServerId: publicBacklinkThread.serverId,
      threadType: publicBacklinkThread.type,
      parentId: publicBacklinkParent.id,
      parentServerId: publicBacklinkParent.serverId,
      parentParentId: publicBacklinkParent.parentId,
      parentType: publicBacklinkParent.type,
      parentIndexingEnabled: publicBacklinkParent.indexingEnabled,
      categoryServerId: publicBacklinkCategory.serverId,
      categoryType: publicBacklinkCategory.type,
      serverKickedAt: publicBacklinkServer.kickedAt,
      hasVisibleStarter: exists(
        db
          .select({ one: sql`1` })
          .from(publicBacklinkStarter)
          .innerJoin(
            publicBacklinkStarterAuthor,
            eq(publicBacklinkStarter.authorId, publicBacklinkStarterAuthor.id),
          )
          .where(
            and(
              eq(publicBacklinkStarter.primaryChannelId, publicBacklinkThread.id),
              eq(publicBacklinkStarter.starterMessage, true),
              eq(publicBacklinkStarter.isIgnored, false),
              or(
                isNull(publicBacklinkStarterAuthor.isIgnored),
                eq(publicBacklinkStarterAuthor.isIgnored, false),
              ),
            ),
          ),
      ),
    })
    .from(dbThreadBacklink)
    .innerJoin(publicBacklinkMessage, eq(dbThreadBacklink.fromMessageId, publicBacklinkMessage.id))
    .innerJoin(publicBacklinkAuthor, eq(publicBacklinkMessage.authorId, publicBacklinkAuthor.id))
    .innerJoin(publicBacklinkThread, eq(dbThreadBacklink.fromThreadId, publicBacklinkThread.id))
    .innerJoin(publicBacklinkParent, eq(publicBacklinkThread.parentId, publicBacklinkParent.id))
    .leftJoin(publicBacklinkCategory, eq(publicBacklinkParent.parentId, publicBacklinkCategory.id))
    .innerJoin(publicBacklinkServer, eq(publicBacklinkThread.serverId, publicBacklinkServer.id))
    .where(
      and(
        eq(dbThreadBacklink.toThreadId, threadId),
        serverId ? eq(publicBacklinkThread.serverId, serverId) : undefined,
        eq(publicBacklinkMessage.primaryChannelId, dbThreadBacklink.fromThreadId),
        eq(publicBacklinkMessage.serverId, publicBacklinkThread.serverId),
        eq(publicBacklinkMessage.isIgnored, false),
        or(isNull(publicBacklinkAuthor.isIgnored), eq(publicBacklinkAuthor.isIgnored, false)),
        inArray(publicBacklinkThread.type, [...PUBLIC_THREAD_CHANNEL_TYPES]),
        eq(publicBacklinkParent.serverId, publicBacklinkThread.serverId),
        inArray(publicBacklinkParent.type, [...PUBLIC_PARENT_CHANNEL_TYPES]),
        eq(publicBacklinkParent.indexingEnabled, true),
        or(
          isNull(publicBacklinkParent.parentId),
          and(
            eq(publicBacklinkCategory.serverId, publicBacklinkThread.serverId),
            eq(publicBacklinkCategory.type, ChannelType.GuildCategory),
          ),
        ),
        isNull(publicBacklinkServer.kickedAt),
        exists(
          db
            .select({ one: sql`1` })
            .from(publicBacklinkStarter)
            .innerJoin(
              publicBacklinkStarterAuthor,
              eq(publicBacklinkStarter.authorId, publicBacklinkStarterAuthor.id),
            )
            .where(
              and(
                eq(publicBacklinkStarter.primaryChannelId, publicBacklinkThread.id),
                eq(publicBacklinkStarter.starterMessage, true),
                eq(publicBacklinkStarter.isIgnored, false),
                or(
                  isNull(publicBacklinkStarterAuthor.isIgnored),
                  eq(publicBacklinkStarterAuthor.isIgnored, false),
                ),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(dbThreadBacklink.fromMessageId))
    .limit(10);

  return rows
    .filter(
      (row) =>
        !row.messageIgnored &&
        row.authorIgnored !== true &&
        row.fromThreadId === row.primaryChannelId &&
        isCurrentlyPublishedMessage(row),
    )
    .map((row) => {
      const title = row.threadTitle?.trim() || "Untitled thread";
      return {
        fromMessageId: row.fromMessageId,
        createdAt: getDateFromSnowflake(row.fromMessageId).toISOString(),
        thread: {
          id: row.fromThreadId,
          title,
          slug: getSlugFromTitle(title),
        },
        author: {
          name: row.authorAnonymized ? "Anonymous member" : row.authorName,
          isBot: row.authorIsBot,
        },
      };
    });
}

function isCurrentlyPublishedMessage(row: {
  serverKickedAt: Date | null;
  messageServerId?: string;
  serverId?: string;
  primaryChannelId: string | null;
  threadId: string | null;
  threadServerId: string | null;
  threadType: number | null;
  parentId: string | null;
  parentServerId: string | null;
  parentParentId: string | null;
  parentType: number | null;
  parentIndexingEnabled: boolean | null;
  categoryServerId: string | null;
  categoryType: number | null;
  hasVisibleStarter: unknown;
}): boolean {
  const messageServerId = row.messageServerId ?? row.serverId;
  return (
    row.serverKickedAt === null &&
    row.threadId !== null &&
    row.primaryChannelId === row.threadId &&
    messageServerId === row.threadServerId &&
    PUBLIC_THREAD_CHANNEL_TYPES.includes(
      row.threadType as (typeof PUBLIC_THREAD_CHANNEL_TYPES)[number],
    ) &&
    row.parentId !== null &&
    row.parentServerId === row.threadServerId &&
    (row.parentParentId === null ||
      (row.categoryServerId === row.threadServerId &&
        row.categoryType === ChannelType.GuildCategory)) &&
    PUBLIC_PARENT_CHANNEL_TYPES.includes(
      row.parentType as (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number],
    ) &&
    row.parentIndexingEnabled === true &&
    row.hasVisibleStarter === true
  );
}

function getPublicAuthorIdentity(row: {
  messageWebhookId: string | null;
  messageMetadata: DBMessage["metadata"];
  authorName: string;
  authorAvatar: string | null;
  authorAnonymized: boolean;
}) {
  const webhook = row.messageMetadata?.webhook;
  if (row.messageWebhookId || webhook) {
    const name = webhook?.displayName?.trim() || webhook?.name?.trim() || row.authorName;
    return {
      name,
      avatar: webhook?.avatarUrl ?? webhook?.avatar ?? row.authorAvatar,
      webhook: {
        id: row.messageWebhookId ?? webhook?.id ?? null,
        name,
        avatar: webhook?.avatarUrl ?? webhook?.avatar ?? row.authorAvatar,
      },
    };
  }
  return {
    name: row.authorAnonymized ? "Anonymous member" : row.authorName,
    avatar: row.authorAnonymized ? null : row.authorAvatar,
    webhook: null,
  };
}

function sanitizePublicMetadata(
  metadata: MessageMetadataSchema | null,
  privateUserIds: ReadonlySet<string>,
): MessageMetadataSchema | null {
  if (!metadata?.users || privateUserIds.size === 0) return metadata;
  return {
    ...metadata,
    users: Object.fromEntries(
      Object.entries(metadata.users).filter(([id]) => !privateUserIds.has(id)),
    ),
  };
}

function hasPublicMessageBody(message: PublicThreadMessage): boolean {
  return Boolean(
    message.content ||
    message.attachments.length > 0 ||
    message.embeds?.length ||
    message.poll ||
    message.components?.length ||
    message.snapshot ||
    message.stickers?.length,
  );
}

function toOptionalIsoDate(timestamp: number | null): string | null {
  if (timestamp === null || !Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSafeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getDiscordInviteUrl(invite: string | null): string | null {
  if (!invite) return null;
  const value = invite.trim();
  if (/^[a-zA-Z0-9_-]+$/.test(value)) {
    return `https://discord.gg/${value}`;
  }

  const url = getSafeHttpsUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname;
  return hostname === "discord.gg" || hostname === "discord.com" ? url : null;
}
