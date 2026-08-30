import type { IndexErrorClassification, RetryDisposition } from "./model";

const retryDispositions = {
	"discord-transient": "retryable",
	"discord-permission": "terminal",
	"discord-unknown": "terminal",
	"missing-entity": "terminal",
	"unsupported-entity": "terminal",
	"partial-fetch": "retryable",
	conversion: "terminal",
	"privacy-rejection": "terminal",
	database: "retryable",
	"projection-submission": "retryable",
	"projection-completion": "retryable",
	cancelled: "terminal",
	configuration: "terminal",
} as const satisfies Record<IndexErrorClassification, RetryDisposition>;

export const retryDispositionFor = (
	classification: IndexErrorClassification,
): RetryDisposition => retryDispositions[classification];
