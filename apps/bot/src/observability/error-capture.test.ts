import { assert, describe, it } from "@effect/vitest";
import {
	Cause,
	ConfigProvider,
	Effect,
	Exit,
	Fiber,
	Layer,
	Option,
	Schema,
	Scope,
	Tracer,
} from "effect";
import { TestClock } from "effect/testing";
import { type EventMessage, PostHog } from "posthog-node";
import { SearchIndexError } from "../adapters/search";
import {
	ErrorCapture,
	type ErrorCaptureContext,
	layerPostHogErrorCapture,
	redactPostHogEvent,
} from "./error-capture";
import {
	errorFingerprint,
	normalizeError,
	safeSpanName,
	sanitizeText,
	staticOperation,
} from "./policy";

interface CapturedEvent {
	readonly error: Error;
	readonly distinctId: string;
	readonly properties: NonNullable<EventMessage["properties"]>;
	readonly eventUUID: string;
}

interface TestClient {
	readonly captureException: (
		error: Error,
		distinctId: string,
		properties: NonNullable<EventMessage["properties"]>,
		eventUUID: string,
	) => void;
	readonly shutdown: (timeoutMs: number) => Promise<void>;
	readonly abort?: () => void;
}

const decodeRequestBody = Schema.decodeUnknownOption(Schema.String);

const config = (env: Record<string, string>) =>
	ConfigProvider.layer(ConfigProvider.fromEnv({ env }));

const buildCapture = (
	env: Record<string, string>,
	client: TestClient,
	scope: Scope.Scope,
) =>
	Layer.build(
		layerPostHogErrorCapture({
			makeClient: () => ({ ...client, abort: client.abort ?? (() => {}) }),
		}).pipe(Layer.provideMerge(config(env))),
	).pipe(
		Scope.provide(scope),
		Effect.flatMap((context) => ErrorCapture.pipe(Effect.provide(context))),
	);

const recordingClient = (events: CapturedEvent[]): TestClient => ({
	captureException: (error, distinctId, properties, eventUUID) =>
		events.push({ error, distinctId, properties, eventUUID }),
	shutdown: async () => {},
});

