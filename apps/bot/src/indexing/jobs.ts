import { randomUUID } from "node:crypto";
import type {
	CreateIndexingJobInput,
	StoredReconciliationCandidate,
} from "@repo/db/helpers/indexing";
import type { DBIndexingJob, IndexingJobSummary } from "@repo/db/schema/index";
import {
	type AnyThreadChannel,
	ChannelFlags,
	ChannelType,
	type FetchedThreadsMore,
	type GuildBasedChannel,
	type Snowflake,
} from "discord.js";
import {
	Cause,
	Clock,
	Context,
	Effect,
	FiberMap,
	Layer,
	type Scope,
	Semaphore,
} from "effect";
import {
	IndexingRepository,
	type IndexingRepositoryError,
} from "../adapters/indexing-repository";
import { DiscordClient } from "../discord/client";
import { ErrorCapture } from "../observability/error-capture";
import { IndexingCoordinator } from "./coordinator";
import { DiscordHistory, type ThreadParentChannel } from "./discord-history";
import {
	type PlannedReconciliationThread,
	type ReconciliationOptions,
	type ReconciliationPlanOperations,
	type ReconciliationScope,
	type ReconciliationSummary,
	reconcileDiscordHistory,
} from "./reconciliation";

export interface ReconciliationJobOptions extends ReconciliationOptions {
	/** Bounds archived discovery independently from Discord's pagination behavior. */
	readonly maxArchivedPagesPerParent: number;
}

export const conservativeReconciliationJobOptions: ReconciliationJobOptions = {
	maxThreads: 50,
	maxMessages: 5_000,
	threadConcurrency: 2,
	maxArchivedPagesPerParent: 2,
};

export interface ManualJobRequest {
	readonly requestedBy?: string;
	readonly trigger?: string;
	readonly maxThreads?: number;
}

export interface ReconciliationJobsService {
	readonly repairStartup: Effect.Effect<
		readonly DBIndexingJob[],
		IndexingRepositoryError
	>;
	readonly startGuild: (
		guildId: Snowflake,
		request?: ManualJobRequest,
	) => Effect.Effect<DBIndexingJob, IndexingRepositoryError>;
	readonly startThread: (
		guildId: Snowflake,
		parentChannelId: Snowflake,
		threadId: Snowflake,
		request?: ManualJobRequest,
	) => Effect.Effect<DBIndexingJob, IndexingRepositoryError>;
	readonly startScheduled: () => Effect.Effect<
		DBIndexingJob,
		IndexingRepositoryError
	>;
	readonly get: (
		jobId: string,
	) => Effect.Effect<DBIndexingJob | null, IndexingRepositoryError>;
	readonly cancel: (
		jobId: string,
	) => Effect.Effect<DBIndexingJob | null, IndexingRepositoryError>;
}

export class ReconciliationJobs extends Context.Service<
	ReconciliationJobs,
	ReconciliationJobsService
>()("velumn/bot/indexing/ReconciliationJobs") {}

const supportedParent = (
	channel: GuildBasedChannel,
): channel is ThreadParentChannel =>
	channel.type === ChannelType.GuildText ||
	channel.type === ChannelType.GuildForum ||
	channel.type === ChannelType.GuildAnnouncement;

const supportedThread = (
	channel: GuildBasedChannel,
): channel is AnyThreadChannel =>
	channel.type === ChannelType.PublicThread ||
	channel.type === ChannelType.AnnouncementThread;

