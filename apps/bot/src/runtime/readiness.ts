import { Context, Effect, Layer, Ref, Semaphore } from "effect";
import { BotMetrics, type ReadinessComponent } from "../observability/metrics";

export interface ReadinessState {
	readonly ready: boolean;
	readonly discord: boolean;
	readonly commands: boolean;
	readonly http: boolean;
	readonly indexingCoordinator: boolean;
	readonly gatewayMutationInbox: boolean;
	readonly projector: boolean;
}

const initialState: ReadinessState = {
	ready: false,
	discord: false,
	commands: false,
	http: false,
	indexingCoordinator: false,
	gatewayMutationInbox: false,
	projector: false,
};

export class Readiness extends Context.Service<
	Readiness,
	{
		readonly get: Effect.Effect<ReadinessState>;
		readonly setDiscordReady: (ready: boolean) => Effect.Effect<void>;
		readonly setCommandsReady: (ready: boolean) => Effect.Effect<void>;
		readonly setHttpReady: (ready: boolean) => Effect.Effect<void>;
		readonly setIndexingCoordinatorReady: (
			ready: boolean,
		) => Effect.Effect<void>;
		readonly setGatewayMutationInboxReady: (
			ready: boolean,
		) => Effect.Effect<void>;
		readonly setProjectorReady: (ready: boolean) => Effect.Effect<void>;
	}
>()("velumn/bot/runtime/Readiness") {
	static readonly layer = Layer.effect(
		Readiness,
		Effect.gen(function* () {
			const state = yield* Ref.make(initialState);
			const updates = yield* Semaphore.make(1);
			yield* Effect.forEach(
				[
					"service",
					"discord",
					"commands",
					"http",
					"indexing_coordinator",
					"gateway_mutation_inbox",
					"projector",
				] as const,
				(component) => BotMetrics.setReadiness(component, false),
				{ discard: true },
			);
			const update = (
				field:
					| "discord"
					| "commands"
					| "http"
					| "indexingCoordinator"
					| "gatewayMutationInbox"
					| "projector",
				value: boolean,
				component: ReadinessComponent,
			) =>
				updates
					.withPermits(1)(
						Ref.modify(state, (current) => {
							const changed = { ...current, [field]: value };
							const next = {
								...changed,
								ready:
									changed.discord &&
									changed.commands &&
									changed.http &&
									changed.indexingCoordinator &&
									changed.gatewayMutationInbox &&
									changed.projector,
							};
							return [next, next];
						}).pipe(
							Effect.flatMap((next) =>
								Effect.all(
									[
										BotMetrics.setReadiness(component, value),
										BotMetrics.setReadiness("service", next.ready),
									],
									{ discard: true },
								),
							),
						),
					)
					.pipe(Effect.uninterruptible);

			return Readiness.of({
				get: Ref.get(state),
				setDiscordReady: (ready) => update("discord", ready, "discord"),
				setCommandsReady: (ready) => update("commands", ready, "commands"),
				setHttpReady: (ready) => update("http", ready, "http"),
				setIndexingCoordinatorReady: (ready) =>
					update("indexingCoordinator", ready, "indexing_coordinator"),
				setGatewayMutationInboxReady: (ready) =>
					update("gatewayMutationInbox", ready, "gateway_mutation_inbox"),
				setProjectorReady: (ready) => update("projector", ready, "projector"),
			});
		}),
	);
}
