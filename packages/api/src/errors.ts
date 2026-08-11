import { TRPCError } from "@trpc/server";
import type {
	ApiResult,
	IndexingFailure,
	SearchFailure,
	VoteFailure,
} from "./contracts";

export const unwrapIndexingResult = <Value>(
	result: ApiResult<Value, IndexingFailure>,
): Value => {
	if (result.ok) return result.value;
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Indexing job storage is unavailable",
	});
};

export const unwrapSearchResult = <Value>(
	result: ApiResult<Value, SearchFailure>,
): Value => {
	if (result.ok) return result.value;
	switch (result.failure.code) {
		case "search_not_configured":
			throw new TRPCError({
				code: "SERVICE_UNAVAILABLE",
				message: "Search is not configured",
			});
		case "search_unavailable":
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to search messages",
			});
	}
};

export const unwrapVoteResult = (
	result: ApiResult<void, VoteFailure>,
): void => {
	if (result.ok) return;
	switch (result.failure.code) {
		case "thread_not_found":
			throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
		case "repository_unavailable":
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to vote on thread",
			});
	}
};