const channelMetadata = (channel: GuildBasedChannel, observedAt: Date) => ({
	id: channel.id,
	serverId: channel.guildId,
	parentId: channel.parentId,
	authorId: channel.isThread() ? (channel.ownerId ?? null) : null,
	channelName: channel.name,
	position: "position" in channel ? channel.position : 0,
	nsfw: "nsfw" in channel ? channel.nsfw : false,
	botPermissions: null,
	botPermissionsCheckedAt: null,
	observedAt,
	archived: channel.isThread() ? (channel.archived ?? false) : false,
	locked: channel.isThread() ? (channel.locked ?? false) : false,
	archivedTimestamp:
		channel.isThread() && channel.archiveTimestamp
			? channel.archiveTimestamp
			: null,
	lastIndexedMessageId: null,
	type: channel.type,
	pinned: channel.isThread() && channel.flags.has(ChannelFlags.Pinned),
	upvotes: 0,
	downvotes: 0,
	availableTags:
		channel.type === ChannelType.GuildForum
			? {
					_tag: "Replace" as const,
					items: (channel.availableTags ?? []).map((tag) => ({
						id: tag.id,
						name: tag.name,
						moderated: tag.moderated,
						emojiId: tag.emoji?.id ?? null,
						emojiName: tag.emoji?.name ?? null,
					})),
				}
			: { _tag: "NotFetched" as const },
	appliedTagIds: channel.isThread()
		? { _tag: "Replace" as const, items: channel.appliedTags }
		: { _tag: "NotFetched" as const },
});

export const makeThreadPlanner = (
	options: ReconciliationJobOptions,
): Effect.Effect<
	ReconciliationPlanOperations,
	never,
	DiscordHistory | IndexingRepository
