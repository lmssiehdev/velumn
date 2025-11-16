import { MeiliSearch } from "meilisearch";
import { botEnv } from "../config";
import { MESSAGES_INDEX_NAME } from "../constants";

const client = new MeiliSearch({
	host: botEnv.MEILISEARCH_HOST || "http://127.0.0.1:7700",
	apiKey: botEnv.MEILISEARCH_API_KEY,
});

async function main() {
	try {
		await client.index(MESSAGES_INDEX_NAME).deleteAllDocuments();
		console.log("MeiliSearch index cleared");
	} catch (error) {
		console.error("Failed to clear MeiliSearch:", error);
	}
}

main();
