import { assert, describe, it } from "@effect/vitest";
import type { DBIndexingGatewayMutation } from "@repo/db/schema/index";
import {
	Client,
	Events,
	type Message,
	type Client as ReadyClient,
} from "discord.js";
import {
	Deferred,
	Effect,
	Exit,
	Fiber,
	Layer,
	Option,
	Redacted,
	Scope,
} from "effect";
import { TestClock } from "effect/testing";
import { GatewayMutationRepository } from "../adapters/gateway-mutation-repository";
import { IndexingRepository } from "../adapters/indexing-repository";
import { SearchIndex } from "../adapters/search";
import { BotConfig } from "../config/bot-config";
import {
	DiscordConnection,
	loginDiscordConnection,
	makeDiscordConnection,
} from "../discord/client";
import { makeDiscordEvents } from "../discord/events";
import {
	IndexingCoordinator,
	layerIndexingCoordinator,
	layerIndexingCoordinatorSupervisor,
	layerIndexMutationProcessor,
} from "../indexing/coordinator";
import { layerIndexingEvents } from "../indexing/events";
import {
	GatewayMutationInbox,
	layerGatewayMutationInbox,
} from "../indexing/gateway-inbox";
import { layerMeiliProjector } from "../indexing/projector";
import { Readiness } from "./readiness";

const config = BotConfig.of({
	discordToken: Redacted.make("discord-token"),
	environment: "test",
	developmentGuildId: "guild-1",
	developmentInstallerUserId: "user-1",
	apiPort: 8001,
	apiSecret: Redacted.make("api-secret"),
	allowedOrigins: [],
	meilisearch: Option.none(),
	r2: Option.none(),
});

