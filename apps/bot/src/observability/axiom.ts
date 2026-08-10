import { Config, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, type HttpClient } from "effect/unstable/http";
import { OtlpSerialization } from "effect/unstable/observability";
import { safeOtlpTracerLayer } from "./safe-tracer";

const requiredTrimmed = (name: string) =>
	Config.schema(Schema.Trim.check(Schema.isNonEmpty()), name);

const optionalTrimmed = (name: string) =>
	Config.option(Config.string(name)).pipe(
		Config.map(Option.map((value) => value.trim())),
		Config.map(Option.filter((value) => value.length > 0)),
	);

const tracesUrl = (endpoint: string) =>
	`${endpoint.replace(/\/+$/, "")}/v1/traces`;

export const makeAxiomTelemetryLayer = (options?: {
	readonly httpClientLayer?: Layer.Layer<HttpClient.HttpClient>;
}) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const configuredToken = yield* Config.option(
				Config.string("AXIOM_TOKEN"),
			);
			const token = Option.getOrUndefined(configuredToken)?.trim();
			if (!token) return Layer.empty;

			const tracesDataset = yield* requiredTrimmed("AXIOM_TRACES_DATASET");
			const endpoint = yield* requiredTrimmed("AXIOM_OTLP_ENDPOINT").pipe(
				Config.withDefault("https://api.axiom.co"),
			);
			const environment = yield* Config.string("NODE_ENV").pipe(
				Config.withDefault("development"),
				Config.map((value) => value.trim() || "development"),
			);
			const version = yield* optionalTrimmed("OTEL_SERVICE_VERSION");
			const hostname = yield* optionalTrimmed("HOSTNAME");
			const resource = {
				serviceName: "velumn-bot",
				serviceVersion: Option.getOrUndefined(version),
				attributes: {
					"service.namespace": "velumn",
					"deployment.environment.name": environment,
					...(Option.isSome(hostname) ? { "host.name": hostname.value } : {}),
				},
			};
			const headers = (dataset: string) => ({
				Authorization: `Bearer ${token}`,
				"X-Axiom-Dataset": dataset,
			});
			return safeOtlpTracerLayer({
				url: tracesUrl(endpoint),
				headers: headers(tracesDataset),
				resource,
			}).pipe(
				Layer.provide(OtlpSerialization.layerJson),
				Layer.provideMerge(options?.httpClientLayer ?? FetchHttpClient.layer),
			);
		}),
	);

export const layerAxiomTelemetry = makeAxiomTelemetryLayer();
