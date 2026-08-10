import { ChannelType } from "discord-api-types/v10";
import {
	and,
	count,
	desc,
	eq,
	exists,
	gt,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "..";
import {
	PUBLIC_PARENT_CHANNEL_TYPES,
	PUBLIC_THREAD_CHANNEL_TYPES,
} from "../publication";
import {
	dbAttachments,
	dbChannel,
	dbDiscordUser,
	dbMessage,
	dbServer,
} from "../schema";

const sitemapParent = alias(dbChannel, "sitemap_parent");
const sitemapCategory = alias(dbChannel, "sitemap_category");
const sitemapStarter = alias(dbMessage, "sitemap_starter");
const sitemapStarterAuthor = alias(dbDiscordUser, "sitemap_starter_author");

function visibleStarterFilter() {
	return and(
		eq(sitemapStarter.serverId, dbChannel.serverId),
		eq(sitemapStarter.primaryChannelId, dbChannel.id),
		eq(sitemapStarter.starterMessage, true),
		eq(sitemapStarter.isIgnored, false),
		or(
			isNull(sitemapStarterAuthor.isIgnored),
			eq(sitemapStarterAuthor.isIgnored, false),
		),
	);
}

function hasPublicStarterBody() {
	return or(
		sql`length(btrim(${sitemapStarter.content})) > 0`,
		exists(
			db
				.select({ one: sql`1` })
				.from(dbAttachments)
				.where(eq(dbAttachments.messageId, sitemapStarter.id)),
		),
		sql`coalesce(json_array_length(${sitemapStarter.embeds}), 0) > 0`,
		isNotNull(sitemapStarter.poll),
		sql`coalesce(json_array_length(${sitemapStarter.components}), 0) > 0`,
		isNotNull(sitemapStarter.snapshot),
		sql`coalesce(json_array_length(${sitemapStarter.stickers}), 0) > 0`,
	);
}

function hasUsableThreadTitle() {
	return or(
		sql`length(btrim(coalesce(${dbChannel.channelName}, ''))) > 0`,
		sql`length(btrim(${sitemapStarter.content})) > 0`,
	);
}

function hasExactlyOneRoutableStarter() {
	const visibleStarterCount = db
		.select({ count: count() })
		.from(sitemapStarter)
		.innerJoin(
			sitemapStarterAuthor,
			eq(sitemapStarter.authorId, sitemapStarterAuthor.id),
		)
		.where(visibleStarterFilter());

	return and(
		sql`(${visibleStarterCount}) = 1`,
		exists(
			db
				.select({ one: sql`1` })
				.from(sitemapStarter)
				.innerJoin(
					sitemapStarterAuthor,
					eq(sitemapStarter.authorId, sitemapStarterAuthor.id),
				)
				.where(
					and(
						visibleStarterFilter(),
						hasPublicStarterBody(),
						hasUsableThreadTitle(),
					),
				),
		),
	);
}

function publicThreadFilter(serverId?: string) {
	return and(
		serverId ? eq(dbChannel.serverId, serverId) : undefined,
		inArray(dbChannel.type, [...PUBLIC_THREAD_CHANNEL_TYPES]),
		eq(sitemapParent.serverId, dbChannel.serverId),
		or(
			isNull(sitemapParent.parentId),
			exists(
				db
					.select({ one: sql`1` })
					.from(sitemapCategory)
					.where(
						and(
							eq(sitemapCategory.id, sitemapParent.parentId),
							eq(sitemapCategory.serverId, sitemapParent.serverId),
							eq(sitemapCategory.type, ChannelType.GuildCategory),
						),
					),
			),
		),
		inArray(sitemapParent.type, [...PUBLIC_PARENT_CHANNEL_TYPES]),
		eq(sitemapParent.indexingEnabled, true),
		isNull(dbServer.kickedAt),
		hasExactlyOneRoutableStarter(),
	);
}

const mainSiteThreadFilter = and(
	publicThreadFilter(),
	or(isNull(dbServer.customDomain), eq(dbServer.domainVerified, false)),
);

export type SitemapRange = {
	upperId: string;
	lowerExclusiveId: string | null;
};

const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;

export function encodeSitemapRange(range: SitemapRange) {
	return `${range.upperId}-${range.lowerExclusiveId ?? "0"}`;
}

export function parseSitemapRange(value: string): SitemapRange | null {
	const match = /^(\d+)-(\d+)$/.exec(value);
	if (!match) return null;

	const upperId = BigInt(match[1]!);
	const lowerExclusiveId = BigInt(match[2]!);
	if (
		upperId <= 0n ||
		upperId > POSTGRES_BIGINT_MAX ||
		lowerExclusiveId < 0n ||
		lowerExclusiveId > POSTGRES_BIGINT_MAX ||
		upperId <= lowerExclusiveId
	) {
		return null;
	}

	return {
		upperId: upperId.toString(),
		lowerExclusiveId:
			lowerExclusiveId === 0n ? null : lowerExclusiveId.toString(),
	};
}

function scopedThreadFilter(serverId?: string) {
	return serverId ? publicThreadFilter(serverId) : mainSiteThreadFilter;
}

async function getSitemapPartitions(
	serverId: string | undefined,
	limit: number,
) {
	const partitions: SitemapRange[] = [];
	let cursor: string | undefined;

	while (true) {
		const rows = await db
			.select({ id: dbChannel.id })
			.from(dbChannel)
			.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
			.innerJoin(sitemapParent, eq(dbChannel.parentId, sitemapParent.id))
			.where(
				and(
					scopedThreadFilter(serverId),
					cursor ? lte(dbChannel.id, cursor) : undefined,
				),
			)
			.orderBy(desc(dbChannel.id))
			.limit(limit + 1);

		if (rows.length === 0) break;

		const lookahead = rows[limit];
		partitions.push({
			upperId: rows[0]!.id,
			lowerExclusiveId: lookahead?.id ?? null,
		});
		if (!lookahead) break;
		cursor = lookahead.id;
	}

	return partitions;
}

async function getThreadsForSitemapRange(
	serverId: string | undefined,
	range: SitemapRange,
	limit: number,
) {
	return db
		.select({
			id: dbChannel.id,
			name: dbChannel.channelName,
		})
		.from(dbChannel)
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.innerJoin(sitemapParent, eq(dbChannel.parentId, sitemapParent.id))
		.where(
			and(
				scopedThreadFilter(serverId),
				lte(dbChannel.id, range.upperId),
				range.lowerExclusiveId
					? gt(dbChannel.id, range.lowerExclusiveId)
					: undefined,
			),
		)
		.orderBy(desc(dbChannel.id))
		.limit(limit);
}

export function getCanonicalSitemapPartitions(limit: number) {
	return getSitemapPartitions(undefined, limit);
}

export function getCanonicalThreadsForSitemapRange(
	range: SitemapRange,
	limit: number,
) {
	return getThreadsForSitemapRange(undefined, range, limit);
}

export function getTenantSitemapPartitions(serverId: string, limit: number) {
	return getSitemapPartitions(serverId, limit);
}

export function getTenantThreadsForSitemapRange(
	serverId: string,
	range: SitemapRange,
	limit: number,
) {
	return getThreadsForSitemapRange(serverId, range, limit);
}
