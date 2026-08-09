import { randomUUID } from "node:crypto";
import {
	ChannelType,
	type GuildTextBasedChannel,
	type Snowflake,
} from "discord.js";
import { Clock, Effect, Ref } from "effect";
import type { IndexingCoordinatorService } from "./coordinator";
import type { DiscordHistory } from "./discord-history";
import type {
	IndexMutation,
	IndexSubmission,
	IndexTerminalOutcome,
} from "./model";

export type ReconciliationScope =
	| { readonly _tag: "Guild"; readonly guildId: Snowflake }
	| {
			readonly _tag: "Channel";
			readonly guildId: Snowflake;
			readonly channelId: Snowflake;
	  }
	| {
			readonly _tag: "Thread";
			readonly guildId: Snowflake;
			readonly channelId: Snowflake;
			readonly threadId: Snowflake;
	  };

export interface PlannedReconciliationThread {
	readonly channel: GuildTextBasedChannel;
	readonly guildId: Snowflake;
	readonly parentChannelId: Snowflake;
	readonly active: boolean;
}

export interface ReconciliationPlanOperations {
	readonly guildInstallationExists: (
		guildId: Snowflake,
	) => Effect.Effect<boolean, unknown>;
	readonly planThreads: (
		scope: ReconciliationScope,
	) => Effect.Effect<readonly PlannedReconciliationThread[], unknown>;
	readonly getMessageCheckpoint: (
		threadId: Snowflake,
	) => Effect.Effect<Snowflake | null, unknown>;
	readonly getSelectionCursor: (
		anchorChannelId: Snowflake,
	) => Effect.Effect<Snowflake | null, unknown>;
	readonly setSelectionCursor: (
		anchorChannelId: Snowflake,
		threadId: Snowflake,
	) => Effect.Effect<void, unknown>;
}

export interface ReconciliationOptions {
	readonly maxThreads: number;
	readonly maxMessages: number;
	readonly threadConcurrency: number;
}

export type ReconciliationFailureStage =
	| "plan-threads"
	| "reconcile-thread"
	| "fetch-message-page"
	| "upsert-message";

export interface ReconciliationFailure {
	readonly threadId: Snowflake | null;
	readonly stage: ReconciliationFailureStage;
	readonly cause: unknown;
}

export interface ReconciliationSummary {
	readonly status: "succeeded" | "partial" | "failed";
	readonly plannedThreads: number;
	readonly attemptedThreads: number;
	readonly succeededThreads: number;
	readonly failedThreads: number;
	readonly submittedMessages: number;
	readonly threadCapReached: boolean;
	readonly messageCapReached: boolean;
	readonly failures: readonly ReconciliationFailure[];
}

interface ThreadResult {
	readonly succeeded: boolean;
	readonly submittedMessages: number;
	readonly failure?: ReconciliationFailure;
}

type ReconciliationHistory = Pick<
	DiscordHistory["Service"],
	"fetchMessagePage"
>;

const messagePageSize = 100;

export const contentOrderingKey = (threadId: Snowflake) =>
	`channel:${threadId}`;

const validateOptions = (options: ReconciliationOptions) => {
	for (const [name, value] of Object.entries(options)) {
		const minimum = name === "threadConcurrency" ? 1 : 0;
		if (!Number.isInteger(value) || value < minimum) {
			throw new RangeError(
				`${name} must be an integer greater than or equal to ${minimum}`,
			);
		}
	}
};

const belongsToScope = (
	scope: ReconciliationScope,
	thread: PlannedReconciliationThread,
) => {
	if (thread.guildId !== scope.guildId) return false;
	if (scope._tag === "Guild") return true;
	if (thread.parentChannelId !== scope.channelId) return false;
	return scope._tag === "Channel" || thread.channel.id === scope.threadId;
};

const eligibleThreads = (
	scope: ReconciliationScope,
	threads: readonly PlannedReconciliationThread[],
) => {
	const seen = new Set<Snowflake>();
	return threads
		.filter(
			(thread) =>
				belongsToScope(scope, thread) &&
				(thread.channel.type === ChannelType.GuildAnnouncement ||
					thread.channel.type === ChannelType.PublicThread ||
					thread.channel.type === ChannelType.AnnouncementThread),
		)
		.map((thread, position) => ({ thread, position }))
		.sort(
			(left, right) =>
				Number(right.thread.active) - Number(left.thread.active) ||
				left.position - right.position,
		)
		.filter(({ thread }) => {
			if (seen.has(thread.channel.id)) return false;
			seen.add(thread.channel.id);
			return true;
		})
		.map(({ thread }) => thread);
};

