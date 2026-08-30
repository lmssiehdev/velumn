import { randomUUID } from "node:crypto";
import {
	type Cause,
	Config,
	Context,
	Effect,
	Layer,
	Option,
	Schema,
} from "effect";
import { type EventMessage, PostHog } from "posthog-node";
import {
	errorFingerprint,
	inspectCause,
	normalizeError,
	type ReportBoundary,
	reportBoundary,
	reportEnvironment,
	sanitizeText,
	staticOperation,
} from "./policy";

export interface ErrorCaptureContext {
	readonly boundary: ReportBoundary;
	readonly operation?: string;
	readonly guildId?: string;
	readonly channelId?: string;
	readonly threadId?: string;
	readonly messageId?: string;
	readonly jobId?: string;
	readonly submissionId?: string;
	readonly mutationId?: string;
	readonly projectionId?: string;
}

export interface ErrorCaptureResult {
	readonly eventUUID: string;
	readonly traceId?: string;
	readonly spanId?: string;
	readonly fingerprint: string;
}

export interface ErrorCaptureService {
	readonly captureCause: (
		cause: Cause.Cause<unknown>,
		context: ErrorCaptureContext,
	) => Effect.Effect<ErrorCaptureResult | undefined>;
}

const noop: ErrorCaptureService = {
	captureCause: () => Effect.succeed(undefined),
};

export const ErrorCapture = Context.Reference<ErrorCaptureService>(
	"velumn/bot/observability/ErrorCapture",
	{ defaultValue: () => noop },
);

interface PostHogClient {
	readonly captureException: (
		error: Error,
		distinctId: string,
		properties: NonNullable<EventMessage["properties"]>,
		eventUUID: string,
	) => void;
	readonly shutdown: (timeoutMs: number) => Promise<void>;
	readonly abort: () => void;
}

interface PostHogCaptureOptions {
	readonly makeClient?: (token: string, host: string) => PostHogClient;
	readonly shutdownTimeoutMs?: number;
}

const propertyAllowlist = new Set([
	"$exception_list",
	"$exception_level",
	"$lib",
	"$lib_version",
	"$is_server",
	"$geoip_disable",
	"$process_person_profile",
	"$groups",
	"service_name",
	"service_version",
	"deployment_environment",
	"operation",
	"boundary",
	"error_type",
	"error_tag",
	"error_operation",
	"failure_kind",
	"cause_count",
	"reported_count",
	"fail_count",
	"defect_count",
	"interrupt_count",
	"is_composite",
	"has_mixed_failure_kinds",
	"error_event_id",
	"trace_id",
	"span_id",
	"$exception_fingerprint",
	"guildId",
	"channelId",
	"threadId",
	"messageId",
	"jobId",
	"submissionId",
	"mutationId",
	"projectionId",
]);

const exceptionFrameSchema = Schema.Struct({
	filename: Schema.optional(Schema.String),
	module: Schema.optional(Schema.String),
	function: Schema.optional(Schema.String),
	platform: Schema.optional(Schema.String),
	in_app: Schema.optional(Schema.Boolean),
	lineno: Schema.optional(Schema.Number),
	colno: Schema.optional(Schema.Number),
});
const exceptionEntrySchema = Schema.Struct({
	type: Schema.optional(Schema.String),
	value: Schema.optional(Schema.String),
	stacktrace: Schema.optional(
		Schema.Struct({
			frames: Schema.optional(Schema.Array(exceptionFrameSchema)),
		}),
	),
});
const decodeExceptionList = Schema.decodeUnknownOption(
	Schema.Array(exceptionEntrySchema),
);
const decodePropertyString = Schema.decodeUnknownOption(Schema.String);
const decodeJsonProperty = Schema.decodeUnknownOption(Schema.Json);

const sanitizeFrameText = (value: string | undefined) =>
	value === undefined ? undefined : sanitizeText(value).slice(0, 512);

