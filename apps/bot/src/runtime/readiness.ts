import { Context, Effect, Layer, Ref } from "effect";

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
			const update = (
				field:
					| "discord"
					| "commands"
					| "http"
					| "indexingCoordinator"
					| "gatewayMutationInbox"
					| "projector",
				value: boolean,
			) =>
				Ref.update(state, (current) => {
					const next = { ...current, [field]: value };
					return {
						...next,
						ready:
							next.discord &&
							next.commands &&
							next.http &&
							next.indexingCoordinator &&
							next.gatewayMutationInbox &&
							next.projector,
					};
				});

			return Readiness.of({
				get: Ref.get(state),
				setDiscordReady: (ready) => update("discord", ready),
				setCommandsReady: (ready) => update("commands", ready),
				setHttpReady: (ready) => update("http", ready),
				setIndexingCoordinatorReady: (ready) =>
					update("indexingCoordinator", ready),
				setGatewayMutationInboxReady: (ready) =>
					update("gatewayMutationInbox", ready),
				setProjectorReady: (ready) => update("projector", ready),
			});
		}),
	);
}