const selectThreads = (
	scope: ReconciliationScope,
	eligible: readonly PlannedReconciliationThread[],
	cursor: Snowflake | null,
	maxThreads: number,
) => {
	if (scope._tag === "Thread" || cursor === null) {
		return eligible.slice(0, maxThreads);
	}
	const cursorIndex = eligible.findIndex(
		(thread) => thread.channel.id === cursor,
	);
	if (cursorIndex < 0) return eligible.slice(0, maxThreads);
	const rotated = [
		...eligible.slice(cursorIndex + 1),
		...eligible.slice(0, cursorIndex + 1),
	];
	return rotated.slice(0, maxThreads);
};

const planningFailure = (
	cause: unknown,
	plannedThreads = 0,
): ReconciliationSummary => ({
	status: "failed",
	plannedThreads,
	attemptedThreads: 0,
	succeededThreads: 0,
	failedThreads: 0,
	submittedMessages: 0,
	threadCapReached: false,
	messageCapReached: false,
	failures: [{ threadId: null, stage: "plan-threads", cause }],
});

const missingInstallationSummary = (): ReconciliationSummary => ({
	status: "succeeded",
	plannedThreads: 0,
	attemptedThreads: 0,
	succeededThreads: 0,
	failedThreads: 0,
	submittedMessages: 0,
	threadCapReached: false,
	messageCapReached: false,
	failures: [],
});

const failedResult = (
	threadId: Snowflake,
	stage: ReconciliationFailureStage,
	cause: unknown,
	submittedMessages = 0,
): ThreadResult => ({
	succeeded: false,
	submittedMessages,
	failure: { threadId, stage, cause },
});

const receiptFailure = <E>(outcome: IndexTerminalOutcome<E>) =>
	outcome._tag === "Failed" ? outcome.cause : undefined;

