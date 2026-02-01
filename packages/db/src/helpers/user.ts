import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import {
	type AuthUser,
	type DBUser,
	dbAttachments,
	dbDiscordUser,
	dbMessage,
	dbServer,
	user,
	userServers,
} from "../schema";

export async function getAuthUser(userId: string) {
	return await db.query.user.findFirst({
		where: {
			id: userId,
		},
	});
}

export async function updateAuthUser(
	userId: string,
	payload: Exclude<Partial<AuthUser>, "id">,
) {
	const [result] = await db
		.update(user)
		.set(payload)
		.where(eq(user.id, userId))
		.returning();
	return result;
}

export async function resetUserServerIdLink(serverId: string) {
	await db.delete(userServers).where(eq(userServers.serverId, serverId));
}

export async function getUserServers(userId: string) {
	return await db
		.select({
			serverId: userServers.serverId,
			finishedOnboarding: userServers.finishedOnboarding,
			createdAt: userServers.createdAt,
			updatedAt: userServers.updatedAt,
			server: {
				id: dbServer.id,
				name: dbServer.name,
				icon: dbServer.icon,
				plan: dbServer.plan,
				description: dbServer.description,
				memberCount: dbServer.memberCount,
				kickedAt: dbServer.kickedAt,
				serverInvite: dbServer.serverInvite,
				invitedBy: dbServer.invitedBy,
				anonymizeUsers: dbServer.anonymizeUsers,
			},
		})
		.from(userServers)
		.innerJoin(dbServer, eq(userServers.serverId, dbServer.id))
		.where(eq(userServers.userId, userId));
}

export async function addServerToUser(userId: string, serverId: string) {
	await db
		.insert(userServers)
		.values({
			userId,
			serverId,
		})
		.onConflictDoNothing();
}

export async function removeServerFromUser(userId: string, serverId: string) {
	await db
		.delete(userServers)
		.where(
			and(eq(userServers.userId, userId), eq(userServers.serverId, serverId)),
		);
}

export async function updateServerOnboarding(
	userId: string,
	serverId: string,
	finishedOnboarding: boolean,
) {
	await db
		.update(userServers)
		.set({
			finishedOnboarding,
			updatedAt: new Date(),
		})
		.where(
			and(eq(userServers.userId, userId), eq(userServers.serverId, serverId)),
		);
}

export async function getServerOwner(serverId: string) {
	const result = await db
		.select({
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
			},
		})
		.from(userServers)
		.innerJoin(user, eq(userServers.userId, user.id))
		.where(eq(userServers.serverId, serverId))
		.limit(1);

	return result[0]?.user;
}

export async function getUserServerCount(userId: string) {
	const result = await db
		.select({ count: userServers.serverId })
		.from(userServers)
		.where(eq(userServers.userId, userId));
	return result.length;
}

export async function anonymizeUser(user: DBUser, anonymizeName: boolean) {
	await db
		.insert(dbDiscordUser)
		.values({
			...user,
			anonymizeName,
		})
		.onConflictDoUpdate({
			target: dbDiscordUser.id,
			set: {
				anonymizeName,
			},
		});
}

export async function ignoreDiscordUser(user: DBUser) {
	try {
		await db
			.insert(dbDiscordUser)
			.values({
				...user,
				anonymizeName: true,
				isIgnored: true,
			})
			.onConflictDoUpdate({
				target: dbDiscordUser.id,
				set: {
					anonymizeName: true,
					isIgnored: true,
				},
			});
		await db
			.delete(dbAttachments)
			.where(
				inArray(
					dbAttachments.messageId,
					db
						.select({ id: dbMessage.id })
						.from(dbMessage)
						.where(eq(dbMessage.authorId, user.id)),
				),
			);
		await db
			.update(dbMessage)
			.set({
				content: "",
				cleanContent: "",
				embeds: null,
				reactions: null,
				snapshot: null,
				poll: null,
				isIgnored: true,
			})
			.where(eq(dbMessage.authorId, user.id));
	} catch (error) {
		console.log("failed_to_ignore_user", { error, user: user.id });
	}
}

export async function upsertUser(userId: string) {
	await db
		.insert(dbDiscordUser)
		.values({
			id: userId,
			displayName: userId,
			avatar: null,
			isBot: false,
			anonymizeName: false,
			isIgnored: false,
		})
		.onConflictDoNothing();
	return userId;
}

export async function findUserByAccountId(accountId: string) {
	return await db._query.dbDiscordUser.findFirst({
		where: eq(dbDiscordUser.id, accountId),
	});
}
export async function findManyDiscordAccountsById(ids: string[]) {
	if (ids.length === 0) {
		return [];
	}
	return await db._query.dbDiscordUser.findMany({
		where: inArray(dbDiscordUser.id, ids),
	});
}

// !! TODO: clean up
export async function upsertManyDiscordAccounts(users: DBUser[]) {
	const existing = await findManyDiscordAccountsById(users.map((x) => x.id));

	const existingMap = existing.reduce(
		(acc, cur) => {
			acc[cur.id] = cur;
			return acc;
		},
		{} as Record<string, DBUser>,
	);

	const toCreate = users.filter((c) => !existingMap[c.id]).map((c) => c);
	const toUpdate = users.filter((c) => existingMap[c.id]).map((c) => c);

	const [created, updated] = await Promise.all([
		updateManyDiscordAccounts(toUpdate),
		createManyDiscordAccounts(toCreate),
	]);
	return [...created, ...updated];
}

export async function createManyDiscordAccounts(users: DBUser[]) {
	const uniqueAccountsToCreate = new Map<string, DBUser>(
		users.map((i) => [i.id, i]),
	);
	const accountSet = Array.from(uniqueAccountsToCreate.values());

	const chunkSize = 25;
	const chunks: DBUser[][] = [];
	for (let i = 0; i < accountSet.length; i += chunkSize) {
		chunks.push(accountSet.slice(i, i + chunkSize));
	}
	for await (const chunk of chunks) {
		await Promise.all(
			chunk.map(async (user) => db.insert(dbDiscordUser).values(user)),
		);
	}
	return findManyDiscordAccountsById(accountSet.map((i) => i.id));
}

export async function updateManyDiscordAccounts(data: DBUser[]) {
	const uniqueAccountsToCreate = new Map<string, DBUser>(
		data.map((i) => [i.id, i]),
	);
	const accountSet = Array.from(uniqueAccountsToCreate.values());

	const chunkSize = 25;
	const chunks: DBUser[][] = [];
	for (let i = 0; i < accountSet.length; i += chunkSize) {
		chunks.push(accountSet.slice(i, i + chunkSize));
	}
	for await (const chunk of chunks) {
		await Promise.all(
			chunk.map(async (user) =>
				db.update(dbDiscordUser).set(user).where(eq(dbDiscordUser.id, user.id)),
			),
		);
	}
	return findManyDiscordAccountsById(accountSet.map((i) => i.id));
}
