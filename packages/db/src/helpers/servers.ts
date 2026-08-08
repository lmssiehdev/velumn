import { ChannelType } from "discord-api-types/v10";
import { and, eq, exists, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../index";
import {
	isPendingInviteFresh,
	type OnboardingLifecycle,
	PENDING_INVITE_MAX_AGE_MS,
	resolveOnboardingLifecycle,
} from "../lifecycle";
import {
	type DBChannel,
	type DBServer,
	type DBServerInsert,
	dbChannel,
	dbMessage,
	dbServer,
	pendingDiscordInvite,
	type ServerPlan,
	userServers,
} from "../schema";
import { buildConflictUpdateColumns } from "../utils/drizzle";

export async function checkIfServerExistsForUser({
	userId,
	serverId,
}: {
	userId: string;
	serverId: string;
}) {
	return await db.query.userServers.findFirst({
		where: {
			userId: userId,
			serverId: serverId,
		},
		with: {
			server: true,
		},
	});
}

export async function createBotInvite({
	userId,
	serverId,
}: {
	userId: string;
	serverId: string;
}) {
	const now = new Date();
	const expiredBefore = new Date(now.getTime() - PENDING_INVITE_MAX_AGE_MS);

	await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(pendingDiscordInvite)
			.values({ userId, updatedAt: now, serverId })
			.onConflictDoNothing()
			.returning({ serverId: pendingDiscordInvite.serverId });
		if (inserted.length > 0) return;

		const refreshed = await tx
			.update(pendingDiscordInvite)
			.set({ userId, updatedAt: now })
			.where(
				and(
					eq(pendingDiscordInvite.serverId, serverId),
					or(
						eq(pendingDiscordInvite.userId, userId),
						isNull(pendingDiscordInvite.updatedAt),
						lt(pendingDiscordInvite.updatedAt, expiredBefore),
					),
				),
			)
			.returning({ serverId: pendingDiscordInvite.serverId });

		if (refreshed.length === 0) {
			throw new Error("A different user is already installing this server");
		}
	});
}

export async function linkServerToUser(serverId: string, userId: string) {
	await db
		.insert(userServers)
		.values({
			userId,
			serverId,
		})
		.onConflictDoNothing();
}

export async function getPendingDiscordInvite(serverId: string) {
	return await db._query.pendingDiscordInvite.findFirst({
		where: eq(pendingDiscordInvite.serverId, serverId),
		columns: {
			userId: true,
			updatedAt: true,
		},
	});
}

export async function getUserWhoInvited(serverId: string) {
	const invite = await getPendingDiscordInvite(serverId);
	return invite && isPendingInviteFresh(invite) ? invite : undefined;
}

export async function getOnboardingLifecycleForUser({
	userId,
	serverId,
}: {
	userId: string;
	serverId: string;
}) {
	const installation = await getOnboardingInstallationForUser({
		userId,
		serverId,
	});
	return installation.lifecycle;
}

export async function getOnboardingInstallationForUser({
	userId,
	serverId,
}: {
	userId: string;
	serverId: string;
}) {
	const [membership, pendingInvite] = await Promise.all([
		checkIfServerExistsForUser({ userId, serverId }),
		getPendingDiscordInvite(serverId),
	]);

	return {
		membership,
		lifecycle: resolveOnboardingLifecycle({
			userId,
			membership: membership
				? {
						finishedOnboarding: membership.finishedOnboarding,
						kickedAt: membership.server?.kickedAt ?? null,
					}
				: null,
			pendingInvite: pendingInvite ?? null,
		}),
	};
}

export async function getOnboardingLifecyclesForUser({
	userId,
	serverIds,
}: {
	userId: string;
	serverIds: string[];
}) {
	const uniqueServerIds = [...new Set(serverIds)];
	const lifecycles = new Map<string, OnboardingLifecycle>();
	if (uniqueServerIds.length === 0) return lifecycles;

	const [memberships, pendingInvites] = await Promise.all([
		db
			.select({
				serverId: userServers.serverId,
				finishedOnboarding: userServers.finishedOnboarding,
				kickedAt: dbServer.kickedAt,
			})
			.from(userServers)
			.leftJoin(dbServer, eq(userServers.serverId, dbServer.id))
			.where(
				and(
					eq(userServers.userId, userId),
					inArray(userServers.serverId, uniqueServerIds),
				),
			),
		db
			.select({
				serverId: pendingDiscordInvite.serverId,
				userId: pendingDiscordInvite.userId,
				updatedAt: pendingDiscordInvite.updatedAt,
			})
			.from(pendingDiscordInvite)
			.where(inArray(pendingDiscordInvite.serverId, uniqueServerIds)),
	]);

	const membershipByServer = new Map(
		memberships.map((membership) => [membership.serverId, membership]),
	);
	const pendingInviteByServer = new Map(
		pendingInvites.map((invite) => [invite.serverId, invite]),
	);

	for (const serverId of uniqueServerIds) {
		const membership = membershipByServer.get(serverId);
		lifecycles.set(
			serverId,
			resolveOnboardingLifecycle({
				userId,
				membership: membership
					? {
							finishedOnboarding: membership.finishedOnboarding,
							kickedAt: membership.kickedAt,
						}
					: null,
				pendingInvite: pendingInviteByServer.get(serverId) ?? null,
			}),
		);
	}

	return lifecycles;
}

