import { db } from "..";
import * as schema from "../schema";

async function clearDbMessages() {
	try {
		const tables = [
			schema.dbThreadBacklink,
			schema.dbAttachments,
			schema.dbChannel,
			schema.dbMessage,
		];

		for (const table of tables) {
			await db.delete(table);
		}
		console.log("Cleared Messages");
	} catch (e) {
		console.error("Failed to clear messages", e);
	}
}

await clearDbMessages();
