import { assert, describe, it } from "@effect/vitest";
import type { IndexErrorClassification, RetryDisposition } from "./model";
import { retryDispositionFor } from "./retry-policy";

const expectedDispositions = {
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

describe("indexing retry policy", () => {
	it("classifies every error classification", () => {
		for (const [classification, expected] of Object.entries(
			expectedDispositions,
		) as ReadonlyArray<readonly [IndexErrorClassification, RetryDisposition]>) {
			assert.equal(retryDispositionFor(classification), expected);
		}
	});
});
