import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Option, Tracer } from "effect";
import { ErrorCapture } from "./error-capture";
import { launchObserved } from "./runtime";

describe("observed application runtime", () => {
	it.effect("reports AppLayer acquisition without changing its failure", () =>
		Effect.gen(function* () {
			const failure = new Error("app acquisition failed");
			let reported: Cause.Cause<unknown> | undefined;
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (options) => {
					const span = new Tracer.NativeSpan(options);
					spans.push(span);
					return span;
				},
			});
			const exit = yield* launchObserved(
				Layer.effectDiscard(Effect.fail(failure)),
			).pipe(
				Effect.provideService(ErrorCapture, {
					captureCause: (cause) =>
						Effect.sync(() => {
							reported = cause;
							return undefined;
						}),
				}),
				Effect.provideService(Tracer.Tracer, tracer),
				Effect.exit,
			);

			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.strictEqual(
					Option.getOrUndefined(Cause.findErrorOption(exit.cause)),
					failure,
				);
				assert.isDefined(reported);
				assert.strictEqual(
					Option.getOrUndefined(Cause.findErrorOption(reported)),
					failure,
				);
				assert.deepEqual(spans, []);
			}
		}),
	);
});