const sanitizeExceptionList = (
	value: Parameters<typeof decodeExceptionList>[0],
) => {
	const entries = Option.getOrElse(decodeExceptionList(value), () => []);
	return entries.slice(0, 1).map((item) => {
		const frames = (item.stacktrace?.frames ?? [])
			.slice(0, 40)
			.map((frame) => ({
				filename: sanitizeFrameText(frame.filename),
				module: sanitizeFrameText(frame.module),
				function: sanitizeFrameText(frame.function),
				platform: sanitizeFrameText(frame.platform),
				in_app: frame.in_app,
				lineno: frame.lineno,
				colno: frame.colno,
			}));
		return {
			type: sanitizeText(item.type ?? "UnknownError").slice(0, 128),
			value: sanitizeText(item.value ?? "Failure details unavailable").slice(
				0,
				2_000,
			),
			mechanism: { type: "generic", handled: true, synthetic: false },
			stacktrace: { type: "raw", frames },
		};
	});
};

export const redactPostHogEvent = (
	event: EventMessage | null,
): EventMessage | null => {
	if (event?.event !== "$exception") return event;
	const properties = event.properties ?? {};
	const safeProperties: NonNullable<EventMessage["properties"]> = {};
	for (const key of propertyAllowlist) {
		const value = properties[key];
		if (value === undefined) continue;
		if (key === "$exception_list") {
			safeProperties[key] = sanitizeExceptionList(value);
			continue;
		}
		const text = Option.getOrUndefined(decodePropertyString(value));
		if (text !== undefined) {
			safeProperties[key] = sanitizeText(text);
			continue;
		}
		const json = Option.getOrUndefined(decodeJsonProperty(value));
		if (json !== undefined) safeProperties[key] = json;
	}
	return { ...event, properties: safeProperties };
};

const makeDefaultClient = (token: string, host: string): PostHogClient => {
	const controller = new AbortController();
	const client = new PostHog(token, {
		host,
		enableExceptionAutocapture: false,
		flushAt: 20,
		flushInterval: 10_000,
		before_send: redactPostHogEvent,
		fetch: (url, options) =>
			fetch(url, {
				...options,
				signal: options.signal
					? AbortSignal.any([options.signal, controller.signal])
					: controller.signal,
			}),
	});
	return {
		captureException: (error, distinctId, properties, eventUUID) =>
			client.captureException(error, distinctId, properties, eventUUID),
		// 5.48.1 declares public shutdown as void, so its awaitable concrete API remains _shutdown.
		shutdown: (timeoutMs) => client._shutdown(timeoutMs),
		abort: () => controller.abort(),
	};
};

const safeContextString = (
	context: ErrorCaptureContext,
	key: keyof ErrorCaptureContext,
): string | undefined => {
	try {
		const value = context[key];
		return value && value.length > 0 && value.length <= 256 ? value : undefined;
	} catch {
		return undefined;
	}
};

const validTraceId = (value: string): boolean =>
	/^[a-f0-9]{32}$/i.test(value) && !/^0+$/.test(value);
const validSpanId = (value: string): boolean =>
	/^[a-f0-9]{16}$/i.test(value) && !/^0+$/.test(value);

export const generateEventUUID = (): string => randomUUID();

