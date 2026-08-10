import { Effect, Exit, Layer, Tracer } from "effect";
import type { HttpClient } from "effect/unstable/http";
import {
	OtlpExporter,
	type OtlpSerialization,
	OtlpTracer,
} from "effect/unstable/observability";
import { safeSpanName, sanitizedExporterCause } from "./policy";

type OtlpTracerOptions = Omit<
	Parameters<typeof OtlpTracer.make>[0],
	"context"
> & {
	readonly context?: never;
};

const allowedAttributeKeys = new Set([
	"discord.guild_id",
	"discord.server_id",
	"discord.channel_id",
	"discord.thread_id",
	"discord.message_id",
	"guildId",
	"channelId",
	"threadId",
	"messageId",
	"jobId",
	"submissionId",
	"mutationId",
	"projectionId",
	"error.event_id",
	"error.type",
	"error.classification",
	"error.fingerprint",
	"operation.name",
	"operation.outcome",
	"retry.classification",
	"retry.attempt",
	"batch.claimed_count",
	"batch.failed_count",
	"batch.processed_count",
	"item.count",
]);

const safeAttribute = (
	key: string,
	value: unknown,
): string | number | boolean | undefined => {
	if (!allowedAttributeKeys.has(key)) return undefined;
	if (typeof value === "boolean") return value;
	if (typeof value === "number")
		return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000
			? value
			: undefined;
	if (typeof value === "string")
		return value.length > 0 && value.length <= 256 ? value : undefined;
	return undefined;
};

const safeAttributes = (
	attributes: Readonly<Record<string, unknown>> | ReadonlyMap<string, unknown>,
) => {
	const output: Record<string, string | number | boolean> = {};
	try {
		for (const [key, value] of attributes instanceof Map
			? attributes
			: Object.entries(attributes)) {
			const safeValue = safeAttribute(key, value);
			if (safeValue !== undefined) output[key] = safeValue;
		}
	} catch {
		return output;
	}
	return output;
};

const sanitizedFailureExit = (exit: Exit.Exit<unknown, unknown>) => {
	if (Exit.isSuccess(exit)) return exit;
	const cause = sanitizedExporterCause(exit.cause);
	return cause === "interrupt-only" ? Exit.void : Exit.failCause(cause);
};

const wrapSpan = (span: Tracer.Span): Tracer.Span => ({
	_tag: "Span",
	name: span.name,
	spanId: span.spanId,
	traceId: span.traceId,
	parent: span.parent,
	annotations: span.annotations,
	get status() {
		return span.status;
	},
	get attributes() {
		return new Map(Object.entries(safeAttributes(span.attributes)));
	},
	get links() {
		return span.links.map((link) => ({
			span: link.span,
			attributes: {},
		}));
	},
	sampled: span.sampled,
	kind: span.kind,
	end: (endTime, exit) => {
		span.end(endTime, sanitizedFailureExit(exit));
	},
	attribute: (key, value) => {
		const safeValue = safeAttribute(key, value);
		if (safeValue !== undefined) span.attribute(key, safeValue);
	},
	event: () => {},
	addLinks: () => {},
});

// Keep the exporter useful without allowing arbitrary application values into OTLP.
export const safeOtlpTracerLayer = (
	options: OtlpTracerOptions,
): Layer.Layer<
	never,
	never,
	HttpClient.HttpClient | OtlpSerialization.OtlpSerialization
> =>
	Layer.effect(
		Tracer.Tracer,
		OtlpTracer.make(options).pipe(
			Effect.map((tracer) =>
				Tracer.make({
					span: (spanOptions) =>
						wrapSpan(
							tracer.span({
								...spanOptions,
								name: safeSpanName(spanOptions.name),
								links: spanOptions.links.map((link) => ({
									span: link.span,
									attributes: {},
								})),
							}),
						),
				}),
			),
		),
	).pipe(Layer.provideMerge(OtlpExporter.layerFlusher));
