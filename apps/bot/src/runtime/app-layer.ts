import { Effect, Layer } from "effect";
import { GatewayMutationRepository } from "../adapters/gateway-mutation-repository";
import { IndexingRepository } from "../adapters/indexing-repository";
import {
	GuildInstallationRepository,
	PrivacyRepository,
} from "../adapters/repository";
import { SearchIndex } from "../adapters/search";
import { AttachmentStorage } from "../adapters/storage";
import { ManageAccount } from "../commands/manage-account";
import { CommandRegistry } from "../commands/registry";
import { BotConfig } from "../config/bot-config";
import {
	DiscordClient,
	DiscordConnection,
	DiscordStartupBarrier,
} from "../discord/client";
import { BotHttpServer } from "../http/server";
import {
	IndexingCoordinator,
	layerIndexingCoordinator,
} from "../indexing/coordinator";
import { DiscordHistory } from "../indexing/discord-history";
import { IndexingEvents, layerIndexingEvents } from "../indexing/events";
import { layerGatewayMutationInbox } from "../indexing/gateway-inbox";
import { layerReconciliationJobs } from "../indexing/jobs";
import { layerIndexMutationProcessorLive } from "../indexing/mutation";
import { layerMeiliProjector } from "../indexing/projector";
import { layerReconciliationScheduler } from "../indexing/scheduler";
import { Readiness } from "./readiness";

const config = BotConfig.layer;
const readiness = Readiness.layer;
const connection = DiscordConnection.layer;
const indexingRepository = IndexingRepository.layer;
const search = SearchIndex.layerWithConfig.pipe(Layer.provide(config));
const storage = AttachmentStorage.layerWithConfig.pipe(Layer.provide(config));
const history = DiscordHistory.layer.pipe(Layer.provide(connection));
const mutationProcessor = layerIndexMutationProcessorLive().pipe(
	Layer.provide(
		Layer.mergeAll(
			config,
			history,
			indexingRepository,
			GuildInstallationRepository.layer,
		),
	),
);
const coordinator = layerIndexingCoordinator({
	queueCapacity: 256,
	maxActivePartitions: 64,
	idleTimeToLive: "5 minutes",
}).pipe(Layer.provide(mutationProcessor));
const markCoordinatorReady = Layer.effectDiscard(
	Effect.gen(function* () {
		yield* IndexingCoordinator;
		const state = yield* Readiness;
		yield* state.setIndexingCoordinatorReady(true);
		yield* Effect.addFinalizer(() => state.setIndexingCoordinatorReady(false));
	}),
);
const coordinatorRuntime = markCoordinatorReady.pipe(
	Layer.provideMerge(Layer.merge(readiness, coordinator)),
);
const gatewayInbox = layerGatewayMutationInbox().pipe(
	Layer.provideMerge(
		Layer.merge(GatewayMutationRepository.layer, coordinatorRuntime),
	),
);
const events = layerIndexingEvents().pipe(
	Layer.provideMerge(Layer.merge(connection, gatewayInbox)),
);
const discordBarrier = Layer.effect(
	DiscordStartupBarrier,
	Effect.as(IndexingEvents, true as const),
).pipe(Layer.provideMerge(events));
const discord = DiscordClient.layerWithConfig.pipe(
	Layer.provideMerge(Layer.merge(config, discordBarrier)),
);
const reconciliationJobs = layerReconciliationJobs().pipe(
	Layer.provide(
		Layer.mergeAll(discord, history, coordinator, indexingRepository),
	),
);
const scheduler = layerReconciliationScheduler().pipe(
	Layer.provide(reconciliationJobs),
);
const privacy = Layer.merge(PrivacyRepository.layer, search);
const manageAccount = ManageAccount.layer.pipe(Layer.provide(privacy));
const dependencies = Layer.mergeAll(
	config,
	discord,
	readiness,
	manageAccount,
	search,
	storage,
	reconciliationJobs,
	scheduler,
);

const projector = layerMeiliProjector().pipe(
	Layer.provide(Layer.mergeAll(config, readiness, indexingRepository, search)),
);
const services = Layer.merge(CommandRegistry, BotHttpServer).pipe(
	Layer.provideMerge(dependencies),
);
export const AppLayer = Layer.mergeAll(services, projector);