export async function completeBotInstallation({
	server,
	userId,
	channels,
}: {
	server: Partial<DBServerInsert> & Pick<DBServerInsert, "id">;
	userId: string;
	channels: DBChannel[];
}) {
	const installation = { ...server, kickedAt: null };
	const { id, invitedBy: _, ...updateFields } = installation;

	await db.transaction(async (tx) => {
		await tx
			.insert(dbServer)
			.values(installation as DBServerInsert)
			.onConflictDoUpdate({
				target: dbServer.id,
				set: buildConflictUpdateColumns(
					dbServer,
					Object.keys(updateFields) as Array<keyof typeof updateFields>,
				),
			});

		await tx
			.insert(userServers)
			.values({ userId, serverId: id })
			.onConflictDoNothing();

		if (channels.length > 0) {
			await tx
				.insert(dbChannel)
				.values(channels)
				.onConflictDoUpdate({
					target: dbChannel.id,
					set: {
						channelName: sql.raw(`excluded.${dbChannel.channelName.name}`),
					},
				});
		}

		await tx
			.delete(pendingDiscordInvite)
			.where(
				and(
					eq(pendingDiscordInvite.serverId, id),
					eq(pendingDiscordInvite.userId, userId),
				),
			);
	});
}

export async function getChannelsInServer(
	serverId: string,
): Promise<DBChannel[]> {
	if (!serverId) {
		return [];
	}
	return await db.query.dbChannel.findMany({
		where: {
			AND: [
				{
					serverId,
					type: {
						OR: [ChannelType.GuildText, ChannelType.GuildForum],
					},
				},
			],
		},
		with: {
			server: true,
		},
	});
}

export async function getExistingThreadCountsByChannel(
	serverId: string,
	channelIds: string[],
) {
	if (channelIds.length === 0) return new Map<string, number>();

	const counts = await db
		.select({
			channelId: dbChannel.parentId,
			threads: sql<number>`count(*)::int`,
		})
		.from(dbChannel)
		.where(
			and(
				eq(dbChannel.serverId, serverId),
				eq(dbChannel.type, ChannelType.PublicThread),
				inArray(dbChannel.parentId, channelIds),
			),
		)
		.groupBy(dbChannel.parentId);

	return new Map(
		counts.flatMap((row) =>
			row.channelId ? [[row.channelId, row.threads] as const] : [],
		),
	);
}

export async function setServerPlanById(serverId: string, plan: ServerPlan) {
	return await db
		.update(dbServer)
		.set({
			plan,
		})
		.where(eq(dbServer.id, serverId));
}

export async function updateServer(
	server: { id: string } & Partial<Omit<DBServerInsert, "id">>,
) {
	const { id, ...updateFields } = server;

	await db.update(dbServer).set(updateFields).where(eq(dbServer.id, id));
}
export async function upsertServer(server: Partial<DBServerInsert>) {
	const { id, invitedBy, ...updateFields } = server;

	await db
		.insert(dbServer)
		.values(server as DBServerInsert)
		.onConflictDoUpdate({
			target: dbServer.id,
			set: buildConflictUpdateColumns(
				dbServer,
				Object.keys(updateFields) as Array<keyof typeof updateFields>,
			),
		});
}

export async function createBulkServers(servers: DBServer[]) {
	if (servers.length === 0) {
		return [];
	}

	const chunkSize = 25;
	const chunks: DBServer[][] = [];
	for (let i = 0; i < servers.length; i += chunkSize) {
		chunks.push(servers.slice(i, i + chunkSize));
	}
	for await (const chunk of chunks) {
		await db.insert(dbServer).values(chunk).onConflictDoNothing();
	}

	return servers;
}