export const layerPostHogErrorCapture = (options: PostHogCaptureOptions = {}) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const configuredToken = yield* Config.option(
				Config.string("POSTHOG_PROJECT_TOKEN"),
			);
			const token = Option.getOrUndefined(configuredToken)?.trim();
			if (!token) return Layer.empty;

			const host = yield* Config.string("POSTHOG_HOST").pipe(
				Config.withDefault("https://us.i.posthog.com"),
				Config.map((value) => value.trim() || "https://us.i.posthog.com"),
			);
			const environment = yield* Config.string("NODE_ENV").pipe(
				Config.withDefault("development"),
				Config.map(reportEnvironment),
			);
			const configuredVersion = yield* Config.option(
				Config.string("OTEL_SERVICE_VERSION"),
			);
			const serviceVersion =
				Option.getOrUndefined(configuredVersion)?.trim() || undefined;
			const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 3_000;
			return Layer.effect(
				ErrorCapture,
				Effect.acquireRelease(
					Effect.sync(() =>
						(options.makeClient ?? makeDefaultClient)(token, host),
					),
					(client) =>
						Effect.tryPromise(() => client.shutdown(shutdownTimeoutMs)).pipe(
							Effect.timeout(`${shutdownTimeoutMs} millis`),
							Effect.ignore,
							Effect.ensuring(Effect.sync(() => client.abort())),
						),
				).pipe(
					Effect.map((client): ErrorCaptureService => ({
						captureCause: (cause, context) =>
							Effect.gen(function* () {
								const selection = inspectCause(cause);
								if (selection === "interrupt-only") return undefined;
								const boundary = reportBoundary(
									safeContextString(context, "boundary"),
								);
								const operation = staticOperation(
									safeContextString(context, "operation"),
									boundary,
								);
								const normalized = normalizeError(selection.selected);
								const fingerprint = errorFingerprint({
									operation,
									selectedKind: selection.selectedKind,
									type: normalized.type,
									typedOperation: normalized.typedOperation,
									stack: normalized.stack,
								});
								const eventUUID = generateEventUUID();
								const rawIds = Object.fromEntries(
									(
										[
											"guildId",
											"channelId",
											"threadId",
											"messageId",
											"jobId",
											"submissionId",
											"mutationId",
											"projectionId",
										] as const
									)
										.map(
											(key) => [key, safeContextString(context, key)] as const,
										)
										.filter(
											(entry): entry is readonly [(typeof entry)[0], string] =>
												entry[1] !== undefined,
										),
								);
								const span = yield* Effect.currentSpan.pipe(Effect.option);
								const currentSpan = Option.getOrUndefined(span);
								const traceId =
									currentSpan && validTraceId(currentSpan.traceId)
										? currentSpan.traceId
										: undefined;
								const spanId =
									currentSpan && validSpanId(currentSpan.spanId)
										? currentSpan.spanId
										: undefined;
								if (currentSpan) {
									try {
										currentSpan.attribute("error.event_id", eventUUID);
										currentSpan.attribute("error.type", normalized.type);
										currentSpan.attribute("error.fingerprint", fingerprint);
										for (const [key, value] of Object.entries(rawIds))
											currentSpan.attribute(key, value);
									} catch {
										// A non-conforming tracer cannot prevent local or remote capture.
									}
								}
								const properties: NonNullable<EventMessage["properties"]> = {
									service_name: "velumn-bot",
									deployment_environment: environment,
									operation,
									boundary,
									error_type: normalized.type,
									failure_kind: selection.failure_kind,
									cause_count: selection.cause_count,
									reported_count: 1,
									fail_count: selection.fail_count,
									defect_count: selection.defect_count,
									interrupt_count: selection.interrupt_count,
									is_composite: selection.is_composite,
									has_mixed_failure_kinds: selection.has_mixed_failure_kinds,
									error_event_id: eventUUID,
									$exception_fingerprint: fingerprint,
									$process_person_profile: false,
									...rawIds,
								};
								if (serviceVersion) properties.service_version = serviceVersion;
								if (normalized.tag) properties.error_tag = normalized.tag;
								if (normalized.typedOperation) {
									properties.error_operation = normalized.typedOperation;
								}
								if (traceId) properties.trace_id = traceId;
								if (spanId) properties.span_id = spanId;
								if (rawIds.guildId) {
									properties.$groups = { guild: rawIds.guildId };
								}
								yield* Effect.logError("Captured application error", {
									eventUUID,
									traceId,
									spanId,
									operation,
									type: normalized.type,
									fingerprint,
									message: normalized.message,
									stack: normalized.stack,
									...rawIds,
								}).pipe(Effect.catchCause(() => Effect.void));
								try {
									client.captureException(
										normalized.error,
										"velumn-bot",
										properties,
										eventUUID,
									);
								} catch {
									// Error capture is best effort and cannot alter application failure.
								}
								if (traceId && spanId) {
									return { eventUUID, traceId, spanId, fingerprint };
								}
								if (traceId) return { eventUUID, traceId, fingerprint };
								if (spanId) return { eventUUID, spanId, fingerprint };
								return { eventUUID, fingerprint };
							}),
					})),
				),
			);
		}),
	);
