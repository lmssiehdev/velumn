import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { MeiliSearch, type SearchResponse } from "meilisearch";
import { BotConfig } from "../config/bot-config";
import { MESSAGES_INDEX_NAME } from "../constants";

export interface SearchDocument {
	readonly id: string;
	readonly title: string;
	readonly channelName: string;
	readonly content: string;
	readonly serverId: string;
	readonly threadId: string;
	readonly isThreadStarter: boolean;
	readonly timestamp: number;
}

export interface SearchQuery {
	readonly serverId: string;
	readonly query: string;
	readonly limit?: number;
}

export interface SearchHealth {
	readonly status: string;
	readonly version: string;
	readonly numberOfDocuments: number;
	readonly isIndexing: boolean;
}

type SearchOperation =
	| "addDocuments"
	| "updateDocuments"
	| "deleteMessages"
	| "deleteThread"
	| "updateThreadTitle"
	| "search"
	| "health";

export class SearchIndexError extends Schema.TaggedError<SearchIndexError>()(
	"SearchIndexError",
	{
		operation: Schema.Literals([
			"addDocuments",
			"updateDocuments",
			"deleteMessages",
			"deleteThread",
			"updateThreadTitle",
			"search",
			"health",
		]),
		cause: Schema.Defect(),
	},
) {}

export class SearchNotConfiguredError extends Schema.TaggedError<SearchNotConfiguredError>()(
	"SearchNotConfiguredError",
	{},
) {}

export type SearchError = SearchIndexError | SearchNotConfiguredError;

const searchErrorCauseSchema = Schema.Struct({
	code: Schema.optional(Schema.String),
	status: Schema.optional(Schema.Number),
	response: Schema.optional(
		Schema.Struct({ status: Schema.optional(Schema.Number) }),
	),
	cause: Schema.optional(Schema.Unknown),
});
const decodeSearchErrorCause = Schema.decodeUnknownOption(
	searchErrorCauseSchema,
);

export const isSearchNotFoundError = (error: {
	readonly _tag: string;
}): boolean => {
	if (error._tag !== "SearchIndexError") return false;
	let cause = "cause" in error ? error.cause : undefined;
	for (let depth = 0; depth < 3; depth++) {
		const parsed = Option.getOrUndefined(decodeSearchErrorCause(cause));
		if (!parsed) break;
		if (
			parsed.code?.endsWith("_not_found") ||
			parsed.status === 404 ||
			parsed.response?.status === 404
		) {
			return true;
		}
		cause = parsed.cause;
	}
	return false;
};

const taskTimeout = 30_000;

export class SearchIndex extends Context.Service<
	SearchIndex,
	{
		readonly addDocuments: (
			documents: readonly SearchDocument[],
		) => Effect.Effect<void, SearchError>;
		readonly updateDocuments: (
			documents: ReadonlyArray<
				Partial<SearchDocument> & { readonly id: string }
			>,
		) => Effect.Effect<void, SearchError>;
		readonly deleteMessages: (
			messageIds: readonly string[],
		) => Effect.Effect<void, SearchError>;
		readonly deleteThread: (
			threadId: string,
		) => Effect.Effect<void, SearchError>;
		readonly updateThreadTitle: (
			threadId: string,
			title: string,
		) => Effect.Effect<void, SearchError>;
		readonly search: (
			query: SearchQuery,
		) => Effect.Effect<SearchResponse<SearchDocument>, SearchError>;
		readonly health: Effect.Effect<SearchHealth, SearchError>;
	}
>()("velumn/bot/adapters/SearchIndex") {
	static readonly layerWithConfig = Layer.effect(
		SearchIndex,
		Effect.gen(function* () {
			const config = yield* BotConfig;
			if (Option.isNone(config.meilisearch)) {
				const unavailable = Effect.fail(new SearchNotConfiguredError());
				return SearchIndex.of({
					addDocuments: () => Effect.void,
					updateDocuments: () => Effect.void,
					deleteMessages: () => Effect.void,
					deleteThread: () => Effect.void,
					updateThreadTitle: () => Effect.void,
					search: () => unavailable,
					health: unavailable,
				});
			}
			const meilisearch = config.meilisearch.value;
			const client = new MeiliSearch({
				host: meilisearch.host,
				apiKey: Option.match(meilisearch.apiKey, {
					onNone: () => undefined,
					onSome: Redacted.value,
				}),
			});
			const index = client.index<SearchDocument>(MESSAGES_INDEX_NAME);
			const fail = (operation: SearchOperation, cause: unknown) =>
				new SearchIndexError({ operation, cause });
			const waitForTask = (
				operation: SearchOperation,
				task: () => ReturnType<typeof index.addDocuments>,
			) =>
				Effect.tryPromise({
					try: async () => {
						const result = await task().waitTask({ timeout: taskTimeout });
						if (result.status !== "succeeded") {
							throw result.error ?? new Error(`Search task ${result.status}`);
						}
					},
					catch: (cause) => fail(operation, cause),
				});

			return SearchIndex.of({
				addDocuments: (documents) =>
					documents.length === 0
						? Effect.void
						: waitForTask("addDocuments", () =>
								index.addDocuments([...documents], { primaryKey: "id" }),
							),
				updateDocuments: (documents) =>
					documents.length === 0
						? Effect.void
						: waitForTask("updateDocuments", () =>
								index.updateDocuments([...documents], { primaryKey: "id" }),
							),
				deleteMessages: (messageIds) => {
					if (messageIds.length === 0) return Effect.void;
					return waitForTask("deleteMessages", () =>
						index.deleteDocuments([...messageIds]),
					);
				},
				deleteThread: (threadId) =>
					waitForTask("deleteThread", () =>
						index.deleteDocuments({
							filter: `threadId = ${JSON.stringify(threadId)}`,
						}),
					),
				updateThreadTitle: (threadId, title) =>
					Effect.tryPromise({
						try: () =>
							index.getDocuments({
								filter: `threadId = ${JSON.stringify(threadId)}`,
								limit: 10_000,
							}),
						catch: (cause) => fail("updateThreadTitle", cause),
					}).pipe(
						Effect.flatMap((documents) =>
							documents.results.length === 0
								? Effect.void
								: waitForTask("updateThreadTitle", () =>
										index.updateDocuments(
											documents.results.map(({ id }) => ({ id, title })),
										),
									),
						),
					),
				search: ({ serverId, query, limit = 15 }) =>
					Effect.tryPromise({
						try: (signal) =>
							index.search(
								query,
								{
									filter: `serverId = ${JSON.stringify(serverId)}`,
									matchingStrategy: "frequency",
									limit,
									attributesToHighlight: ["content", "title"],
									highlightPreTag: "<mark>",
									highlightPostTag: "</mark>",
									showMatchesPosition: true,
								},
								{ signal },
							),
						catch: (cause) => fail("search", cause),
					}),
				health: Effect.tryPromise({
					try: async () => {
						const [health, version, stats] = await Promise.all([
							client.health(),
							client.getVersion(),
							index.getStats(),
						]);
						return {
							status: health.status,
							version: version.pkgVersion,
							numberOfDocuments: stats.numberOfDocuments,
							isIndexing: stats.isIndexing,
						};
					},
					catch: (cause) => fail("health", cause),
				}),
			});
		}),
	);
}