export const reconcileDiscordHistory = <E>(
	scope: ReconciliationScope,
	options: ReconciliationOptions,
	plan: ReconciliationPlanOperations,
	history: ReconciliationHistory,
	coordinator: IndexingCoordinatorService<E>,
): Effect.Effect<ReconciliationSummary> =>
	Effect.gen(function* () {
		yield* Effect.sync(() => validateOptions(options));
		const installed = yield* plan.guildInstallationExists(scope.guildId).pipe(
			Effect.match({
				onFailure: (cause) => ({ _tag: "Failed" as const, cause }),
				onSuccess: (exists) => ({ _tag: "Succeeded" as const, exists }),
			}),
		);
		if (installed._tag === "Failed") return planningFailure(installed.cause);
		if (!installed.exists) return missingInstallationSummary();
		const planned = yield* plan.planThreads(scope).pipe(
			Effect.match({
				onFailure: (cause) => ({ _tag: "Failed" as const, cause }),
				onSuccess: (threads) => ({ _tag: "Succeeded" as const, threads }),
			}),
		);
		if (planned._tag === "Failed") {
			return planningFailure(planned.cause);
		}

		const eligible = eligibleThreads(scope, planned.threads);
		const anchorChannelId = eligible
			.map((thread) => thread.parentChannelId)
			.sort()[0];
		const selectionCursor =
			scope._tag === "Thread" || anchorChannelId === undefined
				? { _tag: "Succeeded" as const, cursor: null }
				: yield* plan.getSelectionCursor(anchorChannelId).pipe(
						Effect.match({
							onFailure: (cause) => ({ _tag: "Failed" as const, cause }),
							onSuccess: (cursor) => ({
								_tag: "Succeeded" as const,
								cursor,
							}),
						}),
					);
		if (selectionCursor._tag === "Failed") {
			return planningFailure(selectionCursor.cause, eligible.length);
		}
		const selected = selectThreads(
			scope,
			eligible,
			selectionCursor.cursor,
			options.maxThreads,
		);
		const lastSelected = selected.at(-1);
		if (
			scope._tag !== "Thread" &&
			anchorChannelId !== undefined &&
			lastSelected !== undefined
		) {
			const persisted = yield* plan
				.setSelectionCursor(anchorChannelId, lastSelected.channel.id)
				.pipe(
					Effect.match({
						onFailure: (cause) => ({ _tag: "Failed" as const, cause }),
						onSuccess: () => ({ _tag: "Succeeded" as const }),
					}),
				);
			if (persisted._tag === "Failed") {
				return planningFailure(persisted.cause, eligible.length);
			}
		}
		const activeThreads = selected.filter((thread) => thread.active);
		const storedThreads = selected.filter((thread) => !thread.active);
		const remainingMessages = yield* Ref.make(options.maxMessages);
		const runId = randomUUID();
		let submissionSequence = 0;

		const submit = (orderingKey: string, mutation: IndexMutation) =>
			Effect.gen(function* () {
				const submittedAt = yield* Clock.currentTimeMillis;
				const submission: IndexSubmission = {
					id: `${runId}:${submissionSequence++}`,
					source: "reconciliation",
					orderingKey,
					mutation,
					submittedAt,
				};
				const result = yield* coordinator.submit(submission);
				if (result._tag !== "Accepted") return result._tag;
				return yield* result.receipt.await;
			});

		const runThread = (
			thread: PlannedReconciliationThread,
		): Effect.Effect<ThreadResult> =>
			Effect.gen(function* () {
				const threadId = thread.channel.id;
				const orderingKey = contentOrderingKey(threadId);
				const isThread =
					thread.channel.type === ChannelType.PublicThread ||
					thread.channel.type === ChannelType.AnnouncementThread;
				if (isThread) {
					const requestedAt = yield* Clock.currentTimeMillis;
					const reconciled = yield* submit(orderingKey, {
						_tag: "ReconcileThread",
						threadId,
						parentChannelId: thread.parentChannelId,
						guildId: thread.guildId,
						requestedAt,
					});
					if (typeof reconciled === "string") {
						return failedResult(threadId, "reconcile-thread", reconciled);
					}
					const reconcileFailure = receiptFailure(reconciled);
					if (reconcileFailure !== undefined) {
						return failedResult(threadId, "reconcile-thread", reconcileFailure);
					}
				}

				const checkpoint = yield* plan.getMessageCheckpoint(threadId).pipe(
					Effect.match({
						onFailure: (cause) => ({ _tag: "Failed" as const, cause }),
						onSuccess: (after) => ({ _tag: "Succeeded" as const, after }),
					}),
				);
				if (checkpoint._tag === "Failed") {
					return failedResult(threadId, "fetch-message-page", checkpoint.cause);
				}
				let after: Snowflake | undefined = checkpoint.after ?? undefined;
				let submittedMessages = 0;
				while (true) {
					const remaining = yield* Ref.get(remainingMessages);
					if (remaining === 0) break;
					const fetched = yield* history
						.fetchMessagePage({
							channel: thread.channel,
							after,
							limit: messagePageSize,
						})
						.pipe(
							Effect.match({
								onFailure: (cause) => ({
									_tag: "Failed" as const,
									cause,
								}),
								onSuccess: (messages) => ({
									_tag: "Succeeded" as const,
									messages,
								}),
							}),
						);
					if (fetched._tag === "Failed") {
						return failedResult(
							threadId,
							"fetch-message-page",
							fetched.cause,
							submittedMessages,
						);
					}

					const page = [...fetched.messages.values()].sort((left, right) =>
						BigInt(left.id) < BigInt(right.id) ? -1 : 1,
					);
					let acceptedFromPage = 0;
					for (const message of page) {
						const reserved = yield* Ref.modify(remainingMessages, (current) =>
							current === 0 ? [false, current] : [true, current - 1],
						);
						if (!reserved) break;
						acceptedFromPage += 1;
						const observedAt = yield* Clock.currentTimeMillis;
						const outcome = yield* submit(orderingKey, {
							_tag: "UpsertMessage",
							messageId: message.id,
							channelId: threadId,
							threadId: isThread ? threadId : null,
							observedAt,
						});
						if (typeof outcome === "string") {
							yield* Ref.update(remainingMessages, (current) => current + 1);
							return failedResult(
								threadId,
								"upsert-message",
								outcome,
								submittedMessages,
							);
						}
						const failure = receiptFailure(outcome);
						if (failure !== undefined) {
							yield* Ref.update(remainingMessages, (current) => current + 1);
							return failedResult(
								threadId,
								"upsert-message",
								failure,
								submittedMessages,
							);
						}
						submittedMessages += 1;
						after = message.id;
					}

					if (acceptedFromPage < page.length || page.length < messagePageSize) {
						break;
					}
				}
				return { succeeded: true, submittedMessages };
			});

		const runThreads = (threads: readonly PlannedReconciliationThread[]) =>
			Effect.forEach(threads, runThread, {
				concurrency: options.threadConcurrency,
			});
		const activeResults = yield* runThreads(activeThreads);
		const storedResults = yield* runThreads(storedThreads);
		const results = [...activeResults, ...storedResults];
		const succeededThreads = results.filter(
			(result) => result.succeeded,
		).length;
		const failedThreads = results.length - succeededThreads;
		const failures = results.flatMap((result) =>
			result.failure ? [result.failure] : [],
		);
		const messagesRemaining = yield* Ref.get(remainingMessages);
		const threadCapReached = eligible.length > selected.length;
		const messageCapReached = selected.length > 0 && messagesRemaining === 0;

		return {
			status:
				failedThreads > 0 && succeededThreads === 0
					? "failed"
					: failedThreads > 0 || threadCapReached || messageCapReached
						? "partial"
						: "succeeded",
			plannedThreads: eligible.length,
			attemptedThreads: selected.length,
			succeededThreads,
			failedThreads,
			submittedMessages: results.reduce(
				(total, result) => total + result.submittedMessages,
				0,
			),
			threadCapReached,
			messageCapReached,
			failures,
		};
	});