describe("indexing layer lifecycle", () => {
	it.effect(
		"closes after the coordinator deadline with an admitted stuck inbox item",
		() =>
			Effect.gen(function* () {
				const scope = yield* Scope.make();
				const started = yield* Deferred.make<void>();
				let claimed = false;
				let deferred = 0;
				let released = 0;
				const mutation: DBIndexingGatewayMutation = {
					id: 1,
					submissionId: "gateway:stuck",
					orderingKey: "content:thread-1",
					mutation: {
						_tag: "DeleteMessage",
						messageId: "message-1",
						channelId: "thread-1",
						threadId: "thread-1",
						observedAt: 0,
					},
					submittedAt: new Date(0),
					status: "processing",
					attemptCount: 1,
					nextAttemptAt: new Date(0),
					leaseOwner: "shutdown-inbox",
					leaseExpiresAt: new Date(100_000),
					lastErrorCode: null,
					createdAt: new Date(0),
					updatedAt: new Date(0),
				};
				const repository = GatewayMutationRepository.of({
					enqueue: () => Effect.die("unused"),
					claim: () =>
						Effect.sync(() => {
							if (claimed) return [];
							claimed = true;
							return [mutation];
						}),
					complete: () => Effect.die("stuck work must not complete"),
					defer: () =>
						Effect.sync(() => {
							deferred += 1;
						}),
					renew: () => Effect.void,
					release: () =>
						Effect.sync(() => {
							released += 1;
						}),
				});
				const coordinator = layerIndexingCoordinator({
					queueCapacity: 4,
					maxActivePartitions: 4,
					idleTimeToLive: "1 minute",
				}).pipe(
					Layer.provide(
						layerIndexMutationProcessor(() =>
							Deferred.succeed(started, undefined).pipe(
								Effect.andThen(Effect.never),
							),
						),
					),
				);
				const root = layerGatewayMutationInbox({
					leaseOwner: "shutdown-inbox",
					batchSize: 1,
					concurrency: 1,
					leaseDurationMs: 100_000,
					initialRetryDelayMs: 10,
					maximumRetryDelayMs: 100,
					pollingIntervalMs: 10,
				}).pipe(
					Layer.provideMerge(
						Layer.mergeAll(
							Layer.succeed(GatewayMutationRepository, repository),
							coordinator,
							Readiness.layer,
						),
					),
				);

				yield* Layer.build(root).pipe(Scope.provide(scope));
				yield* Deferred.await(started);
				const closeFiber = yield* Effect.forkChild(
					Scope.close(scope, Exit.void),
				);
				yield* Effect.yieldNow;
				assert.isUndefined(closeFiber.pollUnsafe());
				yield* TestClock.adjust("3 seconds");
				yield* Fiber.join(closeFiber);

				assert.equal(deferred, 1);
				assert.equal(released, 1);
			}),
	);

	it.effect(
		"keeps the root inbox polling after acquisition and listener enqueue",
		() =>
			Effect.gen(function* () {
				const client = new Client({ intents: [] });
				const readiness = yield* Readiness;
				const scope = yield* Scope.make();
				const enqueued = yield* Deferred.make<void>();
				const pending: DBIndexingGatewayMutation[] = [];
				let nextId = 1;
				let claimCount = 0;
				let completedCount = 0;
				let coordinatorFinalized = false;
				const repository = GatewayMutationRepository.of({
					enqueue: (input) =>
						Effect.gen(function* () {
							const row: DBIndexingGatewayMutation = {
								id: nextId++,
								submissionId: input.submissionId,
								orderingKey: input.orderingKey,
								mutation: input.mutation,
								submittedAt: input.submittedAt,
								status: "pending",
								attemptCount: 0,
								nextAttemptAt: new Date(0),
								leaseOwner: null,
								leaseExpiresAt: null,
								lastErrorCode: null,
								createdAt: new Date(0),
								updatedAt: new Date(0),
							};
							pending.push(row);
							yield* Deferred.succeed(enqueued, undefined);
							return row;
						}),
					claim: (input) =>
						Effect.sync(() => {
							claimCount += 1;
							return pending.splice(0, input.limit).map((row) => ({
								...row,
								status: "processing" as const,
								attemptCount: row.attemptCount + 1,
								leaseOwner: input.leaseOwner,
								leaseExpiresAt: input.leaseExpiresAt,
							}));
						}),
					complete: () =>
						Effect.sync(() => {
							completedCount += 1;
						}),
					defer: () => Effect.void,
					renew: () => Effect.void,
					release: () => Effect.void,
				});
				const coordinator = IndexingCoordinator.of({
					submit: (submission) =>
						Effect.succeed({
							_tag: "Accepted" as const,
							receipt: {
								await: Effect.succeed({
									_tag: "Completed" as const,
									submissionId: submission.id,
									completedAt: submission.submittedAt,
								}),
							},
						}),
					state: Effect.succeed({ accepting: true, outstanding: 0 }),
					close: Effect.void,
				});
				const coordinatorLayer = Layer.effect(
					IndexingCoordinator,
					Effect.acquireRelease(Effect.succeed(coordinator), () =>
						readiness.get.pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									coordinatorFinalized = true;
								}),
							),
							Effect.asVoid,
						),
					),
				);
				const connection = Layer.effect(
					DiscordConnection,
					makeDiscordEvents(client).pipe(
						Effect.map((events) => DiscordConnection.of({ client, events })),
					),
				);
				const inbox = layerGatewayMutationInbox({
					leaseOwner: "integration-inbox",
					batchSize: 2,
					concurrency: 1,
					leaseDurationMs: 1_000,
					initialRetryDelayMs: 10,
					maximumRetryDelayMs: 100,
					pollingIntervalMs: 10,
				}).pipe(
					Layer.provideMerge(
						Layer.mergeAll(
							Layer.succeed(GatewayMutationRepository, repository),
							coordinatorLayer,
							layerIndexingCoordinatorSupervisor,
							Layer.succeed(Readiness, readiness),
						),
					),
				);
				const root = layerIndexingEvents().pipe(
					Layer.provideMerge(Layer.merge(connection, inbox)),
				);

				yield* Layer.build(root).pipe(Scope.provide(scope));
				assert.equal(claimCount, 1);
				assert.isTrue((yield* readiness.get).gatewayMutationInbox);
				assert.isAbove(client.listenerCount(Events.MessageCreate), 0);

				client.emit(Events.MessageCreate, {
					id: "message-1",
					channelId: "thread-1",
					guildId: "guild-1",
					channel: { isThread: () => true },
				} as Message<true>);
				yield* Deferred.await(enqueued);
				yield* TestClock.adjust("10 millis");
				yield* Effect.yieldNow;
				assert.equal(completedCount, 1);
				const claimsAfterMutation = claimCount;

				yield* TestClock.adjust("30 millis");
				yield* Effect.yieldNow;
				assert.isAbove(claimCount, claimsAfterMutation);

				yield* Scope.close(scope, Exit.void);
				assert.equal(client.listenerCount(Events.MessageCreate), 0);
				assert.isFalse((yield* readiness.get).gatewayMutationInbox);
				assert.isTrue(coordinatorFinalized);
				const claimsAfterClose = claimCount;
				yield* TestClock.adjust("30 millis");
				assert.equal(claimCount, claimsAfterClose);
			}).pipe(Effect.provide(Readiness.layer)),
	);

	it.effect("degrades readiness when the root inbox poll fiber defects", () =>
		Effect.gen(function* () {
			const readiness = yield* Readiness;
			const scope = yield* Scope.make();
			const repository = GatewayMutationRepository.of({
				enqueue: () => Effect.die("unused"),
				claim: () => Effect.die("poll defect"),
				complete: () => Effect.void,
				defer: () => Effect.void,
				renew: () => Effect.void,
				release: () => Effect.void,
			});
			const coordinator = IndexingCoordinator.of({
				submit: () => Effect.die("unused"),
				state: Effect.succeed({ accepting: true, outstanding: 0 }),
				close: Effect.void,
			});
			const root = layerGatewayMutationInbox({
				leaseOwner: "defect-inbox",
				batchSize: 1,
				concurrency: 1,
				leaseDurationMs: 1_000,
				initialRetryDelayMs: 10,
				maximumRetryDelayMs: 100,
				pollingIntervalMs: 10,
			}).pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						Layer.succeed(GatewayMutationRepository, repository),
						Layer.succeed(IndexingCoordinator, coordinator),
						layerIndexingCoordinatorSupervisor,
						Layer.succeed(Readiness, readiness),
					),
				),
			);

			yield* Layer.build(root).pipe(Scope.provide(scope));
			yield* Effect.yieldNow;
			assert.isFalse((yield* readiness.get).gatewayMutationInbox);
			yield* Scope.close(scope, Exit.void);
		}).pipe(Effect.provide(Readiness.layer)),
	);

	it.effect(
		"registers indexing events before login and removes them on close",
		() =>
			Effect.gen(function* () {
				const client = new Client({ intents: [] });
				const scope = yield* Scope.make();
				let destroyed = false;
				client.destroy = async () => {
					destroyed = true;
				};
				const connection = yield* makeDiscordConnection({
					makeClient: () => client,
				}).pipe(Scope.provide(scope));
				const coordinator = IndexingCoordinator.of({
					submit: () => Effect.succeed({ _tag: "Closing" }),
					state: Effect.succeed({ accepting: true, outstanding: 0 }),
					close: Effect.void,
				});

				yield* Layer.build(
					layerIndexingEvents().pipe(
						Layer.provide(
							Layer.merge(
								Layer.succeed(DiscordConnection, connection),
								Layer.merge(
									Layer.succeed(IndexingCoordinator, coordinator),
									Layer.succeed(
										GatewayMutationInbox,
										GatewayMutationInbox.of({ enqueue: () => Effect.void }),
									),
								),
							),
						),
					),
				).pipe(Scope.provide(scope));

				assert.isAbove(client.listenerCount(Events.MessageCreate), 0);
				yield* loginDiscordConnection(connection, Redacted.make("token"), {
					login: async (loginClient) => {
						assert.isAbove(loginClient.listenerCount(Events.MessageCreate), 0);
						assert.isAbove(loginClient.listenerCount(Events.ClientReady), 1);
						queueMicrotask(() =>
							loginClient.emit(
								Events.ClientReady,
								loginClient as ReadyClient<true>,
							),
						);
						return "token";
					},
				});

				yield* Scope.close(scope, Exit.void);
				assert.equal(client.listenerCount(Events.MessageCreate), 0);
				assert.isTrue(destroyed);
			}),
	);

	it.effect("marks an optional projector ready and resets it on close", () =>
		Effect.gen(function* () {
			const readiness = yield* Readiness;
			const scope = yield* Scope.make();
			yield* Layer.build(
				layerMeiliProjector({
					leaseOwner: "test-projector",
					batchSize: 1,
					partitionConcurrency: 1,
					leaseDurationMs: 1_000,
					initialRetryDelayMs: 1,
					maximumRetryDelayMs: 1,
					maximumAttemptCount: 2,
					pollingIntervalMs: 1,
				}).pipe(
					Layer.provide(
						Layer.mergeAll(
							Layer.succeed(BotConfig, config),
							Layer.succeed(Readiness, readiness),
							IndexingRepository.layer,
							SearchIndex.layerWithConfig.pipe(
								Layer.provide(Layer.succeed(BotConfig, config)),
							),
						),
					),
				),
			).pipe(Scope.provide(scope));

			assert.isTrue((yield* readiness.get).projector);
			yield* Scope.close(scope, Exit.void);
			assert.isFalse((yield* readiness.get).projector);
		}).pipe(Effect.provide(Readiness.layer)),
	);
});
