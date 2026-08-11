import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Option, Redacted, Scope } from "effect";
import { SearchIndex } from "../adapters/search";
import { BotConfig } from "../config/bot-config";
import { ReconciliationJobs } from "../indexing/jobs";
import { Readiness } from "../runtime/readiness";
import { makeBotHttpServer } from "./server";

const config = BotConfig.of({
	discordToken: Redacted.make("discord-token"),
	environment: "test",
	developmentGuildId: "guild-1",
	developmentInstallerUserId: "user-1",
	apiPort: 8001,
	apiSecret: Redacted.make("api-secret"),
	allowedOrigins: ["http://localhost:3000"],
	meilisearch: Option.none(),
	r2: Option.none(),
});

describe("Bot HTTP server", () => {
	it.effect(
		"tracks readiness and stops accepting requests on scope close",
		() =>
			Effect.gen(function* () {
				const readiness = yield* Readiness;
				yield* readiness.setDiscordReady(true);
				yield* readiness.setCommandsReady(true);
				yield* readiness.setIndexingCoordinatorReady(true);
				yield* readiness.setGatewayMutationInboxReady(true);
				yield* readiness.setProjectorReady(true);
				const scope = yield* Scope.make();
				let stopped = false;
				let observedPort: number | undefined;
				let observedSecret: string | undefined;
				let closedActiveConnections: boolean | undefined;

				yield* makeBotHttpServer({
					makeFetch: (options) => {
						observedSecret = options.apiSecret;
						return () => new Response("OK");
					},
					serve: ({ port }) => {
						observedPort = port;
						return {
							stop: async (closeConnections) => {
								stopped = true;
								closedActiveConnections = closeConnections;
							},
						};
					},
				}).pipe(
					Effect.provideService(BotConfig, config),
					Effect.provideService(
						SearchIndex,
						SearchIndex.of({
							addDocuments: () => Effect.void,
							updateDocuments: () => Effect.void,
							deleteMessages: () => Effect.void,
							deleteThread: () => Effect.void,
							updateThreadTitle: () => Effect.void,
							search: () => Effect.die("not used"),
							health: Effect.die("not used"),
						}),
					),
					Effect.provideService(
						ReconciliationJobs,
						ReconciliationJobs.of({
							repairStartup: Effect.die("not used"),
							startGuild: () => Effect.die("not used"),
							startThread: () => Effect.die("not used"),
							startScheduled: () => Effect.die("not used"),
							get: () => Effect.die("not used"),
							cancel: () => Effect.die("not used"),
						}),
					),
					Scope.provide(scope),
				);

				assert.strictEqual(observedPort, 8001);
				assert.strictEqual(observedSecret, "api-secret");
				assert.isTrue((yield* readiness.get).ready);
				assert.isFalse(stopped);

				yield* Scope.close(scope, Exit.void);
				assert.isTrue(stopped);
				assert.isFalse(closedActiveConnections);
				assert.isFalse((yield* readiness.get).http);
			}).pipe(Effect.provide(Readiness.layer)),
	);
});
