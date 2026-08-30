import { assert, describe, it } from "@effect/vitest";
import { boundedExponentialDelayMs } from "./backoff";

describe("persisted worker backoff", () => {
	it("uses one-based attempts and caps the delay", () => {
		const delay = (attemptCount: number) =>
			boundedExponentialDelayMs({
				initialDelayMs: 100,
				maximumDelayMs: 1_000,
				attemptCount,
			});

		assert.equal(delay(0), 100);
		assert.equal(delay(1), 100);
		assert.equal(delay(2), 200);
		assert.equal(delay(4), 800);
		assert.equal(delay(5), 1_000);
		assert.equal(delay(1_000), 1_000);
	});
});
