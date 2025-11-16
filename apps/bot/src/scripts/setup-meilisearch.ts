import { MeiliSearch } from "meilisearch";
import { botEnv } from "../config";

const client = new MeiliSearch({
	host: botEnv.MEILISEARCH_HOST || "http://127.0.0.1:7700",
	apiKey: botEnv.MEILISEARCH_API_KEY,
});

const index = client.index("discord-messages");
await index.updateSettings({
	searchableAttributes: ["title", "content"],
	filterableAttributes: ["serverId"],
	sortableAttributes: ["timestamp"],
});
console.log("MeiliSearch index configured");
