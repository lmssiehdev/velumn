import { MeiliSearch } from "meilisearch";
import { botEnv } from "../../config";

const client = new MeiliSearch({
	host: botEnv.MEILISEARCH_HOST || "http://127.0.0.1:7700",
	apiKey: botEnv.MEILISEARCH_MASTER_KEY,
});

async function checkMeiliSearchHealth() {
	try {
		console.log(
			`[${new Date().toISOString()}] Checking MeiliSearch instance...`,
		);
		console.log(
			`[${new Date().toISOString()}] Host: ${botEnv.MEILISEARCH_HOST || "http://127.0.0.1:7700"}`,
		);

		const health = await client.health();
		console.log(`[${new Date().toISOString()}] ✓ Status: ${health.status}`);

		const version = await client.getVersion();
		console.log(
			`[${new Date().toISOString()}] ✓ Version: ${version.pkgVersion}`,
		);

		const index = client.index("discord-messages");
		const stats = await index.getStats();
		console.log(`[${new Date().toISOString()}] ✓ Index: discord-messages`);
		console.log(
			`[${new Date().toISOString()}]   - Documents: ${stats.numberOfDocuments}`,
		);
		console.log(
			`[${new Date().toISOString()}]   - Indexing: ${stats.isIndexing}`,
		);

		console.log(
			`[${new Date().toISOString()}] ✓ MeiliSearch is up and running!`,
		);
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] ✗ MeiliSearch check failed:`,
			error,
		);
		process.exit(1);
	}
}

await checkMeiliSearchHealth();
