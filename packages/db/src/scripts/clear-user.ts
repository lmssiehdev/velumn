import { eq } from "drizzle-orm";
import { db } from "..";
import { dbChannel, dbServer, user } from "../schema";

async function clearUser() {
	try {
		const USER_ID = "WqldiiXnMJYSJLYtuNrSdGDO2HPmj3hw";
		const result = await db.query.user.findFirst({
			where: {
				id: USER_ID,
			},
			columns: {
				serverId: true,
			},
		});
		await db
			.update(user)
			.set({
				serverId: null,
				finishedOnboarding: false,
			})
			.where(eq(user.id, USER_ID));
		if (result?.serverId) {
			await db.delete(dbServer).where(eq(dbServer.id, result.serverId));
			await db.delete(dbChannel).where(eq(dbChannel.serverId, result.serverId));
		}
		console.log("Cleared User");
	} catch (e) {
		console.error("Failed to clear user", e);
	} finally {
		db.$client.end();
	}
}
await clearUser();
