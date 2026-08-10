import { assert, describe, it } from "@effect/vitest";
import {
	Cause,
	ConfigProvider,
	Effect,
	Exit,
	Layer,
	Logger,
	Option,
	Scope,
	Tracer,
} from "effect";
import {
	HttpClient,
	type HttpClientError,
	HttpClientResponse,
} from "effect/unstable/http";
import { PostHog } from "posthog-node";
import { SearchIndexError } from "../adapters/search";
import { makeAxiomTelemetryLayer } from "./axiom";
import {
	ErrorCapture,
	type ErrorCaptureResult,
	layerPostHogErrorCapture,
	redactPostHogEvent,
} from "./error-capture";

interface CapturedRequest {
	readonly url: string;
	readonly headers: Record<string, string>;
	readonly body?: string;
}

const testLayer = (
	env: Record<string, string>,
	requests: CapturedRequest[],
) => {
	const client = HttpClient.makeWith(
		Effect.fnUntraced(function* (requestEffect) {
			const request = yield* requestEffect;
			requests.push({
				url: request.url,
				headers: request.headers,
				...(request.body._tag === "Uint8Array"
					? { body: new TextDecoder().decode(request.body.body) }
					: {}),
			});
			return HttpClientResponse.fromWeb(request, new Response());
		}),
		Effect.succeed as HttpClient.HttpClient.Preprocess<
			HttpClientError.HttpClientError,
			never
		>,
	);
	return makeAxiomTelemetryLayer({
		httpClientLayer: Layer.succeed(HttpClient.HttpClient, client),
	}).pipe(
		Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
	);
};

