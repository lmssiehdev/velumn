import { sql } from "drizzle-orm";
import { db } from "..";
import { userServers } from "../schema";

async function migrateUserServersData() {
	console.log("📝 Migrating existing user-server data...");

	try {
		const usersWithServers = await db.query.user.findMany({
			columns: {
				id: true,
				old_serverId: true,
			},
		});

		for (const { id, old_serverId } of usersWithServers) {
			if (!old_serverId) {
				continue;
			}
			await db.insert(userServers).values({
				userId: id,
				serverId: old_serverId,
				finishedOnboarding: true,
			});
		}

		const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM user_servers
    `);

		const migratedCount = Number(countResult.rows[0]?.count) || 0;
		console.log(`📊 Migrated ${migratedCount} user-server relationships`);

		if (migratedCount > 0) {
			console.log("✨ Migration verification passed!");
		} else {
			console.log(
				"⚠️ No existing data found to migrate (this is expected for fresh installs)",
			);
		}

		return migratedCount;
	} catch (error) {
		console.error("❌ Data migration failed:", error);
		throw error;
	}
}

migrateUserServersData()
	.then(() => {
		console.log("🎉 Data migration complete!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Data migration failed:", error);
		process.exit(1);
	});
