import { Effect, Exit, Layer, Option, Schema, Tracer } from "effect";
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
	"discord.event.category",
	"mutation.type",
	"submission.source",
	"projection.operation",
	"job.kind",
	"job.trigger",
	"retry.classification",
	"retry.attempt",
	"retry.disposition",
	"batch.claimed_count",
	"batch.failed_count",
	"batch.processed_count",
	"job.planned_count",
	"job.processed_count",
	"job.committed_count",
	"job.skipped_count",
	"job.failed_count",
	"job.projections_pending_count",
	"item.count",
]);

const allowedCategoricalValues = new Map<string, ReadonlySet<string>>([
	[
		"discord.event.category",
		new Set([
			"message",
			"channel",
			"thread",
			"guild",
			"member",
			"role",
			"interaction",
			"other",
		]),
	],
	[
		"mutation.type",
		new Set([
			"invalid_payload",
			"upsert_message",
			"delete_message",
			"delete_thread",
			"reconcile_thread",
			"upsert_channel",
			"delete_channel",
			"install_guild",
			"upsert_guild",
			"delete_guild",
			"upsert_user",
			"reconcile_bot_member_permissions",
			"reconcile_role_permissions",
		]),
	],
	[
		"submission.source",
		new Set(["gateway", "manual", "reconciliation", "scheduled"]),
	],
	[
		"projection.operation",
		new Set([
			"message_upsert",
			"container_refresh",
			"rebuild",
			"message_delete",
			"container_delete",
			"server_delete",
		]),
	],
	["job.kind", new Set(["guild", "channel", "thread", "permissions", "full"])],
	["job.trigger", new Set(["schedule", "manual", "other"])],
	["retry.disposition", new Set(["retryable", "terminal"])],
]);

const decodeBooleanAttribute = Schema.decodeUnknownOption(Schema.Boolean);
const decodeNumberAttribute = Schema.decodeUnknownOption(Schema.Number);
const decodeStringAttribute = Schema.decodeUnknownOption(Schema.String);

const safeAttribute = (
	key: string,
	value: Parameters<typeof decodeStringAttribute>[0],
): string | number | boolean | undefined => {
	if (!allowedAttributeKeys.has(key)) return undefined;
	const booleanValue = Option.getOrUndefined(decodeBooleanAttribute(value));
	if (booleanValue !== undefined) return booleanValue;
	const numberValue = Option.getOrUndefined(decodeNumberAttribute(value));
	if (numberValue !== undefined)
		return Number.isFinite(numberValue) &&
			Math.abs(numberValue) <= 1_000_000_000
			? numberValue
			: undefined;
	const stringValue = Option.getOrUndefined(decodeStringAttribute(value));
	if (stringValue !== undefined)
		return stringValue.length > 0 &&
			stringValue.length <= 256 &&
			(allowedCategoricalValues.get(key)?.has(stringValue) ?? true)
			? stringValue
			: undefined;
	return undefined;
};

const safeAttributes = (attributes: Tracer.Span["attributes"]) => {
	const output: Record<string, string | number | boolean> = {};
	try {
		for (const [key, value] of attributes) {
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
