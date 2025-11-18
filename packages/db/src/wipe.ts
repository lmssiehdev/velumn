import { sql } from 'drizzle-orm';

async function wipeDatabase() {
	if (process.env.NODE_ENV === "production") {
		return;
	}
	try {
		await sql`DROP SCHEMA public CASCADE`;
		await sql`CREATE SCHEMA public`;
		console.log("Database wiped successfully!");
	} catch (error) {
		console.error("Error wiping database:", error);
	}
}
wipeDatabase();