describe("Axiom telemetry", () => {
	it.effect("is entirely disabled for a missing or blank token", () =>
		Effect.gen(function* () {
			const environments: ReadonlyArray<Record<string, string>> = [
				{},
				{ AXIOM_TOKEN: "   " },
			];
			for (const env of environments) {
				const requests: CapturedRequest[] = [];
				const scope = yield* Scope.make();
				const context = yield* Layer.build(testLayer(env, requests)).pipe(
					Scope.provide(scope),
				);
				yield* Effect.void.pipe(
					Effect.withSpan("disabled"),
					Effect.provide(context),
				);
				yield* Scope.close(scope, Exit.void);
				assert.deepEqual(requests, []);
			}
		}),
	);

	it.effect("requires only a non-blank traces dataset when enabled", () =>
		Effect.gen(function* () {
			const missing = yield* Effect.exit(
				Layer.build(
					testLayer({ AXIOM_TOKEN: "token", AXIOM_TRACES_DATASET: "   " }, []),
				).pipe(Effect.scoped),
			);
			assert.isTrue(Exit.isFailure(missing));

			const enabled = yield* Effect.exit(
				Layer.build(
					testLayer(
						{
							AXIOM_TOKEN: "token",
							AXIOM_TRACES_DATASET: "traces",
							AXIOM_LOGS_DATASET: "   ",
						},
						[],
					),
				).pipe(Effect.scoped),
			);
			assert.isTrue(Exit.isSuccess(enabled));
		}),
	);

	it.effect("exports only allowlisted trace topology and no logs", () =>
		Effect.gen(function* () {
			const requests: CapturedRequest[] = [];
			const scope = yield* Scope.make();
			let consoleLogs = 0;
			const logger = Logger.make<unknown, void>(() => {
				consoleLogs += 1;
			});
			const context = yield* Layer.build(
				testLayer(
					{
						AXIOM_TOKEN: "token",
						AXIOM_TRACES_DATASET: "bot-traces",
						AXIOM_OTLP_ENDPOINT: "https://axiom.invalid/",
						NODE_ENV: "production",
						OTEL_SERVICE_VERSION: "1.2.3",
						HOSTNAME: "bot-1",
					},
					requests,
				),
			).pipe(Scope.provide(scope));
			const privateValue =
				'Useful failure ID-42 123456789012345678 user@example.com\npostgresql+asyncpg://user:pass@db.local/app mysql2://user:pass@db/app redis+tls://user:pass@db/0\n{"password":"JSON_SECRET","access_key":"ACCESS_SECRET","auth-token":"AUTH_SECRET"}\nrequest_body=PRIVATE_BODY\nsearch_query=PRIVATE_QUERY\nmessage_content=PRIVATE_CONTENT\nhttps://discord.com/api/webhooks/123/WEBHOOK_SECRET\nAuthorization: Bearer auth-secret';
			const hostile = new Proxy(
				{ privateValue },
				{
					ownKeys: () => {
						throw new Error("must not enumerate hostile telemetry");
					},
				},
			);
			const external = Tracer.externalSpan({
				traceId: "external-trace-id",
				spanId: "external-span-id",
			});
			let parentSpanId = "";
			let childParentSpanId = "";

			yield* Effect.gen(function* () {
				const parent = yield* Effect.currentSpan;
				parentSpanId = parent.spanId;
				parent.attribute("private.attribute", hostile);
				parent.event("private.event", 1n, { hostile });
				(parent.attributes as Map<string, unknown>).set(
					"private.direct.attribute",
					hostile,
				);
				(parent.links as Array<Tracer.SpanLink>).push({
					span: external,
					attributes: { hostile },
				});
				yield* Effect.logError(privateValue, Cause.die(hostile)).pipe(
					Effect.annotateLogs({ hostile }),
				);
				yield* Effect.gen(function* () {
					const child = yield* Effect.currentSpan;
					childParentSpanId = Option.getOrUndefined(child.parent)?.spanId ?? "";
					child.attribute("private.child", privateValue);
					child.event("private.child.event", 2n, { privateValue });
					return yield* Effect.failCause(
						Cause.combine(
							Cause.fail(new Error(privateValue)),
							Cause.combine(
								Cause.die(
									new Error("Second useful defect secret=SECOND_SECRET"),
								),
								Cause.interrupt(1),
							),
						),
					);
				}).pipe(
					Effect.withSpan("projector.poll", {
						links: [{ span: external, attributes: { privateValue } }],
					}),
					Effect.annotateSpans({
						"operation.name": "projector.poll",
						"operation.outcome": "failed",
						"retry.attempt": 2,
						"batch.claimed_count": 4,
						"error.event_id": "event-42",
						"error.type": "WorkerError",
						"error.fingerprint": "velumn:v1:fingerprint",
						"discord.guild_id": "guild-42",
						jobId: "job-42",
						privateValue,
						hostile,
					}),
					Effect.exit,
				);
			}).pipe(
				Effect.withSpan(`private parent ${privateValue}`),
				Effect.provide(context),
				Effect.provide(Logger.layer([logger])),
			);
			assert.equal(consoleLogs, 1);
			assert.equal(childParentSpanId, parentSpanId);
			assert.deepEqual(requests, []);
			yield* Scope.close(scope, Exit.void);

			assert.isFalse(
				requests.some((request) => request.url.endsWith("/v1/logs")),
			);
			const traces = requests.find((request) =>
				request.url.endsWith("/v1/traces"),
			);
			assert.isDefined(traces);
			assert.equal(traces?.headers["x-axiom-dataset"], "bot-traces");
			const body = traces?.body ?? "";
			for (const forbidden of [
				privateValue,
				"user:pass",
				"user@example.com",
				"JSON_SECRET",
				"ACCESS_SECRET",
				"AUTH_SECRET",
				"PRIVATE_BODY",
				"PRIVATE_QUERY",
				"PRIVATE_CONTENT",
				"WEBHOOK_SECRET",
				"SECOND_SECRET",
				"auth-secret",
				"private.attribute",
				"private.direct.attribute",
				"private.event",
				"private.child",
			]) {
				assert.notInclude(body, forbidden);
			}
			const payload = JSON.parse(body) as {
				resourceSpans: Array<{
					resource: { attributes: unknown[] };
					scopeSpans: Array<{
						spans: Array<{
							spanId: string;
							parentSpanId?: string;
							name: string;
							attributes: Array<{ key: string; value: unknown }>;
							events: Array<{
								name: string;
								attributes: Array<{ key: string; value: unknown }>;
							}>;
							links: Array<{ attributes: unknown[] }>;
						}>;
					}>;
				}>;
			};
			const resource = payload.resourceSpans[0];
			assert.include(
				JSON.stringify(resource?.resource.attributes),
				"velumn-bot",
			);
			assert.include(JSON.stringify(resource?.resource.attributes), "1.2.3");
			const spans = resource?.scopeSpans[0]?.spans ?? [];
			assert.equal(spans.length, 2);
			assert.include(
				spans.map(({ name }) => name),
				"projector.poll",
			);
			assert.isTrue(
				spans.some(({ name }) => /^operation\.[a-f0-9]{16}$/.test(name)),
			);
			for (const span of spans) {
				assert.isTrue(
					span.attributes.every(({ key }) =>
						[
							"batch.claimed_count",
							"discord.guild_id",
							"error.event_id",
							"error.fingerprint",
							"error.type",
							"jobId",
							"operation.name",
							"operation.outcome",
							"retry.attempt",
						].includes(key),
					),
				);
				assert.isTrue(span.links.every((link) => link.attributes.length === 0));
			}
			assert.isTrue(spans.some((span) => span.parentSpanId === parentSpanId));
			const failed = spans.find((span) => span.name === "projector.poll");
			assert.deepEqual(failed?.attributes.map(({ key }) => key).sort(), [
				"batch.claimed_count",
				"discord.guild_id",
				"error.event_id",
				"error.fingerprint",
				"error.type",
				"jobId",
				"operation.name",
				"operation.outcome",
				"retry.attempt",
			]);
			assert.equal(failed?.events.length, 2);
			assert.isTrue(failed?.events.every(({ name }) => name === "exception"));
			const failedEvent = JSON.stringify(failed?.events);
			assert.include(failedEvent, "Useful failure ID-42");
			assert.include(failedEvent, "Second useful defect");
			assert.include(failedEvent, "123456789012345678");
			assert.notInclude(failedEvent, "user:pass");
			assert.notInclude(failedEvent, "auth-secret");
			assert.notInclude(failedEvent, "user@example.com");
		}),
	);

	it.effect("exports poll interruption without error status or exception", () =>
		Effect.gen(function* () {
			const requests: CapturedRequest[] = [];
			const scope = yield* Scope.make();
			const context = yield* Layer.build(
				testLayer(
					{ AXIOM_TOKEN: "token", AXIOM_TRACES_DATASET: "bot-traces" },
					requests,
				),
			).pipe(Scope.provide(scope));
			yield* Effect.interrupt.pipe(
				Effect.withSpan("scheduler.poll"),
				Effect.exit,
				Effect.provide(context),
			);
			yield* Scope.close(scope, Exit.void);
			const body =
				requests.find(({ url }) => url.endsWith("/v1/traces"))?.body ?? "";
			const payload = JSON.parse(body) as {
				resourceSpans: Array<{
					scopeSpans: Array<{
						spans: Array<{
							name: string;
							events: unknown[];
							status?: { code?: number };
						}>;
					}>;
				}>;
			};
			const span = payload.resourceSpans[0]?.scopeSpans[0]?.spans.find(
				({ name }) => name === "scheduler.poll",
			);
			assert.deepEqual(span?.events, []);
			assert.notEqual(span?.status?.code, 2);
		}),
	);

	it.effect("correlates one real failed span across PostHog and Axiom", () =>
		Effect.gen(function* () {
			const axiomRequests: CapturedRequest[] = [];
			const postHogPayloads: string[] = [];
			const env = {
				AXIOM_TOKEN: "axiom-token",
				AXIOM_TRACES_DATASET: "bot-traces",
				POSTHOG_PROJECT_TOKEN: "posthog-token",
				NODE_ENV: "test",
			};
			const postHog = new PostHog("posthog-token", {
				host: "https://posthog.invalid",
				enableExceptionAutocapture: false,
				disableCompression: true,
				flushAt: 20,
				before_send: redactPostHogEvent,
				fetch: async (_url, options) => {
					if (typeof options.body === "string")
						postHogPayloads.push(options.body);
					return {
						status: 200,
						text: async () => "{}",
						json: async () => ({}),
					};
				},
			});
			const postHogLayer = layerPostHogErrorCapture({
				makeClient: () => ({
					captureException: (error, distinctId, properties, eventUUID) =>
						postHog.captureException(error, distinctId, properties, eventUUID),
					shutdown: (timeoutMs) => postHog._shutdown(timeoutMs),
					abort: () => {},
				}),
			}).pipe(
				Layer.provideMerge(
					ConfigProvider.layer(ConfigProvider.fromEnv({ env })),
				),
			);
			const scope = yield* Scope.make();
			const context = yield* Layer.build(
				Layer.merge(testLayer(env, axiomRequests), postHogLayer),
			).pipe(Scope.provide(scope));
			const capture = yield* ErrorCapture.pipe(Effect.provide(context));
			const sdkError = new Error(
				"Meilisearch addDocuments failed for ID-42 password=INNER_SECRET user@example.com",
			);
			sdkError.stack =
				"Error: Meilisearch addDocuments failed\n    at addDocuments (/app/node_modules/meilisearch/index.js:42:7)";
			const wrapper = new SearchIndexError({
				operation: "addDocuments",
				cause: sdkError,
			});
			let result: ErrorCaptureResult | undefined;
			yield* Effect.fail(wrapper).pipe(
				Effect.tapCause((cause) =>
					capture
						.captureCause(cause, {
							boundary: "discord_event_handler",
							operation: "messageCreate",
							guildId: "guild-123",
							channelId: "channel-456",
							messageId: "message-789",
						})
						.pipe(
							Effect.tap((captured) =>
								Effect.sync(() => {
									result = captured;
								}),
							),
						),
				),
				Effect.withSpan("messageCreate", {
					attributes: {
						"operation.name": "messageCreate",
						guildId: "guild-123",
						channelId: "channel-456",
						messageId: "message-789",
					},
				}),
				Effect.exit,
				Effect.provide(context),
				Effect.provide(Logger.layer([Logger.make(() => {})])),
			);
			yield* Scope.close(scope, Exit.void);

			assert.isDefined(result);
			assert.equal(postHogPayloads.length, 1);
			const postHogBody = postHogPayloads[0] ?? "";
			const axiomBody =
				axiomRequests.find(({ url }) => url.endsWith("/v1/traces"))?.body ?? "";
			for (const correlation of [
				result?.eventUUID ?? "missing-event",
				result?.traceId ?? "missing-trace",
				result?.spanId ?? "missing-span",
			]) {
				assert.include(postHogBody, correlation);
				assert.include(axiomBody, correlation);
			}
			for (const forbidden of ["INNER_SECRET", "user@example.com"]) {
				assert.notInclude(postHogBody, forbidden);
				assert.notInclude(axiomBody, forbidden);
			}
			for (const useful of [
				"SearchIndexError",
				"Meilisearch addDocuments failed for ID-42",
				"addDocuments",
			]) {
				assert.include(postHogBody, useful);
				assert.include(axiomBody, useful);
			}
			const axiom = JSON.parse(axiomBody) as {
				resourceSpans: Array<{
					scopeSpans: Array<{
						spans: Array<{
							name: string;
							attributes: Array<{
								key: string;
								value: { stringValue?: string };
							}>;
						}>;
					}>;
				}>;
			};
			const span = axiom.resourceSpans[0]?.scopeSpans[0]?.spans.find(
				({ name }) => name === "messageCreate",
			);
			const attributes = Object.fromEntries(
				(span?.attributes ?? []).map(({ key, value }) => [
					key,
					value.stringValue,
				]),
			);
			assert.deepEqual(attributes, {
				"operation.name": "messageCreate",
				guildId: "guild-123",
				channelId: "channel-456",
				messageId: "message-789",
				"error.event_id": result?.eventUUID,
				"error.type": "SearchIndexError",
				"error.fingerprint": result?.fingerprint,
			});
		}),
	);
});
