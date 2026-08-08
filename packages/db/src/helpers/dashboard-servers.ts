import { ChannelType } from "discord-api-types/v10";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index";
import {
	type OnboardingLifecycle,
	resolveOnboardingLifecycle,
} from "../lifecycle";
import {
	dbChannel,
	dbServer,
	pendingDiscordInvite,
	userServers,
} from "../schema";

const INDEXABLE_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildForum];

/**
 * A server the requesting user is a member of, projected for dashboard reads.
 *
 * Only fields the current schema can answer truthfully are present. Indexing
 * progress, last-indexed timestamps, and bot last-seen health are deliberately
 * absent rather than inferred; see PROGRESS.md.
 */
export type DashboardServerProjection = {
	id: string;
	name: string;
	icon: string | null;
	lifecycle: OnboardingLifecycle;
	enabledChannelCount: number;
	eligibleChannelCount: number;
	indexedThreadCount: number;
	customDomain: string | null;
	domainVerified: boolean;
};

/**
 * Loads dashboard projections for a user's memberships in a fixed number of
 * queries regardless of how many servers they belong to.
 *
 * Memberships without a `db_server` row are omitted: the bot has never created
 * the server, so there is no name or icon to present.
 */
async function loadDashboardServers({
	userId,
	serverIds,
}: {
	userId: string;
	serverIds?: string[];
}): Promise<DashboardServerProjection[]> {
	const threadParent = alias(dbChannel, "dashboard_thread_parent");
	const memberships = await db
		.select({
			serverId: userServers.serverId,
			finishedOnboarding: userServers.finishedOnboarding,
			name: dbServer.name,
			icon: dbServer.icon,
			kickedAt: dbServer.kickedAt,
			customDomain: dbServer.customDomain,
			domainVerified: dbServer.domainVerified,
		})
		.from(userServers)
		.innerJoin(dbServer, eq(userServers.serverId, dbServer.id))
		.where(
			serverIds
				? and(
						eq(userServers.userId, userId),
						inArray(userServers.serverId, serverIds),
					)
				: eq(userServers.userId, userId),
		);

	if (memberships.length === 0) return [];

	const memberServerIds = memberships.map((membership) => membership.serverId);

	const [channelCounts, threadCounts, pendingInvites] = await Promise.all([
		db
			.select({
				serverId: dbChannel.serverId,
				eligible: sql<number>`count(*)::int`,
				enabled: sql<number>`(count(*) filter (where ${dbChannel.indexingEnabled}))::int`,
			})
			.from(dbChannel)
			.where(
				and(
					inArray(dbChannel.serverId, memberServerIds),
					isNull(dbChannel.parentId),
					inArray(dbChannel.type, INDEXABLE_CHANNEL_TYPES),
				),
			)
			.groupBy(dbChannel.serverId),
		db
			.select({
				serverId: dbChannel.serverId,
				threads: sql<number>`count(*)::int`,
			})
			.from(dbChannel)
			.innerJoin(
				threadParent,
				and(
					eq(threadParent.id, dbChannel.parentId),
					eq(threadParent.serverId, dbChannel.serverId),
				),
			)
			.where(
				and(
					inArray(dbChannel.serverId, memberServerIds),
					isNotNull(dbChannel.parentId),
					eq(dbChannel.type, ChannelType.PublicThread),
				),
			)
			.groupBy(dbChannel.serverId),
		db
			.select({
				serverId: pendingDiscordInvite.serverId,
				userId: pendingDiscordInvite.userId,
				updatedAt: pendingDiscordInvite.updatedAt,
			})
			.from(pendingDiscordInvite)
			.where(inArray(pendingDiscordInvite.serverId, memberServerIds)),
	]);

	const channelCountByServer = new Map(
		channelCounts.map((row) => [row.serverId, row]),
	);
	const threadCountByServer = new Map(
		threadCounts.map((row) => [row.serverId, row.threads]),
	);
	const pendingInviteByServer = new Map(
		pendingInvites.map((invite) => [invite.serverId, invite]),
	);

	return memberships.map((membership) => {
		const channels = channelCountByServer.get(membership.serverId);

		return {
			id: membership.serverId,
			name: membership.name,
			icon: membership.icon,
			lifecycle: resolveOnboardingLifecycle({
				userId,
				membership: {
					finishedOnboarding: membership.finishedOnboarding,
					kickedAt: membership.kickedAt,
				},
				pendingInvite: pendingInviteByServer.get(membership.serverId) ?? null,
			}),
			enabledChannelCount: channels?.enabled ?? 0,
			eligibleChannelCount: channels?.eligible ?? 0,
			indexedThreadCount: threadCountByServer.get(membership.serverId) ?? 0,
			customDomain: membership.customDomain,
			domainVerified: membership.domainVerified,
		};
	});
}

export async function getDashboardServersForUser({
	userId,
}: {
	userId: string;
}): Promise<DashboardServerProjection[]> {
	const servers = await loadDashboardServers({ userId });
	return servers.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns the projection only when the user is a member of the server, so
 * callers cannot distinguish "does not exist" from "not yours".
 */
export async function getDashboardServerForUser({
	userId,
	serverId,
}: {
	userId: string;
	serverId: string;
}): Promise<DashboardServerProjection | null> {
	const [server] = await loadDashboardServers({
		userId,
		serverIds: [serverId],
	});
	return server ?? null;
}
