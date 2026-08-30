import { Effect, Metric } from "effect";
import type { PersistedIndexMutationKind } from "../indexing/mutation-metadata";

export type MetricOutcome =
	| "succeeded"
	| "failed"
	| "cancelled"
	| "skipped"
	| "deferred"
	| "partial";

export type DiscordEventCategory =
	| "message"
	| "channel"
	| "thread"
	| "guild"
	| "member"
	| "role"
	| "interaction"
	| "other";

export type IndexMutationKind = "invalid_payload" | PersistedIndexMutationKind;

export type GatewayMutationOutcome =
	| MetricOutcome
	| "accepted"
	| "overloaded"
	| "closing"
	| "lease_lost";

export type ProjectorOperation =
	| "poll"
	| "claim"
	| "renew_lease"
	| "project"
	| "complete"
	| "release";

export type ReconciliationKind =
	| "guild"
	| "channel"
	| "thread"
	| "permissions"
	| "full";

export type ReconciliationTrigger = "schedule" | "manual" | "other";

export type ReadinessComponent =
	| "service"
	| "discord"
	| "commands"
	| "http"
	| "indexing_coordinator"
	| "gateway_mutation_inbox"
	| "projector";

export type QueueKind =
	| "indexing_outstanding"
	| "gateway_mutations"
	| "projector"
	| "reconciliation";

export type BacklogKind =
	| "indexing_outstanding"
	| "gateway_pending"
	| "projector_pending"
	| "reconciliation_pending";

export type RetryOperation =
	| "gateway_enqueue"
	| "gateway_processing"
	| "indexing_mutation"
	| "projector"
	| "reconciliation";

export type RetryDisposition = "retryable" | "terminal";

const durationBoundaries = [
	1, 5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000, 60_000,
];

const discordEvents = Metric.counter("velumn_bot_discord_events_total", {
	description: "Discord events handled by category and outcome",
	incremental: true,
});
const discordEventDuration = Metric.histogram(
	"velumn_bot_discord_event_duration_ms",
	{
		description: "Discord event handler duration in milliseconds",
		boundaries: durationBoundaries,
	},
);
const gatewayMutations = Metric.counter("velumn_bot_gateway_mutations_total", {
	description: "Gateway mutations processed by kind and outcome",
	incremental: true,
});
const gatewayMutationDuration = Metric.histogram(
	"velumn_bot_gateway_mutation_duration_ms",
	{
		description: "Gateway mutation processing duration in milliseconds",
		boundaries: durationBoundaries,
	},
);
const indexingMutations = Metric.counter(
	"velumn_bot_indexing_mutations_total",
	{
		description: "Indexing mutations executed by kind and outcome",
		incremental: true,
	},
);
const indexingMutationDuration = Metric.histogram(
	"velumn_bot_indexing_mutation_duration_ms",
	{
		description: "Indexing mutation execution duration in milliseconds",
		boundaries: durationBoundaries,
	},
);
const projectorOperations = Metric.counter(
	"velumn_bot_projector_operations_total",
	{
		description: "Projector operations by operation and outcome",
		incremental: true,
	},
);
const projectorOperationDuration = Metric.histogram(
	"velumn_bot_projector_operation_duration_ms",
	{
		description: "Projector operation duration in milliseconds",
		boundaries: durationBoundaries,
	},
);
const reconciliationJobs = Metric.counter(
	"velumn_bot_reconciliation_jobs_total",
	{
		description: "Reconciliation jobs by kind and outcome",
		incremental: true,
	},
);
const reconciliationJobDuration = Metric.histogram(
	"velumn_bot_reconciliation_job_duration_ms",
	{
		description: "Reconciliation job duration in milliseconds",
		boundaries: durationBoundaries,
	},
);
const readiness = Metric.gauge("velumn_bot_readiness", {
	description: "Current readiness state by component",
});
const queueDepth = Metric.gauge("velumn_bot_queue_depth", {
	description: "Current in-memory work depth by queue or outstanding set",
});
const backlogSize = Metric.gauge("velumn_bot_backlog_size", {
	description: "Current persisted backlog size by backlog",
});
const retries = Metric.counter("velumn_bot_retries_total", {
	description: "Retry decisions by operation and disposition",
	incremental: true,
});

