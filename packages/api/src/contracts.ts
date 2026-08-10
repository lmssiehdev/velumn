export interface ReadinessState {
	readonly ready: boolean;
	readonly discord: boolean;
	readonly commands: boolean;
	readonly http: boolean;
	readonly indexingCoordinator: boolean;
	readonly gatewayMutationInbox: boolean;
	readonly projector: boolean;
}

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

export interface MatchPosition {
	readonly start: number;
	readonly length: number;
}

export type SearchHit = SearchDocument & {
	readonly _formatted?: Partial<SearchDocument>;
	readonly _matchesPosition?: Partial<
		Record<"title" | "content", readonly MatchPosition[]>
	>;
};

export interface SearchResult {
	readonly hits: readonly SearchHit[];
	readonly estimatedTotalHits?: number;
	readonly processingTimeMs: number;
	readonly query: string;
	readonly [key: string]: unknown;
}

export interface SearchHealth {
	readonly status: string;
	readonly version: string;
	readonly numberOfDocuments: number;
	readonly isIndexing: boolean;
}

export interface SearchRequest {
	readonly serverId: string;
	readonly query: string;
	readonly limit?: number;
}

export interface GuildReconciliationRequest {
	readonly trigger: "index-server" | "reindex-server";
	readonly maxThreads?: number;
}

export type IndexingJobStatus =
	| "queued"
	| "running"
	| "succeeded"
	| "partial"
	| "failed"
	| "cancelled";

export interface AcceptedReconciliationJob {
	readonly id: string;
	readonly status: IndexingJobStatus;
}

export type ApiResult<Value, Failure> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly failure: Failure };

export const apiSuccess = <Value>(value: Value): ApiResult<Value, never> => ({
	ok: true,
	value,
});

export const apiFailure = <Failure>(
	failure: Failure,
): ApiResult<never, Failure> => ({ ok: false, failure });

export type IndexingFailure =
	| { readonly code: "guild_not_found" }
	| { readonly code: "thread_not_found" }
	| { readonly code: "job_not_found" }
	| { readonly code: "unsupported_thread" }
	| { readonly code: "job_finished" }
	| { readonly code: "discord_unavailable" }
	| { readonly code: "repository_unavailable" };

export type SearchFailure =
	| { readonly code: "search_not_configured" }
	| { readonly code: "search_unavailable" };

export type VoteFailure =
	| { readonly code: "thread_not_found" }
	| { readonly code: "repository_unavailable" };

export interface BotApiOperations {
	readonly getReadiness: (signal?: AbortSignal) => Promise<ReadinessState>;
	readonly search: (
		input: SearchRequest,
		signal?: AbortSignal,
	) => Promise<ApiResult<SearchResult, SearchFailure>>;
	readonly getSearchHealth: (
		signal?: AbortSignal,
	) => Promise<ApiResult<SearchHealth, SearchFailure>>;
	readonly startGuildReconciliation: (
		guildId: string,
		request: GuildReconciliationRequest,
		signal?: AbortSignal,
	) => Promise<ApiResult<AcceptedReconciliationJob, IndexingFailure>>;
	readonly startThreadReconciliation: (
		guildId: string,
		threadId: string,
		signal?: AbortSignal,
	) => Promise<ApiResult<AcceptedReconciliationJob, IndexingFailure>>;
	readonly getReconciliationJob: (
		jobId: string,
		signal?: AbortSignal,
	) => Promise<ApiResult<AcceptedReconciliationJob, IndexingFailure>>;
	readonly cancelReconciliationJob: (
		jobId: string,
		signal?: AbortSignal,
	) => Promise<ApiResult<AcceptedReconciliationJob, IndexingFailure>>;
	readonly isBotInServer: (serverId: string) => Promise<boolean>;
	readonly updateVote: (
		threadId: string,
		type: "upvote" | "downvote",
	) => Promise<ApiResult<void, VoteFailure>>;
}
