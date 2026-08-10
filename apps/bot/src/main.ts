import { BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { ObservabilityLayer } from "./observability";
import { launchObserved } from "./observability/runtime";
import { AppLayer } from "./runtime/app-layer";

const main = Effect.scoped(
	Effect.gen(function* () {
		const observability = yield* Layer.build(ObservabilityLayer);
		yield* launchObserved(AppLayer).pipe(Effect.provide(observability));
	}),
);

BunRuntime.runMain(main);