const finiteNonNegative = (value: number) =>
	Number.isFinite(value) && value >= 0;

const increment = <State>(
	metric: Metric.Metric<number, State>,
	attributes: Metric.Metric.Attributes,
) => Metric.update(Metric.withAttributes(metric, attributes), 1);

const observeDuration = <State>(
	metric: Metric.Metric<number, State>,
	durationMs: number,
	attributes: Metric.Metric.Attributes,
) =>
	finiteNonNegative(durationMs)
		? Metric.update(Metric.withAttributes(metric, attributes), durationMs)
		: Effect.void;

const setNonNegativeGauge = (
	metric: Metric.Gauge<number>,
	value: number,
	attributes: Metric.Metric.Attributes,
) =>
	finiteNonNegative(value)
		? Metric.update(Metric.withAttributes(metric, attributes), value)
		: Effect.void;

const recordOperation = <CounterState, DurationState>(
	counter: Metric.Metric<number, CounterState>,
	duration: Metric.Metric<number, DurationState>,
	durationMs: number,
	attributes: Metric.Metric.Attributes,
) =>
	Effect.all(
		[
			increment(counter, attributes),
			observeDuration(duration, durationMs, attributes),
		],
		{ discard: true },
	);

export const BotMetrics = {
	recordDiscordEvent: (input: {
		readonly category: DiscordEventCategory;
		readonly outcome: MetricOutcome;
		readonly durationMs: number;
	}) =>
		recordOperation(discordEvents, discordEventDuration, input.durationMs, {
			category: input.category,
			outcome: input.outcome,
		}),

	recordGatewayMutation: (input: {
		readonly kind: IndexMutationKind;
		readonly outcome: GatewayMutationOutcome;
		readonly durationMs: number;
	}) =>
		recordOperation(
			gatewayMutations,
			gatewayMutationDuration,
			input.durationMs,
			{ kind: input.kind, outcome: input.outcome },
		),

	recordIndexingMutation: (input: {
		readonly kind: IndexMutationKind;
		readonly outcome: MetricOutcome;
		readonly durationMs: number;
	}) =>
		recordOperation(
			indexingMutations,
			indexingMutationDuration,
			input.durationMs,
			{ kind: input.kind, outcome: input.outcome },
		),

	recordProjectorOperation: (input: {
		readonly operation: ProjectorOperation;
		readonly outcome: MetricOutcome;
		readonly durationMs: number;
	}) =>
		recordOperation(
			projectorOperations,
			projectorOperationDuration,
			input.durationMs,
			{ operation: input.operation, outcome: input.outcome },
		),

	recordReconciliationJob: (input: {
		readonly kind: ReconciliationKind;
		readonly trigger: ReconciliationTrigger;
		readonly outcome: MetricOutcome;
		readonly durationMs: number;
	}) =>
		recordOperation(
			reconciliationJobs,
			reconciliationJobDuration,
			input.durationMs,
			{
				kind: input.kind,
				trigger: input.trigger,
				outcome: input.outcome,
			},
		),

	setReadiness: (component: ReadinessComponent, ready: boolean) =>
		Metric.update(
			Metric.withAttributes(readiness, { component }),
			ready ? 1 : 0,
		),

	setQueueDepth: (queue: QueueKind, depth: number) =>
		setNonNegativeGauge(queueDepth, depth, { queue }),

	setBacklogSize: (backlog: BacklogKind, size: number) =>
		setNonNegativeGauge(backlogSize, size, { backlog }),

	recordRetry: (operation: RetryOperation, disposition: RetryDisposition) =>
		increment(retries, { operation, disposition }),
} as const;
