import { Layer } from "effect";
import { layerAxiomTelemetry } from "./axiom";
import { layerPostHogErrorCapture } from "./error-capture";

export const ObservabilityLayer = Layer.merge(
	layerAxiomTelemetry,
	layerPostHogErrorCapture(),
);