export async function getAllServers() {
	return await db.query.dbServer.findMany();
}

export async function getServerInfo(
	serverId: string,
): Promise<DBServer | undefined> {
	return await db._query.dbServer.findFirst({
		where: and(eq(dbServer.id, serverId)),
	});
}

export async function getServerInfoByChannelId(channelId: string) {
	const result = await db
		.select({
			server: dbServer,
		})
		.from(dbChannel)
		.innerJoin(dbServer, eq(dbChannel.serverId, dbServer.id))
		.where(eq(dbChannel.id, channelId))
		.limit(1);

	if (result.length === 0 || result[0]?.server === undefined) {
		return;
	}

	const { server } = result[0];

	return server;
}

export async function getServerInfoByDomain(domain: string) {
	return await db.query.dbServer.findFirst({
		where: {
			customDomain: domain,
			domainVerified: true,
		},
	});
}

export async function getBulkServers(serverIds: string[]) {
	return await db._query.dbServer.findMany({
		where: inArray(dbServer.id, serverIds),
	});
}

export type ThreadWithMetadata = Awaited<
	ReturnType<typeof getAllThreads>
>["threads"][number];

export const threadPinFilters = ["all", "pinned", "unpinned"] as const;
export type ThreadPinFilter = (typeof threadPinFilters)[number];

export async function getAllThreads(
	getBy: "server" | "channel",
	config: {
		id: string;
		pinFilter?: ThreadPinFilter;
		page?: number;
	},
) {
	const { id, pinFilter = "all", page = 1 } = config;
	const LIMIT_PER_PAGE = 10;
	const pinPredicate =
		pinFilter === "pinned"
			? { pinned: true }
			: pinFilter === "unpinned"
				? { pinned: false }
				: {};
	const where =
		getBy === "server"
			? {
					serverId: id,
					parentId: {
						isNotNull: true as const,
					},
					...pinPredicate,
				}
			: {
					parentId: id,
					...pinPredicate,
				};

	if (pinFilter === "pinned") {
		const result = await db.query.dbChannel.findMany({
			where,
			with: {
				author: true,
				messages: {
					columns: {
						id: true,
					},
					limit: 1,
					orderBy: {
						id: "asc",
					},
					with: {
						user: {
							columns: {
								id: true,
								displayName: true,
								anonymizeName: true,
								isIgnored: true,
							},
						},
					},
				},
				parent: true,
			},
			extras: {
				messagesCount: (t) =>
					db.$count(dbMessage, eq(dbMessage.primaryChannelId, t.id)),
			},
			orderBy: {
				id: "desc",
			},
		});

		return {
			hasMore: false,
			threads: result,
			page,
		};
	}

	const result = await db.query.dbChannel.findMany({
		where,
		with: {
			author: true,
			messages: {
				columns: {
					id: true,
				},
				limit: 1,
				orderBy: {
					id: "asc",
				},
				with: {
					user: {
						columns: {
							id: true,
							displayName: true,
							anonymizeName: true,
							isIgnored: true,
						},
					},
				},
			},
			parent: true,
		},
		extras: {
			messagesCount: (t) =>
				db.$count(dbMessage, eq(dbMessage.primaryChannelId, t.id)),
		},
		limit: LIMIT_PER_PAGE + 1,
		offset: (page - 1) * LIMIT_PER_PAGE,
		orderBy: {
			id: "desc",
		},
	});

	return {
		hasMore: result.length > LIMIT_PER_PAGE,
		threads: result.splice(0, LIMIT_PER_PAGE),
		page,
	};
}

export async function getTopicsInServer(serverId: string) {
	return await db
		.select({
			id: dbChannel.id,
			channelName: dbChannel.channelName,
			type: dbChannel.type,
		})
		.from(dbChannel)
		.where(
			and(
				eq(dbChannel.serverId, serverId),
				isNull(dbChannel.parentId),
				exists(
					db
						.select()
						.from(dbMessage)
						.where(eq(dbMessage.parentChannelId, dbChannel.id)),
				),
			),
		);
}

export async function getServerOnboardingStatus(
	serverId: string,
): Promise<boolean> {
	// Check if any user has completed onboarding for this server
	const result = await db
		.select({ finishedOnboarding: userServers.finishedOnboarding })
		.from(userServers)
		.where(eq(userServers.serverId, serverId))
		.limit(1);

	// If no users are associated with this server, assume onboarding not complete
	if (result.length === 0) {
		return false;
	}

	// Return true if any user has completed onboarding
	return result.some((us) => us.finishedOnboarding);
}
