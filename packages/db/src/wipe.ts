import { sql } from "drizzle-orm";
import { db } from ".";

async function wipeDatabase() {
	if (process.env.NODE_ENV === "production") {
		console.log("Skipping database wipe in production");
		return;
	}
	try {
		await db.execute(sql`DROP SCHEMA public CASCADE`);
		await db.execute(sql`CREATE SCHEMA public`);
		console.log("Database wiped successfully!");
	} catch (error) {
		console.error("Error wiping database:", error);
	} finally {
		db.$client.end();
	}
}

wipeDatabase();
