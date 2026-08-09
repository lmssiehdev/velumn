import { eq } from "drizzle-orm";
import { db } from "..";
import { dbChannel, dbServer, user, userServers } from "../schema";

async function clearUser() {
	try {
		const USER_ID = "WqldiiXnMJYSJLYtuNrSdGDO2HPmj3hw";
		const result = await db.query.user.findFirst({
			where: {
				id: USER_ID,
			},
			columns: {
				old_serverId: true,
			},
		});
		const serverLinks = await db.query.userServers.findMany({
			where: {
				userId: USER_ID,
			},
			columns: {
				serverId: true,
			},
		});
		const serverIds = new Set(serverLinks.map(({ serverId }) => serverId));
		if (result?.old_serverId) {
			serverIds.add(result.old_serverId);
		}
		await db
			.update(user)
			.set({
				old_serverId: null,
			})
			.where(eq(user.id, USER_ID));
		await db.delete(userServers).where(eq(userServers.userId, USER_ID));
		for (const serverId of serverIds) {
			await db.delete(userServers).where(eq(userServers.serverId, serverId));
			await db.delete(dbServer).where(eq(dbServer.id, serverId));
			await db.delete(dbChannel).where(eq(dbChannel.serverId, serverId));
		}
		console.log("Cleared User");
	} catch (e) {
		console.error("Failed to clear user", e);
	} finally {
		db.$client.end();
	}
}
await clearUser();
