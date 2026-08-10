import { Effect, Layer } from "effect";
import { ErrorCapture } from "./error-capture";

export const launchObserved = <A, E, R>(
	appLayer: Layer.Layer<A, E, R>,
): Effect.Effect<never, E, R> =>
	Effect.gen(function* () {
		const errorCapture = yield* ErrorCapture;
		return yield* Layer.launch(appLayer).pipe(
			Effect.tapCause((cause) =>
				errorCapture.captureCause(cause, {
					boundary: "application",
					operation: "app.runtime",
				}),
			),
		);
	});