> =>
	Effect.gen(function* () {
		const history = yield* DiscordHistory;
		const repository = yield* IndexingRepository;
		const upsertChannel = (channel: GuildBasedChannel, observedAt: Date) =>
			repository
				.upsertChannelMetadata(channelMetadata(channel, observedAt))
				.pipe(Effect.map((result) => result._tag === "Applied"));

		const loadStored = (
			scope: ReconciliationScope,
		): Effect.Effect<readonly PlannedReconciliationThread[], unknown> =>
			Effect.gen(function* () {
				const rows = yield* repository.storedCandidates({
					guildId: scope.guildId,
					parentChannelId: scope._tag === "Guild" ? undefined : scope.channelId,
					threadId: scope._tag === "Thread" ? scope.threadId : undefined,
				});
				return yield* Effect.forEach(
					rows,
					(row: StoredReconciliationCandidate) =>
						history
							.lookupGuildChannelFetchRequired({
								guildId: row.guildId,
								channelId: row.threadId,
							})
							.pipe(
								Effect.map((channel) =>
									supportedThread(channel)
										? ([
												{
													channel,
													guildId: row.guildId,
													parentChannelId: row.parentChannelId,
													active: false,
												},
											] as const)
										: [],
								),
								Effect.catchTag("DiscordHistoryMissingError", () =>
									Clock.currentTimeMillis.pipe(
										Effect.flatMap((observedAt) =>
											repository.deleteThread({
												threadId: row.threadId,
												parentChannelId: row.parentChannelId,
												serverId: row.guildId,
												observedAt,
											}),
										),
										Effect.as([] as readonly PlannedReconciliationThread[]),
									),
								),
							),
					{ concurrency: options.threadConcurrency },
				).pipe(Effect.map((groups) => groups.flat()));
			});

		return {
			guildInstallationExists: (guildId) =>
				repository.guildInstallationExists(guildId),
			getMessageCheckpoint: (threadId: Snowflake) =>
				repository
					.getCheckpoint(threadId, "message_history")
					.pipe(Effect.map((checkpoint) => checkpoint?.scanCursor ?? null)),
			getSelectionCursor: (anchorChannelId: Snowflake) =>
				repository
					.getCheckpoint(anchorChannelId, "reconciliation_selection")
					.pipe(Effect.map((checkpoint) => checkpoint?.scanCursor ?? null)),
			setSelectionCursor: (anchorChannelId: Snowflake, threadId: Snowflake) =>
				repository
					.upsertCheckpoint({
						channelId: anchorChannelId,
						kind: "reconciliation_selection",
						scanCursor: threadId,
						commitCursor: threadId,
						updatedByJobId: null,
					})
					.pipe(Effect.asVoid),
			planThreads: (scope) =>
				Effect.gen(function* () {
					const channels =
						scope._tag === "Guild"
							? [...(yield* history.fetchGuildChannels(scope.guildId))]
							: [
									yield* history.lookupGuildChannelFetchRequired({
										guildId: scope.guildId,
										channelId: scope.channelId,
									}),
								];
					const observedAt = new Date(yield* Clock.currentTimeMillis);
					if (scope._tag === "Guild") {
						const authoritativeIds = new Set(
							channels
								.filter(
									(channel) =>
										channel.type === ChannelType.GuildCategory ||
										supportedParent(channel),
								)
								.map(({ id }) => id),
						);
						const stored = yield* repository.storedSupportedContainers(
							scope.guildId,
						);
						const missingIds = new Set(
							stored
								.filter(({ id }) => !authoritativeIds.has(id))
								.map(({ id }) => id),
						);
						for (const container of stored) {
							if (
								!missingIds.has(container.id) ||
								(container.parentId !== null &&
									missingIds.has(container.parentId))
							) {
								continue;
							}
							yield* repository.deleteChannel({
								channelId: container.id,
								serverId: scope.guildId,
								scope:
									container.type === ChannelType.GuildCategory
										? "self"
										: "tree",
								observedAt,
							});
						}
					}
					const parents = channels.filter(supportedParent);
					const discovered: PlannedReconciliationThread[] = [];

					for (const parent of parents) {
						const facts = yield* repository.sourceFacts(parent.id);
						if (!facts?.serverActive || !facts.indexingEnabled || facts.nsfw) {
							continue;
						}
						if (!(yield* upsertChannel(parent, observedAt))) continue;
						if (scope._tag === "Thread") {
							const target = yield* history
								.lookupGuildChannelFetchRequired({
									guildId: scope.guildId,
									channelId: scope.threadId,
								})
								.pipe(
									Effect.catchTag("DiscordHistoryMissingError", () =>
										repository
											.deleteThread({
												threadId: scope.threadId,
												parentChannelId: scope.channelId,
												serverId: scope.guildId,
												observedAt: observedAt.getTime(),
											})
											.pipe(Effect.as(null)),
									),
								);
							if (target === null) return [];
							if (supportedThread(target) && target.parentId === parent.id) {
								if (!(yield* upsertChannel(target, observedAt))) continue;
								discovered.push({
									channel: target,
									guildId: scope.guildId,
									parentChannelId: parent.id,
									active: !target.archived,
								});
							}
							continue;
						}
						if (parent.type === ChannelType.GuildAnnouncement) {
							discovered.push({
								channel: parent,
								guildId: scope.guildId,
								parentChannelId: parent.id,
								active: true,
							});
						}
						const active = yield* history.fetchActiveThreads(parent);
						for (const thread of active.threads.values()) {
							if (supportedThread(thread)) {
								if (!(yield* upsertChannel(thread, observedAt))) continue;
								discovered.push({
									channel: thread,
									guildId: scope.guildId,
									parentChannelId: parent.id,
									active: true,
								});
							}
						}

						const archivedCheckpoint = yield* repository.getCheckpoint(
							parent.id,
							"archived_thread_discovery",
						);
						let before: Snowflake | Date | undefined =
							archivedCheckpoint?.scanCursor ?? undefined;
						for (
							let page = 0;
							page < options.maxArchivedPagesPerParent;
							page++
						) {
							if (discovered.length >= options.maxThreads) break;
							const archivedPage: FetchedThreadsMore =
								yield* history.fetchArchivedPublicThreadPage({
									channel: parent,
									before,
									limit: 100,
								});
							const threads: AnyThreadChannel[] = [
								...archivedPage.threads.values(),
							];
							for (const thread of threads) {
								if (supportedThread(thread)) {
									if (!(yield* upsertChannel(thread, observedAt))) continue;
									discovered.push({
										channel: thread,
										guildId: scope.guildId,
										parentChannelId: parent.id,
										active: false,
									});
								}
							}
							const nextBefore: Snowflake | undefined = threads.at(-1)?.id;
							if (!archivedPage.hasMore || !nextBefore) {
								yield* repository.resetCheckpoint({
									channelId: parent.id,
									kind: "archived_thread_discovery",
									updatedByJobId: null,
								});
								break;
							}
							before = nextBefore;
							yield* repository.upsertCheckpoint({
								channelId: parent.id,
								kind: "archived_thread_discovery",
								scanCursor: nextBefore,
								commitCursor: nextBefore,
								updatedByJobId: null,
							});
						}
					}

					return [...discovered, ...(yield* loadStored(scope))];
				}),
		};
	});