describe("PostHog error capture", () => {
	it.effect("is a quiet no-op without a project token", () =>
		Effect.gen(function* () {
			let made = 0;
			const environments: ReadonlyArray<Record<string, string>> = [
				{},
				{ POSTHOG_PROJECT_TOKEN: "   " },
			];
			for (const env of environments) {
				const context = yield* Layer.build(
					layerPostHogErrorCapture({
						makeClient: () => {
							made += 1;
							throw new Error("must not construct");
						},
					}).pipe(Layer.provideMerge(config(env))),
				).pipe(Effect.scoped);
				const capture = yield* ErrorCapture.pipe(Effect.provide(context));
				assert.isUndefined(
					yield* capture.captureCause(Cause.die("ignored"), {
						boundary: "application",
					}),
				);
			}
			assert.equal(made, 0);
		}),
	);

	it.effect(
		"suppresses interrupts and selects the first defect before failures",
		() =>
			Effect.gen(function* () {
				const events: CapturedEvent[] = [];
				const scope = yield* Scope.make();
				const capture = yield* buildCapture(
					{
						POSTHOG_PROJECT_TOKEN: "token",
						NODE_ENV: "test",
						OTEL_SERVICE_VERSION: "1.2.3",
					},
					recordingClient(events),
					scope,
				);
				assert.isUndefined(
					yield* capture.captureCause(Cause.interrupt(1), {
						boundary: "application",
					}),
				);
				const firstDefect = Object.assign(new Error("useful defect"), {
					name: "GatewayDefect",
				});
				const cause = Cause.combine(
					Cause.fail(new Error("typed failure")),
					Cause.combine(Cause.die(firstDefect), Cause.interrupt(2)),
				);
				const result = yield* capture.captureCause(cause, {
					boundary: "gateway_poll_fiber",
					operation: "gateway.poll",
					guildId: "123456789012345678",
					jobId: "job-123",
				});

				assert.equal(events.length, 1);
				assert.equal(events[0]?.error.name, "GatewayDefect");
				assert.equal(events[0]?.error.message, "useful defect");
				assert.equal(events[0]?.distinctId, "velumn-bot");
				assert.equal(events[0]?.eventUUID, result?.eventUUID);
				assert.match(result?.eventUUID ?? "", /^[0-9a-f-]{36}$/);
				assert.deepInclude(events[0]?.properties, {
					service_name: "velumn-bot",
					service_version: "1.2.3",
					deployment_environment: "test",
					operation: "gateway.poll",
					boundary: "gateway_poll_fiber",
					error_type: "GatewayDefect",
					failure_kind: "mixed",
					cause_count: 3,
					fail_count: 1,
					defect_count: 1,
					interrupt_count: 1,
					guildId: "123456789012345678",
					jobId: "job-123",
					$groups: { guild: "123456789012345678" },
					$process_person_profile: false,
				});
				assert.equal(events[0]?.properties.error_event_id, result?.eventUUID);
				yield* Scope.close(scope, Exit.void);
			}),
	);

	it.effect("selects fail-only errors and preserves an original Cause", () =>
		Effect.gen(function* () {
			const events: CapturedEvent[] = [];
			const scope = yield* Scope.make();
			const capture = yield* buildCapture(
				{ POSTHOG_PROJECT_TOKEN: "token" },
				recordingClient(events),
				scope,
			);
			const original = Cause.fail(
				Object.assign(new Error("ordinary useful text ID-42"), {
					_tag: "SearchError",
					operation: "documents.update",
				}),
			);
			const exit = yield* Effect.failCause(original).pipe(
				Effect.tapCause((cause) =>
					capture.captureCause(cause, { boundary: "application" }),
				),
				Effect.exit,
			);
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) assert.strictEqual(exit.cause, original);
			assert.equal(events[0]?.properties.failure_kind, "failure");
			assert.equal(events[0]?.properties.error_tag, "SearchError");
			assert.equal(events[0]?.properties.error_operation, "documents.update");
			assert.include(events[0]?.error.message ?? "", "ID-42");
			assert.notProperty(events[0]?.properties, "trace_id");
			assert.notProperty(events[0]?.properties, "span_id");
			yield* Scope.close(scope, Exit.void);
		}),
	);

	it.effect("falls back safely for hostile Cause and error getters", () =>
		Effect.gen(function* () {
			const events: CapturedEvent[] = [];
			const scope = yield* Scope.make();
			const capture = yield* buildCapture(
				{ POSTHOG_PROJECT_TOKEN: "token" },
				recordingClient(events),
				scope,
			);
			const hostileError = new Proxy(Object.create(Error.prototype) as Error, {
				get: () => {
					throw new Error("hostile getter");
				},
			});
			yield* capture.captureCause(Cause.die(hostileError), {
				boundary: "application",
			});
			const hostileCause = new Proxy(Cause.die("private"), {
				get: (target, property, receiver) => {
					if (property === "reasons") throw new Error("hostile Cause");
					return Reflect.get(target, property, receiver);
				},
			});
			yield* capture.captureCause(hostileCause, { boundary: "application" });
			assert.equal(events.length, 2);
			assert.equal(events[0]?.error.name, "UnknownError");
			assert.equal(events[1]?.properties.failure_kind, "unknown");
			yield* Scope.close(scope, Exit.void);
		}),
	);

	it("redacts secrets but retains useful text, paths, functions, and IDs", () => {
		const sanitized = sanitizeText(
			'Failed ID-42 at /app/src/jobs.ts runJob Authorization: Bearer auth-secret email=user@example.com\nCookie: session=COOKIE_SECRET\npostgresql+asyncpg://user:pass@db/app mysql2://user:pass@db/app redis+tls://user:pass@db/0\n{"password":"JSON_PASSWORD","access-key":"ACCESS_KEY","auth_token":"AUTH_TOKEN","client_secret":"CLIENT_SECRET","session-token":"SESSION_TOKEN"}\nhttps://discord.com/api/webhooks/123456789012345678/WEBHOOK_TOKEN\nrequest_body=private payload\n"search_query":"private query"\nmessage_content: private text\napi_key=API_SECRET eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature\n-----BEGIN PRIVATE KEY-----\nPEM_SECRET\n-----END PRIVATE KEY-----',
		);
		assert.include(sanitized, "Failed ID-42 at /app/src/jobs.ts runJob");
		for (const forbidden of [
			"auth-secret",
			"user@example.com",
			"COOKIE_SECRET",
			"user:pass",
			"postgresql+asyncpg",
			"mysql2://",
			"redis+tls",
			"JSON_PASSWORD",
			"ACCESS_KEY",
			"AUTH_TOKEN",
			"CLIENT_SECRET",
			"SESSION_TOKEN",
			"WEBHOOK_TOKEN",
			"private payload",
			"private query",
			"private text",
			"API_SECRET",
			"eyJhbGci",
			"PEM_SECRET",
		]) {
			assert.notInclude(sanitized, forbidden);
		}
	});

	it("uses a bounded native cause chain for empty tagged adapter diagnostics", () => {
		const sdk = new Error(
			"Meilisearch addDocuments failed for ID-42 password=SDK_SECRET",
		);
		sdk.stack =
			"Error: Meilisearch addDocuments failed\n    at addDocuments (/app/node_modules/meilisearch/index.js:42:7)";
		const normalized = normalizeError(
			new SearchIndexError({ operation: "addDocuments", cause: sdk }),
		);
		assert.equal(normalized.type, "SearchIndexError");
		assert.equal(normalized.tag, "SearchIndexError");
		assert.equal(normalized.typedOperation, "addDocuments");
		assert.include(
			normalized.message,
			"Meilisearch addDocuments failed for ID-42",
		);
		assert.notInclude(normalized.message, "SDK_SECRET");
		assert.include(normalized.stack, "addDocuments");
	});

	it("builds stable fingerprints from static identity rather than messages or line numbers", () => {
		const make = (
			message: string,
			line: number,
			operation = "gateway.poll",
		) => {
			const normalized = normalizeError(
				Object.assign(new Error(message), {
					stack: `WorkerError: ${message}\n    at runJob (/app/apps/bot/src/jobs.ts:${line}:9)`,
					name: "WorkerError",
				}),
			);
			return errorFingerprint({
				operation,
				selectedKind: "Die",
				type: normalized.type,
				stack: normalized.stack,
			});
		};
		assert.equal(make("first", 10), make("second", 99));
		assert.notEqual(make("first", 10), make("first", 10, "projector.poll"));
		assert.match(make("first", 10), /^velumn:v1:[a-f0-9]{64}$/);
	});

	it("preserves readable camelCase and PascalCase static operation names", () => {
		for (const name of [
			"messageCreate",
			"IndexingCoordinator.settleItem",
			"addDocuments",
			"deleteThread",
		]) {
			assert.equal(safeSpanName(name), name);
			assert.equal(staticOperation(name, "unknown"), name);
		}
		assert.match(
			safeSpanName("messageCreate user@example.com"),
			/^operation\.[a-f0-9]{16}$/,
		);
	});

	it.effect("uses the active span IDs and annotates the same event UUID", () =>
		Effect.gen(function* () {
			const events: CapturedEvent[] = [];
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (options) => {
					const span = new Tracer.NativeSpan(options);
					spans.push(span);
					return span;
				},
			});
			const scope = yield* Scope.make();
			const capture = yield* buildCapture(
				{ POSTHOG_PROJECT_TOKEN: "token" },
				recordingClient(events),
				scope,
			);
			const result = yield* capture
				.captureCause(Cause.die(new Error("failure")), {
					boundary: "application",
				})
				.pipe(
					Effect.withSpan("app.runtime"),
					Effect.provideService(Tracer.Tracer, tracer),
				);
			const span = spans[0];
			assert.isDefined(span);
			assert.equal(result?.traceId, span.traceId);
			assert.equal(result?.spanId, span.spanId);
			assert.equal(span.attributes.get("error.event_id"), result?.eventUUID);
			assert.equal(events[0]?.properties.trace_id, result?.traceId);
			assert.equal(events[0]?.properties.span_id, result?.spanId);
			yield* Scope.close(scope, Exit.void);
		}),
	);

	it.effect(
		"isolates capture failures and aborts a bounded shutdown once",
		() =>
			Effect.gen(function* () {
				let shutdowns = 0;
				let aborts = 0;
				const scope = yield* Scope.make();
				const capture = yield* buildCapture(
					{ POSTHOG_PROJECT_TOKEN: "token" },
					{
						captureException: () => {
							throw new Error("capture failed");
						},
						shutdown: () => {
							shutdowns += 1;
							return new Promise<void>(() => {});
						},
						abort: () => {
							aborts += 1;
						},
					},
					scope,
				);
				assert.isDefined(
					yield* capture.captureCause(Cause.die("failure"), {
						boundary: "application",
					}),
				);
				const close = yield* Effect.forkChild(Scope.close(scope, Exit.void));
				yield* Effect.yieldNow;
				assert.equal(shutdowns, 1);
				yield* TestClock.adjust("3 seconds");
				yield* Fiber.join(close);
				yield* Scope.close(scope, Exit.void);
				assert.equal(shutdowns, 1);
				assert.equal(aborts, 1);
			}),
	);

	it.effect(
		"scans the real serialized batch after defense-in-depth redaction",
		() =>
			Effect.gen(function* () {
				const payloads: string[] = [];
				const client = new PostHog("test-token", {
					host: "https://posthog.invalid",
					enableExceptionAutocapture: false,
					disableCompression: true,
					flushAt: 20,
					before_send: redactPostHogEvent,
					fetch: async (_url, options) => {
						const body = Option.getOrUndefined(decodeRequestBody(options.body));
						if (body !== undefined) payloads.push(body);
						return {
							status: 200,
							text: async () => "{}",
							json: async () => ({}),
						};
					},
				});
				const scope = yield* Scope.make();
				const capture = yield* buildCapture(
					{ POSTHOG_PROJECT_TOKEN: "token", NODE_ENV: "production" },
					{
						captureException: (error, distinctId, properties, eventUUID) =>
							client.captureException(error, distinctId, properties, eventUUID),
						shutdown: (timeoutMs) => client._shutdown(timeoutMs),
					},
					scope,
				);
				const context: ErrorCaptureContext = {
					boundary: "discord_event_handler",
					operation: "message.create",
					guildId: "123456789012345678",
					messageId: "234567890123456789",
				};
				const sdkError = new Error(
					'Failed useful SDK operation ID-42 password=SECRET email=user@example.com\n{"api-key":"JSON_SECRET","access_key":"ACCESS_SECRET","auth-token":"AUTH_SECRET"}\npostgresql+asyncpg://user:pass@db/app mysql2://user:pass@db/app redis+tls://user:pass@db/0\nhttps://discord.com/api/webhooks/123/WEBHOOK_SECRET\nrequest_body=PRIVATE\nsearch_query=PRIVATE_QUERY\nmessage_content=PRIVATE_CONTENT',
				);
				sdkError.stack =
					"Error: bearer TOKEN_SECRET\n    at addDocuments (/app/apps/bot/src/worker.ts:10:2)";
				const result = yield* capture
					.captureCause(
						Cause.fail(
							new SearchIndexError({
								operation: "addDocuments",
								cause: sdkError,
							}),
						),
						context,
					)
					.pipe(Effect.withSpan("discord.event_handler"));
				yield* Scope.close(scope, Exit.void);
				assert.equal(payloads.length, 1);
				const serialized = payloads[0] ?? "";
				for (const forbidden of [
					"SECRET",
					"PRIVATE",
					"TOKEN_SECRET",
					"user@example.com",
					"JSON_SECRET",
					"ACCESS_SECRET",
					"AUTH_SECRET",
					"user:pass",
					"mysql2://",
					"redis+tls://",
					"WEBHOOK_SECRET",
					"PRIVATE_QUERY",
					"PRIVATE_CONTENT",
				])
					assert.notInclude(serialized, forbidden);
				for (const retained of [
					"Failed useful SDK operation ID-42",
					"SearchIndexError",
					"addDocuments",
					"apps/bot/src/worker.ts",
					"123456789012345678",
					"234567890123456789",
					result?.eventUUID ?? "missing",
					result?.traceId ?? "missing-trace",
					result?.spanId ?? "missing-span",
					"velumn:v1:",
				])
					assert.include(serialized, retained);
				const payload = JSON.parse(serialized) as {
					batch: Array<{
						event: string;
						uuid: string;
						properties: NonNullable<EventMessage["properties"]>;
					}>;
				};
				assert.equal(payload.batch[0]?.event, "$exception");
				assert.equal(payload.batch[0]?.uuid, result?.eventUUID);
			}),
	);
});
