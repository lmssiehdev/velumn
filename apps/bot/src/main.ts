import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { AppLayer } from "./runtime/app-layer";

BunRuntime.runMain(Layer.launch(AppLayer));
