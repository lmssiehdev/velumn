import type { DBMessageWithRelations } from "@repo/db/schema/discord";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import type { PublicThreadChannel } from "discord.js";
import DOMPurify from "isomorphic-dompurify";
import { MeiliSearch } from "meilisearch";
import { botEnv } from "../config";
import { MESSAGES_INDEX_NAME } from "../constants";

const client = new MeiliSearch({
	host: botEnv.MEILISEARCH_HOST || "http://127.0.0.1:7700",
	apiKey: botEnv.MEILISEARCH_API_KEY,
});

const index = client.index(MESSAGES_INDEX_NAME);

export type SearchMessage = {
	id: string;
	title: string;
	channelName: string;
	content: string;
	serverId: string;
	threadId: string;
	isThreadStarter: boolean;
	timestamp: string;
};

export function insertBulkSearchMessages(
	thread: PublicThreadChannel,
	messages: DBMessageWithRelations[],
) {
	const convertedMessages = messages.map((m) => ({
		id: m.id,
		title: thread.name,
		channelName: thread.parent?.name,
		content: m.cleanContent,
		serverId: thread.guild.id,
		threadId: m.channelId,
		isThreadStarter: m.starterMessage,
		timestamp: getDateFromSnowflake(m.id).getTime(),
	}));
	index.addDocuments(convertedMessages, { primaryKey: "id" });
	return;
}

const MAX_RESULTS_PER_THREAD = 2;
export async function searchMessages(options: {
	serverId: string;
	query: string;
	limit?: number;
}) {
	const { serverId, query, limit = 15 } = options;
	const results = await index.search<SearchMessage>(query, {
		filter: `serverId = ${serverId}`,
		matchingStrategy: "frequency",
		limit,
		attributesToHighlight: ["content", "title"],
		highlightPreTag: "<mark>",
		highlightPostTag: "</mark>",
	});

	const threadCounts = new Map<string, number>();
	const filteredHits = results.hits

		.filter((hit) => {
			const count = threadCounts.get(hit.threadId) || 0;
			if (count >= MAX_RESULTS_PER_THREAD) return false;

			threadCounts.set(hit.threadId, count + 1);
			return true;
		})
		.map((hit) => ({
			...hit._formatted,
			sanitizedName: sanitize(hit._formatted?.title),
			sanitizedContent: sanitize(hit._formatted?.content),
		}))
		.splice(0, limit);

	return {
		...results,
		hits: filteredHits,
	};
}

function sanitize(content?: string) {
	if (!content) {
		return "";
	}
	return DOMPurify.sanitize(content, {
		ALLOWED_TAGS: ["mark"],
		ALLOWED_ATTR: [],
	});
}