const emptySummary = (): IndexingJobSummary => ({
	planned: 0,
	processed: 0,
	committed: 0,
	skipped: 0,
	failed: 0,
	projectionsPending: 0,
});

const addSummary = (
	total: IndexingJobSummary,
	result: ReconciliationSummary,
): IndexingJobSummary => ({
	planned: total.planned + result.plannedThreads,
	processed: total.processed + result.attemptedThreads,
	committed: total.committed + result.submittedMessages,
	skipped:
		total.skipped +
		Math.max(0, result.plannedThreads - result.attemptedThreads),
	failed:
		total.failed +
		result.failedThreads +
		(result.status === "failed" && result.failedThreads === 0 ? 1 : 0),
	projectionsPending: 0,
});

export const makeReconciliationJobs = (
	options: ReconciliationJobOptions = conservativeReconciliationJobOptions,
): Effect.Effect<
	ReconciliationJobsService,
	never,
	| DiscordClient
	| DiscordHistory
	| IndexingCoordinator
	| IndexingRepository
	| Scope.Scope
> =>
	Effect.gen(function* () {
		const discord = yield* DiscordClient;
		const history = yield* DiscordHistory;
		const coordinator = yield* IndexingCoordinator;
		const repository = yield* IndexingRepository;
		const errorCapture = yield* ErrorCapture;
		const planner = yield* makeThreadPlanner(options);
		const semaphore = yield* Semaphore.make(1);
		const fibers = yield* FiberMap.make<string, void>();

		const submitGuildLeave = (guildId: string) =>
			Effect.gen(function* () {
				const submittedAt = yield* Clock.currentTimeMillis;
				const result = yield* coordinator.submit({
					id: randomUUID(),
					source: "reconciliation",
					orderingKey: `guild:${guildId}`,
					mutation: { _tag: "DeleteGuild", guildId, observedAt: submittedAt },
					submittedAt,
				});
				if (result._tag !== "Accepted") return false;
				return (yield* result.receipt.await)._tag === "Completed";
			});

		const runScope = (
			scope: ReconciliationScope,
			reconciliationOptions: ReconciliationOptions,
		) =>
			reconcileDiscordHistory(
				scope,
				reconciliationOptions,
				planner,
				history,
				coordinator,
			);

		const runJob = (
			job: DBIndexingJob,
			scopes: readonly ReconciliationScope[] | "scheduled",
			reconciliationOptions: ReconciliationOptions,
		) =>
			semaphore
				.withPermits(1)(
					Effect.gen(function* () {
						const running = yield* repository.startJob(job.id);
						if (!running) {
							yield* repository.completeJob(job.id, { status: "cancelled" });
							return;
						}

						let summary = emptySummary();
						let partial = false;
						let workScopes: readonly ReconciliationScope[];
						if (scopes === "scheduled") {
							const storedGuildIds = yield* repository.activeServerIds();
							const connected = new Set(discord.client.guilds.cache.keys());
							for (const guildId of storedGuildIds) {
								if (connected.has(guildId)) continue;
								summary = { ...summary, planned: summary.planned + 1 };
								if (yield* submitGuildLeave(guildId)) {
									summary = { ...summary, processed: summary.processed + 1 };
								} else {
									partial = true;
									summary = { ...summary, failed: summary.failed + 1 };
								}
							}
							workScopes = [...connected].map((guildId) => ({
								_tag: "Guild" as const,
								guildId,
							}));
						} else {
							workScopes = scopes;
						}

						for (const scope of workScopes) {
							const result = yield* runScope(scope, reconciliationOptions);
							summary = addSummary(summary, result);
							partial ||= result.status !== "succeeded";
						}
						if (summary.failed > 0 && summary.processed === 0) {
							yield* repository.completeJob(job.id, {
								status: "failed",
								summary,
								errorCode: "reconciliation-failed",
							});
						} else if (partial) {
							yield* repository.completeJob(job.id, {
								status: "partial",
								summary,
							});
						} else {
							yield* repository.completeJob(job.id, {
								status: "succeeded",
								summary,
							});
						}
					}),
				)
				.pipe(
					Effect.tapCause((cause) =>
						!Cause.hasInterruptsOnly(cause)
							? errorCapture.captureCause(cause, {
									boundary: "reconciliation_job",
									operation: "reconciliation.job",
									jobId: job.id,
								})
							: Effect.void,
					),
					Effect.withSpan("reconciliation.job", {
						root: true,
						attributes: {
							"operation.name": "reconciliation.job",
							jobId: job.id,
						},
					}),
					Effect.onInterrupt(() =>
						repository
							.completeJob(job.id, { status: "cancelled" })
							.pipe(Effect.ignore),
					),
					Effect.catchCause((cause) =>
						repository
							.completeJob(job.id, {
								status: "failed",
								errorCode: Cause.hasInterruptsOnly(cause)
									? "cancelled"
									: "job-failed",
							})
							.pipe(Effect.ignore),
					),
				);

		const start = (
			input: CreateIndexingJobInput,
			scopes: readonly ReconciliationScope[] | "scheduled",
			reconciliationOptions: ReconciliationOptions = options,
		) =>
			Effect.gen(function* () {
				const job = yield* repository.createJob(input);
				yield* FiberMap.run(
					fibers,
					job.id,
					runJob(job, scopes, reconciliationOptions),
					{
						onlyIfMissing: true,
					},
				);
				return job;
			});

		return {
			repairStartup: repository.repairJobs(),
			startGuild: (guildId, request = {}) =>
				start(
					{
						kind: "guild_reconciliation",
						serverId: guildId,
						channelId: null,
						trigger: request.trigger ?? "manual",
						requestedBy: request.requestedBy ?? null,
						idempotencyKey: null,
					},
					[{ _tag: "Guild", guildId }],
					request.maxThreads === undefined
						? options
						: { ...options, maxThreads: request.maxThreads },
				),
			startThread: (guildId, parentChannelId, threadId, request = {}) =>
				start(
					{
						kind: "thread_reconciliation",
						serverId: guildId,
						channelId: threadId,
						trigger: request.trigger ?? "manual",
						requestedBy: request.requestedBy ?? null,
						idempotencyKey: null,
					},
					[
						{
							_tag: "Thread",
							guildId,
							channelId: parentChannelId,
							threadId,
						},
					],
				),
			startScheduled: () =>
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					return yield* start(
						{
							kind: "full_reconciliation",
							serverId: null,
							channelId: null,
							trigger: "schedule",
							requestedBy: null,
							idempotencyKey: `scheduled:${Math.floor(now / 60_000)}`,
						},
						"scheduled",
					);
				}),
			get: repository.getJob,
			cancel: (jobId) =>
				Effect.gen(function* () {
					const job = yield* repository.requestJobCancellation(jobId);
					if (!job) return yield* repository.getJob(jobId);
					yield* FiberMap.remove(fibers, jobId);
					return yield* repository.getJob(jobId);
				}),
		};
	});

export const layerReconciliationJobs = (
	options: ReconciliationJobOptions = conservativeReconciliationJobOptions,
) => Layer.effect(ReconciliationJobs, makeReconciliationJobs(options));
